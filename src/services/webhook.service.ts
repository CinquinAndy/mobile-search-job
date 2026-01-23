import type {
  ResendWebhookEventType,
  ResendWebhookPayload,
} from "@/types/webhook";
import { WEBHOOK_TO_EMAIL_STATUS } from "@/types/webhook";
import { pbAdmin } from "./pocketbase.server";

// Default user ID for single-user app (Andy's account)
const DEFAULT_USER_ID = "zdc29r3eunp1318";

/**
 * Helper to identify if a domain is a generic provider (Gmail, etc.)
 */
const GENERIC_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "me.com"];

/**
 * Helper to extract domain from email address
 */
function extractDomain(email: string): string {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase().trim() : "";
}

/**
 * Helper to get an entity identifier for a recipient.
 * For common providers (Gmail, etc.), we use the full email.
 * For professional domains, we use just the domain.
 */
function getEntityIdentifier(email: string): string {
  const domain = extractDomain(email);
  if (GENERIC_DOMAINS.includes(domain)) {
    return email.toLowerCase().trim();
  }
  return domain;
}

/**
 * Webhook processing service for Resend events
 */
export const webhookService = {
  /**
   * Process a Resend webhook event
   */
  async processWebhookEvent(payload: ResendWebhookPayload): Promise<{
    success: boolean;
    action: string;
    details?: Record<string, unknown>;
  }> {
    const { type, data } = payload;
    const emailId = data.email_id;
    const status = WEBHOOK_TO_EMAIL_STATUS[type as ResendWebhookEventType];

    console.info(`[Webhook] Processing ${type} for email ${emailId}`);

    try {
      // 1. Update email in emails collection (if it exists)
      const emailUpdated = await this.updateEmailStatus(emailId, type, payload);

      // 2. Find or create company from recipient
      let companyId: string | null = null;
      let applicationId: string | null = null;
      let isFollowUp = false;

      if (data.to && data.to.length > 0) {
        const recipientRaw = data.to[0];
        // Extract email from "Name <email>" if present
        const recipientMatch = recipientRaw.match(/<(.+?)>/);
        const recipientEmail = recipientMatch?.[1] || recipientRaw;
        
        // Check if this event is for a Bcc recipient
        // Resend sends separate events for Bcc, check headers
        const headers = (payload as any).data?.headers || [];
        const bccHeader = headers.find((h: any) => h.name === "Bcc");
        const isBccEvent = bccHeader && bccHeader.value.includes(recipientEmail);
        
        // Skip processing if this is a Bcc event to avoid duplicate applications
        if (isBccEvent) {
          console.info(`[Webhook] Skipping Bcc event for ${recipientEmail}`);
          return {
            success: true,
            action: `skipped_bcc_${type}`,
            details: { emailId, recipientEmail, reason: "bcc_recipient" },
          };
        }
        
        const domain = extractDomain(recipientEmail);
        
        // Only skip our own domains (sender domains)
        const myDomains = ["andy-cinquin.com", "cinquin-andy.fr"];
        if (domain && !myDomains.includes(domain)) {
          // Find or create company and application
          const result = await this.findOrCreateCompanyAndApplication(
            recipientEmail,
            data.subject || "(No Subject)",
            type === "email.sent", // Only create/update on first event (email.sent)
          );
          companyId = result.companyId;
          applicationId = result.applicationId;
          isFollowUp = result.isFollowUp;
        }
      }

      // 3. Create or update email log (linked to application)
      const emailLogId = await this.upsertEmailLog(
        emailId,
        type,
        payload,
        companyId,
        applicationId,
      );

      // 4. Update application last_activity_at
      if (applicationId) {
        await this.updateApplicationActivity(applicationId);
      }

      return {
        success: true,
        action: `processed_${type}`,
        details: {
          emailId,
          status,
          emailUpdated,
          companyId,
          applicationId,
          isFollowUp,
          emailLogId,
        },
      };
    } catch (error) {
      console.error(`[Webhook] Error processing ${type}:`, error);
      throw error;
    }
  },

  /**
   * Update email status in emails collection, or create if not exists
   */
  async updateEmailStatus(
    resendId: string,
    eventType: ResendWebhookEventType,
    payload: ResendWebhookPayload,
  ): Promise<boolean> {
    try {
      const status = WEBHOOK_TO_EMAIL_STATUS[eventType];
      
      // Find email by resend_id
      const email = await pbAdmin
        .collection("emails")
        .getFirstListItem(`resend_id = "${resendId}"`)
        .catch(() => null);

      if (!email) {
        // Email doesn't exist yet - create it with full details from Resend API
        console.info(`[Webhook] No email found with resend_id ${resendId}, fetching full details from Resend`);
        
        // Fetch full email details from Resend API
        const { resendService } = await import("./resend.service");
        let fullEmailData: { html?: string | null; text?: string | null } = {};
        
        try {
          const emailDetails = await resendService.getEmail(resendId);
          fullEmailData = {
            html: emailDetails.html,
            text: emailDetails.text,
          };
          console.info(`[Webhook] Fetched email content from Resend for ${resendId}`);
        } catch (fetchError) {
          console.warn(`[Webhook] Could not fetch email content from Resend: ${fetchError}`);
          // Continue without content - we'll still create the email record
        }
        
        // Parse sender email
        const senderMatch = payload.data.from?.match(/<(.+?)>/) || [null, payload.data.from];
        const senderEmail = senderMatch[1] || payload.data.from || "contact@andy-cinquin.com";
        const senderName = payload.data.from?.replace(/<.+>/, "").trim() || "Andy Cinquin";
        
        // Create the email record with full content
        const newEmailData = {
          resend_id: resendId,
          folder: "sent",
          from_email: senderEmail,
          from_name: senderName,
          to_emails: (payload.data.to || []).map(to => {
            const match = to.match(/<(.+?)>/);
            return { email: match?.[1] || to, name: to.replace(/<.+>/, "").trim() || undefined };
          }),
          cc_emails: [],
          bcc_emails: [],
          subject: payload.data.subject || "(No Subject)",
          body_html: fullEmailData.html || null,
          body_text: fullEmailData.text || null,
          status,
          is_read: true,
          is_starred: false,
          has_attachments: false,
          sent_at: payload.data.created_at,
          user: DEFAULT_USER_ID,
        };

        await pbAdmin.collection("emails").create(newEmailData);
        console.info(`[Webhook] Created email from webhook for ${resendId} with full content`);
        return true;
      }

      // Email exists - update it
      const updates: Record<string, unknown> = {
        status,
      };

      // Add timestamp based on event type
      if (eventType === "email.opened") {
        updates.opened_at = payload.created_at;
      } else if (eventType === "email.clicked") {
        updates.clicked_at = payload.created_at;
      } else if (eventType === "email.bounced") {
        updates.bounced_at = payload.created_at;
      } else if (eventType === "email.delivered") {
        updates.delivered_at = payload.created_at;
      }

      await pbAdmin.collection("emails").update(email.id, updates);
      console.info(`[Webhook] Updated email ${email.id} status to ${status}`);
      return true;
    } catch (error) {
      console.error(`[Webhook] Failed to update email status:`, error);
      return false;
    }
  },
  /**
   * Find or create company AND application, handling follow-ups
   * Returns company ID, application ID, and whether this is a follow-up
   */
  async findOrCreateCompanyAndApplication(
    recipientEmail: string,
    subject: string,
    shouldCreateOrUpdate: boolean,
  ): Promise<{ companyId: string | null; applicationId: string | null; isFollowUp: boolean }> {
    const identifier = getEntityIdentifier(recipientEmail);
    const domain = extractDomain(recipientEmail);
    
    if (!identifier) {
      return { companyId: null, applicationId: null, isFollowUp: false };
    }

    try {
      // 1. Find or create company
      let company = await pbAdmin
        .collection("companies")
        .getFirstListItem(`domain = "${identifier}"`)
        .catch(() => null);

      if (!company && shouldCreateOrUpdate) {
        // Create company with domain as name (will be enriched later)
        let companyName = "";
        if (identifier.includes("@")) {
          // It's a full email address (generic provider)
          companyName = identifier.split("@")[0];
        } else {
          // It's a domain
          companyName = identifier.split(".")[0];
        }
        
        const newCompany = await pbAdmin.collection("companies").create({
          name: companyName.charAt(0).toUpperCase() + companyName.slice(1),
          domain: identifier,
          user: DEFAULT_USER_ID,
        });
        company = newCompany;
        console.info(`[Webhook] Created company ${newCompany.id} for identifier ${identifier}`);
      }

      if (!company) {
        return { companyId: null, applicationId: null, isFollowUp: false };
      }

      // 2. Find or create application for this company
      let application = await pbAdmin
        .collection("applications")
        .getFirstListItem(`company = "${company.id}"`)
        .catch(() => null);

      let isFollowUp = false;

      if (application && shouldCreateOrUpdate) {
        // Application exists → This is a FOLLOW-UP
        isFollowUp = true;
        const currentCount = application.follow_up_count || 0;
        
        await pbAdmin.collection("applications").update(application.id, {
          follow_up_count: currentCount + 1,
          last_follow_up_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        });
        
        console.info(`[Webhook] Follow-up #${currentCount + 1} for application ${application.id} (${domain})`);
      } else if (!application && shouldCreateOrUpdate) {
        // No application → This is a FIRST CONTACT
        const newApplication = await pbAdmin.collection("applications").create({
          company: company.id,
          position: subject.includes("Développeur") ? subject : "Candidature spontanée",
          status: "sent",
          user: DEFAULT_USER_ID,
          first_contact_at: new Date().toISOString(),
          follow_up_count: 0,
        });
        application = newApplication;
        console.info(`[Webhook] Created application ${newApplication.id} (first contact) for ${domain}`);
      }

      return {
        companyId: company.id,
        applicationId: application?.id || null,
        isFollowUp,
      };
    } catch (error) {
      console.error(`[Webhook] Error in findOrCreateCompanyAndApplication:`, error);
      return { companyId: null, applicationId: null, isFollowUp: false };
    }
  },

  /**
   * Update application's last_activity_at
   */
  async updateApplicationActivity(applicationId: string): Promise<void> {
    try {
      await pbAdmin.collection("applications").update(applicationId, {
        last_activity_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[Webhook] Error updating application activity:`, error);
    }
  },

  /**
   * Create or update email log entry
   */
  async upsertEmailLog(
    resendId: string,
    eventType: ResendWebhookEventType,
    payload: ResendWebhookPayload,
    companyId: string | null,
    applicationId: string | null,
  ): Promise<string | null> {
    try {
      const status = WEBHOOK_TO_EMAIL_STATUS[eventType];
      const direction = "outbound"; // Webhooks are for sent emails

      // Try to find existing email_log by external_id
      const existingLog = await pbAdmin
        .collection("email_logs")
        .getFirstListItem(`external_id = "${resendId}" && provider = "resend"`)
        .catch(() => null);

      // Parse recipient email (extract from "Name <email>" format if needed)
      const recipientRaw = payload.data.to?.[0] || "";
      const recipientMatch = recipientRaw.match(/<(.+?)>/);
      const recipientEmail = recipientMatch?.[1] || recipientRaw;

      // Parse sender email (extract from "Name <email>" format if needed)
      const senderRaw = payload.data.from || "";
      const senderMatch = senderRaw.match(/<(.+?)>/);
      const senderEmail = senderMatch?.[1] || senderRaw;

      const logData: Record<string, unknown> = {
        external_id: resendId,
        provider: "resend",
        direction,
        recipient: recipientEmail || undefined,
        sender: senderEmail || undefined,
        subject: payload.data.subject || "",
        status,
        sent_at: payload.data.created_at,
        raw_payload: payload,
      };

      if (companyId) {
        logData.company = companyId;
      }

      if (applicationId) {
        logData.application = applicationId;
      }

      if (existingLog) {
        // Update existing log - keep the user relation
        await pbAdmin.collection("email_logs").update(existingLog.id, {
          status,
          raw_payload: payload,
        });
        console.info(`[Webhook] Updated email_log ${existingLog.id}`);
        return existingLog.id;
      }

      // For new logs, try to find user from linked email, otherwise use default
      const linkedEmail = await pbAdmin
        .collection("emails")
        .getFirstListItem(`resend_id = "${resendId}"`)
        .catch(() => null);

      // Use linked email's user or fall back to default user
      logData.user = linkedEmail?.user || DEFAULT_USER_ID;
      
      const newLog = await pbAdmin.collection("email_logs").create(logData);
      console.info(`[Webhook] Created email_log ${newLog.id} for user ${logData.user}`);
      return newLog.id;
    } catch (error) {
      console.error(`[Webhook] Error upserting email_log:`, error);
      return null;
    }
  },
};

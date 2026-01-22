import type {
  ResendWebhookEventType,
  ResendWebhookPayload,
} from "@/types/webhook";
import { WEBHOOK_TO_EMAIL_STATUS } from "@/types/webhook";
import { pbAdmin } from "./pocketbase.server";

/**
 * Helper to extract domain from email address
 */
function extractDomain(email: string): string {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase() : "";
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
      if (data.to && data.to.length > 0) {
        const recipientEmail = data.to[0];
        companyId = await this.findOrCreateCompany(recipientEmail);
      }

      // 3. Create or update email log
      const emailLogId = await this.upsertEmailLog(
        emailId,
        type,
        payload,
        companyId,
      );

      // 4. Update application status if linked
      await this.updateLinkedApplication(emailId, type);

      return {
        success: true,
        action: `processed_${type}`,
        details: {
          emailId,
          status,
          emailUpdated,
          companyId,
          emailLogId,
        },
      };
    } catch (error) {
      console.error(`[Webhook] Error processing ${type}:`, error);
      throw error;
    }
  },

  /**
   * Update email status in emails collection
   */
  async updateEmailStatus(
    resendId: string,
    eventType: ResendWebhookEventType,
    payload: ResendWebhookPayload,
  ): Promise<boolean> {
    try {
      // Find email by resend_id
      const email = await pbAdmin
        .collection("emails")
        .getFirstListItem(`resend_id = "${resendId}"`)
        .catch(() => null);

      if (!email) {
        console.info(`[Webhook] No email found with resend_id ${resendId}`);
        return false;
      }

      const status = WEBHOOK_TO_EMAIL_STATUS[eventType];
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
   * Find or create a company based on recipient email domain
   */
  async findOrCreateCompany(recipientEmail: string): Promise<string | null> {
    const domain = extractDomain(recipientEmail);

    if (!domain || domain === "andy-cinquin.com" || domain === "gmail.com") {
      // Skip our own domain or common email providers
      return null;
    }

    try {
      // Try to find existing company by domain
      // Note: We search across all users since webhooks don't have user context
      const existingCompany = await pbAdmin
        .collection("companies")
        .getFirstListItem(`domain = "${domain}"`)
        .catch(() => null);

      if (existingCompany) {
        return existingCompany.id;
      }

      // No company found - we can't create without a user context
      // The company will be created when the email is synced with a user
      console.info(`[Webhook] No company found for domain ${domain}`);
      return null;
    } catch (error) {
      console.error(`[Webhook] Error finding company:`, error);
      return null;
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
  ): Promise<string | null> {
    try {
      const status = WEBHOOK_TO_EMAIL_STATUS[eventType];
      const direction = "outbound"; // Webhooks are for sent emails

      // Try to find existing email_log by external_id
      const existingLog = await pbAdmin
        .collection("email_logs")
        .getFirstListItem(`external_id = "${resendId}" && provider = "resend"`)
        .catch(() => null);

      const logData: Record<string, unknown> = {
        external_id: resendId,
        provider: "resend",
        direction,
        recipient: payload.data.to?.[0] || "",
        sender: payload.data.from || "",
        subject: payload.data.subject || "",
        status,
        sent_at: payload.data.created_at,
        raw_payload: payload,
      };

      if (companyId) {
        logData.company = companyId;
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

      // For new logs, we need a user - try to find from linked email
      const linkedEmail = await pbAdmin
        .collection("emails")
        .getFirstListItem(`resend_id = "${resendId}"`)
        .catch(() => null);

      if (linkedEmail?.user) {
        logData.user = linkedEmail.user;
        const newLog = await pbAdmin.collection("email_logs").create(logData);
        console.info(`[Webhook] Created email_log ${newLog.id}`);
        return newLog.id;
      }

      console.info(`[Webhook] Cannot create email_log without user context`);
      return null;
    } catch (error) {
      console.error(`[Webhook] Error upserting email_log:`, error);
      return null;
    }
  },

  /**
   * Update linked application's last_activity_at
   */
  async updateLinkedApplication(
    resendId: string,
    _eventType: ResendWebhookEventType,
  ): Promise<boolean> {
    try {
      // Find email_log linked to an application
      const emailLog = await pbAdmin
        .collection("email_logs")
        .getFirstListItem(`external_id = "${resendId}" && provider = "resend"`)
        .catch(() => null);

      if (!emailLog?.application) {
        return false;
      }

      // Update application's last_activity_at
      await pbAdmin.collection("applications").update(emailLog.application, {
        last_activity_at: new Date().toISOString(),
      });

      console.info(
        `[Webhook] Updated application ${emailLog.application} activity`,
      );
      return true;
    } catch (error) {
      console.error(`[Webhook] Error updating application:`, error);
      return false;
    }
  },
};

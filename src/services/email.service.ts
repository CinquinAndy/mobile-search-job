import type {
  Email,
  EmailAddress,
  EmailFilters,
  EmailThread,
  SendEmailParams,
} from "@/types/email";
import { EmailFolder, EmailStatus } from "@/types/email";
import { resendService } from "./resend.service";

/**
 * Email service for managing emails, drafts, and email operations
 */

// Helper to convert Resend email to our Email type
function convertResendEmail(
  resendEmail: {
    id: string;
    to: string[];
    subject: string;
    created_at: string;
    status?: string;
    from?: string;
    html?: string | null;
    text?: string | null;
  },
  folder: EmailFolder = EmailFolder.SENT,
): Email {
  return {
    id: resendEmail.id,
    resendId: resendEmail.id,
    from: {
      email: resendEmail.from || "unknown@example.com",
    },
    to: resendEmail.to.map((email) => ({ email })),
    subject: resendEmail.subject,
    body: resendEmail.text || "",
    html: resendEmail.html || undefined,
    status: (resendEmail.status as EmailStatus) || EmailStatus.DELIVERED,
    folder,
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    sentAt: resendEmail.created_at,
    createdAt: resendEmail.created_at,
    updatedAt: resendEmail.created_at,
  };
}

// Helper to parse email address
function parseEmailAddress(email: string | EmailAddress): string {
  return typeof email === "string" ? email : email.email;
}

export const emailService = {
  /**
   * Get all sent emails from Resend
   */
  async getSentEmails(): Promise<Email[]> {
    try {
      const resendEmails = await resendService.listAllEmails();

      // Convert to our Email type using basic info only
      // We don't fetch full details to avoid rate limiting
      const emails: Email[] = resendEmails.map((resendEmail) =>
        convertResendEmail(resendEmail, EmailFolder.SENT),
      );

      return emails;
    } catch (error) {
      console.error("Failed to fetch sent emails:", error);
      throw error;
    }
  },

  /**
   * Get inbox emails (received emails from Resend)
   */
  async getInbox(): Promise<Email[]> {
    try {
      const receivedEmails = await resendService.listAllReceivedEmails();

      // Convert to our Email type using basic info
      // We don't fetch full details to avoid rate limiting
      const emails: Email[] = receivedEmails.map((receivedEmail) =>
        convertResendEmail(
          {
            id: receivedEmail.id,
            to: receivedEmail.to,
            from: receivedEmail.from,
            subject: receivedEmail.subject,
            created_at: receivedEmail.created_at,
            html: null,
            text: null,
          },
          EmailFolder.INBOX,
        ),
      );

      return emails;
    } catch (error) {
      console.error("Failed to fetch received emails:", error);
      // Fallback to empty array if receiving is not set up
      return [];
    }
  },

  /**
   * Send a new email
   */
  async sendEmail(params: SendEmailParams): Promise<{ id: string }> {
    try {
      const result = await resendService.sendEmail({
        to: params.to,
        from: params.from,
        subject: params.subject,
        html: params.html,
        text: params.text,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        tags: params.tags,
      });

      if (!result?.id) {
        throw new Error("Failed to send email - no ID returned");
      }

      return { id: result.id };
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  },

  /**
   * Reply to an email
   */
  async replyToEmail(
    originalEmailId: string,
    params: {
      to: EmailAddress[];
      subject: string;
      body: string;
      html?: string;
      cc?: EmailAddress[];
      includeOriginal?: boolean;
    },
  ): Promise<{ id: string }> {
    try {
      // Get original email for context
      const originalEmail =
        await resendService.getEmailContent(originalEmailId);

      let bodyWithContext = params.body;
      let htmlWithContext = params.html;

      if (params.includeOriginal && originalEmail) {
        // Add original message to reply
        const originalText = `\n\n--- Original Message ---\nFrom: ${originalEmail.from}\nDate: ${originalEmail.created_at}\nSubject: ${originalEmail.subject}\n\n${originalEmail.text || ""}`;

        bodyWithContext = params.body + originalText;

        if (params.html && originalEmail.html) {
          htmlWithContext = `
            ${params.html}
            <hr>
            <p><strong>Original Message</strong></p>
            <p><strong>From:</strong> ${originalEmail.from}</p>
            <p><strong>Date:</strong> ${originalEmail.created_at}</p>
            <p><strong>Subject:</strong> ${originalEmail.subject}</p>
            <br>
            ${originalEmail.html}
          `;
        }
      }

      return this.sendEmail({
        to: params.to.map(parseEmailAddress),
        cc: params.cc?.map(parseEmailAddress),
        subject: params.subject.startsWith("Re: ")
          ? params.subject
          : `Re: ${params.subject}`,
        text: bodyWithContext,
        html: htmlWithContext,
        // Reference original email
        replyTo: originalEmail?.from,
      });
    } catch (error) {
      console.error("Failed to reply to email:", error);
      throw error;
    }
  },

  /**
   * Forward an email
   */
  async forwardEmail(
    originalEmailId: string,
    params: {
      to: EmailAddress[];
      additionalMessage?: string;
    },
  ): Promise<{ id: string }> {
    try {
      const originalEmail =
        await resendService.getEmailContent(originalEmailId);

      if (!originalEmail) {
        throw new Error("Original email not found");
      }

      const forwardText = `${params.additionalMessage ? `${params.additionalMessage}\n\n` : ""}
--- Forwarded Message ---
From: ${originalEmail.from}
Date: ${originalEmail.created_at}
Subject: ${originalEmail.subject}

${originalEmail.text || ""}`;

      const forwardHtml = originalEmail.html
        ? `
            ${params.additionalMessage ? `<p>${params.additionalMessage}</p>` : ""}
            <hr>
            <p><strong>Forwarded Message</strong></p>
            <p><strong>From:</strong> ${originalEmail.from}</p>
            <p><strong>Date:</strong> ${originalEmail.created_at}</p>
            <p><strong>Subject:</strong> ${originalEmail.subject}</p>
            <br>
            ${originalEmail.html}
          `
        : undefined;

      return this.sendEmail({
        to: params.to.map(parseEmailAddress),
        subject: `Fwd: ${originalEmail.subject}`,
        text: forwardText,
        html: forwardHtml,
      });
    } catch (error) {
      console.error("Failed to forward email:", error);
      throw error;
    }
  },

  /**
   * Get email details by ID
   */
  async getEmailById(id: string): Promise<Email | null> {
    try {
      const details = await resendService.getEmailContent(id);
      if (!details) return null;

      return convertResendEmail(details);
    } catch (error) {
      console.error(`Failed to fetch email ${id}:`, error);
      return null;
    }
  },

  /**
   * Filter emails based on criteria
   */
  filterEmails(emails: Email[], filters: EmailFilters): Email[] {
    return emails.filter((email) => {
      if (filters.folder && email.folder !== filters.folder) return false;
      if (filters.status && email.status !== filters.status) return false;
      if (filters.isRead !== undefined && email.isRead !== filters.isRead)
        return false;
      if (
        filters.isStarred !== undefined &&
        email.isStarred !== filters.isStarred
      )
        return false;
      if (
        filters.hasAttachments !== undefined &&
        email.hasAttachments !== filters.hasAttachments
      )
        return false;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSubject = email.subject
          .toLowerCase()
          .includes(searchLower);
        const matchesBody = email.body.toLowerCase().includes(searchLower);
        const matchesFrom = email.from.email
          .toLowerCase()
          .includes(searchLower);
        const matchesTo = email.to.some((addr) =>
          addr.email.toLowerCase().includes(searchLower),
        );

        if (!matchesSubject && !matchesBody && !matchesFrom && !matchesTo) {
          return false;
        }
      }

      if (filters.dateFrom) {
        const emailDate = new Date(email.sentAt || email.createdAt);
        if (emailDate < new Date(filters.dateFrom)) return false;
      }

      if (filters.dateTo) {
        const emailDate = new Date(email.sentAt || email.createdAt);
        if (emailDate > new Date(filters.dateTo)) return false;
      }

      return true;
    });
  },

  /**
   * Group emails into threads by subject and participants
   */
  groupIntoThreads(emails: Email[]): EmailThread[] {
    const threads = new Map<string, EmailThread>();

    for (const email of emails) {
      // Create a thread key based on normalized subject and participants
      const normalizedSubject = email.subject
        .replace(/^(Re:|Fwd:)\s*/gi, "")
        .trim()
        .toLowerCase();

      const participants = [
        email.from.email,
        ...email.to.map((addr) => addr.email),
      ].sort();

      const threadKey = `${normalizedSubject}-${participants.join(",")}`;

      if (threads.has(threadKey)) {
        const thread = threads.get(threadKey);
        if (thread) {
          thread.emails.push(email);
          thread.messageCount++;
          thread.lastActivityAt = email.sentAt || email.createdAt;
          if (!email.isRead) thread.isRead = false;
        }
      } else {
        threads.set(threadKey, {
          id: threadKey,
          subject: email.subject,
          participants: [email.from, ...email.to, ...(email.cc || [])].filter(
            (addr, index, self) =>
              index === self.findIndex((a) => a.email === addr.email),
          ),
          emails: [email],
          lastActivityAt: email.sentAt || email.createdAt,
          isRead: email.isRead,
          messageCount: 1,
        });
      }
    }

    // Sort emails within each thread by date
    for (const thread of threads.values()) {
      thread.emails.sort(
        (a, b) =>
          new Date(a.sentAt || a.createdAt).getTime() -
          new Date(b.sentAt || b.createdAt).getTime(),
      );
    }

    return Array.from(threads.values()).sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );
  },
};

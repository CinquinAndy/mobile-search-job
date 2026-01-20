import PocketBase from "pocketbase";
import type { Email, EmailFolder } from "@/types/email";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);

// Enable auto-cancellation for duplicate requests
pb.autoCancellation(false);

// Email sync log interface
export interface EmailSyncLog {
  id: string;
  sync_type: "full" | "incremental" | "sent_only" | "received_only";
  status: "pending" | "running" | "completed" | "failed";
  date_from?: string;
  date_to?: string;
  emails_fetched: number;
  emails_created: number;
  emails_updated: number;
  errors?: string[];
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  user: string;
  created: string;
  updated: string;
}

// Helper to convert PocketBase email to our Email type
function pbToEmail(record: any): Email {
  return {
    id: record.id,
    resendId: record.resend_id,
    from: {
      email: record.from_email,
      name: record.from_name,
    },
    to: record.to_emails || [],
    cc: record.cc_emails,
    bcc: record.bcc_emails,
    subject: record.subject,
    body: record.body_text || "",
    html: record.body_html,
    status: record.status as any,
    folder: record.folder as EmailFolder,
    threadId: record.thread_id,
    inReplyTo: record.in_reply_to,
    isRead: record.is_read || false,
    isStarred: record.is_starred || false,
    hasAttachments: record.has_attachments || false,
    sentAt: record.sent_at,
    receivedAt: record.received_at,
    createdAt: record.created,
    updatedAt: record.updated,
    metadata: {
      openedAt: record.opened_at,
      clickedAt: record.clicked_at,
      ...record.resend_metadata,
    },
  };
}

// Helper to convert our Email type to PocketBase format
function emailToPb(email: Email, userId: string) {
  return {
    resend_id: email.resendId || email.id,
    folder: email.folder,
    from_email: email.from.email,
    from_name: email.from.name,
    to_emails: email.to,
    cc_emails: email.cc || [],
    bcc_emails: email.bcc || [],
    subject: email.subject,
    body_text: email.body,
    body_html: email.html,
    status: email.status,
    is_read: email.isRead,
    is_starred: email.isStarred,
    has_attachments: email.hasAttachments,
    sent_at: email.sentAt,
    received_at: email.receivedAt,
    opened_at: email.metadata?.openedAt,
    clicked_at: email.metadata?.clickedAt,
    thread_id: email.threadId,
    in_reply_to: email.inReplyTo,
    resend_metadata: email.metadata,
    user: userId,
  };
}

export const emailPbService = {
  /**
   * Get emails by folder
   */
  async getEmails(
    userId: string,
    folder?: EmailFolder,
  ): Promise<Email[]> {
    try {
      const filter = folder
        ? `user = "${userId}" && folder = "${folder}"`
        : `user = "${userId}"`;

      const records = await pb.collection("emails").getFullList({
        filter,
        sort: "-created",
      });

      return records.map(pbToEmail);
    } catch (error) {
      console.error("Failed to get emails from PocketBase:", error);
      return [];
    }
  },

  /**
   * Get a single email by ID
   */
  async getEmailById(id: string): Promise<Email | null> {
    try {
      const record = await pb.collection("emails").getOne(id);
      return pbToEmail(record);
    } catch (error) {
      console.error(`Failed to get email ${id}:`, error);
      return null;
    }
  },

  /**
   * Search emails
   */
  async searchEmails(userId: string, query: string): Promise<Email[]> {
    try {
      const filter = `user = "${userId}" && (subject ~ "${query}" || body_text ~ "${query}" || from_email ~ "${query}")`;

      const records = await pb.collection("emails").getFullList({
        filter,
        sort: "-created",
      });

      return records.map(pbToEmail);
    } catch (error) {
      console.error("Failed to search emails:", error);
      return [];
    }
  },

  /**
   * Save a single email (create or update)
   */
  async saveEmail(email: Email, userId: string): Promise<void> {
    try {
      const data = emailToPb(email, userId);

      // Try to find existing email by resend_id
      const existing = await pb.collection("emails").getFirstListItem(
        `resend_id = "${email.resendId || email.id}"`,
      ).catch(() => null);

      if (existing) {
        // Update existing
        await pb.collection("emails").update(existing.id, data);
      } else {
        // Create new
        await pb.collection("emails").create(data);
      }
    } catch (error) {
      console.error("Failed to save email:", error);
      throw error;
    }
  },

  /**
   * Save multiple emails in batch
   */
  async saveEmails(emails: Email[], userId: string): Promise<void> {
    try {
      // Process in batches of 50 to avoid overwhelming PocketBase
      const batchSize = 50;
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        await Promise.all(
          batch.map((email) => this.saveEmail(email, userId)),
        );
      }
    } catch (error) {
      console.error("Failed to save emails batch:", error);
      throw error;
    }
  },

  /**
   * Update an email
   */
  async updateEmail(
    id: string,
    updates: Partial<Email>,
  ): Promise<void> {
    try {
      const data: any = {};
      
      if (updates.isRead !== undefined) data.is_read = updates.isRead;
      if (updates.isStarred !== undefined) data.is_starred = updates.isStarred;
      if (updates.folder) data.folder = updates.folder;

      await pb.collection("emails").update(id, data);
    } catch (error) {
      console.error(`Failed to update email ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete an email
   */
  async deleteEmail(id: string): Promise<void> {
    try {
      await pb.collection("emails").delete(id);
    } catch (error) {
      console.error(`Failed to delete email ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a sync log
   */
  async createSyncLog(
    userId: string,
    params: {
      sync_type: "full" | "incremental" | "sent_only" | "received_only";
      date_from?: Date;
      date_to?: Date;
    },
  ): Promise<string> {
    try {
      const record = await pb.collection("email_sync_logs").create({
        sync_type: params.sync_type,
        status: "pending",
        date_from: params.date_from?.toISOString(),
        date_to: params.date_to?.toISOString(),
        emails_fetched: 0,
        emails_created: 0,
        emails_updated: 0,
        started_at: new Date().toISOString(),
        user: userId,
      });

      return record.id;
    } catch (error) {
      console.error("Failed to create sync log:", error);
      throw error;
    }
  },

  /**
   * Update a sync log
   */
  async updateSyncLog(
    id: string,
    updates: Partial<EmailSyncLog>,
  ): Promise<void> {
    try {
      await pb.collection("email_sync_logs").update(id, updates);
    } catch (error) {
      console.error(`Failed to update sync log ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get the latest sync log for a user
   */
  async getLatestSyncLog(userId: string): Promise<EmailSyncLog | null> {
    try {
      const record = await pb.collection("email_sync_logs").getFirstListItem(
        `user = "${userId}"`,
        { sort: "-created" },
      );

      return record as EmailSyncLog;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get sync log by ID
   */
  async getSyncLog(id: string): Promise<EmailSyncLog | null> {
    try {
      const record = await pb.collection("email_sync_logs").getOne(id);
      return record as EmailSyncLog;
    } catch (error) {
      return null;
    }
  },
};

import { Resend } from "resend";

const RESEND_KEY = process.env.RESEND_KEY;

if (!RESEND_KEY) {
  console.warn(
    "[ResendService] RESEND_KEY is missing. Resend integration will not work.",
  );
}

export const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

// Email update structure from Resend
export interface ResendEmailUpdate {
  id: string;
  from?: string; // Sender email address
  to: string[];
  subject: string;
  created_at: string;
  status?: string;
  html?: string | null; // HTML content
  text?: string | null; // Plain text content
}

export interface ResendReceivedEmail {
  id: string;
  to: string[];
  from: string;
  subject: string;
  created_at: string;
  bcc?: string[];
  cc?: string[];
  reply_to?: string[];
  message_id?: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    content_id?: string | null;
    content_disposition?: string;
    id: string;
    size: number;
  }>;
}

// Helper to delay between requests (Resend rate limit: 2 req/sec)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const resendService = {
  /**
   * Send an email via Resend
   */
  async sendEmail(params: {
    to: string | string[];
    from?: string;
    subject: string;
    html?: string;
    text?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    tags?: { name: string; value: string }[];
  }) {
    if (!resend) throw new Error("Resend client not initialized");

    const response = await resend.emails.send({
      from: params.from || "onboarding@resend.dev", // Use your verified domain
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo,
      tags: params.tags,
    });

    if (response.error) {
      throw new Error(`Resend Error: ${response.error.message}`);
    }

    return response.data;
  },

  /**
   * Get a single email by ID with full content (HTML/text)
   */
  async getEmail(emailId: string): Promise<ResendEmailUpdate> {
    if (!resend) throw new Error("Resend client not initialized");

    const response = await resend.emails.get(emailId);

    if (response.error) {
      throw new Error(`Resend Error: ${response.error.message}`);
    }

    const email = response.data;
    if (!email) {
      throw new Error("Email not found");
    }

    return {
      id: email.id,
      from: email.from,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject || "",
      created_at: email.created_at,
      status: email.last_event || "sent",
      html: email.html || null,
      text: email.text || null,
    };
  },

  /**
   * List ALL sent emails from Resend using cursor-based pagination
   * Fetches all pages until has_more is false
   * Includes rate limiting delay to avoid 429 errors
   */
  async listAllEmails(): Promise<ResendEmailUpdate[]> {
    if (!resend) throw new Error("Resend client not initialized");

    const allEmails: ResendEmailUpdate[] = [];
    let hasMore = true;
    let afterCursor: string | undefined;
    let pageCount = 0;

    console.info("[ResendService] Starting to fetch all emails...");

    while (hasMore) {
      pageCount++;

      // Rate limit: wait 600ms between requests (safe margin for 2 req/sec)
      if (pageCount > 1) {
        await delay(600);
      }

      const response = await resend.emails.list({
        limit: 100,
        after: afterCursor,
      });

      if (response.error) {
        throw new Error(`Resend Error: ${response.error.message}`);
      }

      const emails = response.data?.data || [];

      if (emails.length > 0) {
        // biome-ignore lint/suspicious/noExplicitAny: Resend API response typing
        const mappedEmails = emails.map((email: any) => ({
          id: email.id,
          from: email.from || "contact@andy-cinquin.com", // Include from field
          to: email.to || [],
          subject: email.subject || "",
          created_at: email.created_at,
          status: email.last_event || "sent", // Map last_event to status
          html: null, // List endpoint doesn't include HTML content
          text: null, // List endpoint doesn't include text content
        }));

        allEmails.push(...mappedEmails);
        afterCursor = emails[emails.length - 1].id;
      }

      hasMore = response.data?.has_more ?? false;

      console.info(
        `[ResendService] Page ${pageCount}: fetched ${emails.length} emails (total: ${allEmails.length})`,
      );
    }

    console.info(
      `[ResendService] Finished. Total emails fetched: ${allEmails.length}`,
    );
    return allEmails;
  },

  async getEmailDetails(id: string) {
    if (!resend) throw new Error("Resend client not initialized");

    const response = await resend.emails.get(id);

    if (response.error) {
      throw new Error(`Resend Error: ${response.error.message}`);
    }

    return response.data;
  },

  /**
   * Get full email content including HTML
   */
  async getEmailContent(id: string) {
    if (!resend) throw new Error("Resend client not initialized");

    const response = await resend.emails.get(id);

    if (response.error) {
      throw new Error(`Resend Error: ${response.error.message}`);
    }

    return {
      id: response.data?.id,
      from: response.data?.from,
      to: response.data?.to,
      subject: response.data?.subject,
      html: response.data?.html,
      text: response.data?.text,
      created_at: response.data?.created_at,
      status: response.data?.last_event,
    };
  },

  /**
   * List ALL received emails using cursor-based pagination
   */
  async listAllReceivedEmails(): Promise<ResendReceivedEmail[]> {
    if (!resend) throw new Error("Resend client not initialized");

    const allEmails: ResendReceivedEmail[] = [];
    let hasMore = true;
    let afterCursor: string | undefined;
    let pageCount = 0;

    console.info("[ResendService] Starting to fetch received emails...");

    while (hasMore) {
      pageCount++;

      // Rate limit: wait 600ms between requests
      if (pageCount > 1) {
        await delay(600);
      }

      // biome-ignore lint/suspicious/noExplicitAny: Resend receiving API typing
      const response: any = await (resend.emails as any).receiving.list({
        limit: 100,
        after: afterCursor,
      });

      if (response.error) {
        throw new Error(`Resend Error: ${response.error.message}`);
      }

      const emails = response.data?.data || [];

      if (emails.length > 0) {
        allEmails.push(...emails);        afterCursor = emails[emails.length - 1].id;
      }

      hasMore = response.data?.has_more ?? false;

      console.info(
        `[ResendService] Page ${pageCount}: fetched ${emails.length} received emails (total: ${allEmails.length})`,
      );
    }

    console.info(
      `[ResendService] Finished. Total received emails: ${allEmails.length}`,
    );
    return allEmails;
  },

  /**
   * Get a specific received email by ID
   */
  async getReceivedEmail(id: string) {
    if (!resend) throw new Error("Resend client not initialized");

    // biome-ignore lint/suspicious/noExplicitAny: Resend receiving API typing
    const response: any = await (resend.emails as any).receiving.retrieve(id);

    if (response.error) {
      throw new Error(`Resend Error: ${response.error.message}`);
    }

    return response.data;
  },
};

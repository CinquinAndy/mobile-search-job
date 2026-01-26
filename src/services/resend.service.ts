import { render } from "@react-email/render";
import type { ReactElement } from "react";
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
   * Render a React Email component to HTML and Text
   */
  async renderReactEmail(
    component: ReactElement,
  ): Promise<{ html: string; text: string }> {
    const html = await render(component);
    const text = await render(component, { plainText: true });
    return { html, text };
  },

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
    attachments?: Array<{ filename: string; content: string }>;
  }) {
    if (!resend) throw new Error("Resend client not initialized");

    // biome-ignore lint/suspicious/noExplicitAny: Resend SDK typing issue
    const response = await (resend.emails.send as any)({
      from: params.from || "Andy Cinquin <contact@andy-cinquin.com>", // Use your verified domain
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo,
      tags: params.tags,
      attachments: params.attachments,
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
   * @param dateFrom Optional date to stop fetching (emails older than this won't be fetched)
   */
  async listAllEmails(dateFrom?: Date): Promise<ResendEmailUpdate[]> {
    if (!resend) throw new Error("Resend client not initialized");

    const allEmails: ResendEmailUpdate[] = [];
    let hasMore = true;
    let afterCursor: string | undefined;
    let pageCount = 0;

    console.info(
      `[ResendService] Starting to fetch emails${dateFrom ? ` from ${dateFrom.toISOString()}` : ""}...`,
    );

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
          from: email.from || "contact@andy-cinquin.com",
          to: email.to || [],
          subject: email.subject || "",
          created_at: email.created_at,
          status: email.last_event || "sent",
          html: null,
          text: null,
        }));

        // Check for date filtering
        if (dateFrom) {
          const filteredMapped = [];
          let stoppedByDate = false;

          for (const email of mappedEmails) {
            const emailDate = new Date(email.created_at);
            if (emailDate < dateFrom) {
              stoppedByDate = true;
              break;
            }
            filteredMapped.push(email);
          }

          allEmails.push(...filteredMapped);

          if (stoppedByDate) {
            console.info(
              `[ResendService] Stopped fetching at ${mappedEmails[filteredMapped.length]?.created_at} (reached dateFrom)`,
            );
            break;
          }
        } else {
          allEmails.push(...mappedEmails);
        }

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
   * @param id - Resend ID
   * @param type - Email type (outbound for sent, inbound for received)
   */
  async getEmailContent(id: string, type: "outbound" | "inbound" = "outbound") {
    if (!resend) throw new Error("Resend client not initialized");

    // biome-ignore lint/suspicious/noExplicitAny: Temporary any for response
    let response: any;

    if (type === "inbound") {
      // Use receiving API for inbound emails
      // biome-ignore lint/suspicious/noExplicitAny: Resend receiving API missing in types
      response = await (resend.emails as any).receiving.get(id);
    } else {
      // Use standard emails API for outbound emails
      response = await resend.emails.get(id);
    }

    if (response.error) {
      throw new Error(`Resend Error: ${response.error.message}`);
    }

    const data = response.data;

    return {
      id: data?.id,
      from: data?.from,
      to: data?.to,
      subject: data?.subject,
      html: data?.html,
      text: data?.text,
      created_at: data?.created_at,
      status: data?.last_event,
    };
  },

  /**
   * List ALL received emails using cursor-based pagination
   * @param dateFrom Optional date to stop fetching
   */
  async listAllReceivedEmails(dateFrom?: Date): Promise<ResendReceivedEmail[]> {
    if (!resend) throw new Error("Resend client not initialized");

    const allEmails: ResendReceivedEmail[] = [];
    let hasMore = true;
    let afterCursor: string | undefined;
    let pageCount = 0;

    console.info(
      `[ResendService] Starting to fetch received emails${dateFrom ? ` from ${dateFrom.toISOString()}` : ""}...`,
    );

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
        // biome-ignore lint/suspicious/noExplicitAny: Resend API response typing
        const mappedEmails = emails.map((email: any) => ({
          id: email.id,
          from: email.from,
          to: email.to || [],
          subject: email.subject || "",
          created_at: email.created_at,
        }));

        // Check for date filtering
        if (dateFrom) {
          const filteredMapped = [];
          let stoppedByDate = false;

          for (const email of mappedEmails) {
            const emailDate = new Date(email.created_at);
            if (emailDate < dateFrom) {
              stoppedByDate = true;
              break;
            }
            filteredMapped.push(email);
          }

          allEmails.push(...filteredMapped);

          if (stoppedByDate) {
            console.info(
              `[ResendService] Stopped fetching at ${mappedEmails[filteredMapped.length]?.created_at} (reached dateFrom)`,
            );
            break;
          }
        } else {
          allEmails.push(...mappedEmails);
        }

        afterCursor = emails[emails.length - 1].id;
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
    const response: any = await (resend.emails as any).receiving.get(id);

    if (response.error) {
      throw new Error(`Resend Error: ${response.error.message}`);
    }

    return response.data;
  },
};

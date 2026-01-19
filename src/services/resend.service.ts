import { Resend } from "resend";

const RESEND_KEY = process.env.RESEND_KEY;

if (!RESEND_KEY) {
  console.warn(
    "[ResendService] RESEND_KEY is missing. Resend integration will not work.",
  );
}

export const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

export interface ResendEmailUpdate {
  id: string;
  to: string[];
  subject: string;
  created_at: string;
  status: string;
}

// Helper to delay between requests (Resend rate limit: 2 req/sec)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const resendService = {
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
          to: email.to || [],
          subject: email.subject || "",
          created_at: email.created_at,
          status: email.last_event || "sent",
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
};


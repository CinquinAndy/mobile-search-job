import { getAdminPB } from "./pocketbase.server";
import { resendService } from "./resend.service";

export const syncService = {
  /**
   * Synchronize Resend emails with PocketBase email_logs
   * This should be called from a Server Action or API route
   */
  async syncResendEmails() {
    const pb = await getAdminPB();
    console.info("[SyncService] Starting Resend synchronization...");

    try {
      const emails = await resendService.listSentEmails();
      let updatedCount = 0;
      let createdCount = 0;

      for (const email of emails) {
        const recipient = email.to[0];
        if (!recipient) continue;

        const domain = recipient.split("@")[1];

        // 1. Upsert Email Log
        try {
          // Check if exists
          let existingLog = null;
          try {
            existingLog = await pb
              .collection("email_logs")
              .getFirstListItem(`external_id="${email.id}"`);
          } catch {
            // Not found
          }

          const logData = {
            external_id: email.id,
            provider: "resend",
            recipient,
            subject: email.subject,
            status: email.status,
            sent_at: email.created_at,
            raw_payload: email,
          };

          if (existingLog) {
            // Only update status if it changed
            if (existingLog.status !== email.status) {
              await pb
                .collection("email_logs")
                .update(existingLog.id, { status: email.status });
              updatedCount++;
            }
          } else {
            // Create new log
            const newLog = await pb.collection("email_logs").create(logData);
            createdCount++;

            // 2. Try to auto-match with company/application
            await this.autoMatchApplication(pb, newLog.id, domain, recipient);
          }
        } catch (err) {
          console.error(`[SyncService] Failed to sync email ${email.id}:`, err);
        }
      }

      console.info(
        `[SyncService] Finished. Created: ${createdCount}, Updated: ${updatedCount}`,
      );
      return { createdCount, updatedCount };
    } catch (error) {
      console.error("[SyncService] Synchronization failed:", error);
      throw error;
    }
  },

  /**
   * Logic to link an email log to an application based on domain
   */
  async autoMatchApplication(
    pb: any,
    logId: string,
    domain: string,
    recipient: string,
  ) {
    try {
      // Find company by domain
      let company = null;
      try {
        company = await pb
          .collection("companies")
          .getFirstListItem(`domain="${domain}"`);
      } catch {
        // No company with this domain yet
      }

      if (company) {
        // Find most recent application for this company
        let application = null;
        try {
          application = await pb
            .collection("applications")
            .getFirstListItem(`company="${company.id}"`, { sort: "-created" });
        } catch {
          // No application found
        }

        if (application) {
          // Link them!
          await pb
            .collection("email_logs")
            .update(logId, { application: application.id });

          // Also update application status if the email status is more advanced
          // (Very basic logic for now)
          if (
            application.status === "sent" &&
            ["opened", "clicked"].includes(recipient)
          ) {
            await pb
              .collection("applications")
              .update(application.id, { status: "opened" });
          }
        }
      }
    } catch (err) {
      console.warn(`[SyncService] Auto-matching failed for log ${logId}:`, err);
    }
  },
};

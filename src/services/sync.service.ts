import { getAdminPB } from "./pocketbase.server";
import { type ResendEmailUpdate, resend } from "./resend.service";

// Helper to delay between requests (Resend rate limit: 2 req/sec)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalize date string to ISO 8601 format for PocketBase
 * Handles various formats from Resend API
 */
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  try {
    // Try parsing the date
    const date = new Date(dateStr);
    
    // Check if valid date
    if (Number.isNaN(date.getTime())) {
      console.warn(`[SyncService] Invalid date: ${dateStr}`);
      return null;
    }
    
    // Return ISO 8601 format
    return date.toISOString();
  } catch {
    console.warn(`[SyncService] Failed to parse date: ${dateStr}`);
    return null;
  }
}

export const syncService = {
  /**
   * STEP 1: Sync only email logs from Resend to PocketBase
   * Now includes direction field (outbound for sent emails)
   * @param userId - The user ID to associate email logs with
   */
  async syncEmailLogsOnly(userId: string) {
    if (!resend) throw new Error("Resend client not initialized");

    const pb = await getAdminPB();
    console.info("[SyncService] Starting email logs sync from Resend...");

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let totalProcessed = 0;
    let pageCount = 0;

    let hasMore = true;
    let afterCursor: string | undefined;

    try {
      while (hasMore) {
        pageCount++;

        // Rate limit: wait 600ms between requests
        if (pageCount > 1) {
          await delay(600);
        }

        console.info(`[SyncService] Fetching page ${pageCount}...`);
        const response = await resend.emails.list({
          limit: 100,
          after: afterCursor,
        });

        if (response.error) {
          throw new Error(`Resend Error: ${response.error.message}`);
        }

        const emails = response.data?.data || [];
        hasMore = response.data?.has_more ?? false;

        if (emails.length === 0) break;

        afterCursor = emails[emails.length - 1].id;

        console.info(`[SyncService] Processing ${emails.length} emails...`);

        for (const rawEmail of emails) {
          totalProcessed++;

          // biome-ignore lint/suspicious/noExplicitAny: Resend API typing
          const typedEmail = rawEmail as any;
          const email: ResendEmailUpdate = {
            id: typedEmail.id,
            to: typedEmail.to || [],
            subject: typedEmail.subject || "",
            created_at: typedEmail.created_at,
            status: typedEmail.last_event || "sent",
          };

          const recipient = email.to[0];
          if (!recipient) {
            skippedCount++;
            continue;
          }

          // Normalize date for PocketBase
          const sentAt = normalizeDate(email.created_at);

          try {
            let existingLog = null;
            try {
              existingLog = await pb
                .collection("email_logs")
                .getFirstListItem(`external_id="${email.id}"`);
            } catch {
              // Not found
            }

            if (existingLog) {
              if (existingLog.status !== email.status) {
                await pb
                  .collection("email_logs")
                  .update(existingLog.id, { status: email.status });
                updatedCount++;
              } else {
                skippedCount++;
              }
            } else {
              // Create with direction = outbound (sent emails)
              await pb.collection("email_logs").create({
                external_id: email.id,
                provider: "resend",
                direction: "outbound",
                recipient,
                subject: email.subject,
                status: email.status,
                sent_at: sentAt,
                raw_payload: email,
                user: userId,
              });
              createdCount++;
            }
          } catch (err) {
            console.error(`[SyncService] Failed to sync email ${email.id}:`, err);
          }
        }

        console.info(
          `[SyncService] Batch ${pageCount}: created=${createdCount}, updated=${updatedCount}, skipped=${skippedCount}`,
        );
      }

      console.info(
        `[SyncService] Email logs sync complete. Total: ${totalProcessed} | Created: ${createdCount} | Updated: ${updatedCount} | Skipped: ${skippedCount}`,
      );
      return { createdCount, updatedCount, skippedCount, totalProcessed };
    } catch (error) {
      console.error("[SyncService] Email logs sync failed:", error);
      throw error;
    }
  },

  /**
   * STEP 1b: Sync received/inbound emails from Resend to PocketBase
   * Uses resend.emails.receiving.list() API
   * @param userId - The user ID to associate email logs with
   */
  async syncInboundEmailsOnly(userId: string) {
    if (!resend) throw new Error("Resend client not initialized");

    const pb = await getAdminPB();
    console.info("[SyncService] Starting inbound email logs sync from Resend...");

    let createdCount = 0;
    let skippedCount = 0;
    let totalProcessed = 0;
    let pageCount = 0;

    let hasMore = true;
    let afterCursor: string | undefined;

    try {
      while (hasMore) {
        pageCount++;

        // Rate limit: wait 600ms between requests
        if (pageCount > 1) {
          await delay(600);
        }

        console.info(`[SyncService] Fetching inbound page ${pageCount}...`);
        
        // biome-ignore lint/suspicious/noExplicitAny: Resend SDK typing may not include receiving
        const receivingApi = (resend.emails as any).receiving;
        if (!receivingApi) {
          throw new Error("Resend receiving API not available - may require SDK update");
        }

        const response = await receivingApi.list({
          limit: 100,
          after: afterCursor,
        });

        if (response.error) {
          throw new Error(`Resend Error: ${response.error.message}`);
        }

        const emails = response.data?.data || [];
        hasMore = response.data?.has_more ?? false;

        if (emails.length === 0) break;

        afterCursor = emails[emails.length - 1].id;

        console.info(`[SyncService] Processing ${emails.length} inbound emails...`);

        for (const rawEmail of emails) {
          totalProcessed++;

          // biome-ignore lint/suspicious/noExplicitAny: Resend API typing
          const typedEmail = rawEmail as any;
          const sender = typedEmail.from || "";
          const recipients = typedEmail.to || [];
          const subject = typedEmail.subject || "";
          const createdAt = typedEmail.created_at;

          if (!sender) {
            skippedCount++;
            continue;
          }

          try {
            // Check if already exists
            let existingLog = null;
            try {
              existingLog = await pb
                .collection("email_logs")
                .getFirstListItem(`external_id="${typedEmail.id}"`);
            } catch {
              // Not found
            }

            if (existingLog) {
              skippedCount++;
              continue;
            }

            // Normalize date for PocketBase
            const sentAt = normalizeDate(createdAt);

            // Create inbound email log
            await pb.collection("email_logs").create({
              external_id: typedEmail.id,
              provider: "resend",
              direction: "inbound",
              sender: sender,
              recipient: recipients[0] || "",
              subject: subject,
              status: "received",
              sent_at: sentAt,
              raw_payload: typedEmail,
              user: userId,
            });
            createdCount++;
          } catch (err) {
            console.error(`[SyncService] Failed to sync inbound email ${typedEmail.id}:`, err);
          }
        }

        console.info(
          `[SyncService] Inbound batch ${pageCount}: created=${createdCount}, skipped=${skippedCount}`,
        );
      }

      console.info(
        `[SyncService] Inbound sync complete. Total: ${totalProcessed} | Created: ${createdCount} | Skipped: ${skippedCount}`,
      );
      return { createdCount, skippedCount, totalProcessed };
    } catch (error) {
      console.error("[SyncService] Inbound email logs sync failed:", error);
      throw error;
    }
  },

  /**
   * STEP 2: Link email_logs to companies based on recipient domain
   * Does NOT create companies, just links existing ones
   * @param userId - The user ID to filter email logs
   */
  async linkLogsToCompanies(userId: string) {
    const pb = await getAdminPB();
    console.info("[SyncService] Linking email logs to companies...");

    let linkedCount = 0;
    let skippedCount = 0;

    try {
      // Get all email_logs that don't have a company linked
      const logs = await pb.collection("email_logs").getFullList({
        filter: `user="${userId}" && company=""`,
      });

      console.info(`[SyncService] Found ${logs.length} unlinked email logs`);

      for (const log of logs) {
        const recipient = log.recipient as string;
        const sender = log.sender as string;
        const email = log.direction === "inbound" ? sender : recipient;
        
        if (!email) {
          skippedCount++;
          continue;
        }

        const domain = email.split("@")[1];
        if (!domain) {
          skippedCount++;
          continue;
        }

        try {
          // Find company by domain
          const company = await pb
            .collection("companies")
            .getFirstListItem(`domain="${domain}" && user="${userId}"`);

          await pb.collection("email_logs").update(log.id, {
            company: company.id,
          });
          linkedCount++;
        } catch {
          // Company not found - skip
          skippedCount++;
        }
      }

      console.info(
        `[SyncService] Linked ${linkedCount} logs to companies. Skipped: ${skippedCount}`,
      );
      return { linkedCount, skippedCount };
    } catch (error) {
      console.error("[SyncService] Link logs to companies failed:", error);
      throw error;
    }
  },

  /**
   * STEP 3: Create companies and applications from existing email_logs
   * Does NOT call Resend API - uses only local data
   * @param userId - The user ID to filter email logs
   */
  async createCompaniesFromLogs(userId: string) {
    const pb = await getAdminPB();
    console.info("[SyncService] Creating companies/applications from email logs...");

    let companiesCreated = 0;
    let applicationsCreated = 0;
    let logsLinked = 0;
    let logsSkipped = 0;

    try {
      // Get all outbound email_logs that don't have an application linked
      const logs = await pb.collection("email_logs").getFullList({
        filter: `user="${userId}" && application="" && direction="outbound"`,
        sort: "sent_at",
      });

      console.info(`[SyncService] Found ${logs.length} unlinked outbound email logs`);

      for (const log of logs) {
        const recipient = log.recipient as string;
        if (!recipient) {
          logsSkipped++;
          continue;
        }

        const domain = recipient.split("@")[1];
        if (!domain) {
          logsSkipped++;
          continue;
        }

        const result = await this.createOrMatchCompanyAndApplication(
          pb,
          log.id,
          domain,
          recipient,
          (log.subject as string) || "",
          (log.sent_at as string) || log.created,
          userId,
        );

        if (result.companyCreated) companiesCreated++;
        if (result.applicationCreated) applicationsCreated++;
        if (result.companyId) {
          // Also link company to email log
          await pb.collection("email_logs").update(log.id, {
            company: result.companyId,
          });
        }
        logsLinked++;
      }

      console.info(
        `[SyncService] Complete. Companies: ${companiesCreated} | Applications: ${applicationsCreated} | Logs linked: ${logsLinked} | Skipped: ${logsSkipped}`,
      );
      return { companiesCreated, applicationsCreated, logsLinked, logsSkipped };
    } catch (error) {
      console.error("[SyncService] Create companies failed:", error);
      throw error;
    }
  },

  /**
   * STEP 4: Create responses from inbound email_logs
   * Detects replies and creates response records, updates application status
   * @param userId - The user ID to filter email logs
   */
  async createResponsesFromLogs(userId: string) {
    const pb = await getAdminPB();
    console.info("[SyncService] Creating responses from inbound email logs...");

    let responsesCreated = 0;
    let applicationsUpdated = 0;
    let skippedCount = 0;

    try {
      // Get all inbound email_logs that don't have a response linked yet
      // We identify inbound by checking if direction="inbound" or if there's a sender field
      const logs = await pb.collection("email_logs").getFullList({
        filter: `user="${userId}" && direction="inbound"`,
        sort: "sent_at",
      });

      console.info(`[SyncService] Found ${logs.length} inbound email logs`);

      for (const log of logs) {
        const sender = log.sender as string;
        if (!sender) {
          skippedCount++;
          continue;
        }

        const domain = sender.split("@")[1];
        if (!domain) {
          skippedCount++;
          continue;
        }

        try {
          // Check if response already exists for this email log
          try {
            await pb
              .collection("responses")
              .getFirstListItem(`email_log="${log.id}"`);
            // Already exists, skip
            skippedCount++;
            continue;
          } catch {
            // Not found, create it
          }

          // Find company by domain
          let company = null;
          try {
            company = await pb
              .collection("companies")
              .getFirstListItem(`domain="${domain}" && user="${userId}"`);
          } catch {
            // Company not found, skip
            skippedCount++;
            continue;
          }

          // Find application for this company
          let application = null;
          try {
            application = await pb
              .collection("applications")
              .getFirstListItem(`company="${company.id}"`, { sort: "-created" });
          } catch {
            // No application found
          }

          // Detect response type from subject
          const responseType = this.detectResponseType(log.subject as string || "");

          // Create response
          await pb.collection("responses").create({
            company: company.id,
            application: application?.id || null,
            email_log: log.id,
            type: responseType,
            sender_email: sender,
            subject: log.subject || "",
            received_at: log.sent_at || log.created,
            user: userId,
          });
          responsesCreated++;

          // Update application status if we have one
          if (application) {
            const newStatus = this.getStatusFromResponseType(responseType);
            if (newStatus && application.status !== newStatus) {
              await pb.collection("applications").update(application.id, {
                status: newStatus,
                last_activity_at: log.sent_at || log.created,
              });
              applicationsUpdated++;
            }
          }

          // Link email log to company if not already
          if (!log.company) {
            await pb.collection("email_logs").update(log.id, {
              company: company.id,
              application: application?.id || null,
            });
          }
        } catch (err) {
          console.error(`[SyncService] Failed to create response for log ${log.id}:`, err);
          skippedCount++;
        }
      }

      console.info(
        `[SyncService] Responses created: ${responsesCreated} | Applications updated: ${applicationsUpdated} | Skipped: ${skippedCount}`,
      );
      return { responsesCreated, applicationsUpdated, skippedCount };
    } catch (error) {
      console.error("[SyncService] Create responses failed:", error);
      throw error;
    }
  },

  /**
   * COMBINED: Full sync - email logs + create companies/applications + responses
   */
  async syncResendEmails(userId: string) {
    const emailResult = await this.syncEmailLogsOnly(userId);
    const companyResult = await this.createCompaniesFromLogs(userId);
    const responseResult = await this.createResponsesFromLogs(userId);

    return {
      ...emailResult,
      companiesCreated: companyResult.companiesCreated,
      applicationsCreated: companyResult.applicationsCreated,
      responsesCreated: responseResult.responsesCreated,
    };
  },

  /**
   * Create or find company and application based on email domain
   * Auto-creates companies and applications if they don't exist
   */
  async createOrMatchCompanyAndApplication(
    // biome-ignore lint/suspicious/noExplicitAny: PocketBase client typing
    pb: any,
    logId: string,
    domain: string,
    recipient: string,
    subject: string,
    sentAt: string,
    userId: string,
  ): Promise<{ companyCreated: boolean; applicationCreated: boolean; companyId?: string }> {
    let companyCreated = false;
    let applicationCreated = false;

    try {
      // 1. Find or create company by domain
      let company = null;
      try {
        company = await pb
          .collection("companies")
          .getFirstListItem(`domain="${domain}" && user="${userId}"`);
      } catch {
        // Not found - create it
      }

      if (!company) {
        const companyName = this.extractCompanyName(domain);

        company = await pb.collection("companies").create({
          name: companyName,
          domain: domain,
          website: `https://${domain}`,
          user: userId,
        });
        companyCreated = true;
        console.info(`[SyncService] Created company: ${companyName} (${domain})`);
      }

      // 2. Find or create application for this company
      let application = null;
      try {
        application = await pb
          .collection("applications")
          .getFirstListItem(`company="${company.id}"`, { sort: "-created" });
      } catch {
        // Not found - create it
      }

      if (!application) {
        const position = this.extractPositionFromSubject(subject);

        application = await pb.collection("applications").create({
          company: company.id,
          position: position,
          status: "sent",
          last_activity_at: sentAt,
          notes: `Created from email to ${recipient}`,
          user: userId,
        });
        applicationCreated = true;
        console.info(
          `[SyncService] Created application for ${company.name} (position: ${position || "N/A"})`,
        );
      }

      // 3. Link email log to application and company
      await pb.collection("email_logs").update(logId, {
        application: application.id,
        company: company.id,
      });

      return { companyCreated, applicationCreated, companyId: company.id };
    } catch (err) {
      console.warn(`[SyncService] Failed to create/match for log ${logId}:`, err);
      return { companyCreated: false, applicationCreated: false };
    }
  },

  /**
   * Detect response type from email subject
   */
  detectResponseType(subject: string): string {
    const subjectLower = subject.toLowerCase();

    // Positive patterns
    if (
      subjectLower.includes("entretien") ||
      subjectLower.includes("interview") ||
      subjectLower.includes("rdv") ||
      subjectLower.includes("rencontre")
    ) {
      return "interview";
    }

    if (
      subjectLower.includes("offre") ||
      subjectLower.includes("proposition") ||
      subjectLower.includes("offer")
    ) {
      return "offer";
    }

    // Negative patterns
    if (
      subjectLower.includes("regret") ||
      subjectLower.includes("malheureusement") ||
      subjectLower.includes("unfortunately") ||
      subjectLower.includes("pas retenu") ||
      subjectLower.includes("not selected") ||
      subjectLower.includes("refus")
    ) {
      return "negative";
    }

    // Info patterns
    if (
      subjectLower.includes("accusé") ||
      subjectLower.includes("réception") ||
      subjectLower.includes("confirmation") ||
      subjectLower.includes("received")
    ) {
      return "info";
    }

    // Default to other
    return "other";
  },

  /**
   * Map response type to application status
   */
  getStatusFromResponseType(type: string): string | null {
    const mapping: Record<string, string | null> = {
      positive: "responded",
      negative: "rejected",
      interview: "interview",
      offer: "offer",
      info: "responded",
      other: null,
    };
    return mapping[type];
  },

  /**
   * Extract a readable company name from domain
   */
  extractCompanyName(domain: string): string {
    const parts = domain.split(".");
    let name = parts[0];

    name = name
      .replace(/-/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2");

    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  },

  /**
   * Try to extract job position from email subject
   */
  extractPositionFromSubject(subject: string): string {
    const patterns = [
      /(?:application|candidature)\s+(?:for|pour|-|:)\s*(.+)/i,
      /(?:poste|position|job)\s*[:-]?\s*(.+)/i,
    ];

    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match?.[1]) {
        return match[1].trim().slice(0, 100);
      }
    }

    return subject.slice(0, 50) || "Spontaneous Application";
  },

  /**
   * DANGER: Reset all sync data for a user
   * Deletes: email_logs, responses, applications, companies
   */
  async resetAllData(userId: string) {
    const pb = await getAdminPB();
    console.warn("[SyncService] ⚠️ RESETTING ALL DATA for user:", userId);

    let emailLogsDeleted = 0;
    let responsesDeleted = 0;
    let applicationsDeleted = 0;
    let companiesDeleted = 0;

    try {
      // 1. Delete email_logs
      const emailLogs = await pb.collection("email_logs").getFullList({
        filter: `user="${userId}"`,
      });
      for (const log of emailLogs) {
        await pb.collection("email_logs").delete(log.id);
        emailLogsDeleted++;
      }
      console.info(`[SyncService] Deleted ${emailLogsDeleted} email_logs`);

      // 2. Delete responses
      const responses = await pb.collection("responses").getFullList({
        filter: `user="${userId}"`,
      });
      for (const response of responses) {
        await pb.collection("responses").delete(response.id);
        responsesDeleted++;
      }
      console.info(`[SyncService] Deleted ${responsesDeleted} responses`);

      // 3. Delete applications
      const applications = await pb.collection("applications").getFullList({
        filter: `user="${userId}"`,
      });
      for (const app of applications) {
        await pb.collection("applications").delete(app.id);
        applicationsDeleted++;
      }
      console.info(`[SyncService] Deleted ${applicationsDeleted} applications`);

      // 4. Delete companies
      const companies = await pb.collection("companies").getFullList({
        filter: `user="${userId}"`,
      });
      for (const company of companies) {
        await pb.collection("companies").delete(company.id);
        companiesDeleted++;
      }
      console.info(`[SyncService] Deleted ${companiesDeleted} companies`);

      console.warn("[SyncService] ✅ Reset complete");
      return {
        emailLogsDeleted,
        responsesDeleted,
        applicationsDeleted,
        companiesDeleted,
      };
    } catch (error) {
      console.error("[SyncService] Reset failed:", error);
      throw error;
    }
  },

  /**
   * Update all email_logs with correct dates from Resend API
   * Fetches created_at from Resend for each email and updates sent_at in PocketBase
   */
  async updateEmailDates(userId: string) {
    if (!resend) throw new Error("Resend client not initialized");

    const pb = await getAdminPB();
    console.info("[SyncService] Updating email dates from Resend API...");

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      // Get all email_logs for this user with provider = resend
      const logs = await pb.collection("email_logs").getFullList({
        filter: `user="${userId}" && provider="resend"`,
      });

      console.info(`[SyncService] Found ${logs.length} Resend email logs to update`);

      for (const log of logs) {
        const externalId = log.external_id as string;
        if (!externalId) {
          skippedCount++;
          continue;
        }

        try {
          // Rate limit: wait 600ms between requests
          await delay(600);

          // Fetch email details from Resend
          const response = await resend.emails.get(externalId);

          if (response.error) {
            console.warn(`[SyncService] Failed to fetch email ${externalId}:`, response.error.message);
            errorCount++;
            continue;
          }

          const emailData = response.data;
          if (!emailData?.created_at) {
            skippedCount++;
            continue;
          }

          // Normalize and update the date
          const sentAt = normalizeDate(emailData.created_at);

          if (sentAt && sentAt !== log.sent_at) {
            await pb.collection("email_logs").update(log.id, {
              sent_at: sentAt,
            });
            updatedCount++;
            console.info(`[SyncService] Updated date for ${externalId}: ${sentAt}`);
          } else {
            skippedCount++;
          }
        } catch (err) {
          console.error(`[SyncService] Error updating email ${externalId}:`, err);
          errorCount++;
        }
      }

      console.info(
        `[SyncService] Date update complete. Updated: ${updatedCount} | Skipped: ${skippedCount} | Errors: ${errorCount}`,
      );
      return { updatedCount, skippedCount, errorCount };
    } catch (error) {
      console.error("[SyncService] Update email dates failed:", error);
      throw error;
    }
  },

  /**
   * Update email statuses from Resend API (last_event)
   * Also updates associated application status and last_activity_at
   */
  async updateEmailStatuses(userId: string) {
    if (!resend) throw new Error("Resend client not initialized");

    const pb = await getAdminPB();
    console.info("[SyncService] Updating email statuses from Resend API...");

    let updatedLogsCount = 0;
    let updatedAppsCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      // Get all outbound email_logs for this user with provider = resend
      const logs = await pb.collection("email_logs").getFullList({
        filter: `user="${userId}" && provider="resend" && direction="outbound"`,
      });

      console.info(`[SyncService] Found ${logs.length} Resend email logs to check`);

      for (const log of logs) {
        const externalId = log.external_id as string;
        if (!externalId) {
          skippedCount++;
          continue;
        }

        try {
          // Rate limit: wait 600ms between requests
          await delay(600);

          // Fetch email details from Resend
          const response = await resend.emails.get(externalId);

          if (response.error) {
            console.warn(`[SyncService] Failed to fetch email ${externalId}:`, response.error.message);
            errorCount++;
            continue;
          }

          const emailData = response.data;
          // biome-ignore lint/suspicious/noExplicitAny: Resend API typing
          const lastEvent = (emailData as any)?.last_event;
          
          if (!lastEvent) {
            skippedCount++;
            continue;
          }

          // Update email_logs status if different
          if (lastEvent !== log.status) {
            await pb.collection("email_logs").update(log.id, {
              status: lastEvent,
            });
            updatedLogsCount++;
            console.info(`[SyncService] Updated status for ${externalId}: ${log.status} → ${lastEvent}`);

            // Also update the associated application if exists
            const applicationId = log.application as string;
            if (applicationId) {
              try {
                // Map email event to application status
                const appStatusMap: Record<string, string> = {
                  delivered: "delivered",
                  opened: "opened",
                  clicked: "clicked",
                  bounced: "bounced",
                };
                
                const newAppStatus = appStatusMap[lastEvent];
                if (newAppStatus) {
                  await pb.collection("applications").update(applicationId, {
                    status: newAppStatus,
                    last_activity_at: new Date().toISOString(),
                  });
                  updatedAppsCount++;
                }
              } catch {
                // Application might not exist
              }
            }
          } else {
            skippedCount++;
          }
        } catch (err) {
          console.error(`[SyncService] Error updating status for ${externalId}:`, err);
          errorCount++;
        }
      }

      console.info(
        `[SyncService] Status update complete. Logs: ${updatedLogsCount} | Apps: ${updatedAppsCount} | Skipped: ${skippedCount} | Errors: ${errorCount}`,
      );
      return { updatedLogsCount, updatedAppsCount, skippedCount, errorCount };
    } catch (error) {
      console.error("[SyncService] Update email statuses failed:", error);
      throw error;
    }
  },
};

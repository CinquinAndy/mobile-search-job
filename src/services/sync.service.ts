import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "csv-parse/sync";
import type { ApplicationStatus } from "@/types/application";
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

/**
 * Helper to parse "Name <email@example.com>" format
 */
function parseFullEmailString(emailStr: string): {
  email: string;
  name?: string;
} {
  if (!emailStr) return { email: "" };
  const match = emailStr.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2]?.trim(),
    };
  }
  return { email: emailStr.trim() };
}

export const syncService = {
  /**
   * STEP 1: Sync only email logs from Resend to PocketBase
   * Now includes direction field (outbound for sent emails)
   * @param userId - The user ID to associate email logs with
   * @param options - Optional filters (dateFrom, dateTo)
   */
  async syncEmailLogsOnly(
    userId: string,
    options: { dateFrom?: Date; dateTo?: Date } = {},
  ) {
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

          const rawRecipient = email.to[0];
          if (!rawRecipient) {
            skippedCount++;
            continue;
          }

          // Clean recipient email
          const recipientInfo = parseFullEmailString(rawRecipient);
          const recipient = recipientInfo.email;

          // Normalize date for PocketBase
          const sentAt = normalizeDate(email.created_at);

          // Date range check
          if (sentAt) {
            const sentDate = new Date(sentAt);
            if (options.dateFrom && sentDate < options.dateFrom) {
              skippedCount++;
              continue;
            }
            if (options.dateTo && sentDate > options.dateTo) {
              skippedCount++;
              continue;
            }
          }

          try {
            let existingLog = null;
            try {
              existingLog = await pb
                .collection("email_logs")
                .getFirstListItem(
                  `external_id="${email.id}" && user="${userId}"`,
                );
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
          } catch (err: unknown) {
            const error = err as any;
            const detail = error.response
              ? JSON.stringify(error.response, null, 2)
              : error.message || String(err);
            console.error(
              `[SyncService] Failed to sync email ${email.id}:`,
              detail,
            );
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
   * @param options - Optional filters (dateFrom, dateTo)
   */
  async syncInboundEmailsOnly(
    userId: string,
    options: { dateFrom?: Date; dateTo?: Date } = {},
  ) {
    if (!resend) throw new Error("Resend client not initialized");

    const pb = await getAdminPB();
    console.info(
      "[SyncService] Starting inbound email logs sync from Resend...",
    );

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
          throw new Error(
            "Resend receiving API not available - may require SDK update",
          );
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

        console.info(
          `[SyncService] Processing ${emails.length} inbound emails...`,
        );

        for (const rawEmail of emails) {
          totalProcessed++;

          // biome-ignore lint/suspicious/noExplicitAny: Resend API typing
          const typedEmail = rawEmail as any;
          const rawSender = typedEmail.from || "";
          const rawRecipients = typedEmail.to || [];
          const subject = typedEmail.subject || "";
          const createdAt = typedEmail.created_at;

          if (!rawSender) {
            console.warn(
              `[SyncService] [${totalProcessed}] SKIP: Inbound email ${typedEmail.id} has no sender`,
            );
            skippedCount++;
            continue;
          }

          // Clean names/emails
          const senderInfo = parseFullEmailString(rawSender);
          const sender = senderInfo.email;
          const recipients = rawRecipients.map(
            (r: string) => parseFullEmailString(r).email,
          );

          try {
            // Check if already exists
            const existingLog = await pb
              .collection("email_logs")
              .getFirstListItem(
                `external_id="${typedEmail.id}" && user="${userId}"`,
              )
              .catch(() => null);

            if (existingLog) {
              skippedCount++;
              continue;
            }

            // Normalize date for PocketBase
            const sentAt = normalizeDate(createdAt);

            // Date range check
            if (sentAt) {
              const sentDate = new Date(sentAt);
              if (options.dateFrom && sentDate < options.dateFrom) {
                skippedCount++;
                continue;
              }
              if (options.dateTo && sentDate > options.dateTo) {
                skippedCount++;
                continue;
              }
            }

            console.info(
              `[SyncService] [${totalProcessed}] Creating inbound log: ${sender} -> ${recipients[0] || "unknown"} | Date: ${sentAt}`,
            );

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
          } catch (err: unknown) {
            const error = err as any;
            const detail = error.response
              ? JSON.stringify(error.response, null, 2)
              : error.message || String(err);
            console.error(
              `[SyncService] [${totalProcessed}] Failed to sync inbound email ${typedEmail.id}:`,
              detail,
            );
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
    console.info(
      "[SyncService] Creating companies/applications from email logs...",
    );

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

      console.info(
        `[SyncService] Found ${logs.length} unlinked outbound email logs`,
      );

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
        const subject = (log.subject as string) || "";

        if (!sender) {
          skippedCount++;
          continue;
        }

        const domain = sender.split("@")[1];
        if (!domain) {
          skippedCount++;
          continue;
        }

        console.info(
          `[SyncService] Processing inbound log: ${sender} | Subject: ${subject.slice(0, 40)}...`,
        );

        try {
          // Check if response already exists for this email log
          const existingResponse = await pb
            .collection("responses")
            .getFirstListItem(`email_log="${log.id}"`)
            .catch(() => null);

          if (existingResponse) {
            skippedCount++;
            continue;
          }

          // Find company by domain
          const company = await pb
            .collection("companies")
            .getFirstListItem(`domain="${domain}" && user="${userId}"`)
            .catch(() => null);

          if (!company) {
            console.warn(
              `[SyncService] SKIP: No company found for domain ${domain}`,
            );
            skippedCount++;
            continue;
          }

          // Find application for this company
          // Try to find the most recent application that isn't rejected or inactive
          let application = await pb
            .collection("applications")
            .getFirstListItem(`company="${company.id}" && status!="rejected"`, {
              sort: "-last_activity_at",
            })
            .catch(() => null);

          // Fallback to any application for this company if none active
          if (!application) {
            application = await pb
              .collection("applications")
              .getFirstListItem(`company="${company.id}"`, {
                sort: "-last_activity_at",
              })
              .catch(() => null);
          }

          // Detect response type from subject
          const responseType = this.detectResponseType(subject);

          console.info(
            `[SyncService] Found association: ${company.name} | App: ${application?.id || "NONE"} | Type: ${responseType}`,
          );

          // Ensure date is formatted for PB
          const receivedAt = normalizeDate(log.sent_at || log.created);
          if (!receivedAt) {
            console.warn(
              `[SyncService] SKIP: Could not determine valid date for log ${log.id}`,
            );
            skippedCount++;
            continue;
          }

          // Create response
          await pb.collection("responses").create({
            company: company.id,
            application: application?.id || null,
            email_log: log.id,
            type: responseType,
            sender_email: parseFullEmailString(sender).email,
            subject: subject,
            received_at: receivedAt,
            user: userId,
          });
          responsesCreated++;

          // Update application status if we have one
          if (application) {
            const newStatus = this.getStatusFromResponseType(responseType);
            const logDate = receivedAt;

            // biome-ignore lint/suspicious/noExplicitAny: PocketBase transition
            const updateData: any = {
              last_activity_at: logDate,
              last_response_at: logDate,
            };

            // Only update if it's a more "advanced" status or if status is null/other
            if (newStatus && application.status !== newStatus) {
              console.info(
                `[SyncService] Updating application status: ${application.status} -> ${newStatus}`,
              );
              updateData.status = newStatus;
              applicationsUpdated++;
            }

            await pb
              .collection("applications")
              .update(application.id, updateData);
          }

          // Ensure email log is linked to company/application
          if (!log.company || !log.application) {
            await pb.collection("email_logs").update(log.id, {
              company: company.id,
              application: application?.id || log.application || null,
            });
          }
        } catch (err: unknown) {
          const error = err as {
            response?: { data?: unknown };
            message?: string;
          };
          const detail = error.response
            ? JSON.stringify(error.response.data || error.response)
            : error.message || String(err);
          console.error(
            `[SyncService] Failed to create response for log ${log.id}:`,
            detail,
          );
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
    const outboundResult = await this.syncEmailLogsOnly(userId);
    const inboundResult = await this.syncInboundEmailsOnly(userId);
    const companyResult = await this.createCompaniesFromLogs(userId);
    const responseResult = await this.createResponsesFromLogs(userId);

    return {
      outboundSynced: outboundResult.createdCount,
      inboundSynced: inboundResult.createdCount,
      companiesCreated: companyResult.companiesCreated,
      applicationsCreated: companyResult.applicationsCreated,
      responsesCreated: responseResult.responsesCreated,
    };
  },

  /**
   * Unified sync: logs, content, companies, applications, and responses
   */
  async syncAllEmailData(
    userId: string,
    options: {
      syncType?: "full" | "sent_only" | "received_only";
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
  ) {
    const { syncType = "full" } = options;

    let outboundCount = 0;
    let inboundCount = 0;

    // 1. Sync Logs (Sent)
    if (syncType === "full" || syncType === "sent_only") {
      const result = await this.syncEmailLogsOnly(userId, options);
      outboundCount = result.createdCount;
    }

    // 2. Sync Logs (Received)
    if (syncType === "full" || syncType === "received_only") {
      const result = await this.syncInboundEmailsOnly(userId, options);
      inboundCount = result.createdCount;
    }

    // 3. Create Companies and Applications
    const companyResult = await this.createCompaniesFromLogs(userId);

    // 4. Create Responses
    const responseResult = await this.createResponsesFromLogs(userId);

    return {
      outboundSynced: outboundCount,
      inboundSynced: inboundCount,
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
  ): Promise<{
    companyCreated: boolean;
    applicationCreated: boolean;
    companyId?: string;
  }> {
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
        console.info(
          `[SyncService] Created company: ${companyName} (${domain})`,
        );
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown }; message?: string };
      const detail = error.response
        ? JSON.stringify(error.response.data || error.response)
        : error.message || String(err);
      console.warn(
        `[SyncService] Failed to create/match for log ${logId}:`,
        detail,
      );
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

    name = name.replace(/-/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

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
   * Clean up incorrect email_logs created from Bcc recipients
   * Deletes outbound email_logs where recipient is a personal email (gmail.com, etc.)
   */
  async cleanupBccEmailLogs(userId: string) {
    const pb = await getAdminPB();
    console.info("[SyncService] Cleaning up Bcc email logs...");

    let deletedCount = 0;

    try {
      // Get all outbound email_logs for this user
      const logs = await pb.collection("email_logs").getFullList({
        filter: `user="${userId}" && direction="outbound" && provider="resend"`,
      });

      console.info(`[SyncService] Found ${logs.length} outbound logs to check`);

      // Personal email domains that shouldn't be recipients for outbound emails
      const personalDomains = [
        "gmail.com",
        "outlook.com",
        "hotmail.com",
        "yahoo.com",
        "icloud.com",
        "me.com",
      ];

      for (const log of logs) {
        const recipient = log.recipient as string;
        if (!recipient) continue;

        const domain = recipient.split("@")[1]?.toLowerCase();
        
        // If recipient is a personal email, it's likely a Bcc event
        if (domain && personalDomains.includes(domain)) {
          console.info(
            `[SyncService] Deleting Bcc log: ${log.id} (${recipient})`,
          );
          await pb.collection("email_logs").delete(log.id);
          deletedCount++;
        }
      }

      console.info(
        `[SyncService] Cleanup complete. Deleted ${deletedCount} Bcc logs`,
      );
      return { deletedCount, totalChecked: logs.length };
    } catch (error) {
      console.error("[SyncService] Bcc cleanup failed:", error);
      throw error;
    }
  },

  /**
   * Merge duplicate companies by base name
   * Groups companies like takt.com, takt.ca, takt@gmail.com under one "takt" company
   */
  async mergeCompanyDuplicates(userId: string) {
    const pb = await getAdminPB();
    console.info("[SyncService] Merging duplicate companies...");

    let mergedCount = 0;
    let keptCount = 0;

    try {
      // Get all companies for this user
      const companies = await pb.collection("companies").getFullList({
        filter: `user="${userId}"`,
      });

      console.info(
        `[SyncService] Found ${companies.length} companies to analyze`,
      );

      // Group companies by base name
      const groupedByBaseName: Record<
        string,
        Array<{ id: string; name: string; domain: string }>
      > = {};

      for (const company of companies) {
        const domain = company.domain as string;
        if (!domain) continue;

        // Extract base name using the same logic as webhook
        let baseName: string;
        const GENERIC_DOMAINS = [
          "gmail.com",
          "outlook.com",
          "hotmail.com",
          "yahoo.com",
          "icloud.com",
          "me.com",
        ];

        if (domain.includes("@")) {
          // It's an email (e.g., "takt@gmail.com")
          const prefix = domain.split("@")[0];
          baseName = prefix?.toLowerCase() || "";
        } else if (GENERIC_DOMAINS.some((gd) => domain.endsWith(gd))) {
          // It's a generic domain email
          baseName = domain.split("@")[0]?.toLowerCase() || domain;
        } else {
          // It's a professional domain
          const parts = domain.split(".");
          if (parts.length >= 2) {
            baseName = parts.slice(0, -1).join(".");
          } else {
            baseName = domain;
          }
        }

        // Skip if baseName is empty or invalid
        if (!baseName || baseName.trim() === "") {
          console.warn(
            `[SyncService] Skipping company ${company.id} - empty baseName from domain: ${domain}`,
          );
          continue;
        }

        baseName = baseName.toLowerCase().trim();

        if (!groupedByBaseName[baseName]) {
          groupedByBaseName[baseName] = [];
        }

        groupedByBaseName[baseName].push({
          id: company.id,
          name: company.name as string,
          domain: domain,
        });
      }

      console.info(
        `[SyncService] Grouped into ${Object.keys(groupedByBaseName).length} base names`,
      );
      
      // Log first 10 groups for debugging
      let debugCount = 0;
      for (const [baseName, companies] of Object.entries(groupedByBaseName)) {
        if (debugCount < 10 || companies.length > 1) {
          console.info(
            `[SyncService] Group "${baseName}": ${companies.length} companies - ${companies.map((c) => c.domain).join(", ")}`,
          );
          debugCount++;
        }
      }

      // Merge duplicates
      for (const [baseName, companyGroup] of Object.entries(
        groupedByBaseName,
      )) {
        if (companyGroup.length <= 1) continue; // No duplicates

        console.info(
          `[SyncService] Found ${companyGroup.length} companies for "${baseName}": ${companyGroup.map((c) => c.domain).join(", ")}`,
        );

        // Keep the first one (or choose based on criteria)
        const primaryCompany = companyGroup[0];
        const duplicates = companyGroup.slice(1);

        keptCount++;

        // Update primary company domain to base name
        await pb.collection("companies").update(primaryCompany.id, {
          domain: baseName,
          name:
            baseName.charAt(0).toUpperCase() + baseName.slice(1), // Capitalize
        });

        // Merge applications and email_logs from duplicates to primary
        for (const duplicate of duplicates) {
          // Move applications
          const apps = await pb.collection("applications").getFullList({
            filter: `company="${duplicate.id}"`,
          });
          for (const app of apps) {
            await pb.collection("applications").update(app.id, {
              company: primaryCompany.id,
            });
          }

          // Move email_logs
          const logs = await pb.collection("email_logs").getFullList({
            filter: `company="${duplicate.id}"`,
          });
          for (const log of logs) {
            await pb.collection("email_logs").update(log.id, {
              company: primaryCompany.id,
            });
          }

          // Delete duplicate company
          await pb.collection("companies").delete(duplicate.id);
          mergedCount++;

          console.info(
            `[SyncService] Merged ${duplicate.domain} into ${baseName}`,
          );
        }
      }

      console.info(
        `[SyncService] Company merge complete. Kept ${keptCount}, merged ${mergedCount}`,
      );
      return { keptCount, mergedCount, totalProcessed: companies.length };
    } catch (error) {
      console.error("[SyncService] Company merge failed:", error);
      throw error;
    }
  },

  /**
   * Merge duplicate applications for the same company
   * Keeps the oldest application and consolidates all email_logs
   */
  async mergeDuplicateApplications(userId: string) {
    const pb = await getAdminPB();
    console.info("[SyncService] Merging duplicate applications...");

    let mergedCount = 0;
    let keptCount = 0;

    try {
      // Get all companies for this user
      const companies = await pb.collection("companies").getFullList({
        filter: `user="${userId}"`,
      });

      console.info(
        `[SyncService] Found ${companies.length} companies to check`,
      );

      for (const company of companies) {
        // Get all applications for this company
        const applications = await pb.collection("applications").getFullList({
          filter: `company="${company.id}"`,
          sort: "created", // Oldest first
        });

        if (applications.length <= 1) continue; // No duplicates

        console.info(
          `[SyncService] Found ${applications.length} applications for company "${company.name}" (${company.domain})`,
        );

        // Keep the first (oldest) application
        const primaryApp = applications[0];
        const duplicates = applications.slice(1);

        keptCount++;

        // Merge email_logs from duplicates to primary
        for (const duplicate of duplicates) {
          // Move all email_logs to primary application
          const logs = await pb.collection("email_logs").getFullList({
            filter: `application="${duplicate.id}"`,
          });

          for (const log of logs) {
            await pb.collection("email_logs").update(log.id, {
              application: primaryApp.id,
            });
          }

          console.info(
            `[SyncService] Moved ${logs.length} email_logs from app ${duplicate.id} to ${primaryApp.id}`,
          );

          // Delete duplicate application
          await pb.collection("applications").delete(duplicate.id);
          mergedCount++;
        }

        // Recalculate follow-up count for primary application
        const allLogs = await pb.collection("email_logs").getFullList({
          filter: `application="${primaryApp.id}" && provider="resend" && direction="outbound"`,
          sort: "sent_at",
        });

        const followUpCount = allLogs.length > 1 ? allLogs.length - 1 : 0;
        const firstContactAt = allLogs[0]?.sent_at || primaryApp.created;
        const lastFollowUpAt =
          allLogs.length > 1 ? allLogs[allLogs.length - 1].sent_at : null;

        await pb.collection("applications").update(primaryApp.id, {
          follow_up_count: followUpCount,
          first_contact_at: firstContactAt,
          last_follow_up_at: lastFollowUpAt,
        });

        console.info(
          `[SyncService] Updated app ${primaryApp.id} - followUpCount: ${followUpCount}`,
        );
      }

      console.info(
        `[SyncService] Application merge complete. Kept ${keptCount}, merged ${mergedCount}`,
      );
      return { keptCount, mergedCount, totalCompanies: companies.length };
    } catch (error) {
      console.error("[SyncService] Application merge failed:", error);
      throw error;
    }
  },

  /**
   * Detect and merge company duplicates with smart name matching
   * Handles cases like "DD" vs "DD London", "Technorely" across different emails
   */
  async detectAndMergeSmartDuplicates(userId: string) {
    const pb = await getAdminPB();
    console.info("[SyncService] Detecting smart duplicates...");

    let mergedCount = 0;
    let detectedGroups = 0;

    try {
      // Get all companies
      const companies = await pb.collection("companies").getFullList({
        filter: `user="${userId}"`,
      });

      console.info(
        `[SyncService] Scanning ${companies.length} companies for smart duplicates`,
      );

      // Normalize company name for matching
      const normalizeCompanyName = (name: string, domain: string): string => {
        // Start with name or domain
        let normalized = (name || domain || "").toLowerCase().trim();

        // 1. Basic cleanup - remove special characters and punctuation
        normalized = normalized.replace(/[®™©]/g, "");

        // 2. Handle domains/emails if the name is just a domain/email
        if (normalized.includes(".") && !normalized.includes(" ")) {
          normalized = normalized.split(".")[0];
        } else if (normalized.includes("@")) {
          normalized = normalized.split("@")[0];
        }

        // 3. Remove common prefixes (order matters: longer first)
        const prefixes = ["agence", "agency", "studio", "the"];
        for (const p of prefixes) {
          const prefixRegex = new RegExp(`^${p}\\s+`, "i");
          if (prefixRegex.test(normalized)) {
            normalized = normalized.replace(prefixRegex, "");
          }
        }

        // 3.1 Common suffixes and keywords to strip 
        // Order by length descending to match "communications" before "communication"
        const keywords = [
          "communications",
          "communication",
          "interactive",
          "solutions",
          "production",
          "productions",
          "creative",
          "company",
          "digital",
          "studios",
          "studio",
          "agency",
          "london",
          "design",
          "house",
          "group",
          "canada",
          "nyc",
          "labs",
          "lab",
          "inc",
          "ltd",
          "llc",
          "co",
        ];

        // Clean up punctuation to make word boundaries clearer
        normalized = normalized.replace(/[^\w\s-]/g, " ");

        for (const kw of keywords) {
          // Case 1: Word boundary (e.g., "DD London" -> "DD")
          const wordRegex = new RegExp(`\\s+${kw}$`, "i");
          if (wordRegex.test(normalized)) {
            normalized = normalized.replace(wordRegex, "");
            continue; 
          }

          // Case 2: Attached (e.g., "DDLondon" -> "DD", "Dactylocommunication" -> "Dactylo")
          const attachedRegex = new RegExp(`${kw}$`, "i");
          if (
            attachedRegex.test(normalized) &&
            normalized.length >= kw.length + 2 // Changed to >= to catch "DDLondon" (8 char)
          ) {
            normalized = normalized.replace(attachedRegex, "");
          }
        }

        // 4. Final step: remove all remaining non-alphanumeric and spaces
        return normalized.replace(/[^\w]/g, "").trim();
      };

      // Group companies by normalized name
      const groupedByNormalizedName: Record<
        string,
        Array<{ id: string; name: string; domain: string; original: any }>
      > = {};

      for (const company of companies) {
        const normalized = normalizeCompanyName(
          company.name as string,
          company.domain as string,
        );

        if (!normalized) continue;

        if (!groupedByNormalizedName[normalized]) {
          groupedByNormalizedName[normalized] = [];
        }

        groupedByNormalizedName[normalized].push({
          id: company.id,
          name: company.name as string,
          domain: company.domain as string,
          original: company,
        });
      }

      // Log groups with duplicates
      console.info(`[SyncService] Found ${Object.keys(groupedByNormalizedName).length} unique normalized names`);
      
      const duplicateGroups = Object.entries(groupedByNormalizedName).filter(
        ([_, companies]) => companies.length > 1
      );
      
      console.info(`[SyncService] Groups with 2+ companies (duplicates):`);
      for (const [normalized, companies] of duplicateGroups) {
        console.info(
          `  "${normalized}": ${companies.length} companies - ${companies.map((c) => `"${c.name}" (${c.domain})`).join(", ")}`,
        );
      }
      
      // Search for specific companies mentioned by user
      const searchTerms = ["dd", "technorely", "tux"];
      console.info(`[SyncService] Searching for specific terms: ${searchTerms.join(", ")}`);
      for (const term of searchTerms) {
        const matches = Object.entries(groupedByNormalizedName).filter(
          ([normalized]) => normalized.includes(term)
        );
        if (matches.length > 0) {
          console.info(`  Found matches for "${term}":`);
          for (const [normalized, companies] of matches) {
            console.info(
              `    "${normalized}": ${companies.length} - ${companies.map((c) => `"${c.name}" (${c.domain})`).join(", ")}`,
            );
          }
        }
      }

      // Merge duplicates
      for (const [normalized, companyGroup] of Object.entries(
        groupedByNormalizedName,
      )) {
        if (companyGroup.length <= 1) continue;

        detectedGroups++;

        console.info(
          `[SyncService] 🔍 Found ${companyGroup.length} companies matching "${normalized}":`,
        );
        for (const comp of companyGroup) {
          console.info(
            `  - "${comp.name}" (${comp.domain}) [ID: ${comp.id}]`,
          );
        }

        // Keep the one with the most applications (most active)
        const companiesWithAppCounts = await Promise.all(
          companyGroup.map(async (comp) => {
            const apps = await pb.collection("applications").getFullList({
              filter: `company="${comp.id}"`,
            });
            return { ...comp, appCount: apps.length };
          }),
        );

        // Sort by app count (descending) - keep the most active one
        companiesWithAppCounts.sort((a, b) => b.appCount - a.appCount);
        const primaryCompany = companiesWithAppCounts[0];
        const duplicates = companiesWithAppCounts.slice(1);

        console.info(
          `[SyncService] ✅ Keeping "${primaryCompany.name}" as primary (${primaryCompany.appCount} apps)`,
        );

        // Merge applications and email_logs to primary
        for (const duplicate of duplicates) {
          // Move applications
          const apps = await pb.collection("applications").getFullList({
            filter: `company="${duplicate.id}"`,
          });

          for (const app of apps) {
            await pb.collection("applications").update(app.id, {
              company: primaryCompany.id,
            });
          }

          // Move email_logs
          const logs = await pb.collection("email_logs").getFullList({
            filter: `company="${duplicate.id}"`,
          });

          for (const log of logs) {
            await pb.collection("email_logs").update(log.id, {
              company: primaryCompany.id,
            });
          }

          console.info(
            `[SyncService] 🔀 Merged "${duplicate.name}" (${duplicate.appCount} apps, ${logs.length} logs) into primary`,
          );

          // Delete duplicate company
          await pb.collection("companies").delete(duplicate.id);
          mergedCount++;
        }
      }

      console.info(
        `[SyncService] ✨ Smart merge complete. Detected ${detectedGroups} groups, merged ${mergedCount} duplicates`,
      );

      return {
        detectedGroups,
        mergedCount,
        totalScanned: companies.length,
      };
    } catch (error) {
      console.error("[SyncService] Smart duplicate detection failed:", error);
      throw error;
    }
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

      console.info(
        `[SyncService] Found ${logs.length} Resend email logs to update`,
      );

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
            console.warn(
              `[SyncService] Failed to fetch email ${externalId}:`,
              response.error.message,
            );
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
            console.info(
              `[SyncService] Updated date for ${externalId}: ${sentAt}`,
            );
          } else {
            skippedCount++;
          }
        } catch (err) {
          console.error(
            `[SyncService] Error updating email ${externalId}:`,
            err,
          );
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

      console.info(
        `[SyncService] Found ${logs.length} Resend email logs to check`,
      );

      let processedCount = 0;
      for (const log of logs) {
        processedCount++;
        const externalId = log.external_id as string;
        const subject = (log.subject as string) || "(no subject)";
        const recipient = (log.recipient as string) || "(unknown)";

        console.info(
          `[SyncService] [${processedCount}/${logs.length}] Processing: ${externalId.slice(0, 8)}... | To: ${recipient} | Subject: ${subject.slice(0, 40)}...`,
        );

        if (!externalId) {
          console.warn(
            `[SyncService] [${processedCount}/${logs.length}] SKIP: No external_id`,
          );
          skippedCount++;
          continue;
        }

        try {
          // Rate limit: wait 600ms between requests
          console.info(
            `[SyncService] [${processedCount}/${logs.length}] Calling Resend API...`,
          );
          await delay(600);

          // Fetch email details from Resend
          const response = await resend.emails.get(externalId);

          if (response.error) {
            console.warn(
              `[SyncService] [${processedCount}/${logs.length}] API ERROR: ${response.error.message}`,
            );
            errorCount++;
            continue;
          }

          const emailData = response.data;
          // biome-ignore lint/suspicious/noExplicitAny: Resend API typing
          const lastEvent = (emailData as any)?.last_event;
          const currentStatus = log.status as string;

          console.info(
            `[SyncService] [${processedCount}/${logs.length}] Resend last_event: "${lastEvent}" | DB status: "${currentStatus}"`,
          );

          if (!lastEvent) {
            console.warn(
              `[SyncService] [${processedCount}/${logs.length}] SKIP: No last_event from Resend`,
            );
            skippedCount++;
            continue;
          }

          // Update email_logs status if different
          if (lastEvent !== currentStatus) {
            console.info(
              `[SyncService] [${processedCount}/${logs.length}] UPDATING email_log: ${currentStatus} → ${lastEvent}`,
            );
            await pb.collection("email_logs").update(log.id, {
              status: lastEvent,
            });
            updatedLogsCount++;

            // Also update the associated application if exists
            const applicationId = log.application as string;
            console.info(
              `[SyncService] [${processedCount}/${logs.length}] Application ID: ${applicationId || "NONE"}`,
            );

            if (applicationId) {
              try {
                // Map email event to application status
                const appStatusMap: Record<string, string> = {
                  bounced: "bounced",
                  clicked: "clicked",
                  complained: "bounced", // Treating spam complaint as a bounce/negative signal
                  delivered: "delivered",
                  delivery_delayed: "delivery_delayed",
                  failed: "failed",
                  opened: "opened",
                  sent: "sent",
                  suppressed: "suppressed",
                  queued: "queued",
                  scheduled: "scheduled",
                  canceled: "canceled",
                };

                const newAppStatus = appStatusMap[lastEvent];
                if (newAppStatus) {
                  console.info(
                    `[SyncService] [${processedCount}/${logs.length}] UPDATING application: → ${newAppStatus}`,
                  );
                  await pb.collection("applications").update(applicationId, {
                    status: newAppStatus,
                    last_activity_at: new Date().toISOString(),
                  });
                  updatedAppsCount++;
                } else {
                  console.info(
                    `[SyncService] [${processedCount}/${logs.length}] No app status mapping for "${lastEvent}"`,
                  );
                }
              } catch (appErr) {
                console.warn(
                  `[SyncService] [${processedCount}/${logs.length}] Failed to update application:`,
                  appErr,
                );
              }
            }
          } else {
            console.info(
              `[SyncService] [${processedCount}/${logs.length}] SKIP: Status unchanged (${currentStatus})`,
            );
            skippedCount++;
          }
        } catch (err) {
          console.error(
            `[SyncService] [${processedCount}/${logs.length}] ERROR:`,
            err,
          );
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

  /**
   * Reconcile all application statuses based on existing email_logs in DB.
   * No API calls, purely local logic to ensure DB consistency.
   */
  async reconcileApplicationStatuses(userId: string) {
    const pb = await getAdminPB();
    console.info(
      "[SyncService] Reconciling application statuses from local logs...",
    );

    let updatedCount = 0;
    let totalCount = 0;

    // Status priority (highest value = most advanced state)
    const statusPriority: Record<string, number> = {
      offer: 100,
      interview: 90,
      rejected: 80,
      responded: 70,
      clicked: 60,
      opened: 50,
      delivered: 40,
      sent: 30,
      bounced: 20,
      complained: 20,
      failed: 20,
      delivery_delayed: 10,
      queued: 5,
      scheduled: 5,
      canceled: 0,
      suppressed: 0,
    };

    try {
      const applications = await pb.collection("applications").getFullList({
        filter: `user="${userId}"`,
        expand: "email_logs(application)",
      });

      totalCount = applications.length;
      console.info(`[SyncService] Reconciling ${totalCount} applications...`);

      for (const app of applications) {
        // biome-ignore lint/suspicious/noExplicitAny: Expanded PocketBase relations are hard to type precisely
        const logs = (app.expand?.["email_logs(application)"] as any[]) || [];

        let bestStatus = app.status as string;
        let bestScore = statusPriority[bestStatus] || -1;
        let latestActivity = app.last_activity_at || app.created;
        let lastResponse = app.last_response_at || null;

        // Check if there are any inbound logs (meaning we got a response)
        const inboundLogs = logs.filter(
          (log: Record<string, unknown>) => log.direction === "inbound",
        );
        const hasInbound = inboundLogs.length > 0;
        if (hasInbound && bestScore < statusPriority.responded) {
          bestStatus = "responded";
          bestScore = statusPriority.responded;
        }

        // Check all logs to find the most advanced status and latest activity
        for (const log of logs) {
          const logStatus = log.status as string;
          const logScore = statusPriority[logStatus] || 0;

          if (logScore > bestScore) {
            bestStatus = logStatus;
            bestScore = logScore;
          }

          // Update latest activity date if log is newer
          const logDate = log.sent_at || log.received_at || log.created;
          if (logDate && logDate > latestActivity) {
            latestActivity = logDate;
          }

          // Track latest response date specifically
          if (
            log.direction === "inbound" &&
            logDate &&
            (!lastResponse || logDate > lastResponse)
          ) {
            lastResponse = logDate;
          }
        }

        // Update if something changed
        if (
          bestStatus !== app.status ||
          latestActivity !== app.last_activity_at ||
          lastResponse !== app.last_response_at
        ) {
          console.info(
            `[SyncService] Reconciled ${app.company}: ${app.status} → ${bestStatus} | Activity: ${latestActivity} | Response: ${lastResponse}`,
          );
          await pb.collection("applications").update(app.id, {
            status: bestStatus,
            last_activity_at: latestActivity,
            last_response_at: lastResponse,
          });
          updatedCount++;
        }
      }

      console.info(
        `[SyncService] Reconciliation complete. Updated ${updatedCount}/${totalCount} applications.`,
      );
      return { updatedCount, totalCount };
    } catch (error) {
      console.error("[SyncService] Reconciliation failed:", error);
      throw error;
    }
  },

  /**
   * Reconcile follow-up tracking data (first contact, count, last follow-up)
   * from existing outbound email logs.
   */
  async reconcileFollowUpTracking(userId: string) {
    const pb = await getAdminPB();
    console.info(
      "[SyncService] Reconciling follow-up tracking from local logs...",
    );

    let updatedCount = 0;
    let totalCount = 0;

    try {
      const applications = await pb.collection("applications").getFullList({
        filter: `user="${userId}"`,
        expand: "email_logs(application)",
      });

      totalCount = applications.length;
      console.info(
        `[SyncService] Reconciling follow-ups for ${totalCount} applications...`,
      );

      for (const app of applications) {
        // biome-ignore lint/suspicious/noExplicitAny: Expanded relations
        const logs = (app.expand?.["email_logs(application)"] as any[]) || [];

        // Filter for outbound logs (sent emails)
        const outboundLogs = logs
          .filter(
            (log: Record<string, unknown>) => log.direction === "outbound",
          )
          .sort((a, b) => {
            const dateA = new Date(a.sent_at || a.created).getTime();
            const dateB = new Date(b.sent_at || b.created).getTime();
            return dateA - dateB;
          });

        if (outboundLogs.length === 0) continue;

        const firstLog = outboundLogs[0];
        const lastLog = outboundLogs[outboundLogs.length - 1];

        const firstContactAt = firstLog.sent_at || firstLog.created;
        const followUpCount =
          outboundLogs.length > 1 ? outboundLogs.length - 1 : 0;
        const lastFollowUpAt =
          outboundLogs.length > 1 ? lastLog.sent_at || lastLog.created : null;

        // Update if something changed
        if (
          app.first_contact_at !== firstContactAt ||
          app.follow_up_count !== followUpCount ||
          app.last_follow_up_at !== lastFollowUpAt
        ) {
          console.info(
            `[SyncService] UPDATING follow-ups for ${app.company}: Count ${app.follow_up_count} -> ${followUpCount}`,
          );
          await pb.collection("applications").update(app.id, {
            first_contact_at: firstContactAt,
            follow_up_count: followUpCount,
            last_follow_up_at: lastFollowUpAt,
          });
          updatedCount++;
        }
      }

      console.info(
        `[SyncService] Follow-up reconciliation complete. Updated ${updatedCount}/${totalCount} apps.`,
      );
      return { updatedCount, totalCount };
    } catch (error) {
      console.error("[SyncService] Follow-up reconciliation failed:", error);
      throw error;
    }
  },

  /**
   * SPECIAL: Import data from Awwwards CSV files
   */
  async importAwwwardsCsvs(userId: string) {
    const pb = await getAdminPB();
    const csvFiles = [
      "awwwards_canada_professionals - Canada.csv",
      "awwwards_canada_professionals - Suisse.csv",
      "awwwards_canada_professionals - Uk.csv",
      "awwwards_canada_professionals - US.csv",
      "awwwards_canada_professionals - Autre.csv",
    ];

    let newCompanies = 0;
    let newApplications = 0;
    let updatedApplications = 0;
    let totalRows = 0;

    const parseCsvDate = (
      dateStr: string | null | undefined,
    ): string | null => {
      if (!dateStr || dateStr.trim() === "" || dateStr.trim() === "-")
        return null;
      // Format is DD/MM/YYYY
      const parts = dateStr.split("/");
      if (parts.length !== 3) return null;
      try {
        const day = Number.parseInt(parts[0]);
        const month = Number.parseInt(parts[1]) - 1;
        const year = Number.parseInt(parts[2]);
        const date = new Date(year, month, day, 12, 0, 0);
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString();
      } catch {
        return null;
      }
    };

    for (const filename of csvFiles) {
      const filePath = path.join(process.cwd(), filename);
      if (!fs.existsSync(filePath)) {
        console.warn(`[SyncService] CSV file not found: ${filename}`);
        continue;
      }

      console.info(`[SyncService] Importing ${filename}...`);
      const fileContent = fs.readFileSync(filePath, "utf-8");

      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];

      for (const record of records) {
        totalRows++;
        const name = record.Name || record.name || record.Nom;
        if (!name || name.trim() === "" || name.trim() === "-") continue;

        // Extract raw website and email (support multiple header variations across files)
        const websiteRaw =
          record.Website ||
          record["Website\n"] ||
          record.website ||
          record.URL ||
          "";
        const email =
          record.Email || record.email || record.Mail || record.Courriel || "";

        let validWebsite: string | null = null;
        let domain = "";

        // Try to find a valid URL in various potential fields
        // Some rows have "from https://..." so we extract the URL part
        const potentialUrlFields = [
          websiteRaw,
          record.Infos,
          record.Commentaire,
        ].filter(Boolean);

        for (const rawValue of potentialUrlFields) {
          if (typeof rawValue !== "string") continue;

          // Simple regex to find the first URL in the string
          const urlMatch = rawValue.match(/https?:\/\/[^\s,]+/i);
          const extractedUrl = urlMatch ? urlMatch[0] : null;

          if (extractedUrl) {
            try {
              const urlObj = new URL(extractedUrl);
              // Set validWebsite if not already found (prioritizing the Website column)
              if (!validWebsite) validWebsite = urlObj.href;
              // Extract domain if not already found
              if (!domain) domain = urlObj.hostname.replace("www.", "");

              // If we have both, we can stop searching
              if (validWebsite && domain) break;
            } catch {
              // Not a valid URL, continue
            }
          }
        }

        if (!domain && email.includes("@")) {
          domain = email.split("@")[1];
        }

        // Try to find existing company - be strict with domain, then fuzzy with name
        let company = null;
        if (domain) {
          try {
            company = await pb
              .collection("companies")
              .getFirstListItem(`domain="${domain}" && user="${userId}"`);
          } catch {}
        }

        if (!company) {
          try {
            const normalizedName = name
              .toLowerCase()
              .trim()
              .replace(/"/g, '\\"');
            company = await pb
              .collection("companies")
              .getFirstListItem(`name~"${normalizedName}" && user="${userId}"`);
          } catch {}
        }

        if (!company) {
          try {
            // PocketBase requires a domain. If missing, we generate one from the name.
            const safeDomain =
              domain ||
              `${name
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]/g, "-")}.local`;

            company = await pb.collection("companies").create({
              name: name,
              domain: safeDomain,
              website: validWebsite,
              user: userId,
            });
            newCompanies++;
          } catch (createErr) {
            // biome-ignore lint/suspicious/noExplicitAny: PocketBase error typing
            const err = createErr as any;
            const errorDetails = err.response?.data
              ? JSON.stringify(err.response.data)
              : err.message;
            console.error(
              `[SyncService] Failed to create company "${name}" in ${filename}:`,
              errorDetails,
            );
            // Skip this record and continue
            continue;
          }
        }

        // Find or create application
        let application = null;
        try {
          application = await pb
            .collection("applications")
            .getFirstListItem(`company="${company.id}" && user="${userId}"`, {
              sort: "-created",
            });
        } catch {}

        const dateHeader =
          record["Date mail 1"] || record.Date || record["Date mail"];
        const csvDate = parseCsvDate(dateHeader);

        const reponseValue = (record.Réponse || record.Reponse || "")
          .toString()
          .toUpperCase();
        const isResponded =
          reponseValue === "TRUE" ||
          reponseValue === "OUI" ||
          reponseValue === "1";

        const reponseFinale =
          record["Réponse finale"] ||
          record.ReponseFinale ||
          record.Feedback ||
          "";
        const tech = record.Tech || record.Technologies || record.Stack || "";
        const commentField =
          record.Commentaire ||
          record.Comment ||
          record.Infos ||
          record.Notes ||
          "";

        let newStatus: ApplicationStatus = "sent";
        if (isResponded) newStatus = "responded";

        const rejectionTerms = [
          "refus",
          "regret",
          "malheureusement",
          "unfortunately",
          "rejected",
          "nope",
          "pas retenu",
          "négatif",
          "negatif",
        ];
        if (
          rejectionTerms.some(
            (term) =>
              reponseFinale.toLowerCase().includes(term) ||
              commentField.toLowerCase().includes(term),
          )
        ) {
          newStatus = "rejected";
        }

        const formattedNotes = `--- IMPORT CSV (${filename}) ---\nTech: ${tech}\nComment: ${commentField}\nFinal Response: ${reponseFinale}`;

        if (!application) {
          await pb.collection("applications").create({
            company: company.id,
            user: userId,
            status: newStatus,
            sent_at: csvDate || new Date().toISOString(),
            first_contact_at: csvDate || null,
            last_activity_at: csvDate || new Date().toISOString(),
            position: "Non spécifié (Import CSV)",
            notes: formattedNotes,
          });
          newApplications++;
        } else {
          // Update only if CSV shows more progress or has missing date
          const updates: Record<string, unknown> = {};

          if (
            csvDate &&
            (!application.first_contact_at ||
              new Date(csvDate) < new Date(application.first_contact_at))
          ) {
            updates.first_contact_at = csvDate;
            if (
              !application.sent_at ||
              new Date(csvDate) < new Date(application.sent_at)
            ) {
              updates.sent_at = csvDate;
            }
          }

          // Don't downgrade status
          const statusOrder: ApplicationStatus[] = [
            "sent",
            "delivered",
            "opened",
            "clicked",
            "responded",
            "interview",
            "offer",
            "rejected",
          ];
          const currentIdx = statusOrder.indexOf(
            application.status as ApplicationStatus,
          );
          const newIdx = statusOrder.indexOf(newStatus);
          if (newIdx > currentIdx) {
            updates.status = newStatus;
          }

          // Append notes if they seem new
          if (!application.notes || !application.notes.includes(filename)) {
            updates.notes = application.notes
              ? `${application.notes}\n\n${formattedNotes}`
              : formattedNotes;
          }

          if (Object.keys(updates).length > 0) {
            await pb.collection("applications").update(application.id, updates);
            updatedApplications++;
          }
        }
      }
    }

    return { totalRows, newCompanies, newApplications, updatedApplications };
  },
};

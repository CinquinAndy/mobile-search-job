import { NextResponse } from "next/server";
import { emailService } from "@/services/email.service";
import { pbAdmin } from "@/services/pocketbase.server";
import type { Email } from "@/types/email";

// Helper to ensure date is valid or null for PocketBase
function formatPbDate(dateStr?: string | null): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  try {
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

// Helper to convert Email to PocketBase format
function emailToPb(email: Email, userId: string) {
  // Truncate body_text to 4900 chars to avoid PocketBase validation limit
  const bodyText =
    email.body && email.body.length > 4900
      ? email.body.substring(0, 4900) + "..."
      : email.body;

  return {
    resend_id: email.resendId || email.id,
    folder: email.folder,
    from_email: email.from.email,
    from_name: email.from.name || "",
    to_emails: email.to,
    cc_emails: email.cc || [],
    bcc_emails: email.bcc || [],
    subject: email.subject,
    body_text: bodyText,
    body_html: email.html,
    status: email.status,
    is_read: email.isRead,
    is_starred: email.isStarred,
    has_attachments: email.hasAttachments,
    sent_at: formatPbDate(email.sentAt),
    received_at: formatPbDate(email.receivedAt),
    opened_at: formatPbDate(email.metadata?.openedAt),
    clicked_at: formatPbDate(email.metadata?.clickedAt),
    thread_id: email.threadId,
    in_reply_to: email.inReplyTo,
    resend_metadata: email.metadata,
    user: userId,
  };
}

/**
 * Background email synchronization function
 * Fetches emails from Resend and stores them in PocketBase
 */
async function syncEmailsInBackground(
  syncId: string,
  userId: string,
  options: {
    syncType: "full" | "sent_only" | "received_only";
    dateFrom?: Date;
    dateTo?: Date;
  },
) {
  const startTime = Date.now();

  try {
    // Update sync log to running
    await pbAdmin.collection("email_sync_logs").update(syncId, {
      status: "running",
    });

    let emailsFetched = 0;
    let emailsCreated = 0;

    // Fetch sent emails
    if (options.syncType === "full" || options.syncType === "sent_only") {
      console.info("[EmailSync] Fetching sent emails...");
      const sentEmails = await emailService.getSentEmails(options.dateFrom);
      emailsFetched += sentEmails.length;

      // Save to PocketBase
      for (const email of sentEmails) {
        try {
          const data = emailToPb(email, userId);

          // Try to find existing by resend_id
          const existing = await pbAdmin
            .collection("emails")
            .getFirstListItem(
              `resend_id = "${email.resendId || email.id}" && user = "${userId}"`,
            )
            .catch(() => null);

          if (existing) {
            await pbAdmin.collection("emails").update(existing.id, data);
          } else {
            await pbAdmin.collection("emails").create(data);
            emailsCreated++;
          }
        } catch (error: unknown) {
          const err = error as any;
          const detail = err.response
            ? JSON.stringify(err.response, null, 2)
            : error instanceof Error
              ? error.message
              : String(error);
          console.error(`Failed to save sent email ${email.id}:`, detail);
        }
      }
    }

    // Fetch received emails
    if (options.syncType === "full" || options.syncType === "received_only") {
      console.info("[EmailSync] Fetching received emails...");
      try {
        const receivedEmails = await emailService.getInbox(options.dateFrom);
        emailsFetched += receivedEmails.length;

        // Save to PocketBase
        for (const email of receivedEmails) {
          try {
            const data = emailToPb(email, userId);

            // Try to find existing by resend_id
            const existing = await pbAdmin
              .collection("emails")
              .getFirstListItem(
                `resend_id = "${email.resendId || email.id}" && user = "${userId}"`,
              )
              .catch(() => null);

            if (existing) {
              await pbAdmin.collection("emails").update(existing.id, data);
            } else {
              await pbAdmin.collection("emails").create(data);
              emailsCreated++;
            }
          } catch (error: unknown) {
            const err = error as any;
            const detail = err.response
              ? JSON.stringify(err.response, null, 2)
              : error instanceof Error
                ? error.message
                : String(error);
            console.error(`Failed to save received email ${email.id}:`, detail);
          }
        }
      } catch (error) {
        console.warn(
          "[EmailSync] Could not fetch received emails (normal if not configured):",
          error,
        );
      }
    }

    // Calculate duration
    const duration = Date.now() - startTime;

    // Update sync log to completed
    await pbAdmin.collection("email_sync_logs").update(syncId, {
      status: "completed",
      emails_fetched: emailsFetched,
      emails_created: emailsCreated,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    });

    console.info(
      `[EmailSync] Completed sync ${syncId}: ${emailsFetched} fetched, ${emailsCreated} created in ${duration}ms`,
    );
  } catch (error: unknown) {
    const err = error as any;
    const detail = err.response
      ? JSON.stringify(err.response, null, 2)
      : error instanceof Error
        ? error.message
        : String(error);
    console.error(`[EmailSync] Failed sync ${syncId}:`, detail);

    // Update sync log to failed
    await pbAdmin
      .collection("email_sync_logs")
      .update(syncId, {
        status: "failed",
        errors: [detail],
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      })
      .catch((e) =>
        console.error("Failed to update sync log to failed status:", e),
      );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { syncType = "full", dateFrom, dateTo, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId required" },
        { status: 400 },
      );
    }

    // Create sync log using admin
    const syncLog = await pbAdmin.collection("email_sync_logs").create({
      sync_type: syncType,
      status: "pending",
      date_from: dateFrom,
      date_to: dateTo,
      emails_fetched: 0,
      emails_created: 0,
      emails_updated: 0,
      started_at: new Date().toISOString(),
      user: userId,
    });

    // Start background sync (don't await)
    syncEmailsInBackground(syncLog.id, userId, {
      syncType,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    }).catch((error) => {
      console.error("Background sync error:", error);
    });

    // Return immediately with sync ID
    return NextResponse.json({
      success: true,
      syncId: syncLog.id,
      message: "Email synchronization started in background",
    });
  } catch (error) {
    console.error("Failed to start email sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start sync",
      },
      { status: 500 },
    );
  }
}

/**
 * GET endpoint to check sync status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get("syncId");
    const userId = searchParams.get("userId");

    if (syncId) {
      // Get specific sync log
      const syncLog = await pbAdmin
        .collection("email_sync_logs")
        .getOne(syncId);
      return NextResponse.json({ success: true, syncLog });
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId or syncId required" },
        { status: 400 },
      );
    }

    //Get latest sync log for user
    const syncLog = await pbAdmin
      .collection("email_sync_logs")
      .getFirstListItem(`user = "${userId}"`, { sort: "-created" })
      .catch(() => null);

    return NextResponse.json({ success: true, syncLog });
  } catch (error) {
    console.error("Failed to get sync status:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get sync status",
      },
      { status: 500 },
    );
  }
}

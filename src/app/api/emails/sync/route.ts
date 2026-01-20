import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { emailService } from "@/services/email.service";
import { pbAdmin } from "@/services/pocketbase.server";
import type { Email } from "@/types/email";

// Helper to convert Email to PocketBase format
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

// Helper to get authenticated PocketBase instance
async function getPbWithAuth() {
  const cookieStore = await cookies();
  const pb = pbAdmin; // Use admin instance for background tasks

  // Get auth from cookies
  const authCookie = cookieStore.get("pb_auth");
  if (authCookie?.value) {
    pb.authStore.loadFromCookie(authCookie.value);
  }

  return pb;
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
      const sentEmails = await emailService.getSentEmails();
      emailsFetched += sentEmails.length;
      
      // Save to PocketBase
      for (const email of sentEmails) {
        try {
          const data = emailToPb(email, userId);
          
          // Try to find existing by resend_id
          const existing = await pbAdmin.collection("emails").getFirstListItem(
            `resend_id = "${email.resendId || email.id}"`,
          ).catch(() => null);
          
          if (existing) {
            await pbAdmin.collection("emails").update(existing.id, data);
          } else {
            await pbAdmin.collection("emails").create(data);
            emailsCreated++;
          }
        } catch (error) {
          console.error(`Failed to save sent email ${email.id}:`, error);
        }
      }
    }

    // Fetch received emails
    if (options.syncType === "full" || options.syncType === "received_only") {
      console.info("[EmailSync] Fetching received emails...");
      try {
        const receivedEmails = await emailService.getInbox();
        emailsFetched += receivedEmails.length;
        
        // Save to PocketBase
        for (const email of receivedEmails) {
          try {
            const data = emailToPb(email, userId);
            
            // Try to find existing by resend_id
            const existing = await pbAdmin.collection("emails").getFirstListItem(
              `resend_id = "${email.resendId || email.id}"`,
            ).catch(() => null);
            
            if (existing) {
              await pbAdmin.collection("emails").update(existing.id, data);
            } else {
              await pbAdmin.collection("emails").create(data);
              emailsCreated++;
            }
          } catch (error) {
            console.error(`Failed to save received email ${email.id}:`, error);
          }
        }
      } catch (error) {
        console.warn("[EmailSync] Could not fetch received emails (normal if not configured):", error);
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
  } catch (error) {
    console.error(`[EmailSync] Failed sync ${syncId}:`, error);
    
    // Update sync log to failed
    await pbAdmin.collection("email_sync_logs").update(syncId, {
      status: "failed",
      errors: [error instanceof Error ? error.message : "Unknown error"],
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    });
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
      const syncLog = await pbAdmin.collection("email_sync_logs").getOne(syncId);
      return NextResponse.json({ success: true, syncLog });
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId or syncId required" },
        { status: 400 },
      );
    }

    //Get latest sync log for user
    const syncLog = await pbAdmin.collection("email_sync_logs").getFirstListItem(
      `user = "${userId}"`,
      { sort: "-created" },
    ).catch(() => null);
    
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

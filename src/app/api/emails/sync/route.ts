import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { emailService } from "@/services/email.service";
import { emailPbService } from "@/services/email-pb.service";

// Helper to get authenticated PocketBase instance
async function getPbWithAuth() {
  const cookieStore = await cookies();
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);

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
    await emailPbService.updateSyncLog(syncId, {
      status: "running",
    });

    let emailsFetched = 0;
    let emailsCreated = 0;
    const emailsUpdated = 0;

    // Fetch sent emails
    if (options.syncType === "full" || options.syncType === "sent_only") {
      console.info("[EmailSync] Fetching sent emails...");
      const sentEmails = await emailService.getSentEmails();
      emailsFetched += sentEmails.length;

      // Save to PocketBase
      for (const email of sentEmails) {
        try {
          await emailPbService.saveEmail(email, userId);
          emailsCreated++;
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
            await emailPbService.saveEmail(email, userId);
            emailsCreated++;
          } catch (error) {
            console.error(`Failed to save received email ${email.id}:`, error);
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
    await emailPbService.updateSyncLog(syncId, {
      status: "completed",
      emails_fetched: emailsFetched,
      emails_created: emailsCreated,
      emails_updated: emailsUpdated,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    });

    console.info(
      `[EmailSync] Completed sync ${syncId}: ${emailsFetched} fetched, ${emailsCreated} created in ${duration}ms`,
    );
  } catch (error) {
    console.error(`[EmailSync] Failed sync ${syncId}:`, error);

    // Update sync log to failed
    await emailPbService.updateSyncLog(syncId, {
      status: "failed",
      errors: [error instanceof Error ? error.message : "Unknown error"],
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    });
  }
}

export async function POST(request: Request) {
  try {
    const pb = await getPbWithAuth();

    if (!pb.authStore.isValid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = pb.authStore.model?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID not found" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { syncType = "full", dateFrom, dateTo } = body;

    // Create sync log
    const syncId = await emailPbService.createSyncLog(userId, {
      sync_type: syncType,
      date_from: dateFrom ? new Date(dateFrom) : undefined,
      date_to: dateTo ? new Date(dateTo) : undefined,
    });

    // Start background sync (don't await)
    syncEmailsInBackground(syncId, userId, {
      syncType,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    }).catch((error) => {
      console.error("Background sync error:", error);
    });

    // Return immediately with sync ID
    return NextResponse.json({
      success: true,
      syncId,
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
    const pb = await getPbWithAuth();

    if (!pb.authStore.isValid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get("syncId");

    if (syncId) {
      // Get specific sync log
      const syncLog = await emailPbService.getSyncLog(syncId);
      return NextResponse.json({ success: true, syncLog });
    }

    // Get latest sync log
    const userId = pb.authStore.model?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID not found" },
        { status: 401 },
      );
    }

    const latestSync = await emailPbService.getLatestSyncLog(userId);
    return NextResponse.json({ success: true, syncLog: latestSync });
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

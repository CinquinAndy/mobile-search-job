"use server";

import { revalidatePath } from "next/cache";
import { syncService } from "@/services/sync.service";

/**
 * Sync only outbound email logs from Resend API (sent emails)
 */
export async function syncEmailLogsAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.syncEmailLogsOnly(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync only inbound email logs from Resend API (received emails)
 */
export async function syncInboundEmailsAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.syncInboundEmailsOnly(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Link email_logs to existing companies based on domain
 */
export async function linkLogsToCompaniesAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.linkLogsToCompanies(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create companies and applications from existing email_logs
 * Does NOT call Resend API
 */
export async function createCompaniesAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.createCompaniesFromLogs(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create responses from inbound email_logs
 */
export async function createResponsesAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.createResponsesFromLogs(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Full sync: email logs + create companies/applications + responses
 */
export async function syncApplicationsAction(
  userId: string,
  options: {
    syncType?: "full" | "sent_only" | "received_only";
    dateFrom?: Date;
    dateTo?: Date;
  } = {},
) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.syncAllEmailData(userId, options);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * DANGER: Reset all sync data (email_logs, responses, applications, companies)
 */
export async function resetAllDataAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.resetAllData(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update email dates from Resend API
 */
export async function updateEmailDatesAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.updateEmailDates(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update email statuses from Resend API (last_event)
 */
export async function updateEmailStatusesAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.updateEmailStatuses(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reconcile application statuses locally
 */
export async function reconcileApplicationStatusesAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.reconcileApplicationStatuses(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reconcile follow-up tracking data (first contact, count, last follow-up)
 */
export async function reconcileFollowUpTrackingAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.reconcileFollowUpTracking(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Import Awwwards CSV data
 */
export async function importAwwwardsCsvsAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.importAwwwardsCsvs(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clean up incorrect email_logs from Bcc recipients
 */
export async function cleanupBccEmailLogsAction(userId: string) {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const results = await syncService.cleanupBccEmailLogs(userId);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

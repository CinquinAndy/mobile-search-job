"use server";

import { revalidatePath } from "next/cache";
import { syncService } from "@/services/sync.service";

export async function syncApplicationsAction() {
  try {
    const results = await syncService.syncResendEmails();
    revalidatePath("/");
    return { success: true, data: results };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { resendService } from "@/services/resend.service";

/**
 * GET /api/emails/content/[id]
 * Fetch full email content (HTML/text) from Resend by email ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Email ID is required" },
        { status: 400 },
      );
    }

    // Fetch email content from Resend
    const emailContent = await resendService.getEmail(id);

    return NextResponse.json({
      success: true,
      content: {
        html: emailContent.html,
        text: emailContent.text,
      },
    });
  } catch (error) {
    console.error("Failed to fetch email content:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

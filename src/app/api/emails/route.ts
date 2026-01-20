import { NextResponse } from "next/server";
import { emailService } from "@/services/email.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "sent";

    let emails;
    if (folder === "inbox") {
      emails = await emailService.getInbox();
    } else {
      emails = await emailService.getSentEmails();
    }

    return NextResponse.json({ success: true, emails });
  } catch (error) {
    console.error("Failed to fetch emails:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch emails",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (action === "send") {
      const result = await emailService.sendEmail(params);
      return NextResponse.json({ success: true, result });
    }

    if (action === "reply") {
      const { emailId, ...replyParams } = params;
      const result = await emailService.replyToEmail(emailId, replyParams);
      return NextResponse.json({ success: true, result });
    }

    if (action === "forward") {
      const { emailId, ...forwardParams } = params;
      const result = await emailService.forwardEmail(emailId, forwardParams);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Failed to process email action:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process email",
      },
      { status: 500 },
    );
  }
}

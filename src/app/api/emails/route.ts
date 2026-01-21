import { NextResponse } from "next/server";
import { pbAdmin } from "@/services/pocketbase.server";
import { emailService } from "@/services/email.service";
import type { Email, EmailFolder } from "@/types/email";

// Helper to convert PocketBase email to our Email type
function pbToEmail(record: any): Email {
  return {
    id: record.id,
    resendId: record.resend_id,
    from: {
      email: record.from_email,
      name: record.from_name,
    },
    to: record.to_emails || [],
    cc: record.cc_emails,
    bcc: record.bcc_emails,
    subject: record.subject,
    body: record.body_text || "",
    html: record.body_html,
    status: record.status as any,
    folder: record.folder as EmailFolder,
    threadId: record.thread_id,
    inReplyTo: record.in_reply_to,
    isRead: record.is_read || false,
    isStarred: record.is_starred || false,
    hasAttachments: record.has_attachments || false,
    sentAt: record.sent_at,
    receivedAt: record.received_at,
    createdAt: record.created,
    updatedAt: record.updated,
    metadata: {
      openedAt: record.opened_at,
      clickedAt: record.clicked_at,
      ...record.resend_metadata,
    },
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "sent";
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId parameter required" },
        { status: 400 },
      );
    }

    // Read from PocketBase using admin
    const filter = `user = "${userId}" && folder = "${folder}"`;
    
    const records = await pbAdmin.collection("emails").getFullList({
      filter,
      sort: "-created",
    });

    const emails = records.map(pbToEmail);

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
      const { userId, ...sendParams } = params;
      const result = await emailService.sendEmail({
        ...sendParams,
        userId,
      });
      return NextResponse.json({ success: true, result });
    }

    if (action === "reply") {
      const { emailId, ...replyParams } = body;
      const result = await emailService.replyToEmail(emailId, replyParams);
      return NextResponse.json({ success: true, result });
    }

    if (action === "forward") {
      const { emailId, ...forwardParams } = body;
      const result = await emailService.forwardEmail(emailId, forwardParams);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "sent";

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

    // Read from PocketBase instead of calling Resend directly
    let emails;
    if (folder === "inbox") {
      emails = await emailPbService.getEmails(userId, "inbox" as any);
    } else {
      emails = await emailPbService.getEmails(userId, "sent" as any);
    }

    return NextResponse.json({ success: true, emails });
  } catch (error) {
    console.error("Failed to fetch emails:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch emails",
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

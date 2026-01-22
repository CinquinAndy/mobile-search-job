import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { webhookService } from "@/services/webhook.service";
import type { ResendWebhookPayload } from "@/types/webhook";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

/**
 * Verify Resend webhook signature using Svix
 */
async function verifyWebhookSignature(
  payload: string,
  headers: Headers,
): Promise<ResendWebhookPayload> {
  console.log("[Webhook] Verifying signature...");
  console.log("WEBHOOK_SECRET", WEBHOOK_SECRET);
  console.log("payload", payload);
  console.log("headers", headers);

  if (!WEBHOOK_SECRET) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured");
  }

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing Svix headers");
  }

  const wh = new Webhook(WEBHOOK_SECRET);

  const verified = wh.verify(payload, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  }) as ResendWebhookPayload;

  return verified;
}

/**
 * POST /api/webhooks/resend
 * Receives webhook events from Resend
 */
export async function POST(request: Request) {
  try {
    // Get raw body for signature verification
    const payload = await request.text();

    // Verify signature
    let event: ResendWebhookPayload;
    try {
      event = await verifyWebhookSignature(payload, request.headers);
    } catch (error) {
      console.error("[Webhook] Signature verification failed:", error);
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 401 },
      );
    }

    console.info(`[Webhook] Received event: ${event.type}`);

    // Process the webhook event
    const result = await webhookService.processWebhookEvent(event);

    return NextResponse.json({
      ...result,
      success: true,
    });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);

    // Always return 200 to prevent Resend from retrying
    // Log the error but acknowledge receipt
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
      acknowledged: true,
    });
  }
}

/**
 * GET /api/webhooks/resend
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Resend webhook endpoint is active",
    configured: !!WEBHOOK_SECRET,
  });
}

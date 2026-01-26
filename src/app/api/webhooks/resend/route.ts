import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { webhookService } from "@/services/webhook.service";
import type { ResendWebhookPayload } from "@/types/webhook";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

import webPush from "web-push";
import { pbAdmin } from "@/services/pocketbase.server";

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    "mailto:contact@andy-cinquin.fr",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

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

    // Send push notification
    try {
      const subscriptions = await pbAdmin
        .collection("push_subscriptions")
        .getFullList();

      const message = `Email Update: ${event.type}`;
      // extracted from 'From: Name <email>' usually
      const from = event.data.from || "Unknown";
      const body = `From: ${from}\nSubject: ${event.data.subject}`;

      const notificationPayload = JSON.stringify({
        title: message,
        body: body,
        url: result.emailId ? `/mail?emailId=${result.emailId}` : "/mail",
      });

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            if (!sub.endpoint || !sub.keys) return;

            await webPush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys,
              },
              notificationPayload,
            );
          } catch (err: unknown) {
            console.error("Failed to send notification to", sub.id, err);
            // Check for 410 Gone or 404 Not Found
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 410 || statusCode === 404) {
              // Subscription expired, remove it
              await pbAdmin.collection("push_subscriptions").delete(sub.id);
            }
          }
        }),
      );
    } catch (pushError) {
      console.error("Error sending push notifications:", pushError);
    }

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

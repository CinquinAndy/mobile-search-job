/**
 * Resend Webhook Event Types
 */

// All possible Resend webhook event types
export type ResendWebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained"
  | "email.delivery_delayed";

// Base webhook payload structure
export interface ResendWebhookPayload {
  type: ResendWebhookEventType;
  created_at: string;
  data: ResendWebhookEmailData;
}

// Email data in webhook payload
export interface ResendWebhookEmailData {
  email_id: string;
  from: string;
  to: string[];
  subject: string;
  created_at: string;
  // Optional fields that may be present depending on event type
  click?: {
    link: string;
    timestamp: string;
  };
  bounce?: {
    message: string;
  };
}

// Mapping from webhook event types to our EmailStatus
export const WEBHOOK_TO_EMAIL_STATUS: Record<ResendWebhookEventType, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delivery_delayed",
};

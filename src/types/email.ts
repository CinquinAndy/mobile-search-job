/**
 * Email-related type definitions for the mail client
 */

export enum EmailFolder {
  INBOX = "inbox",
  SENT = "sent",
  DRAFTS = "drafts",
  ARCHIVE = "archive",
}

export enum EmailStatus {
  // Resend statuses
  QUEUED = "queued",
  SCHEDULED = "scheduled",
  SENT = "sent",
  DELIVERED = "delivered",
  DELIVERY_DELAYED = "delivery_delayed",
  BOUNCED = "bounced",
  FAILED = "failed",
  COMPLAINED = "complained",
  CANCELED = "canceled",
  SUPPRESSED = "suppressed",
  // Engagement statuses
  OPENED = "opened",
  CLICKED = "clicked",
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface Email {
  id: string;
  resendId?: string; // ID from Resend API
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string; // Plain text
  html?: string; // HTML version
  status: EmailStatus;
  folder: EmailFolder;
  threadId?: string; // For conversation grouping
  inReplyTo?: string; // Email ID this is replying to
  references?: string[]; // Chain of email IDs in conversation
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  sentAt?: string; // ISO date string
  receivedAt?: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  // Metadata from Resend
  metadata?: {
    openedAt?: string;
    clickedAt?: string;
    bouncedAt?: string;
    deliveredAt?: string;
  };
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailAddress[];
  emails: Email[];
  lastActivityAt: string;
  isRead: boolean;
  messageCount: number;
}

export interface EmailTemplate {
  id: string;
  userId: string;
  name: string;
  subject: string;
  body: string;
  html?: string;
  variables: string[]; // e.g., ["company", "position", "name"]
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSignature {
  id: string;
  userId: string;
  name: string;
  content: string; // Plain text
  html?: string; // HTML version
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDraft {
  id: string;
  userId: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  html?: string;
  templateId?: string;
  signatureId?: string;
  inReplyTo?: string; // If replying to an email
  createdAt: string;
  updatedAt: string;
}

export interface ComposeEmailParams {
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  html?: string;
  templateId?: string;
  signatureId?: string;
  inReplyTo?: string;
}

export interface SendEmailParams {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

// Helper type for template variable substitution
export type TemplateVariables = Record<string, string>;

// Filter and search options
export interface EmailFilters {
  folder?: EmailFolder;
  status?: EmailStatus;
  isRead?: boolean;
  isStarred?: boolean;
  hasAttachments?: boolean;
  search?: string; // Search in subject, body, from, to
  dateFrom?: string;
  dateTo?: string;
}

// Pagination
export interface EmailListResponse {
  emails: Email[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

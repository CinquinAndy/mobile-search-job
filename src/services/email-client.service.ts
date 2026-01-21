/**
 * Client-side service for email operations via API routes
 */

import type {
  Email,
} from "@/types/email";
import { EmailFolder } from "@/types/email";
import { emailPbService } from "./email-pb.service";
import { getCurrentUser } from "./pocketbase.client";

/**
 * Client-side email service that reads from PocketBase directly
 */
export const emailClientService = {
  /**
   * Get all emails from PocketBase for the current user
   */
  async getEmails(): Promise<Email[]> {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");
    
    return emailPbService.getEmails(user.id);
  },

  /**
   * Get inbox emails from PocketBase
   */
  async getInbox(): Promise<Email[]> {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");
    
    return emailPbService.getEmails(user.id, EmailFolder.INBOX);
  },

  /**
   * Load full email content (HTML/text) for an email
   * Uses caching and throttling to avoid rate limits
   */
  async loadEmailContent(
    emailId: string,
    resendId: string,
  ): Promise<{ html?: string; text?: string }> {
    return emailPbService.fetchEmailContent(emailId, resendId);
  },

  /**
   * Send a new email
   */
  async sendEmail(params: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text: string;
    html?: string;
    useProfessionalDesign?: boolean;
    attachCV?: boolean;
    userId?: string;
  }): Promise<{ id: string }> {
    const response = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        text: params.text,
        html: params.html,
        useProfessionalDesign: params.useProfessionalDesign,
        attachCV: params.attachCV,
        userId: params.userId,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to send email");
    }

    return data.result;
  },

  /**
   * Reply to an email
   */
  async replyToEmail(
    emailId: string,
    params: {
      to: Array<{ email: string }>;
      subject: string;
      body: string;
      html?: string;
      cc?: Array<{ email: string }>;
    },
  ): Promise<{ id: string }> {
    const response = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reply",
        emailId,
        ...params,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to reply to email");
    }

    return data.result;
  },

  /**
   * Forward an email
   */
  async forwardEmail(
    emailId: string,
    params: {
      to: Array<{ email: string }>;
      additionalMessage?: string;
    },
  ): Promise<{ id: string }> {
    const response = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "forward",
        emailId,
        ...params,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to forward email");
    }

    return data.result;
  },

  /**
   * Trigger background email synchronization
   */
  async syncEmails(params: {
    syncType?: "full" | "sent_only" | "received_only";
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{ syncId: string; message: string }> {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");
    
    const response = await fetch("/api/emails/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        syncType: params.syncType || "full",
        dateFrom: params.dateFrom?.toISOString(),
        dateTo: params.dateTo?.toISOString(),
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to start synchronization");
    }

    return { syncId: data.syncId, message: data.message };
  },

  /**
   * Get synchronization status
   */
  async getSyncStatus(syncId?: string): Promise<any> {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");
    
    const url = syncId 
      ? `/api/emails/sync?syncId=${syncId}`
      : `/api/emails/sync?userId=${user.id}`;
      
    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to get sync status");
    }

    return data.syncLog;
  },
};

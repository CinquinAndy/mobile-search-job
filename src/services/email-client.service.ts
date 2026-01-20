/**
 * Client-side service for email operations via API routes
 */

import type {
  Email,
  EmailSignature,
  EmailTemplate,
  SendEmailParams,
} from "@/types/email";

export const emailClientService = {
  /**
   * Get sent emails from server
   */
  async getSentEmails(): Promise<Email[]> {
    const response = await fetch("/api/emails?folder=sent");
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch sent emails");
    }

    return data.emails;
  },

  /**
   * Get inbox emails from server
   */
  async getInbox(): Promise<Email[]> {
    const response = await fetch("/api/emails?folder=inbox");
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch inbox");
    }

    return data.emails;
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
};

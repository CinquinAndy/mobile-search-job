"use client";

import { FileText, PenTool, Save, Send, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  EmailAddress,
  EmailSignature,
  EmailTemplate,
} from "@/types/email";

interface EmailComposerProps {
  mode?: "new" | "reply" | "forward";
  to?: EmailAddress[];
  cc?: EmailAddress[];
  subject?: string;
  body?: string;
  templates?: EmailTemplate[];
  signatures?: EmailSignature[];
  onSend: (params: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    html?: string;
  }) => void | Promise<void>;
  onSaveDraft?: (params: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
  }) => void | Promise<void>;
  onClose: () => void;
  defaultSignature?: EmailSignature;
}

export function EmailComposer({
  mode = "new",
  to: initialTo = [],
  cc: initialCc = [],
  subject: initialSubject = "",
  body: initialBody = "",
  templates = [],
  signatures = [],
  onSend,
  onSaveDraft,
  onClose,
  defaultSignature,
}: EmailComposerProps) {
  const [to, setTo] = useState(initialTo.map((addr) => addr.email).join(", "));
  const [cc, setCc] = useState(initialCc.map((addr) => addr.email).join(", "));
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(
    defaultSignature
      ? `${initialBody}\n\n--\n${defaultSignature.content}`
      : initialBody,
  );
  const [isSending, setIsSending] = useState(false);
  const [showCc, setShowCc] = useState(initialCc.length > 0);
  const [showBcc, setShowBcc] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedSignature, setSelectedSignature] = useState<string>(
    defaultSignature?.id || "",
  );

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  const handleSignatureChange = (signatureId: string) => {
    setSelectedSignature(signatureId);
    const signature = signatures.find((s) => s.id === signatureId);
    if (signature) {
      // Remove old signature if exists
      const lines = body.split("\n");
      const signatureIndex = lines.findIndex((line) => line.trim() === "--");
      const bodyWithoutSignature =
        signatureIndex >= 0
          ? lines.slice(0, signatureIndex).join("\n").trim()
          : body.trim();

      setBody(`${bodyWithoutSignature}\n\n--\n${signature.content}`);
    }
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      alert("Please fill in recipient and subject");
      return;
    }

    setIsSending(true);
    try {
      await onSend({
        to: to
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        cc:
          showCc && cc
            ? cc
                .split(",")
                .map((email) => email.trim())
                .filter(Boolean)
            : undefined,
        bcc:
          showBcc && bcc
            ? bcc
                .split(",")
                .map((email) => email.trim())
                .filter(Boolean)
            : undefined,
        subject: subject.trim(),
        body: body.trim(),
      });
      onClose();
    } catch (error) {
      console.error("Failed to send email:", error);
      alert("Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;

    try {
      await onSaveDraft({
        to: to
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        cc:
          showCc && cc
            ? cc
                .split(",")
                .map((email) => email.trim())
                .filter(Boolean)
            : undefined,
        bcc:
          showBcc && bcc
            ? bcc
                .split(",")
                .map((email) => email.trim())
                .filter(Boolean)
            : undefined,
        subject: subject.trim(),
        body: body.trim(),
      });
      alert("Draft saved successfully");
    } catch (error) {
      console.error("Failed to save draft:", error);
      alert("Failed to save draft");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-2xl border border-border shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <h2 className="text-lg font-bold text-foreground">
          {mode === "reply" && "Reply to Email"}
          {mode === "forward" && "Forward Email"}
          {mode === "new" && "New Email"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Template Selector */}
        {templates.length > 0 && mode === "new" && (
          <div>
            <label
              htmlFor="template-select"
              className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1"
            >
              <FileText className="w-3 h-3 inline mr-1" />
              Use Template
            </label>
            <select
              id="template-select"
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select a template --</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* To */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="to-input"
              className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
            >
              To
            </label>
            <div className="flex gap-2">
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-[10px] text-primary hover:underline"
                >
                  + Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  onClick={() => setShowBcc(true)}
                  className="text-[10px] text-primary hover:underline"
                >
                  + Bcc
                </button>
              )}
            </div>
          </div>
          <input
            id="to-input"
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com, another@example.com"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Cc */}
        {showCc && (
          <div>
            <label
              htmlFor="cc-input"
              className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1"
            >
              Cc
            </label>
            <input
              id="cc-input"
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Bcc */}
        {showBcc && (
          <div>
            <label
              htmlFor="bcc-input"
              className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1"
            >
              Bcc
            </label>
            <input
              id="bcc-input"
              type="text"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="bcc@example.com"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Subject */}
        <div>
          <label
            htmlFor="subject-input"
            className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1"
          >
            Subject
          </label>
          <input
            id="subject-input"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="body-input"
            className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1"
          >
            Message
          </label>
          <textarea
            id="body-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={12}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
          />
        </div>

        {/* Signature Selector */}
        {signatures.length > 0 && (
          <div>
            <label
              htmlFor="signature-select"
              className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1"
            >
              <PenTool className="w-3 h-3 inline mr-1" />
              Signature
            </label>
            <select
              id="signature-select"
              value={selectedSignature}
              onChange={(e) => handleSignatureChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- No signature --</option>
              {signatures.map((signature) => (
                <option key={signature.id} value={signature.id}>
                  {signature.name} {signature.isDefault && "(Default)"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          {onSaveDraft && (
            <button
              type="button"
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors border border-border"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !to.trim() || !subject.trim()}
          className={cn(
            "flex items-center gap-2 px-6 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg transition-colors shadow-md",
            isSending || !to.trim() || !subject.trim()
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-primary/90 shadow-primary/20",
          )}
        >
          <Send className="w-4 h-4" />
          {isSending ? "Sending..." : "Send Email"}
        </button>
      </div>
    </div>
  );
}

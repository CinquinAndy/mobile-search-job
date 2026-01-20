"use client";

import { format } from "date-fns";
import DOMPurify from "isomorphic-dompurify";
import {
  ArrowLeft,
  Forward,
  Mail,
  Reply,
  ReplyAll,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Email } from "@/types/email";

interface EmailDetailProps {
  email: Email;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
}

export function EmailDetail({
  email,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onBack,
}: EmailDetailProps) {
  // Sanitize HTML content to prevent XSS
  const sanitizedHtml = email.html
    ? DOMPurify.sanitize(email.html, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "strong",
          "em",
          "u",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "ul",
          "ol",
          "li",
          "a",
          "img",
          "blockquote",
          "code",
          "pre",
          "div",
          "span",
        ],
        ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "style"],
      })
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4 bg-background sticky top-0 z-10">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors lg:hidden"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to list
          </button>
        )}

        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground mb-2 break-words">
              {email.subject}
            </h2>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">
                {email.from.name || email.from.email}
              </span>
              <span className="text-xs text-muted-foreground">
                &lt;{email.from.email}&gt;
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">To:</span>{" "}
              {email.to.map((addr) => addr.email).join(", ")}
            </div>
            {email.cc && email.cc.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Cc:</span>{" "}
                {email.cc.map((addr) => addr.email).join(", ")}
              </div>
            )}
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(email.sentAt || email.createdAt), "PPp")}
          </time>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </button>
          )}
          {onReplyAll && email.to.length > 1 && (
            <button
              type="button"
              onClick={onReplyAll}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors border border-border"
            >
              <ReplyAll className="w-3.5 h-3.5" />
              Reply All
            </button>
          )}
          {onForward && (
            <button
              type="button"
              onClick={onForward}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors border border-border"
            >
              <Forward className="w-3.5 h-3.5" />
              Forward
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {sanitizedHtml ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized with DOMPurify
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {email.body}
          </div>
        )}

        {/* Metadata */}
        {email.metadata && (
          <div className="mt-8 pt-4 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Email Metadata
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-semibold text-foreground">Status:</span>{" "}
                <span
                  className={cn(
                    "ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    email.status === "delivered" &&
                      "bg-green-500/10 text-green-600",
                    email.status === "opened" && "bg-blue-500/10 text-blue-600",
                    email.status === "clicked" &&
                      "bg-purple-500/10 text-purple-600",
                    email.status === "bounced" && "bg-red-500/10 text-red-600",
                  )}
                >
                  {email.status}
                </span>
              </div>
              {email.metadata.deliveredAt && (
                <div>
                  <span className="font-semibold text-foreground">
                    Delivered:
                  </span>{" "}
                  {format(new Date(email.metadata.deliveredAt), "PPp")}
                </div>
              )}
              {email.metadata.openedAt && (
                <div>
                  <span className="font-semibold text-foreground">Opened:</span>{" "}
                  {format(new Date(email.metadata.openedAt), "PPp")}
                </div>
              )}
              {email.metadata.clickedAt && (
                <div>
                  <span className="font-semibold text-foreground">
                    Clicked:
                  </span>{" "}
                  {format(new Date(email.metadata.clickedAt), "PPp")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

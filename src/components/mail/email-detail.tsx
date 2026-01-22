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
  // Check if content is a full HTML document
  const isFullHtml =
    email.html?.includes("<html") || email.html?.includes("<!DOCTYPE");

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
          "table",
          "thead",
          "tbody",
          "tfoot",
          "tr",
          "th",
          "td",
          "center",
          "hr",
          "font",
          "body",
          "html",
          "head",
          "style",
          "meta",
          "title",
          "map",
          "area",
          "summary",
          "details",
        ],
        ALLOWED_ATTR: [
          "href",
          "src",
          "alt",
          "title",
          "class",
          "style",
          "id",
          "width",
          "height",
          "align",
          "valign",
          "border",
          "cellpadding",
          "cellspacing",
          "bgcolor",
          "color",
          "face",
          "size",
          "target",
          "rel",
          "usemap",
          "data-*",
        ],
        FORCE_BODY: !isFullHtml,
        ADD_TAGS: ["style", "meta"],
      })
    : null;

  // Iframe reset and base styles
  const baseStyles = `
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      width: 100%;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      color: #1a1a1a;
      padding: ${isFullHtml ? "0" : "24px"};
      -webkit-font-smoothing: antialiased;
      word-wrap: break-word;
    }
    table {
      border-collapse: collapse;
      border-spacing: 0;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
    }
    a {
      color: #2563eb;
      text-decoration: underline;
    }
    blockquote {
      border-left: 4px solid #e5e7eb;
      margin: 1.5em 0;
      padding: 0.5em 0 0.5em 20px;
      color: #4b5563;
      font-style: italic;
    }
    pre {
      background-color: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid #e2e8f0;
      font-size: 13px;
      white-space: pre-wrap;
    }
    p { margin-bottom: 1em; }
    @media screen and (max-width: 640px) {
      body { padding: ${isFullHtml ? "0" : "16px"}; }
    }
  `;

  const iframeSrcDoc = isFullHtml
    ? (sanitizedHtml as string)?.replace(
        "</head>",
        `<style>${baseStyles}</style></head>`,
      )
    : `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>${baseStyles}</style>
        </head>
        <body>
          ${sanitizedHtml || email.body?.replace(/\n/g, "<br>") || ""}
        </body>
      </html>
    `;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 bg-background sticky top-0 z-10 shadow-sm">
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

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground mb-3 leading-tight wrap-break-word">
              {email.subject}
            </h2>
            <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
              <span className="text-sm font-bold text-foreground truncate">
                {email.from.name || email.from.email.split("@")[0]}
              </span>
              <span className="text-xs text-muted-foreground truncate opacity-70">
                &lt;{email.from.email}&gt;
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 opacity-80">
              <span className="font-semibold px-1 py-0.5 bg-secondary/50 rounded text-[10px] uppercase">
                To
              </span>{" "}
              <span className="truncate">
                {email.to.map((addr) => addr.email).join(", ")}
              </span>
            </div>
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap bg-secondary/30 px-2 py-1 rounded-full border border-border/50">
            {format(
              new Date(email.receivedAt || email.sentAt || email.createdAt),
              "PPp",
            )}
          </time>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all shadow-sm active:scale-95"
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </button>
          )}
          {onReplyAll && email.to.length > 1 && (
            <button
              type="button"
              onClick={onReplyAll}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-all border border-border active:scale-95"
            >
              <ReplyAll className="w-3.5 h-3.5" />
              Reply All
            </button>
          )}
          {onForward && (
            <button
              type="button"
              onClick={onForward}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-all border border-border active:scale-95"
            >
              <Forward className="w-3.5 h-3.5" />
              Forward
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-full transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-secondary/20">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-border overflow-hidden min-h-[500px] flex flex-col ring-1 ring-black/5">
          {email.html || email.body ? (
            <iframe
              title="Email Content"
              className="w-full flex-1 border-none bg-white"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              srcDoc={iframeSrcDoc}
              onLoad={(e) => {
                const iframe = e.currentTarget;
                if (iframe.contentWindow) {
                  const updateHeight = () => {
                    const doc = iframe.contentWindow?.document;
                    if (doc) {
                      const height = doc.documentElement.scrollHeight;
                      iframe.style.height = height + "px";
                    }
                  };
                  updateHeight();
                  // Check again for lazy-loaded images
                  setTimeout(updateHeight, 300);
                  setTimeout(updateHeight, 1000);
                  setTimeout(updateHeight, 3000);
                }
              }}
            />
          ) : (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4 ring-8 ring-secondary/20">
                <Mail className="w-8 h-8 text-muted-foreground opacity-40" />
              </div>
              <p className="text-base font-medium text-muted-foreground">
                This message has no content.
              </p>
              <p className="text-sm text-muted-foreground opacity-70 mt-1">
                Content may not have been synchronized yet.
              </p>
            </div>
          )}
        </div>

        {/* Metadata section */}
        {email.metadata && (
          <div className="max-w-4xl mx-auto mt-10 p-6 bg-background/50 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm leading-relaxed">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-3 opacity-60">
              <span className="flex-1 h-px bg-linear-to-r from-transparent to-border" />
              Tracking & Metadata
              <span className="flex-1 h-px bg-linear-to-l from-transparent to-border" />
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-secondary/10 border border-border/30">
                <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-70">
                  Status
                </span>
                <span
                  className={cn(
                    "inline-flex self-start px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                    email.status === "delivered" &&
                      "bg-green-500/10 text-green-600",
                    email.status === "opened" && "bg-blue-500/10 text-blue-600",
                    email.status === "clicked" &&
                      "bg-purple-500/10 text-purple-600",
                    email.status === "bounced" && "bg-red-500/10 text-red-600",
                    !email.status &&
                      "bg-secondary/50 text-secondary-foreground",
                  )}
                >
                  {email.status || "Unknown"}
                </span>
              </div>

              {email.metadata.deliveredAt && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-secondary/10 border border-border/30 text-xs">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-70">
                    Delivered on
                  </span>
                  <span className="font-medium">
                    {format(new Date(email.metadata.deliveredAt), "PPp")}
                  </span>
                </div>
              )}

              {email.metadata.openedAt && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-secondary/10 border border-border/30 text-xs text-blue-600">
                  <span className="text-[9px] font-bold text-blue-600/60 uppercase opacity-70 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-current rounded-full" />
                    Opened on
                  </span>
                  <span className="font-bold">
                    {format(new Date(email.metadata.openedAt), "PPp")}
                  </span>
                </div>
              )}

              {email.metadata.clickedAt && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-secondary/10 border border-border/30 text-xs text-purple-600">
                  <span className="text-[9px] font-bold text-purple-600/60 uppercase opacity-70 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-current rounded-full" />
                    Clicked on
                  </span>
                  <span className="font-bold">
                    {format(new Date(email.metadata.clickedAt), "PPp")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

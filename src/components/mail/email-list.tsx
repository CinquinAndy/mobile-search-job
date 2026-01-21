"use client";

import { format } from "date-fns";
import { Mail, Star, StarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Email } from "@/types/email";

interface EmailListProps {
  emails: Email[];
  selectedEmailId?: string;
  onSelectEmail: (email: Email) => void;
  onToggleStar?: (emailId: string) => void;
}

export function EmailList({
  emails,
  selectedEmailId,
  onSelectEmail,
  onToggleStar,
}: EmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Mail className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No emails found
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Start by sending your first email or wait for emails to sync.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {emails.map((email) => (
        <button
          key={email.id}
          type="button"
          onClick={() => onSelectEmail(email)}
          className={cn(
            "w-full text-left p-4 hover:bg-secondary/50 transition-colors relative group",
            selectedEmailId === email.id && "bg-secondary",
            !email.isRead && "bg-primary/5",
          )}
        >
          <div className="flex items-start gap-3">
            {/* Star button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar?.(email.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleStar?.(email.id);
                }
              }}
              className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-none p-0"
            >
              {email.isStarred ? (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              ) : (
                <StarOff className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={cn(
                      "font-semibold truncate text-sm",
                      !email.isRead ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {email.from.name || email.from.email}
                  </span>
                  {!email.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
                <time className="text-[10px] text-muted-foreground uppercase tracking-wider flex-shrink-0">
                  {format(
                    new Date(email.receivedAt || email.sentAt || email.createdAt),
                    "MMM d",
                  )}
                </time>
              </div>

              {/* Subject */}
              <h4
                className={cn(
                  "text-sm mb-1 truncate",
                  !email.isRead
                    ? "font-bold text-foreground"
                    : "font-medium text-foreground/70",
                )}
              >
                {email.subject}
              </h4>

              {/* Preview */}
              <p className="text-xs text-muted-foreground truncate">
                {email.body.substring(0, 100)}
              </p>

              {/* Status badge */}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    email.status === "delivered" &&
                      "bg-green-500/10 text-green-600",
                    email.status === "opened" && "bg-blue-500/10 text-blue-600",
                    email.status === "clicked" &&
                      "bg-purple-500/10 text-purple-600",
                    email.status === "bounced" && "bg-red-500/10 text-red-600",
                    email.status === "sent" && "bg-gray-500/10 text-gray-600",
                  )}
                >
                  {email.status}
                </span>
                {email.to.length > 1 && (
                  <span className="text-[9px] text-muted-foreground">
                    +{email.to.length - 1} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

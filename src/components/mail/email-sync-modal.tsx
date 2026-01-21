"use client";

import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface EmailSyncModalProps {
  onSync: (params: {
    syncType: "full" | "sent_only" | "received_only";
    dateFrom?: Date;
    dateTo?: Date;
  }) => void | Promise<void>;
  onClose: () => void;
  isSyncing?: boolean;
}

export function EmailSyncModal({
  onSync,
  onClose,
  isSyncing = false,
}: EmailSyncModalProps) {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [syncType, setSyncType] = useState<"full" | "sent_only" | "received_only">("full");

  const handleSync = async () => {
    const fromDate = dateFrom ? new Date(dateFrom) : undefined;
    const toDate = dateTo ? new Date(dateTo) : undefined;

    // Validate dates
    if (fromDate && toDate && fromDate > toDate) {
      alert("La date de début doit être antérieure à la date de fin");
      return;
    }

    await onSync({ syncType, dateFrom: fromDate, dateTo: toDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-lg animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Sync Emails
              </h2>
              <p className="text-xs text-muted-foreground">
                Fetch the latest emails from Resend
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Sync Type */}
          <div>
            <span className="block text-sm font-bold text-foreground mb-3">
              Sync Type
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSyncType("full")}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium transition-all border",
                  syncType === "full"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSyncType("received_only")}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium transition-all border",
                  syncType === "received_only"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80",
                )}
              >
                Received
              </button>
              <button
                type="button"
                onClick={() => setSyncType("sent_only")}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium transition-all border",
                  syncType === "sent_only"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80",
                )}
              >
                Sent
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email-date-from"
                className="block text-sm font-bold text-foreground mb-2"
              >
                Start Date (optional)
              </label>
              <input
                id="email-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to sync from the beginning
              </p>
            </div>

            <div>
              <label
                htmlFor="email-date-to"
                className="block text-sm font-bold text-foreground mb-2"
              >
                End Date (optional)
              </label>
              <input
                id="email-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                max={format(new Date(), "yyyy-MM-dd")}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to sync until today
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs text-foreground/80">
              <strong className="text-primary">Note:</strong>{" "}
              {syncType === "full" &&
                "Synchronizing received and sent emails."}
              {syncType === "received_only" &&
                "Synchronizing only received emails."}
              {syncType === "sent_only" &&
                "Synchronizing only sent emails."}
              {!dateFrom &&
                !dateTo &&
                " All available emails will be synchronized."}
              {(dateFrom || dateTo) &&
                " Only emails within the selected period."}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className={cn(
              "px-6 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg transition-all shadow-md",
              isSyncing
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-primary/90 shadow-primary/20",
            )}
          >
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

      </div>
    </div>
  );
}

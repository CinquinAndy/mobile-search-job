"use client";

import { format } from "date-fns";
import { Briefcase, Building, ChevronLeft, Mail } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { applicationsService } from "@/services/applications.service";
import type { JobApplication } from "@/types/application";

interface TimelineEvent {
  id: string;
  provider: string;
  sent_at: string;
  subject: string;
  recipient: string;
  status: string;
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [application, setApplication] = React.useState<JobApplication | null>(
    null,
  );
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [appData, timelineData] = await Promise.all([
          applicationsService.getApplication(id),
          applicationsService.getApplicationTimeline(id),
        ]);
        setApplication(appData);
        setTimeline(timelineData as unknown as TimelineEvent[]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">
          Loading details...
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-background p-8 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold mb-4 text-foreground">
          Application not found
        </h1>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-primary hover:underline flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border p-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="p-2 hover:bg-secondary rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">
              {application.company}
            </h1>
            <p className="text-xs text-muted-foreground">
              {application.position}
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        {/* Info Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Status
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-tight",
                    application.status === "responded"
                      ? "bg-green-500/10 text-green-500"
                      : application.status === "bounced"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-blue-500/10 text-blue-500",
                  )}
                >
                  {application.status}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Applied On
              </p>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(application.sentAt), "PP")}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <Building className="w-4 h-4 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1">
                  Company
                </p>
                <p className="text-sm text-foreground">{application.company}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <Briefcase className="w-4 h-4 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1">
                  Position
                </p>
                <p className="text-sm text-foreground">
                  {application.position}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Timeline</h2>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              {timeline.length} Events
            </span>
          </div>

          {timeline.length === 0 ? (
            <div className="p-12 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
              <Mail className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No email logs found for this application.
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Try syncing with Resend to fetch updates.
              </p>
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:w-0.5 before:-translate-x-px before:bg-border">
              {timeline.map((event) => (
                <div key={event.id} className="relative flex items-start pl-10">
                  <div
                    className={cn(
                      "absolute left-0 mt-1.5 w-10 h-10 rounded-full border-4 border-background flex items-center justify-center transition-colors shadow-sm",
                      event.provider === "resend"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1 bg-card rounded-2xl border border-border p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {event.provider} •{" "}
                        {event.sent_at
                          ? format(new Date(event.sent_at), "HH:mm")
                          : "--:--"}
                      </span>
                      <span className="text-xs font-medium text-foreground/60">
                        {event.sent_at
                          ? format(new Date(event.sent_at), "PP")
                          : "Unknown date"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1">
                      {event.subject}
                    </h3>
                    <p className="text-xs text-foreground/70 mb-3 truncate">
                      {event.recipient}
                    </p>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight",
                          event.status === "clicked"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {event.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Actions Footer - Mobile Only */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border flex gap-3 md:hidden">
        <button
          type="button"
          className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg shadow-primary/20"
        >
          Add Reminder
        </button>
        <button
          type="button"
          className="flex-1 py-3 px-4 bg-secondary text-secondary-foreground rounded-xl font-bold text-sm border border-border"
        >
          Update Status
        </button>
      </div>
    </div>
  );
}

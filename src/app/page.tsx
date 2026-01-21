"use client";

import { differenceInDays } from "date-fns";
import {
  AlertCircle,
  Award,
  CheckCircle,
  Clock,
  Download,
  Eye,
  Filter,
  Ghost,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  MousePointer2,
  PhoneIncoming,
  Plus,
  Send,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { syncApplicationsAction } from "@/app/actions/sync";
import { columns } from "@/components/dashboard/columns";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { NewApplicationForm } from "@/components/dashboard/new-application-form";
import { SyncModal } from "@/components/dashboard/sync-modal";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { applicationsService } from "@/services/applications.service";
import { useAuthStore } from "@/stores/auth.store";
import type { JobApplication } from "@/types/application";

export default function Home() {
  const { user, logout } = useAuthStore();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddingApplication, setIsAddingApplication] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"list" | "board">("board");
  const [showOnlyJ7, setShowOnlyJ7] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const data = await applicationsService.getApplications();
        setApplications(data);

        // If data is empty and we have no user, session likely expired
        if (data.length === 0 && !user) {
          window.location.href = "/sign-in";
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (mounted) {
      loadData();
    }
  }, [loadData, mounted]);

  const handleUpdateApplication = useCallback(
    (updatedApp: Partial<JobApplication> & { id: string }) => {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === updatedApp.id ? { ...app, ...updatedApp } : app,
        ),
      );
    },
    [],
  );

  const handleSync = async (params: {
    syncType?: "full" | "sent_only" | "received_only";
    dateFrom?: Date;
    dateTo?: Date;
  } = {}) => {
    if (!user?.id) {
      alert("You must be logged in to sync");
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncApplicationsAction(user.id, params);
      if (result.success) {
        await loadData(true); // Silent reload after sync
        setShowSyncModal(false);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter applications that are 7+ days old without positive response
  const j7Applications = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return applications.filter((app) => {
      // Only include apps in "waiting" statuses
      if (
        ![
          "sent",
          "delivered",
          "opened",
          "clicked",
          "queued",
          "scheduled",
          "delivery_delayed",
        ].includes(app.status)
      ) {
        return false;
      }
      const contactDate = new Date(app.firstContactAt || app.sentAt);
      return contactDate < sevenDaysAgo;
    });
  }, [applications]);

  const displayedApplications = showOnlyJ7 ? j7Applications : applications;

  const exportToCsv = () => {
    const dataToExport = j7Applications;

    if (dataToExport.length === 0) {
      alert("No J+7 companies to export");
      return;
    }

    const headers = [
      "Company",
      "Position",
      "Status",
      "First Contact",
      "Days",
    ];
    const rows = dataToExport.map((app) => {
      const days = differenceInDays(
        new Date(),
        new Date(app.firstContactAt || app.sentAt),
      );
      return [
        app.company,
        app.position || "Not specified",
        app.status,
        new Date(app.firstContactAt || app.sentAt).toLocaleDateString("en-US"),
        days.toString(),
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `follow_ups_j7_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const statGroups = useMemo(() => {
    if (applications.length === 0) return [];
    const total = applications.length;

    const responded = applications.filter((a) =>
      ["responded", "interview", "offer"].includes(a.status),
    ).length;
    const responseRate = ((responded / total) * 100).toFixed(1);

    const opened = applications.filter((a) =>
      ["opened", "clicked"].includes(a.status),
    ).length;
    const openRate = ((opened / total) * 100).toFixed(1);

    const clicked = applications.filter((a) => a.status === "clicked").length;
    const clickRate = ((clicked / total) * 100).toFixed(1);

    const interviews = applications.filter(
      (a) => a.status === "interview",
    ).length;
    const offers = applications.filter((a) => a.status === "offer").length;

    const healthIssues = applications.filter((a) =>
      ["bounced", "failed", "complained"].includes(a.status),
    ).length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const ghosted = applications.filter((a) => {
      if (!["sent", "delivered", "opened", "clicked"].includes(a.status))
        return false;
      const activityDate = new Date(a.lastActivityAt || a.sentAt);
      return activityDate < sevenDaysAgo;
    }).length;

    return [
      {
        title: "Pipeline",
        stats: [
          {
            label: "Total Apps",
            value: total,
            icon: Send,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Responses",
            value: responded,
            icon: TrendingUp,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Reply Rate",
            value: `${responseRate}%`,
            icon: CheckCircle,
            color: "text-green-500",
            bg: "bg-green-500/10",
          },
        ],
      },
      {
        title: "Success",
        stats: [
          {
            label: "Interviews",
            value: interviews,
            icon: PhoneIncoming,
            color: "text-purple-500",
            bg: "bg-purple-500/10",
          },
          {
            label: "Offers",
            value: offers,
            icon: Award,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
        ],
      },
      {
        title: "Engagement",
        stats: [
          {
            label: "Open Rate",
            value: `${openRate}%`,
            icon: Eye,
            color: "text-indigo-500",
            bg: "bg-indigo-500/10",
          },
          {
            label: "Click Rate",
            value: `${clickRate}%`,
            icon: MousePointer2,
            color: "text-violet-500",
            bg: "bg-violet-500/10",
          },
        ],
      },
      {
        title: "Health",
        stats: [
          {
            label: "Issues",
            value: healthIssues,
            icon: AlertCircle,
            color: "text-rose-500",
            bg: "bg-rose-500/10",
          },
          {
            label: "Ghosted",
            value: ghosted,
            icon: Ghost,
            color: "text-slate-500",
            bg: "bg-slate-500/10",
          },
        ],
      },
    ];
  }, [applications]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none">
            Welcome back, {user?.name || user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/mail"
            className="p-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border"
            title="Mail"
          >
            <Mail className="w-5 h-5" />
          </a>
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            disabled={isSyncing}
            className="p-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border disabled:opacity-50"
            title="Sync with Resend"
          >
            <Clock className={cn("w-5 h-5", isSyncing && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setIsAddingApplication(true)}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            title="New Application"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="p-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="space-y-8">
        {/* Advanced Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`sk-${i + 1}`}
                className="h-32 bg-card animate-pulse rounded-2xl border border-border"
              />
            ))
          ) : statGroups.length === 0 ? (
            <div className="col-span-full h-32 flex items-center justify-center bg-card/50 rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
              No data available yet. Start by adding an application.
            </div>
          ) : (
            statGroups.map((group) => (
              <div
                key={group.title}
                className="bg-card/50 backdrop-blur-sm p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">
                    {group.title}
                  </h3>
                  <div className="h-1 w-8 bg-border rounded-full group-hover:bg-primary/30 transition-colors" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {group.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", stat.bg)}>
                          <stat.icon className={cn("w-4 h-4", stat.color)} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {stat.label}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-foreground font-mono">
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Applications Listing */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Applications
              </h2>
              <div className="flex bg-muted p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setView("board")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                    view === "board"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Board
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                    view === "list"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyJ7(!showOnlyJ7)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  showOnlyJ7
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-muted text-muted-foreground border-border hover:text-foreground",
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                J+7 ({j7Applications.length})
              </button>
              <button
                type="button"
                onClick={exportToCsv}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/20 transition-all"
                title="Export J+7 companies to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <span className="text-[10px] font-black uppercase text-muted-foreground bg-muted/50 px-3 py-1 rounded-full tracking-wider border border-border">
                {displayedApplications.length} DISPLAYED
              </span>
            </div>
          </div>

          {isLoading ? (
            view === "board" ? (
              <div className="flex gap-6 overflow-hidden">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`board-sk-${i + 1}`}
                    className="shrink-0 w-80 h-96 bg-card/50 rounded-2xl border border-border animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-card rounded-2xl border border-dashed border-border">
                <div className="animate-pulse text-muted-foreground text-sm uppercase font-black tracking-widest">
                  loading...
                </div>
              </div>
            )
          ) : view === "board" ? (
            <KanbanBoard
              applications={displayedApplications}
              onRefresh={() => loadData(true)}
              onUpdate={handleUpdateApplication}
            />
          ) : (
            <DataTable
              columns={columns}
              data={displayedApplications}
              searchPlaceholder="Search for a company..."
              statusOptions={[
                "sent",
                "delivered",
                "opened",
                "clicked",
                "responded",
                "interview",
                "offer",
                "rejected",
                "rejected_later",
                "rejected_after_interview",
                "bounced",
                "failed",
                "canceled",
                "complained",
                "delivery_delayed",
                "queued",
                "scheduled",
                "suppressed",
              ]}
            />
          )}
        </div>
      </main>

      {/* New Application Modal */}
      {isAddingApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg animate-in zoom-in-95 duration-200">
            <NewApplicationForm
              onSuccess={() => {
                setIsAddingApplication(false);
                loadData();
              }}
              onCancel={() => setIsAddingApplication(false)}
            />
          </div>
        </div>
      )}

      {/* Sync Modal */}
      {showSyncModal && (
        <SyncModal
          onSync={(params) => handleSync(params)}
          onClose={() => setShowSyncModal(false)}
          isSyncing={isSyncing}
        />
      )}
    </div>
  );
}

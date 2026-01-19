"use client";

import { CheckCircle, Clock, LogOut, Plus, Send, XCircle } from "lucide-react";
import * as React from "react";
import { syncApplicationsAction } from "@/app/actions/sync";
import { columns } from "@/components/dashboard/columns";
import { NewApplicationForm } from "@/components/dashboard/new-application-form";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { applicationsService } from "@/services/applications.service";
import { useAuthStore } from "@/stores/auth.store";
import type { JobApplication } from "@/types/application";

export default function Home() {
  const { user, logout } = useAuthStore();
  const [applications, setApplications] = React.useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isAddingApplication, setIsAddingApplication] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await applicationsService.getApplications();
      setApplications(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    if (!user?.id) {
      alert("You must be logged in to sync");
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncApplicationsAction(user.id);
      if (result.success) {
        await loadData();
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const stats = React.useMemo(() => {
    const sent = applications.length;
    const responded = applications.filter(
      (a) => a.status === "responded",
    ).length;
    const bounced = applications.filter((a) => a.status === "bounced").length;
    const active = applications.filter((a) =>
      ["sent", "delivered", "opened", "clicked"].includes(a.status),
    ).length;

    return [
      { label: "Total", value: sent, icon: Send, color: "text-blue-500" },
      { label: "Active", value: active, icon: Clock, color: "text-yellow-500" },
      {
        label: "Responses",
        value: responded,
        icon: CheckCircle,
        color: "text-green-500",
      },
      {
        label: "Bounced",
        value: bounced,
        icon: XCircle,
        color: "text-red-500",
      },
    ];
  }, [applications]);

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
          <button
            type="button"
            onClick={handleSync}
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
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card p-4 rounded-2xl border border-border shadow-sm"
            >
              <div className="flex items-center gap-3 mb-2">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground font-mono">
                {isLoading ? "-" : stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Applications Listing */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Candidatures
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
              {applications.length} total
            </span>
          </div>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center bg-card rounded-2xl border border-dashed border-border">
              <div className="animate-pulse text-muted-foreground text-sm">
                Loading applications...
              </div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={applications}
              searchPlaceholder="Search applications..."
              statusOptions={["sent", "delivered", "opened", "clicked", "responded", "bounced", "rejected", "interview", "offer"]}
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
    </div>
  );
}

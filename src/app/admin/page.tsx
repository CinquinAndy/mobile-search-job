"use client";

import {
  Activity,
  Building2,
  Calendar,
  Database,
  Inbox,
  Link,
  Mail,
  MessageSquare,
  Play,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import * as React from "react";
import {
  createCompaniesAction,
  createResponsesAction,
  linkLogsToCompaniesAction,
  resetAllDataAction,
  syncApplicationsAction,
  syncEmailLogsAction,
  syncInboundEmailsAction,
  updateEmailDatesAction,
  updateEmailStatusesAction,
} from "@/app/actions/sync";
import { useAuthStore } from "@/stores/auth.store";

interface ActionResult {
  success: boolean;
  error?: string;
  data?: Record<string, number>;
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  isLoading: boolean;
  result: ActionResult | null;
  buttonText: string;
  buttonColor: string;
}

function ActionCard({
  title,
  description,
  icon,
  onClick,
  isLoading,
  result,
  buttonText,
  buttonColor,
}: ActionCardProps) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
      <div className="flex items-start gap-4 mb-4">
        <div className="p-3 rounded-xl bg-secondary">{icon}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${buttonColor} disabled:opacity-50`}
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            {buttonText}
          </>
        )}
      </button>

      {result && (
        <div
          className={`mt-4 p-3 rounded-xl text-sm ${
            result.success
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}
        >
          {result.success ? (
            <div className="space-y-1">
              <p className="font-medium">✓ Complete</p>
              {result.data && (
                <ul className="text-xs space-y-0.5 opacity-80">
                  {Object.entries(result.data).map(([key, value]) => (
                    <li key={key}>
                      {key}: <span className="font-mono">{value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p>✗ Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuthStore();

  const [syncLogsLoading, setSyncLogsLoading] = React.useState(false);
  const [syncLogsResult, setSyncLogsResult] = React.useState<ActionResult | null>(null);

  const [syncInboundLoading, setSyncInboundLoading] = React.useState(false);
  const [syncInboundResult, setSyncInboundResult] = React.useState<ActionResult | null>(null);

  const [linkCompaniesLoading, setLinkCompaniesLoading] = React.useState(false);
  const [linkCompaniesResult, setLinkCompaniesResult] = React.useState<ActionResult | null>(null);

  const [createCompaniesLoading, setCreateCompaniesLoading] = React.useState(false);
  const [createCompaniesResult, setCreateCompaniesResult] = React.useState<ActionResult | null>(null);

  const [createResponsesLoading, setCreateResponsesLoading] = React.useState(false);
  const [createResponsesResult, setCreateResponsesResult] = React.useState<ActionResult | null>(null);

  const [fullSyncLoading, setFullSyncLoading] = React.useState(false);
  const [fullSyncResult, setFullSyncResult] = React.useState<ActionResult | null>(null);

  const [updateDatesLoading, setUpdateDatesLoading] = React.useState(false);
  const [updateDatesResult, setUpdateDatesResult] = React.useState<ActionResult | null>(null);

  const [updateStatusesLoading, setUpdateStatusesLoading] = React.useState(false);
  const [updateStatusesResult, setUpdateStatusesResult] = React.useState<ActionResult | null>(null);

  const handleSyncEmailLogs = async () => {
    if (!user?.id) return;
    setSyncLogsLoading(true);
    setSyncLogsResult(null);
    try {
      const result = await syncEmailLogsAction(user.id);
      setSyncLogsResult(result);
    } finally {
      setSyncLogsLoading(false);
    }
  };

  const handleSyncInbound = async () => {
    if (!user?.id) return;
    setSyncInboundLoading(true);
    setSyncInboundResult(null);
    try {
      const result = await syncInboundEmailsAction(user.id);
      setSyncInboundResult(result);
    } finally {
      setSyncInboundLoading(false);
    }
  };

  const handleLinkCompanies = async () => {
    if (!user?.id) return;
    setLinkCompaniesLoading(true);
    setLinkCompaniesResult(null);
    try {
      const result = await linkLogsToCompaniesAction(user.id);
      setLinkCompaniesResult(result);
    } finally {
      setLinkCompaniesLoading(false);
    }
  };

  const handleCreateCompanies = async () => {
    if (!user?.id) return;
    setCreateCompaniesLoading(true);
    setCreateCompaniesResult(null);
    try {
      const result = await createCompaniesAction(user.id);
      setCreateCompaniesResult(result);
    } finally {
      setCreateCompaniesLoading(false);
    }
  };

  const handleCreateResponses = async () => {
    if (!user?.id) return;
    setCreateResponsesLoading(true);
    setCreateResponsesResult(null);
    try {
      const result = await createResponsesAction(user.id);
      setCreateResponsesResult(result);
    } finally {
      setCreateResponsesLoading(false);
    }
  };

  const handleFullSync = async () => {
    if (!user?.id) return;
    setFullSyncLoading(true);
    setFullSyncResult(null);
    try {
      const result = await syncApplicationsAction(user.id);
      setFullSyncResult(result);
    } finally {
      setFullSyncLoading(false);
    }
  };

  const handleUpdateDates = async () => {
    if (!user?.id) return;
    setUpdateDatesLoading(true);
    setUpdateDatesResult(null);
    try {
      const result = await updateEmailDatesAction(user.id);
      setUpdateDatesResult(result);
    } finally {
      setUpdateDatesLoading(false);
    }
  };

  const handleUpdateStatuses = async () => {
    if (!user?.id) return;
    setUpdateStatusesLoading(true);
    setUpdateStatusesResult(null);
    try {
      const result = await updateEmailStatusesAction(user.id);
      setUpdateStatusesResult(result);
    } finally {
      setUpdateStatusesLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">You must be logged in</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage synchronizations and batch actions
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Step 1a: Sync Outbound Emails */}
        <ActionCard
          title="1a. Sync Outbound"
          description="Fetches SENT emails from Resend (outbound)."
          icon={<Mail className="w-5 h-5 text-blue-500" />}
          onClick={handleSyncEmailLogs}
          isLoading={syncLogsLoading}
          result={syncLogsResult}
          buttonText="Outbound → DB"
          buttonColor="bg-blue-500 text-white hover:bg-blue-600"
        />

        {/* Step 1b: Sync Inbound Emails */}
        <ActionCard
          title="1b. Sync Inbound"
          description="Fetches RECEIVED emails from Resend (inbound)."
          icon={<Inbox className="w-5 h-5 text-orange-500" />}
          onClick={handleSyncInbound}
          isLoading={syncInboundLoading}
          result={syncInboundResult}
          buttonText="Inbound → DB"
          buttonColor="bg-orange-500 text-white hover:bg-orange-600"
        />

        {/* Step 2: Link to Companies */}
        <ActionCard
          title="2. Link to Companies"
          description="Links email_logs to existing companies (by domain). Creates nothing."
          icon={<Link className="w-5 h-5 text-cyan-500" />}
          onClick={handleLinkCompanies}
          isLoading={linkCompaniesLoading}
          result={linkCompaniesResult}
          buttonText="email_logs → companies"
          buttonColor="bg-cyan-500 text-white hover:bg-cyan-600"
        />

        {/* Step 3: Create Companies */}
        <ActionCard
          title="3. Create Companies"
          description="Creates companies + applications from unlinked email_logs (outbound)."
          icon={<Building2 className="w-5 h-5 text-purple-500" />}
          onClick={handleCreateCompanies}
          isLoading={createCompaniesLoading}
          result={createCompaniesResult}
          buttonText="email_logs → new companies"
          buttonColor="bg-purple-500 text-white hover:bg-purple-600"
        />

        {/* Step 4: Create Responses */}
        <ActionCard
          title="4. Create Responses"
          description="Creates responses from inbound email_logs and updates statuses."
          icon={<MessageSquare className="w-5 h-5 text-green-500" />}
          onClick={handleCreateResponses}
          isLoading={createResponsesLoading}
          result={createResponsesResult}
          buttonText="inbound → responses"
          buttonColor="bg-green-500 text-white hover:bg-green-600"
        />

        {/* Full Sync */}
        <ActionCard
          title="Full Sync"
          description="Runs all steps: sync Resend + companies + responses."
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
          onClick={handleFullSync}
          isLoading={fullSyncLoading}
          result={fullSyncResult}
          buttonText="Full Sync"
          buttonColor="bg-yellow-500 text-black hover:bg-yellow-400"
        />

        {/* Update Dates */}
        <ActionCard
          title="Fix Dates"
          description="Fetches correct created_at from Resend API for each email and updates sent_at."
          icon={<Calendar className="w-5 h-5 text-pink-500" />}
          onClick={handleUpdateDates}
          isLoading={updateDatesLoading}
          result={updateDatesResult}
          buttonText="Update Dates"
          buttonColor="bg-pink-500 text-white hover:bg-pink-600"
        />

        {/* Update Statuses */}
        <ActionCard
          title="Update Statuses"
          description="Fetches last_event from Resend API and updates email/application statuses."
          icon={<Activity className="w-5 h-5 text-indigo-500" />}
          onClick={handleUpdateStatuses}
          isLoading={updateStatusesLoading}
          result={updateStatusesResult}
          buttonText="Update Statuses"
          buttonColor="bg-indigo-500 text-white hover:bg-indigo-600"
        />
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-secondary/50 rounded-xl border border-border">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How to use</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Sync Outbound</strong>: Fetches sent emails from Resend</li>
              <li><strong>Sync Inbound</strong>: Fetches received emails from Resend</li>
              <li><strong>Link to Companies</strong>: Links logs to existing companies</li>
              <li><strong>Create Companies</strong>: Creates missing companies/applications</li>
              <li><strong>Create Responses</strong>: Creates responses from inbound emails</li>
              <li><strong>Full Sync</strong>: Runs steps 1a, 3, and 4 at once</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <DangerZone userId={user.id} />

      {/* Back to Dashboard */}
      <div className="mt-6">
        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}

// Danger Zone Component
function DangerZone({ userId }: { userId: string }) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleReset = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await resetAllDataAction(userId);
      setResult(res);
      setShowConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 p-4 bg-red-500/10 rounded-xl border border-red-500/30">
      <div className="flex items-start gap-3">
        <Trash2 className="w-5 h-5 text-red-500 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-red-500 mb-1">⚠️ Danger Zone</p>
          <p className="text-sm text-muted-foreground mb-4">
            Deletes all data: email_logs, responses, applications, companies.
            This action is irreversible.
          </p>

          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 bg-red-500/20 text-red-500 rounded-lg font-medium text-sm hover:bg-red-500/30 transition-colors"
            >
              Reset all data
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Confirm deletion"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {result && (
            <div
              className={`mt-4 p-3 rounded-xl text-sm ${
                result.success
                  ? "bg-green-500/10 text-green-500 border border-green-500/20"
                  : "bg-red-500/10 text-red-500 border border-red-500/20"
              }`}
            >
              {result.success ? (
                <div className="space-y-1">
                  <p className="font-medium">✓ Data deleted</p>
                  {result.data && (
                    <ul className="text-xs space-y-0.5 opacity-80">
                      {Object.entries(result.data).map(([key, value]) => (
                        <li key={key}>
                          {key}: <span className="font-mono">{value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p>✗ Error: {result.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

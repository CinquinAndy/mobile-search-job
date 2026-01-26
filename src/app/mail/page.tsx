"use client";

import { Mail, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmailComposer } from "@/components/mail/email-composer";
import { EmailDetail } from "@/components/mail/email-detail";
import { EmailList } from "@/components/mail/email-list";
import { EmailSidebar } from "@/components/mail/email-sidebar";
import { EmailSyncModal } from "@/components/mail/email-sync-modal";
import { cn } from "@/lib/utils";
import { emailClientService } from "@/services/email-client.service";
import { signatureService } from "@/services/signature.service";
import { templateService } from "@/services/template.service";
import { useAuthStore } from "@/stores/auth.store";
import type { Email, EmailSignature, EmailTemplate } from "@/types/email";
import { EmailFolder } from "@/types/email";
export default function MailPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Use nuqs for URL-based state
  const [emailId, setEmailId] = useQueryState("emailId");
  const [activeFolder, setActiveFolder] = useQueryState(
    "folder",
    parseAsStringLiteral(Object.values(EmailFolder)).withDefault(
      EmailFolder.INBOX,
    ),
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [composerMode, setComposerMode] = useState<"new" | "reply" | "forward">(
    "new",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [defaultSignature, setDefaultSignature] =
    useState<EmailSignature | null>(null);

  // Mobile responsive state
  const [showMobileList, setShowMobileList] = useState(true);

  const handleAuthError = useCallback(() => {
    console.error("[Mail] Authentication error detected. Logging out...");
    logout();
    router.push("/sign-in");
  }, [logout, router]);

  // Load emails
  const loadEmails = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedEmails = await emailClientService.getEmails();
      setEmails(fetchedEmails);
    } catch (error) {
      console.error("Failed to load emails:", error);
      if (
        error instanceof Error &&
        error.message.includes("not authenticated")
      ) {
        handleAuthError();
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthError]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const fetchedTemplates = await templateService.listTemplates();
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  }, []);

  // Load signatures
  const loadSignatures = useCallback(async () => {
    try {
      const fetchedSignatures = await signatureService.listSignatures();
      setSignatures(fetchedSignatures);

      const defaultSig = await signatureService.getDefaultSignature();
      setDefaultSignature(defaultSig);
    } catch (error) {
      console.error("Failed to load signatures:", error);
    }
  }, []);

  // Initial load
  const handleSync = useCallback(
    async (params: {
      syncType: "full" | "sent_only" | "received_only";
      dateFrom?: Date;
      dateTo?: Date;
    }) => {
      setIsSyncing(true);
      setShowSyncModal(false); // Close modal

      try {
        const { syncId, message } = await emailClientService.syncEmails(params);
        console.log(message, "Sync ID:", syncId);

        const pollInterval = setInterval(async () => {
          try {
            const syncLog = await emailClientService.getSyncStatus(syncId);

            if (syncLog?.status === "completed") {
              clearInterval(pollInterval);
              await loadEmails();
              setIsSyncing(false);
            } else if (syncLog?.status === "failed") {
              clearInterval(pollInterval);
              setIsSyncing(false);
              console.error("Sync failed:", syncLog.errors);
            }
          } catch (error) {
            console.error("Error checking sync status:", error);
          }
        }, 2000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setIsSyncing(false);
        }, 120000);
      } catch (error) {
        console.error("Failed to start sync:", error);
        setIsSyncing(false);
        if (
          error instanceof Error &&
          error.message.includes("not authenticated")
        ) {
          handleAuthError();
        }
      }
    },
    [loadEmails, handleAuthError, setActiveFolder],
  );

  // Sync selection with URL emailId
  useEffect(() => {
    if (!emailId || emails.length === 0) {
      if (!emailId) setSelectedEmail(null);
      return;
    }

    const email = emails.find((e) => e.id === emailId);
    if (email) {
      setSelectedEmail(email);
      // Ensure we are in the correct folder for this email
      if (email.folder !== activeFolder) {
        setActiveFolder(email.folder);
      }
    }
  }, [emailId, emails, activeFolder, setActiveFolder]);

  useEffect(() => {
    if (!user) return;

    loadEmails();
    loadTemplates();
    loadSignatures();

    // Auto sync on page load
    handleSync({ syncType: "received_only" });
  }, [user, loadEmails, loadTemplates, loadSignatures, handleSync]);

  // Subscribe to realtime email updates (for webhook-created emails)
  useEffect(() => {
    if (!user) return;
    let unsubscribe: (() => void) | null = null;

    const setupRealtime = async () => {
      try {
        const { getClientPB } = await import("@/services/pocketbase.client");
        const pb = getClientPB();

        // Subscribe to emails collection changes
        unsubscribe = await pb.collection("emails").subscribe("*", (e) => {
          console.info(
            `[Mail] Realtime event: ${e.action} on email ${e.record.id}`,
          );

          if (e.action === "create") {
            // New email created (by webhook) - add to list
            setEmails((prev) => {
              // Check if already exists
              if (prev.some((email) => email.id === e.record.id)) return prev;

              // Convert PB record to Email type
              const newEmail = {
                id: e.record.id,
                resendId: e.record.resend_id,
                folder: e.record.folder,
                from: { email: e.record.from_email, name: e.record.from_name },
                to: e.record.to_emails || [],
                cc: e.record.cc_emails || [],
                bcc: e.record.bcc_emails || [],
                subject: e.record.subject,
                body: e.record.body_text || "",
                html: e.record.body_html,
                status: e.record.status,
                isRead: e.record.is_read,
                isStarred: e.record.is_starred,
                hasAttachments: e.record.has_attachments,
                sentAt: e.record.sent_at,
                receivedAt: e.record.received_at,
                createdAt: e.record.created,
                updatedAt: e.record.updated,
              };

              return [newEmail, ...prev];
            });
          } else if (e.action === "update") {
            // Email updated - refresh in list
            setEmails((prev) =>
              prev.map((email) =>
                email.id === e.record.id
                  ? { ...email, status: e.record.status }
                  : email,
              ),
            );
          }
        });

        console.info("[Mail] Realtime subscription active for emails");
      } catch (error) {
        console.error("[Mail] Failed to setup realtime:", error);
      }
    };

    setupRealtime();

    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.info("[Mail] Realtime subscription cleaned up");
      }
    };
  }, [user]);

  // Load email content when an email is selected
  useEffect(() => {
    async function loadContent() {
      if (!selectedEmail || !selectedEmail.resendId) return;

      // Skip if content already loaded
      if (selectedEmail.html || selectedEmail.body) return;

      try {
        console.info(`[Mail] Loading content for email ${selectedEmail.id}...`);
        const content = await emailClientService.loadEmailContent(
          selectedEmail.id,
          selectedEmail.resendId,
        );

        // Update the email in the list with the loaded content
        setEmails((prevEmails) =>
          prevEmails.map((email) =>
            email.id === selectedEmail.id
              ? {
                  ...email,
                  html: content.html,
                  body: content.text || email.body,
                }
              : email,
          ),
        );

        // Update selected email
        setSelectedEmail((prev) =>
          prev
            ? { ...prev, html: content.html, body: content.text || prev.body }
            : prev,
        );

        console.info(`[Mail] Content loaded for email ${selectedEmail.id}`);
      } catch (error) {
        console.error("Failed to load email content:", error);
      }
    }

    loadContent();
  }, [selectedEmail]);

  // Filter emails by folder and search
  const filteredEmails = emails
    .filter((email) => {
      // Folder filter
      if (activeFolder !== email.folder) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          email.subject.toLowerCase().includes(query) ||
          email.body.toLowerCase().includes(query) ||
          email.from.email.toLowerCase().includes(query) ||
          email.to.some((addr) => addr.email.toLowerCase().includes(query))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.receivedAt || a.sentAt || a.createdAt).getTime();
      const dateB = new Date(b.receivedAt || b.sentAt || b.createdAt).getTime();
      return dateB - dateA;
    });

  // Handle email selection
  const handleSelectEmail = (email: Email) => {
    setEmailId(email.id);
    setShowMobileList(false);
  };

  // Handle compose
  const handleCompose = () => {
    setComposerMode("new");
    setShowComposer(true);
  };

  // Handle reply
  const handleReply = () => {
    if (!selectedEmail) return;
    setComposerMode("reply");
    setShowComposer(true);
  };

  // Handle forward
  const handleForward = () => {
    if (!selectedEmail) return;
    setComposerMode("forward");
    setShowComposer(true);
  };

  // Send email
  const handleSendEmail = async (params: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    html?: string;
    useProfessionalDesign?: boolean;
    attachCV?: boolean;
  }) => {
    try {
      await emailClientService.sendEmail({
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        text: params.body,
        html: params.html,
        useProfessionalDesign: params.useProfessionalDesign,
        attachCV: params.attachCV,
        userId: user?.id,
      });

      // Close composer - email will appear via realtime subscription when webhook creates it
      setShowComposer(false);
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Mail</h1>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emails..."
              className="pl-10 pr-8 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary w-64"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Sync button */}
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            disabled={isSyncing}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            title="Sync emails"
          >
            <RefreshCw
              className={cn(
                "w-5 h-5 text-foreground",
                isSyncing && "animate-spin",
              )}
            />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 hidden lg:block">
          <EmailSidebar
            activeFolder={activeFolder}
            onFolderChange={(folder) => {
              setActiveFolder(folder);
              setEmailId(null);
            }}
            onCompose={handleCompose}
            inboxCount={
              emails.filter((e) => e.folder === EmailFolder.INBOX).length
            }
            sentCount={
              emails.filter((e) => e.folder === EmailFolder.SENT).length
            }
          />
        </aside>

        {/* Email List */}
        <div
          className={cn(
            "w-full lg:w-96 border-r border-border overflow-y-auto",
            !showMobileList && "hidden lg:block",
          )}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse text-muted-foreground text-sm">
                Loading emails...
              </div>
            </div>
          ) : (
            <EmailList
              emails={filteredEmails}
              selectedEmailId={selectedEmail?.id}
              onSelectEmail={handleSelectEmail}
            />
          )}
        </div>

        {/* Email Detail */}
        <div
          className={cn(
            "flex-1 overflow-hidden",
            showMobileList && "hidden lg:block",
          )}
        >
          {selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              onReply={handleReply}
              onForward={handleForward}
              onBack={() => setShowMobileList(true)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Mail className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">
                No email selected
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select an email from the list to read its contents
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl h-[90vh]">
            <EmailComposer
              mode={composerMode}
              to={
                composerMode === "reply" && selectedEmail
                  ? [selectedEmail.from]
                  : []
              }
              subject={
                composerMode === "reply" && selectedEmail
                  ? `Re: ${selectedEmail.subject}`
                  : composerMode === "forward" && selectedEmail
                    ? `Fwd: ${selectedEmail.subject}`
                    : ""
              }
              body={
                composerMode === "forward" && selectedEmail
                  ? `\n\n--- Forwarded Message ---\n${selectedEmail.body}`
                  : ""
              }
              templates={templates}
              signatures={signatures}
              defaultSignature={defaultSignature || undefined}
              onSend={handleSendEmail}
              onClose={() => setShowComposer(false)}
            />
          </div>
        </div>
      )}

      {/* Mobile Compose FAB */}
      <button
        type="button"
        onClick={handleCompose}
        className="fixed bottom-6 right-6 lg:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-all"
      >
        <Mail className="w-6 h-6" />
      </button>

      {/* Email Sync Modal */}
      {showSyncModal && (
        <EmailSyncModal
          onSync={handleSync}
          onClose={() => setShowSyncModal(false)}
          isSyncing={isSyncing}
        />
      )}
    </div>
  );
}

"use client";

import { Mail, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmailComposer } from "@/components/mail/email-composer";
import { EmailDetail } from "@/components/mail/email-detail";
import { EmailList } from "@/components/mail/email-list";
import { EmailSidebar } from "@/components/mail/email-sidebar";
import { cn } from "@/lib/utils";
import { emailClientService } from "@/services/email-client.service";
import { signatureService } from "@/services/signature.service";
import { templateService } from "@/services/template.service";
import type { Email, EmailSignature, EmailTemplate } from "@/types/email";
import { EmailFolder } from "@/types/email";

export default function MailPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [activeFolder, setActiveFolder] = useState<EmailFolder>(
    EmailFolder.SENT,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
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

  // Load emails
  const loadEmails = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedEmails = await emailClientService.getSentEmails();
      setEmails(fetchedEmails);
    } catch (error) {
      console.error("Failed to load emails:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  useEffect(() => {
    loadEmails();
    loadTemplates();
    loadSignatures();
  }, [loadEmails, loadTemplates, loadSignatures]);

  // Sync emails
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await loadEmails();
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter emails by folder and search
  const filteredEmails = emails.filter((email) => {
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
  });

  // Handle email selection
  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
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
  }) => {
    try {
      await emailClientService.sendEmail({
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        text: params.body,
        html: params.html,
      });

      // Refresh emails after sending
      await loadEmails();
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
          <Mail className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Mail</h1>
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
            onClick={handleSync}
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
              setSelectedEmail(null);
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
    </div>
  );
}

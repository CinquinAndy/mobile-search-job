"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Inbox,
  PenTool,
  Plus,
  Send as SendIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmailFolder } from "@/types/email";

interface EmailSidebarProps {
  activeFolder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
  onManageTemplates?: () => void;
  onManageSignatures?: () => void;
  inboxCount?: number;
  sentCount?: number;
}

export function EmailSidebar({
  activeFolder,
  onFolderChange,
  onCompose,
  onManageTemplates,
  onManageSignatures,
  inboxCount = 0,
  sentCount = 0,
}: EmailSidebarProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSignatures, setShowSignatures] = useState(false);

  const folders = [
    {
      id: EmailFolder.INBOX,
      label: "Inbox",
      icon: Inbox,
      count: inboxCount,
    },
    {
      id: EmailFolder.SENT,
      label: "Sent",
      icon: SendIcon,
      count: sentCount,
    },
    // Drafts feature can be enabled later
    // {
    //   id: EmailFolder.DRAFTS,
    //   label: "Drafts",
    //   icon: File,
    //   count: draftsCount,
    // },
  ];

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Compose Button */}
      <div className="p-4">
        <button
          type="button"
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
        >
          <Plus className="w-5 h-5" />
          Compose
        </button>
      </div>

      {/* Folders */}
      <nav className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => onFolderChange(folder.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                activeFolder === folder.id
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70 hover:bg-secondary hover:text-foreground",
              )}
            >
              <folder.icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left">{folder.label}</span>
              {folder.count > 0 && (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    activeFolder === folder.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {folder.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Templates Section */}
        {onManageTemplates && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              {showTemplates ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <FileText className="w-4 h-4" />
              Templates
            </button>
            {showTemplates && (
              <div className="mt-1 pl-6">
                <button
                  type="button"
                  onClick={onManageTemplates}
                  className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  Manage Templates
                </button>
              </div>
            )}
          </div>
        )}

        {/* Signatures Section */}
        {onManageSignatures && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowSignatures(!showSignatures)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSignatures ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <PenTool className="w-4 h-4" />
              Signatures
            </button>
            {showSignatures && (
              <div className="mt-1 pl-6">
                <button
                  type="button"
                  onClick={onManageSignatures}
                  className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  Manage Signatures
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}

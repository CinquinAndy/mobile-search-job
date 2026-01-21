"use client";

import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import {
  Calendar,
  Clock,
  MoreVertical,
  Plus,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { applicationsService } from "@/services/applications.service";
import type { ApplicationStatus, JobApplication } from "@/types/application";

interface KanbanBoardProps {
  applications: JobApplication[];
  onRefresh: () => void;
  onUpdate: (updatedApp: Partial<JobApplication> & { id: string }) => void;
}

type ColumnId =
  | "contact"
  | "interview"
  | "rejected"
  | "rejected_later"
  | "rejected_after_interview";

interface Column {
  id: ColumnId;
  title: string;
  statuses: ApplicationStatus[];
  color: string;
}

const COLUMNS: Column[] = [
  {
    id: "contact",
    title: "Contact Sent",
    statuses: [
      "sent",
      "delivered",
      "opened",
      "clicked",
      "responded",
      "queued",
      "scheduled",
      "suppressed",
      "delivery_delayed",
      "offer",
    ],
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: "interview",
    title: "Interview Scheduled",
    statuses: ["interview"],
    color:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  {
    id: "rejected",
    title: "Categorical Refusal",
    statuses: ["rejected", "bounced", "failed", "complained"],
    color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  {
    id: "rejected_later",
    title: "Refuse Later",
    statuses: ["rejected_later"],
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    id: "rejected_after_interview",
    title: "Refused After Interview",
    statuses: ["rejected_after_interview"],
    color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  },
];

// Map column ID to a default status for that column when dropped
const COLUMN_TO_STATUS: Record<ColumnId, ApplicationStatus> = {
  contact: "sent",
  interview: "interview",
  rejected: "rejected",
  rejected_later: "rejected_later",
  rejected_after_interview: "rejected_after_interview",
};

export function KanbanBoard({
  applications,
  onRefresh,
  onUpdate,
}: KanbanBoardProps) {
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const [enabled, setEnabled] = React.useState(false);
  const [globalSearch, setGlobalSearch] = React.useState("");
  const [visibleCounts, setVisibleCounts] = React.useState<
    Record<string, number>
  >(
    COLUMNS.reduce(
      (acc, col) => {
        acc[col.id] = 20;
        return acc;
      },
      {} as Record<string, number>,
    ),
  );

  // Hydration fix for @hello-pangea/dnd with Next.js
  React.useEffect(() => {
    setEnabled(true);
  }, []);

  const handleMove = async (id: string, newStatus: ApplicationStatus) => {
    // Optimistic update
    onUpdate({ id, status: newStatus });
    setIsUpdating(id);

    try {
      await applicationsService.updateStatus(id, newStatus);
      onRefresh();
    } finally {
      setIsUpdating(null);
    }
  };

  const handleFollowUp = async (id: string) => {
    const app = applications.find((a) => a.id === id);
    if (!app) return;

    // Optimistic update
    onUpdate({
      id,
      followUpCount: (app.followUpCount || 0) + 1,
      lastFollowUpAt: new Date().toISOString(),
    });
    setIsUpdating(id);

    try {
      await applicationsService.incrementFollowUp(id);
      onRefresh();
    } finally {
      setIsUpdating(null);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = COLUMN_TO_STATUS[destination.droppableId as ColumnId];
    if (newStatus) {
      await handleMove(draggableId, newStatus);
    }
  };

  const getAppsInColumn = (column: Column) => {
    const query = globalSearch.toLowerCase();
    return applications
      .filter((app) => column.statuses.includes(app.status))
      .filter((app) => {
        if (!query) return true;
        return (
          app.company.toLowerCase().includes(query) ||
          (app.position || "").toLowerCase().includes(query)
        );
      });
  };

  if (!enabled) return null;

  return (
    <div className="space-y-6">
      {/* Global Kanban Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search all boards..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
        {globalSearch && (
          <button
            type="button"
            onClick={() => setGlobalSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-6 -mx-4 px-4 md:mx-0 md:px-0 custom-scrollbar min-h-[600px] items-start">
          {COLUMNS.map((column) => {
            const allAppsInColumn = getAppsInColumn(column);
            const visibleCount = visibleCounts[column.id] || 20;
            const apps = allAppsInColumn.slice(0, visibleCount);
            const hasMore = allAppsInColumn.length > visibleCount;

            return (
              <div
                key={column.id}
                className="shrink-0 w-80 flex flex-col gap-4"
              >
                <div
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border sticky top-0 z-20 backdrop-blur-md",
                    column.color,
                  )}
                >
                  <h3 className="text-xs font-black uppercase tracking-widest text-inherit">
                    {column.title}
                  </h3>
                  <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full ring-1 ring-inset ring-black/5">
                    {allAppsInColumn.length}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "flex flex-col gap-3 min-h-[150px] rounded-2xl transition-colors p-1",
                        snapshot.isDraggingOver && "bg-muted/30",
                      )}
                    >
                      {apps.map((app, index) => (
                        <Draggable
                          key={app.id}
                          draggableId={app.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "transition-transform",
                                snapshot.isDragging && "z-50",
                              )}
                            >
                              <KanbanCard
                                application={app}
                                onMove={handleMove}
                                onFollowUp={handleFollowUp}
                                isLoading={isUpdating === app.id}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {allAppsInColumn.length === 0 && (
                        <div className="h-24 flex items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                          Empty
                        </div>
                      )}

                      {hasMore && (
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleCounts((prev) => ({
                              ...prev,
                              [column.id]: prev[column.id] + 20,
                            }))
                          }
                          className="w-full py-3 rounded-2xl border border-dashed border-border bg-card/30 text-muted-foreground text-[10px] font-black uppercase tracking-widest hover:bg-muted/50 hover:text-foreground transition-all flex items-center justify-center gap-2 mt-2"
                        >
                          <Plus className="w-3 h-3" />
                          View {allAppsInColumn.length - visibleCount} more
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}

function KanbanCard({
  application,
  onMove,
  onFollowUp,
  isLoading,
}: {
  application: JobApplication;
  onMove: (id: string, newStatus: ApplicationStatus) => void;
  onFollowUp: (id: string) => void;
  isLoading: boolean;
}) {
  const firstContactDays = differenceInDays(
    new Date(),
    new Date(application.firstContactAt || application.sentAt),
  );

  const showFollowUpSystem = [
    "contact",
    "sent",
    "delivered",
    "opened",
    "clicked",
    "responded",
  ].includes(application.status);

  return (
    <div
      className={cn(
        "group bg-card p-4 rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 relative",
        isLoading && "opacity-50 pointer-events-none",
      )}
      style={{ zIndex: 1 }} // Ensure base z-index allows dropdown to stay above
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-0.5">
          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {application.company}
          </h4>
          <span className="text-[10px] text-muted-foreground font-medium line-clamp-1">
            {application.position || "Position not specified"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <StatusSmallBadge status={application.status} />
        </div>
      </div>

      <div className="space-y-3">
        {/* Timing Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/50 border border-border/50">
            <span className="text-[8px] font-black uppercase text-muted-foreground/70 tracking-tighter">
              First Contact
            </span>
            <span className="text-[10px] font-bold text-foreground flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5 text-blue-500" />
              {firstContactDays === 0 ? "Today" : `${firstContactDays}d ago`}
            </span>
          </div>

          {showFollowUpSystem && (
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/50 border border-border/50">
              <span className="text-[8px] font-black uppercase text-muted-foreground/70 tracking-tighter">
                Follow-ups
              </span>
              <span className="text-[10px] font-bold text-foreground flex items-center gap-1">
                <RefreshCcw className="w-2.5 h-2.5 text-emerald-500" />
                {application.followUpCount}{" "}
                {application.followUpCount > 1 ? "times" : "time"}
              </span>
            </div>
          )}
        </div>

        {/* Last Activity / Follow up detail */}
        {application.lastFollowUpAt && showFollowUpSystem && (
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-medium bg-emerald-500/5 py-1 px-2 rounded-md border border-emerald-500/10 w-fit">
            <Clock className="w-2.5 h-2.5" />
            Last follow-up{" "}
            {formatDistanceToNow(new Date(application.lastFollowUpAt), {
              addSuffix: true,
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {showFollowUpSystem && (
            <button
              type="button"
              onClick={() => onFollowUp(application.id)}
              className="flex-1 h-8 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Follow up
            </button>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center gap-1 ml-auto">
            <MoveDropdown
              id={application.id}
              currentStatus={application.status}
              onMove={onMove}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MoveDropdown({
  id,
  currentStatus,
  onMove,
}: {
  id: string;
  currentStatus: ApplicationStatus;
  onMove: (id: string, s: ApplicationStatus) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  const OPTIONS: { label: string; status: ApplicationStatus }[] = [
    { label: "Contact Sent", status: "sent" },
    { label: "Interview", status: "interview" },
    { label: "Categorical Refusal", status: "rejected" },
    { label: "Refuse Later", status: "rejected_later" },
    { label: "Refused After Interview", status: "rejected_after_interview" },
    { label: "Offer Received", status: "offer" },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        className="h-8 w-8 flex items-center justify-center rounded-lg bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-colors"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 bottom-full mb-2 w-48 bg-card border border-border rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          role="menu"
          aria-orientation="vertical"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex flex-col">
            <div className="px-3 py-1.5 border-b border-border mb-1">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                Move to...
              </span>
            </div>
            {OPTIONS.map((opt) => (
              <button
                key={opt.status}
                type="button"
                role="menuitem"
                onClick={() => {
                  onMove(id, opt.status);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-medium hover:bg-muted transition-colors flex items-center justify-between",
                  currentStatus === opt.status
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
                {currentStatus === opt.status && (
                  <div className="w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusSmallBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    responded: "bg-green-500",
    interview: "bg-purple-500",
    offer: "bg-amber-500",
    rejected: "bg-red-500",
    rejected_later: "bg-orange-500",
    rejected_after_interview: "bg-zinc-500",
    default: "bg-blue-500",
  };

  const color = configs[status] || configs.default;

  return (
    <div
      className={cn(
        "w-1.5 h-1.5 rounded-full ring-2 ring-white dark:ring-zinc-950",
        color,
      )}
    />
  );
}

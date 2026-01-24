import type { JobApplication } from "@/types/application";
import { getClientPB } from "./pocketbase.client";

interface CompanyRecord {
  id: string;
  name: string;
  domain: string;
  website?: string;
}

interface ApplicationRecord {
  id: string;
  company: string;
  position: string;
  status: JobApplication["status"];
  created: string;
  updated: string;
  last_activity_at?: string;
  last_response_at?: string;
  first_contact_at?: string;
  last_follow_up_at?: string;
  follow_up_count?: number;
  expand?: {
    company?: CompanyRecord;
    "email_logs(application)"?: {
      recipient: string;
      provider: string;
      direction: string;
      sent_at: string;
    }[];
  };
}

export const applicationsService = {
  async getApplications(): Promise<JobApplication[]> {
    const pb = getClientPB();

    // Validate and refresh auth if needed
    if (!pb.authStore.isValid) {
      try {
        await pb.collection("users").authRefresh();
      } catch {
        // Auth completely invalid, clear and return empty
        pb.authStore.clear();
        return [];
      }
    }

    // No fallback here, real data only
    const records = await pb
      .collection("applications")
      .getFullList<ApplicationRecord>({
        sort: "-created",
        expand: "company,email_logs(application)",
      });

    return records.map((record) => {
      const logs = record.expand?.["email_logs(application)"] || [];
      const resendLog = logs.find((l) => l.provider === "resend");
      const email = logs[0]?.recipient;

      // Count RESEND and MANUAL outbound emails for follow-ups
      const outboundLogs = logs
        .filter((l) => (l.provider === "resend" || l.provider === "manual") && l.direction === "outbound")
        .sort((a, b) => {
          const dateA = new Date(a.sent_at).getTime();
          const dateB = new Date(b.sent_at).getTime();
          return dateA - dateB;
        });

      // Follow-ups = all emails after the first one
      const followUpCount = outboundLogs.length > 1 
        ? outboundLogs.length - 1 
        : 0;

      const latestLogDate = outboundLogs.length > 0 
        ? outboundLogs[outboundLogs.length - 1].sent_at 
        : null;

      return {
        id: record.id,
        company: record.expand?.company?.name || "Unknown",
        position: record.position,
        status: record.status,
        sentAt: record.created,
        lastActivityAt: record.last_activity_at || record.updated,
        lastResponseAt: record.last_response_at,
        firstContactAt: record.first_contact_at || record.created,
        lastFollowUpAt: latestLogDate || record.last_follow_up_at,
        followUpCount: followUpCount, // Use calculated count
        email: email,
        isFromResend: !!resendLog,
      };
    });
  },

  async getApplication(id: string): Promise<JobApplication | null> {
    const pb = getClientPB();
    try {
      const record = await pb
        .collection("applications")
        .getOne<ApplicationRecord>(id, {
          expand: "company",
        });
      return {
        id: record.id,
        company: record.expand?.company?.name || "Unknown",
        position: record.position,
        status: record.status,
        sentAt: record.created,
        lastActivityAt: record.last_activity_at || record.updated,
        lastResponseAt: record.last_response_at,
        firstContactAt: record.first_contact_at || record.created,
        lastFollowUpAt: record.last_follow_up_at,
        followUpCount: record.follow_up_count || 0,
      };
    } catch {
      return null;
    }
  },

  async createApplication(data: {
    companyName: string;
    domain: string;
    position: string;
    website?: string;
    notes?: string;
  }): Promise<string> {
    const pb = getClientPB();
    const userId = pb.authStore.model?.id;

    if (!userId) throw new Error("User not authenticated");

    // 1. Find or create company
    let companyId: string;
    try {
      const existing = await pb
        .collection("companies")
        .getFirstListItem(`domain="${data.domain}"`);
      companyId = existing.id;
    } catch {
      const newCompany = await pb.collection("companies").create({
        name: data.companyName,
        domain: data.domain,
        website: data.website,
        user: userId,
      });
      companyId = newCompany.id;
    }

    // 2. Create application
    const application = await pb.collection("applications").create({
      company: companyId,
      position: data.position,
      status: "sent",
      notes: data.notes,
      user: userId,
      first_contact_at: new Date().toISOString(),
    });

    return application.id;
  },

  async getApplicationTimeline(id: string) {
    const pb = getClientPB();
    return await pb.collection("email_logs").getFullList({
      filter: `application="${id}"`,
      sort: "-sent_at",
    });
  },

  async updateStatus(
    id: string,
    status: JobApplication["status"],
  ): Promise<void> {
    const pb = getClientPB();
    await pb.collection("applications").update(id, {
      status,
      last_activity_at: new Date().toISOString(),
    });
  },

  async incrementFollowUp(id: string): Promise<void> {
    const pb = getClientPB();
    const userId = pb.authStore.model?.id;
    if (!userId) throw new Error("User not authenticated");

    // 1. Get current application with its logs to find recipient
    const application = await pb
      .collection("applications")
      .getOne<ApplicationRecord>(id, {
        expand: "email_logs(application),company",
      });

    const logs = application.expand?.["email_logs(application)"] || [];
    const lastLog = logs.sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
    )[0];
    // Fallback to user email if no recipient found (to pass email validation)
    const recipient = lastLog?.recipient || pb.authStore.model?.email || "manual@tracker.local";
    const now = new Date().toISOString();

    // 2. Create a manual email log to show in timeline and reset J+7
    try {
      await pb.collection("email_logs").create({
        application: id,
        company: application.company,
        user: userId,
        provider: "manual",
        direction: "outbound",
        recipient: recipient,
        subject: `Follow-up #${(application.follow_up_count || 0) + 1}`,
        status: "sent",
        sent_at: now,
        external_id: `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        raw_payload: { manual: true },
      });
    } catch (err: any) {
      console.warn("[Applications] Manual provider rejected, retrying with 'resend'...", err.message);
      
      // Fallback: ALWAYS try with 'resend' provider if 'manual' fails
      // (This covers Enum validation errors where provider MUST be 'resend' or 'gmail')
      try {
         await pb.collection("email_logs").create({
            application: id,
            company: application.company,
            user: userId,
            provider: "resend",
            direction: "outbound",
            recipient: recipient,
            subject: `[Manual] Follow-up #${(application.follow_up_count || 0) + 1}`,
            status: "sent",
            sent_at: now,
            external_id: `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            raw_payload: { manual: true, fallback: true },
         });
      } catch (retryErr: any) {
         console.error("[Applications] Follow-up creation COMPLETELY failed:", retryErr.response?.data || retryErr.message);
         throw retryErr;
      }
    }

    // 3. Update application stats
    await pb.collection("applications").update(id, {
      follow_up_count: (application.follow_up_count || 0) + 1,
      last_follow_up_at: now,
      last_activity_at: now,
    });
  },
};

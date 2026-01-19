import { getClientPB } from "./pocketbase.client";

export type ResponseType =
  | "positive"
  | "negative"
  | "interview"
  | "offer"
  | "info"
  | "other";

export interface Response {
  id: string;
  application?: string;
  company: string;
  email_log?: string;
  type: ResponseType;
  sender_email?: string;
  subject?: string;
  content?: string;
  received_at: string;
  notes?: string;
  user: string;
  created: string;
  updated: string;
}

export interface CreateResponseData {
  application?: string;
  company: string;
  email_log?: string;
  type: ResponseType;
  sender_email?: string;
  subject?: string;
  content?: string;
  received_at: string;
  notes?: string;
}

export const responsesService = {
  /**
   * Get all responses for the current user
   */
  async getResponses(): Promise<Response[]> {
    const pb = getClientPB();
    const records = await pb.collection("responses").getFullList({
      sort: "-received_at",
      expand: "company,application",
    });
    return records as unknown as Response[];
  },

  /**
   * Get responses for a specific company
   */
  async getResponsesByCompany(companyId: string): Promise<Response[]> {
    const pb = getClientPB();
    const records = await pb.collection("responses").getFullList({
      filter: `company="${companyId}"`,
      sort: "-received_at",
    });
    return records as unknown as Response[];
  },

  /**
   * Get responses for a specific application
   */
  async getResponsesByApplication(applicationId: string): Promise<Response[]> {
    const pb = getClientPB();
    const records = await pb.collection("responses").getFullList({
      filter: `application="${applicationId}"`,
      sort: "-received_at",
    });
    return records as unknown as Response[];
  },

  /**
   * Create a new response
   */
  async createResponse(data: CreateResponseData): Promise<Response> {
    const pb = getClientPB();
    const user = pb.authStore.record;
    if (!user) throw new Error("User not authenticated");

    const record = await pb.collection("responses").create({
      ...data,
      user: user.id,
    });

    // Update application status if it has one
    if (data.application) {
      const newStatus = this.getStatusFromResponseType(data.type);
      if (newStatus) {
        await pb.collection("applications").update(data.application, {
          status: newStatus,
          last_activity_at: data.received_at,
        });
      }
    }

    return record as unknown as Response;
  },

  /**
   * Update an existing response
   */
  async updateResponse(
    id: string,
    data: Partial<CreateResponseData>,
  ): Promise<Response> {
    const pb = getClientPB();
    const record = await pb.collection("responses").update(id, data);
    return record as unknown as Response;
  },

  /**
   * Delete a response
   */
  async deleteResponse(id: string): Promise<void> {
    const pb = getClientPB();
    await pb.collection("responses").delete(id);
  },

  /**
   * Map response type to application status
   */
  getStatusFromResponseType(
    type: ResponseType,
  ): string | null {
    const mapping: Record<ResponseType, string | null> = {
      positive: "responded",
      negative: "rejected",
      interview: "interview",
      offer: "offer",
      info: "responded",
      other: null,
    };
    return mapping[type];
  },
};

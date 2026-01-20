import type { EmailSignature } from "@/types/email";

/**
 * Service for managing email signatures
 * Signatures are stored in localStorage for now (can be migrated to PocketBase later)
 */

const SIGNATURES_STORAGE_KEY = "email_signatures";

// Helper to get user ID from auth
function getUserId(): string {
  // For now, use a default user ID
  // TODO: Get from actual auth store
  return "default_user";
}

function getSignatures(): EmailSignature[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SIGNATURES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to load signatures:", error);
    return [];
  }
}

function saveSignatures(signatures: EmailSignature[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SIGNATURES_STORAGE_KEY, JSON.stringify(signatures));
  } catch (error) {
    console.error("Failed to save signatures:", error);
    throw error;
  }
}

export const signatureService = {
  /**
   * Get all signatures for the current user
   */
  async listSignatures(): Promise<EmailSignature[]> {
    const signatures = getSignatures();
    const userId = getUserId();
    return signatures.filter((s) => s.userId === userId);
  },

  /**
   * Get a specific signature by ID
   */
  async getSignature(id: string): Promise<EmailSignature | null> {
    const signatures = getSignatures();
    return signatures.find((s) => s.id === id) || null;
  },

  /**
   * Get the default signature
   */
  async getDefaultSignature(): Promise<EmailSignature | null> {
    const signatures = await this.listSignatures();
    return signatures.find((s) => s.isDefault) || null;
  },

  /**
   * Create a new signature
   */
  async createSignature(
    signature: Omit<
      EmailSignature,
      "id" | "userId" | "createdAt" | "updatedAt"
    >,
  ): Promise<EmailSignature> {
    const signatures = getSignatures();
    const userId = getUserId();

    // If this is set as default, unset other defaults
    if (signature.isDefault) {
      for (const sig of signatures) {
        if (sig.userId === userId && sig.isDefault) {
          sig.isDefault = false;
        }
      }
    }

    const newSignature: EmailSignature = {
      ...signature,
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    signatures.push(newSignature);
    saveSignatures(signatures);

    return newSignature;
  },

  /**
   * Update an existing signature
   */
  async updateSignature(
    id: string,
    updates: Partial<Omit<EmailSignature, "id" | "userId" | "createdAt">>,
  ): Promise<EmailSignature> {
    const signatures = getSignatures();
    const userId = getUserId();
    const index = signatures.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new Error(`Signature ${id} not found`);
    }

    // If setting this as default, unset other defaults
    if (updates.isDefault) {
      for (const sig of signatures) {
        if (sig.userId === userId && sig.id !== id && sig.isDefault) {
          sig.isDefault = false;
        }
      }
    }

    const updatedSignature: EmailSignature = {
      ...signatures[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    signatures[index] = updatedSignature;
    saveSignatures(signatures);

    return updatedSignature;
  },

  /**
   * Delete a signature
   */
  async deleteSignature(id: string): Promise<void> {
    const signatures = getSignatures();
    const filtered = signatures.filter((s) => s.id !== id);

    if (filtered.length === signatures.length) {
      throw new Error(`Signature ${id} not found`);
    }

    saveSignatures(filtered);
  },

  /**
   * Set a signature as default
   */
  async setDefaultSignature(id: string): Promise<EmailSignature> {
    return this.updateSignature(id, { isDefault: true });
  },

  /**
   * Append signature to email content
   */
  appendSignature(
    content: string,
    signature: EmailSignature,
    format: "text" | "html" = "text",
  ): string {
    if (format === "html") {
      return `${content}<br><br>--<br>${signature.html || signature.content}`;
    }

    return `${content}\n\n--\n${signature.content}`;
  },
};

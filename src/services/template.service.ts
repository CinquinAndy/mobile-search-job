import type { EmailTemplate, TemplateVariables } from "@/types/email";

/**
 * Service for managing email templates
 * Templates are stored in localStorage for now (can be migrated to PocketBase later)
 */

const TEMPLATES_STORAGE_KEY = "email_templates";

// Helper to get user ID from auth
function getUserId(): string {
  // For now, use a default user ID
  // TODO: Get from actual auth store
  return "default_user";
}

function getTemplates(): EmailTemplate[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to load templates:", error);
    return [];
  }
}

function saveTemplates(templates: EmailTemplate[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Failed to save templates:", error);
    throw error;
  }
}

export const templateService = {
  /**
   * Get all templates for the current user
   */
  async listTemplates(): Promise<EmailTemplate[]> {
    const templates = getTemplates();
    const userId = getUserId();
    return templates.filter((t) => t.userId === userId);
  },

  /**
   * Get a specific template by ID
   */
  async getTemplate(id: string): Promise<EmailTemplate | null> {
    const templates = getTemplates();
    return templates.find((t) => t.id === id) || null;
  },

  /**
   * Create a new template
   */
  async createTemplate(
    template: Omit<EmailTemplate, "id" | "userId" | "createdAt" | "updatedAt">,
  ): Promise<EmailTemplate> {
    const templates = getTemplates();
    const userId = getUserId();

    const newTemplate: EmailTemplate = {
      ...template,
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    templates.push(newTemplate);
    saveTemplates(templates);

    return newTemplate;
  },

  /**
   * Update an existing template
   */
  async updateTemplate(
    id: string,
    updates: Partial<Omit<EmailTemplate, "id" | "userId" | "createdAt">>,
  ): Promise<EmailTemplate> {
    const templates = getTemplates();
    const index = templates.findIndex((t) => t.id === id);

    if (index === -1) {
      throw new Error(`Template ${id} not found`);
    }

    const updatedTemplate: EmailTemplate = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    templates[index] = updatedTemplate;
    saveTemplates(templates);

    return updatedTemplate;
  },

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    const templates = getTemplates();
    const filtered = templates.filter((t) => t.id !== id);

    if (filtered.length === templates.length) {
      throw new Error(`Template ${id} not found`);
    }

    saveTemplates(filtered);
  },

  /**
   * Render a template with variable substitution
   */
  renderTemplate(
    template: EmailTemplate,
    variables: TemplateVariables,
  ): { subject: string; body: string; html?: string } {
    let subject = template.subject;
    let body = template.body;
    let html = template.html;

    // Replace all variables in format {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, "g"), value);
      body = body.replace(new RegExp(placeholder, "g"), value);
      if (html) {
        html = html.replace(new RegExp(placeholder, "g"), value);
      }
    }

    return { subject, body, html };
  },

  /**
   * Extract variables from template content
   */
  extractVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: RegExp.exec pattern
    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  },

  /**
   * Update template variables based on content
   */
  async updateTemplateVariables(id: string): Promise<EmailTemplate> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }

    // Extract variables from subject and body
    const subjectVars = this.extractVariables(template.subject);
    const bodyVars = this.extractVariables(template.body);
    const htmlVars = template.html ? this.extractVariables(template.html) : [];

    const allVars = Array.from(
      new Set([...subjectVars, ...bodyVars, ...htmlVars]),
    );

    return this.updateTemplate(id, { variables: allVars });
  },
};

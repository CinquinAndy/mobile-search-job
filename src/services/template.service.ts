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
    if (stored) return JSON.parse(stored);

    // Default templates
    const userId = getUserId();
    const defaultTemplates: EmailTemplate[] = [
      {
        id: "job-app-en",
        userId,
        name: "Job Application (EN)",
        subject: "Andy - Full-Stack Dev for {{companyName}}",
        body: `Hey there {{companyName}} team!

I've been browsing Awwwards for a long time now and that's how I found you and your work! I'm impressed every time.

I always told myself that I would reach out to you when I felt legitimate enough to do so.

I would love to work with an agency like yours and move to Canada!

My name is Andy, and I'm thinking... "why not", I have 7 years of experience in IT, a Master's degree in engineering, and I've worked in many different environments.
IT consulting, Startup, end client, and agency.

I think my profile might interest you: I have a nice background, including over a year of experience at an American agency, Wildlife.la, where I worked on NextJS, then on React. I've also had the opportunity to create several SaaS platforms, e-commerce sites, and websites as a freelancer for over 7 years, but the list would be too long to detail here!

So let me share my portfolio with you:
https://andy-cinquin.fr (🇫🇷) or https://andy-cinquin.com (🇬🇧)

You'll also find all the necessary info on my GitHub:
https://github.com/CinquinAndy for the pure tech aspect!

Stack-wise, I'm particularly comfortable with the JS/TS ecosystem (NextJS) and Headless CMS like Strapi, Payload, or Directus.

I really want to collaborate with the best in our field, and that's clearly you. Your approach and the quality of your work speaks to me tremendously. I've seen quite a few of your projects, which say great things (really great things!) about you, so here I go: nothing ventured, nothing gained as they say ;d !

Wishing you a wonderful day,
Andy`,
        variables: ["companyName"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "job-app-fr",
        userId,
        name: "Job Application (FR)",
        subject: "Andy - Dev Full-Stack pour {{companyName}}",
        body: `Hello à toute la team {{companyName}} !

Cela fait très longtemps que je me balade sur Awwwards et c'est comme ça que je vous ai trouvé, vous et votre travail ! Et je suis impressionné à chaque fois.

Je me suis toujours dit que je vous contacterais le jour où je me sentirais légitime de le faire.

Je rêverais de travailler avec une agence comme la vôtre et de venir m'installer au Canada !

Moi, c'est Andy, et je me dis ... "why not", j'ai 7 ans d'expérience en informatique, un master d'ingénierie, et j'ai travaillé dans de nombreux environnements différents.
ESN, Startup, client final, et agence.

Je pense que mon profil peut vous intéresser : j'ai un parcours sympa, incluant une expérience de plus d'un an dans une agence américaine, Wildlife.la, où j'ai travaillé sur NextJS, puis sur React. J'ai également eu l'occasion de créer plusieurs SaaS, des plateformes e-commerce et des sites web en freelance pendant +7 ans, mais la liste serait trop longue pour tout détailler ici !

Je vous laisse donc découvrir mon portfolio ici :
https://andy-cinquin.fr (🇫🇷) ou https://andy-cinquin.com (🇬🇧)

Et vous trouverez également toutes les infos nécessaires sur mon GitHub :
https://github.com/CinquinAndy par rapport à l'aspect tech pur !

Côté stack, je suis particulièrement à l'aise avec l'écosystème JS/TS (NextJS) et les CMS Headless comme Strapi, Payload ou Directus.

J'ai très envie de collaborer avec les cracks de notre domaine, et c'est clairement votre cas. Votre approche et la qualité de vos réalisations me parlent énormément. J'ai vu pas mal de vos réalisations, qui disent du bien (beaucoup de bien même!) de vous, alors je me lance : qui ne tente rien n'a rien comme on dit ;d !

En vous souhaitant une très agréable journée,
Andy`,
        variables: ["companyName"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    saveTemplates(defaultTemplates);
    return defaultTemplates;
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

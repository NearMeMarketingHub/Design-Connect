import type { User, Project, Estimate, EstimateLineItem, Invoice, InvoiceLineItem, RecurringBilling, ProjectPhase, ActionItem, InspirationImage, Message } from "@shared/schema";

class ApiClient {
  private baseUrl = "/api";

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth methods
  async register(username: string, password: string, role: string, name?: string) {
    return this.fetch<{ user: Omit<User, "password"> }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, role, name }),
    });
  }

  async login(username: string, password: string) {
    return this.fetch<{ user: Omit<User, "password"> }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async logout() {
    return this.fetch<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser() {
    return this.fetch<{ user: Omit<User, "password"> }>("/auth/user");
  }

  // Project methods
  async getProjects() {
    return this.fetch<Project[]>("/projects");
  }

  async getProject(id: string) {
    return this.fetch<Project>(`/projects/${id}`);
  }

  async createProject(project: Partial<Project>) {
    return this.fetch<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: string, project: Partial<Project>) {
    return this.fetch<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(project),
    });
  }

  // Estimate methods
  async getEstimates() {
    return this.fetch<Estimate[]>("/estimates");
  }

  async getEstimate(id: string) {
    return this.fetch<Estimate & { lineItems: EstimateLineItem[] }>(`/estimates/${id}`);
  }

  async createEstimate(estimate: Partial<Estimate> & { lineItems?: Partial<EstimateLineItem>[] }) {
    return this.fetch<Estimate>("/estimates", {
      method: "POST",
      body: JSON.stringify(estimate),
    });
  }

  // Invoice methods
  async getInvoices() {
    return this.fetch<Invoice[]>("/invoices");
  }

  async getInvoice(id: string) {
    return this.fetch<Invoice & { lineItems: InvoiceLineItem[] }>(`/invoices/${id}`);
  }

  async createInvoice(invoice: Partial<Invoice> & { lineItems?: Partial<InvoiceLineItem>[] }) {
    return this.fetch<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify(invoice),
    });
  }

  // Recurring billing methods
  async getRecurringBilling() {
    return this.fetch<RecurringBilling[]>("/recurring-billing");
  }

  async createRecurringBilling(billing: Partial<RecurringBilling>) {
    return this.fetch<RecurringBilling>("/recurring-billing", {
      method: "POST",
      body: JSON.stringify(billing),
    });
  }

  // Project phase methods
  async getProjectPhases(projectId: string) {
    return this.fetch<ProjectPhase[]>(`/projects/${projectId}/phases`);
  }

  async createProjectPhase(projectId: string, phase: Partial<ProjectPhase>) {
    return this.fetch<ProjectPhase>(`/projects/${projectId}/phases`, {
      method: "POST",
      body: JSON.stringify(phase),
    });
  }

  // Action item methods
  async getActionItems(projectId: string) {
    return this.fetch<ActionItem[]>(`/projects/${projectId}/action-items`);
  }

  async createActionItem(projectId: string, item: Partial<ActionItem>) {
    return this.fetch<ActionItem>(`/projects/${projectId}/action-items`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  async updateActionItem(id: string, item: Partial<ActionItem>) {
    return this.fetch<ActionItem>(`/action-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(item),
    });
  }

  // Inspiration image methods
  async getInspirationImages(projectId: string) {
    return this.fetch<InspirationImage[]>(`/projects/${projectId}/inspiration`);
  }

  async createInspirationImage(projectId: string, image: Partial<InspirationImage>) {
    return this.fetch<InspirationImage>(`/projects/${projectId}/inspiration`, {
      method: "POST",
      body: JSON.stringify(image),
    });
  }

  // Message methods
  async getMessages(projectId: string) {
    return this.fetch<Message[]>(`/projects/${projectId}/messages`);
  }

  async createMessage(projectId: string, content: string) {
    return this.fetch<Message>(`/projects/${projectId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }
}

export const api = new ApiClient();

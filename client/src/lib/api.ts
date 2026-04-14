import type { User, Project, Estimate, EstimateLineItem, Invoice, InvoiceLineItem, RecurringBilling, ProjectPhase, ActionItem, InspirationImage, Message, ContractorRequest } from "@shared/schema";

export type ProjectWithClient = Project & {
  client: Omit<User, "password"> | null;
};

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
  async register(username: string, email: string, password: string, role: string, name?: string, companyName?: string, companyType?: string, phone?: string, contractorType?: string) {
    return this.fetch<{ user: Omit<User, "password">; pendingApproval?: boolean; message?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password, role, name, companyName, companyType, phone, contractorType }),
    });
  }

  async login(username: string, password: string, portal: 'client' | 'contractor' | 'admin' | 'notary') {
    return this.fetch<{ user: Omit<User, "password">; portal: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, portal }),
    });
  }

  // Admin contractor approval
  async getPendingContractors() {
    return this.fetch<Omit<User, "password">[]>("/admin/contractors/pending");
  }

  async approveContractor(contractorId: string) {
    return this.fetch<{ message: string }>(`/admin/contractors/${contractorId}/approve`, {
      method: "POST",
    });
  }

  async rejectContractor(contractorId: string) {
    return this.fetch<{ message: string }>(`/admin/contractors/${contractorId}/reject`, {
      method: "POST",
    });
  }

  // Contractor access requests
  async getContractorRequests() {
    return this.fetch<ContractorRequest[]>("/contractor-requests");
  }

  async getPendingContractorRequests() {
    return this.fetch<ContractorRequest[]>("/contractor-requests/pending");
  }

  async approveContractorRequest(requestId: string) {
    return this.fetch<{ message: string; tempPassword: string }>(`/contractor-requests/${requestId}/approve`, {
      method: "PATCH",
    });
  }

  async rejectContractorRequest(requestId: string) {
    return this.fetch<{ message: string }>(`/contractor-requests/${requestId}/reject`, {
      method: "PATCH",
    });
  }

  async logout() {
    return this.fetch<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser() {
    const response = await fetch(`${this.baseUrl}/auth/user`, {
      credentials: "include",
    });
    
    if (!response.ok) {
      // Return null user for unauthenticated state instead of throwing
      return { user: null as Omit<User, "password"> | null };
    }
    
    return response.json() as Promise<{ user: Omit<User, "password"> }>;
  }

  // Project methods
  async getProjects() {
    return this.fetch<Project[]>("/projects");
  }

  async getProject(id: string) {
    return this.fetch<ProjectWithClient>(`/projects/${id}`);
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

  // Admin methods
  async getAdminProjects() {
    return this.fetch<(Project & { clientName?: string; contractorName?: string })[]>("/admin/projects");
  }

  async getContractors() {
    return this.fetch<Omit<User, "password">[]>("/admin/contractors");
  }

  async getClients() {
    return this.fetch<Omit<User, "password">[]>("/admin/clients");
  }

  async assignContractor(projectId: string, contractorId: string) {
    return this.fetch<Project>(`/admin/projects/${projectId}/assign`, {
      method: "POST",
      body: JSON.stringify({ contractorId }),
    });
  }

  // Sandbox methods
  async getSandboxData() {
    return this.fetch<{ client: Omit<User, "password"> | null; contractor: Omit<User, "password"> | null; project: Project | null }>("/sandbox/data");
  }

  async initializeSandbox() {
    return this.fetch<{ client: Omit<User, "password">; contractor: Omit<User, "password">; project: Project }>("/sandbox/initialize", {
      method: "POST",
    });
  }

  async resetSandbox() {
    return this.fetch<{ client: Omit<User, "password">; contractor: Omit<User, "password">; project: Project }>("/sandbox/reset", {
      method: "POST",
    });
  }
}

export const api = new ApiClient();

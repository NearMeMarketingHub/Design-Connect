import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import { AdminShell } from "@/components/admin-shell";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import ClientDashboard from "@/pages/client-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import Estimator from "@/pages/estimator";
import ProjectDetails from "@/pages/project-details";
import SalesDashboard from "@/pages/sales-dashboard";
import AccountingDashboard from "@/pages/accounting-dashboard";
import CreateInvoice from "@/pages/create-invoice";
import NewProject from "@/pages/new-project";
import ClientProjects from "@/pages/client-projects";
import SettingsPage from "@/pages/settings";
import AdminLogin from "@/pages/admin-login";
import AdminOverview from "@/pages/admin/overview";
import AdminCompanies from "@/pages/admin/companies";
import AdminCompanyDetail from "@/pages/admin/company-detail";
import AdminDemoRequests from "@/pages/admin/demo-requests";
import AdminUsers from "@/pages/admin/users";
import AdminInvites from "@/pages/admin/invites";
import AdminProjects from "@/pages/admin/projects";
import AdminPricingAccess from "@/pages/admin/pricing-access";
import AdminTools from "@/pages/admin/tools";
import AdminRoleDefinitions from "@/pages/admin/role-definitions";
import AdminAuditLog from "@/pages/admin/audit-log";
import AdminViewAsUser from "@/pages/admin/view-as-user";
import SandboxDashboard from "@/pages/sandbox-dashboard";
import SandboxProject from "@/pages/sandbox-project";
import SandboxMessages from "@/pages/sandbox-messages";
import SandboxDocuments from "@/pages/sandbox-documents";
import SandboxPhotos from "@/pages/sandbox-photos";
import BudgetAdmin from "@/pages/budget-admin";
import AcceptInvite from "@/pages/accept-invite";
import ContractorManagement from "@/pages/contractor-management";
import ContractorProfile from "@/pages/contractor-profile";
import MyProfile from "@/pages/my-profile";
import ContractorCalculator from "@/pages/contractor-calculator";
import FloorCalculator from "@/pages/floor-calculator";
import FloorPlan3D from "@/pages/floor-plan-3d";
import SignDocumentPage from "@/pages/sign-document";
import SignAuthenticatedPage from "@/pages/sign-authenticated";
import SignatureSetup from "@/pages/signature-setup";
import NotaryPortal from "@/pages/notary-portal";
import CompanyDashboard from "@/pages/company-dashboard";
import CompanyFinancials from "@/pages/company-financials";
import SubcontractorDashboard from "@/pages/subcontractor-dashboard";
import AcceptSubcontractorInvite from "@/pages/accept-subcontractor-invite";
import DemoPage from "@/pages/demo";
import ResetPasswordPage from "@/pages/reset-password";
import ForgotPasswordPage from "@/pages/forgot-password";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import ErrorBoundary from "@/components/error-boundary";
import { useRealtimeUpdates } from "@/lib/useRealtimeUpdates";

function Router() {
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Landing Page (home)
  if (location === "/") {
    return <LandingPage />;
  }

  // Demo / Contact page (public)
  if (location === "/demo") {
    return <DemoPage />;
  }

  // Password reset pages (public)
  if (location === "/forgot-password") {
    return <ForgotPasswordPage />;
  }

  if (location.startsWith("/reset-password/")) {
    return (
      <Switch>
        <Route path="/reset-password/:token" component={ResetPasswordPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  
  // Auth Routes
  if (location === "/auth") {
    return <AuthPage />;
  }
  
  if (location === "/admin-login") {
    return <AdminLogin />;
  }
  
  // Accept invite page - doesn't require auth or layout
  if (location.startsWith("/invite/")) {
    return (
      <Switch>
        <Route path="/invite/:token" component={AcceptInvite} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  
  // Public signing page - doesn't require auth
  if (location.startsWith("/sign/")) {
    return (
      <Switch>
        <Route path="/sign/:token" component={SignDocumentPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  
  // Notary Portal Routes (has its own header)
  // Strictly restricted to users with role=contractor and contractorType=notary
  if (location.startsWith("/notary")) {
    if (!authLoading && !(user?.role === "contractor" && user.contractorType === "notary")) {
      setLocation("/auth");
      return null;
    }
    if (authLoading) return null;
    return (
      <Switch>
        <Route path="/notary/portal" component={NotaryPortal} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Accept subcontractor invite (public token-based page)
  if (location.startsWith("/subcontractor-invite/")) {
    return (
      <Switch>
        <Route path="/subcontractor-invite/:token" component={AcceptSubcontractorInvite} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Company Portal Routes (with Layout - shares contractor portal sidebar)
  if (location.startsWith("/company")) {
    return (
      <Layout>
        <Switch>
          <Route path="/company/dashboard" component={CompanyDashboard} />
          <Route path="/company/team" component={CompanyDashboard} />
          <Route path="/company/budget" component={BudgetAdmin} />
          <Route path="/company/financials" component={CompanyFinancials} />
          <Route path="/company/sales">{() => <SalesDashboard />}</Route>
          <Route path="/company/estimates">{() => <Estimator />}</Route>
          <Route path="/company/accounting">{() => <AccountingDashboard />}</Route>
          <Route path="/company/invoice/new">{() => <CreateInvoice />}</Route>
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  }

  // Subcontractor Portal Routes (with Layout)
  // Strictly restricted to users with role=contractor and contractorType=subcontractor
  if (location.startsWith("/subcontractor")) {
    if (!authLoading && !(user?.role === "contractor" && user.contractorType === "subcontractor")) {
      setLocation("/auth");
      return null;
    }
    if (authLoading) return null;
    return (
      <Layout>
        <Switch>
          <Route path="/subcontractor/dashboard" component={SubcontractorDashboard} />
          <Route path="/subcontractor/project/:id/progress" component={ProjectDetails} />
          <Route path="/subcontractor/project/:id/documents" component={ProjectDetails} />
          <Route path="/subcontractor/project/:id/messages" component={ProjectDetails} />
          <Route path="/subcontractor/project/:id/budget" component={ProjectDetails} />
          <Route path="/subcontractor/project/:id/timeline" component={ProjectDetails} />
          <Route path="/subcontractor/project/:id" component={ProjectDetails} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  }
  
  // Sandbox pages have their own headers
  if (location.startsWith("/sandbox")) {
    return (
      <Switch>
        <Route path="/sandbox/dashboard" component={SandboxDashboard} />
        <Route path="/sandbox/project/:id" component={SandboxProject} />
        <Route path="/sandbox/project/:id/messages" component={SandboxMessages} />
        <Route path="/sandbox/project/:id/documents" component={SandboxDocuments} />
        <Route path="/sandbox/project/:id/photos" component={SandboxPhotos} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Admin Portal Routes (have their own headers / sidebar layout)
  if (location.startsWith("/admin")) {
    return (
      <Switch>
        <Route path="/admin/dashboard" component={AdminOverview} />
        <Route path="/admin/overview"><Redirect to="/admin/dashboard" /></Route>
        <Route path="/admin/companies/:companyId" component={AdminCompanyDetail} />
        <Route path="/admin/companies" component={AdminCompanies} />
        <Route path="/admin/demo-requests" component={AdminDemoRequests} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/invites" component={AdminInvites} />
        <Route path="/admin/projects" component={AdminProjects} />
        <Route path="/admin/pricing-access" component={AdminPricingAccess} />
        <Route path="/admin/tools" component={AdminTools} />
        <Route path="/admin/role-definitions" component={AdminRoleDefinitions} />
        <Route path="/admin/audit-log" component={AdminAuditLog} />
        <Route path="/admin/view-as-user" component={AdminViewAsUser} />
        <Route path="/admin/project/:id" component={ProjectDetails} />
        <Route path="/admin/contractors" component={ContractorManagement} />
        <Route path="/admin/contractors/:id" component={ContractorProfile} />
        <Route path="/admin/budget" component={BudgetAdmin} />
        <Route path="/admin/sales">{() => <AdminShell><SalesDashboard /></AdminShell>}</Route>
        <Route path="/admin/estimates">{() => <AdminShell><Estimator /></AdminShell>}</Route>
        <Route path="/admin/accounting">{() => <AdminShell><AccountingDashboard /></AdminShell>}</Route>
        <Route path="/admin/invoice/new">{() => <AdminShell><CreateInvoice /></AdminShell>}</Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Client Portal Routes (with Layout)
  if (location.startsWith("/client")) {
    return (
      <Layout>
        <Switch>
          <Route path="/client/dashboard" component={ClientDashboard} />
          <Route path="/client/projects" component={ClientProjects} />
          <Route path="/client/project/:id/progress" component={ProjectDetails} />
          <Route path="/client/project/:id/documents" component={ProjectDetails} />
          <Route path="/client/project/:id/messages" component={ProjectDetails} />
          <Route path="/client/project/:id/budget" component={ProjectDetails} />
          <Route path="/client/project/:id/timeline" component={ProjectDetails} />
          <Route path="/client/project/:id/inspiration" component={ProjectDetails} />
          <Route path="/client/project/:id/materials" component={ProjectDetails} />
          <Route path="/client/project/:id/action-center" component={ProjectDetails} />
          <Route path="/client/project/:id" component={ProjectDetails} />
          <Route path="/client/sign/:packetId" component={SignAuthenticatedPage} />
          <Route path="/client/profile" component={MyProfile} />
          <Route path="/client/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  }

  // Contractor Portal Routes (with Layout)
  if (location.startsWith("/contractor")) {
    return (
      <Layout>
        <Switch>
          <Route path="/contractor/dashboard" component={AdminDashboard} />
          <Route path="/contractor/projects" component={ClientProjects} />
          <Route path="/contractor/new-project" component={NewProject} />
          <Route path="/contractor/project/:id/progress" component={ProjectDetails} />
          <Route path="/contractor/project/:id/documents" component={ProjectDetails} />
          <Route path="/contractor/project/:id/messages" component={ProjectDetails} />
          <Route path="/contractor/project/:id/budget" component={ProjectDetails} />
          <Route path="/contractor/project/:id/timeline" component={ProjectDetails} />
          <Route path="/contractor/project/:id/inspiration" component={ProjectDetails} />
          <Route path="/contractor/project/:id/contractor-photos" component={ProjectDetails} />
          <Route path="/contractor/project/:id/materials" component={ProjectDetails} />
          <Route path="/contractor/project/:id/action-center" component={ProjectDetails} />
          <Route path="/contractor/project/:id/signature-setup/:documentId" component={SignatureSetup} />
          <Route path="/contractor/project/:id" component={ProjectDetails} />
          <Route path="/contractor/calculator" component={ContractorCalculator} />
          <Route path="/contractor/floor-calculator" component={FloorCalculator} />
          <Route path="/contractor/floor-plan-3d" component={FloorPlan3D} />
          <Route path="/contractor/profile" component={MyProfile} />
          <Route path="/contractor/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  }

  // Fallback to NotFound for any unmatched routes
  return <NotFound />;
}

function RealtimeUpdates() {
  const { user } = useAuth();
  useRealtimeUpdates(!!user);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <RealtimeUpdates />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

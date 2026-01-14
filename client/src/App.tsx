import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
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
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
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
import SignDocumentPage from "@/pages/sign-document";
import SignAuthenticatedPage from "@/pages/sign-authenticated";
import SignatureSetup from "@/pages/signature-setup";
import NotaryPortal from "@/pages/notary-portal";
import { AuthProvider } from "@/lib/auth-context";

function Router() {
  const [location] = useLocation();

  // Landing Page (home)
  if (location === "/") {
    return <LandingPage />;
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
  if (location.startsWith("/notary")) {
    return (
      <Switch>
        <Route path="/notary/portal" component={NotaryPortal} />
        <Route component={NotFound} />
      </Switch>
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

  // Admin Portal Routes (have their own headers)
  if (location.startsWith("/admin")) {
    return (
      <Switch>
        <Route path="/admin/dashboard" component={SuperAdminDashboard} />
        <Route path="/admin/contractors" component={ContractorManagement} />
        <Route path="/admin/contractors/:id" component={ContractorProfile} />
        <Route path="/admin/budget" component={BudgetAdmin} />
        <Route path="/admin/sales" component={SalesDashboard} />
        <Route path="/admin/estimates" component={Estimator} />
        <Route path="/admin/accounting" component={AccountingDashboard} />
        <Route path="/admin/invoice/new" component={CreateInvoice} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

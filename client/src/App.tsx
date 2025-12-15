import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import AuthPage from "@/pages/auth";
import ClientDashboard from "@/pages/client-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import Estimator from "@/pages/estimator";
import ProjectDetails from "@/pages/project-details";
import TimelinePage from "@/pages/timeline";
import SalesDashboard from "@/pages/sales-dashboard";
import AccountingDashboard from "@/pages/accounting-dashboard";
import CreateInvoice from "@/pages/create-invoice";
import ClientProjects from "@/pages/client-projects";
import SettingsPage from "@/pages/settings";
import AdminLogin from "@/pages/admin-login";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import SandboxDashboard from "@/pages/sandbox-dashboard";
import SandboxProject from "@/pages/sandbox-project";
import SandboxMessages from "@/pages/sandbox-messages";
import SandboxDocuments from "@/pages/sandbox-documents";
import SandboxPhotos from "@/pages/sandbox-photos";
import { AuthProvider } from "@/lib/auth-context";

function Router() {
  const [location] = useLocation();

  if (location === "/") {
    return <AuthPage />;
  }
  
  if (location === "/admin-login") {
    return <AdminLogin />;
  }
  
  // Super Admin Dashboard has its own header, so render without Layout
  if (location === "/super-admin") {
    return <SuperAdminDashboard />;
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

  return (
    <Layout>
      <Switch>
        <Route path="/dashboard" component={ClientDashboard} />
        <Route path="/my-projects" component={ClientProjects} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/admin-dashboard" component={AdminDashboard} />
        
        {/* Sales & Estimating */}
        <Route path="/sales" component={SalesDashboard} />
        <Route path="/estimates" component={Estimator} />
        
        {/* Accounting & Invoicing */}
        <Route path="/accounting" component={AccountingDashboard} />
        <Route path="/create-invoice" component={CreateInvoice} />

        {/* Projects & Operations */}
        <Route path="/project/:id" component={ProjectDetails} />
        <Route path="/timeline" component={TimelinePage} />
        <Route path="/schedule" component={TimelinePage} />
        
        {/* Redirects/Placeholders for demo completeness */}
        <Route path="/inspiration">
          {() => <ProjectDetails />} 
        </Route>
        <Route path="/documents">
          {() => <ProjectDetails />}
        </Route>
        <Route path="/projects">
          {() => <AdminDashboard />}
        </Route>
         <Route path="/admin-docs">
          {() => <ProjectDetails />}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
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

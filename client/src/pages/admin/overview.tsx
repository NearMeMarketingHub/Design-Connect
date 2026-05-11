import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Building2,
  CheckCircle,
  CalendarCheck,
  Clock,
  Users,
  FolderOpen,
  Receipt,
  Wrench,
  Link2,
  ChevronRight,
} from "lucide-react";

interface AdminCompany {
  id: string;
  subscriptionStatus?: string;
}

interface DemoRequest {
  id: string;
  status: string;
}

interface AdminInvite {
  id: string;
  status: string;
}

export default function AdminOverview() {
  const { user } = useAuth();

  const { data: allCompanies = [] } = useQuery<AdminCompany[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: () => apiRequest("GET", "/api/admin/companies").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: demoRequests = [] } = useQuery<DemoRequest[]>({
    queryKey: ["/api/admin/demo-requests"],
    queryFn: () => apiRequest("GET", "/api/admin/demo-requests").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: adminInvites = [] } = useQuery<AdminInvite[]>({
    queryKey: ["/api/admin/invites"],
    queryFn: () => apiRequest("GET", "/api/admin/invites").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: pendingContractors = [] } = useQuery({
    queryKey: ["/api/admin/contractors/pending"],
    queryFn: () => api.getPendingContractors(),
    enabled: user?.role === "admin",
  });

  const { data: contractorRequests = [] } = useQuery({
    queryKey: ["/api/contractor-requests/pending"],
    queryFn: () => api.getPendingContractorRequests(),
    enabled: user?.role === "admin",
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const activeCompanies = allCompanies.filter(
    (c) => c.subscriptionStatus === "active" || c.subscriptionStatus === "trialing"
  );
  const newDemoRequests = demoRequests.filter((d) => d.status === "new");
  const pendingInvitesCount = adminInvites.filter((i) => i.status === "pending").length;
  const pendingTotal =
    pendingContractors.length + contractorRequests.length + pendingInvitesCount;

  const stats = [
    {
      label: "Total Companies",
      value: allCompanies.length,
      icon: Building2,
      color: "bg-blue-100 text-blue-600",
      href: "/admin/companies",
    },
    {
      label: "Active Companies",
      value: activeCompanies.length,
      icon: CheckCircle,
      color: "bg-green-100 text-green-600",
      href: "/admin/companies",
    },
    {
      label: "New Demo Requests",
      value: newDemoRequests.length,
      icon: CalendarCheck,
      color: "bg-purple-100 text-purple-600",
      href: "/admin/demo-requests",
    },
    {
      label: "Pending Invites & Approvals",
      value: pendingTotal,
      icon: Clock,
      color:
        pendingTotal > 0
          ? "bg-orange-200 text-orange-700"
          : "bg-orange-100 text-orange-600",
      href: "/admin/invites",
    },
    {
      label: "Total Users",
      value: allUsers.length,
      icon: Users,
      color: "bg-indigo-100 text-indigo-600",
      href: "/admin/users",
    },
  ];

  const quickLinks = [
    {
      label: "Companies",
      description: "Manage company accounts, plans, and access",
      icon: Building2,
      href: "/admin/companies",
      color: "text-blue-600",
    },
    {
      label: "Demo Requests",
      description: "Review leads and convert them to companies",
      icon: CalendarCheck,
      href: "/admin/demo-requests",
      color: "text-purple-600",
    },
    {
      label: "Users",
      description: "Search users and send password resets",
      icon: Users,
      href: "/admin/users",
      color: "text-violet-600",
    },
    {
      label: "Invites",
      description: "Monitor invite status across the platform",
      icon: Link2,
      href: "/admin/invites",
      color: "text-teal-600",
    },
    {
      label: "Projects",
      description: "View and assign contractors to projects",
      icon: FolderOpen,
      href: "/admin/projects",
      color: "text-blue-600",
    },
    {
      label: "Pricing & Access",
      description: "Configure platform pricing defaults and access settings.",
      icon: Receipt,
      href: "/admin/pricing-access",
      color: "text-emerald-600",
    },
    {
      label: "Admin Tools",
      description: "Sandbox testing, role definitions, and platform utilities.",
      icon: Wrench,
      href: "/admin/tools",
      color: "text-gray-600",
    },
  ];

  return (
    <SuperAdminLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back. Here's a snapshot of the platform.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href}>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${stat.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
                        <h3 className="text-2xl font-bold">{stat.value}</h3>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Quick Navigation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    data-testid={`quick-link-${link.href.replace("/admin/", "")}`}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg shrink-0">
                        <Icon className={`w-5 h-5 ${link.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{link.label}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {link.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}

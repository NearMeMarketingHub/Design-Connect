import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  TestTube,
  LayoutDashboard,
  RefreshCw,
  Loader2,
} from "lucide-react";

export default function AdminTools() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sandboxData, isLoading: sandboxLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  const initSandboxMutation = useMutation({
    mutationFn: () => api.initializeSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/data"] });
      toast({ title: "Sandbox Initialized" });
    },
    onError: (error: Error) =>
      toast({
        title: "Initialization Failed",
        description: parseErrorMessage(error),
        variant: "destructive",
      }),
  });

  const resetSandboxMutation = useMutation({
    mutationFn: () => api.resetSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/data"] });
      toast({ title: "Sandbox Reset" });
    },
    onError: (error: Error) =>
      toast({
        title: "Reset Failed",
        description: parseErrorMessage(error),
        variant: "destructive",
      }),
  });

  return (
    <SuperAdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <TestTube className="w-5 h-5 text-purple-600" />
            <h1 className="text-2xl font-bold text-foreground">Sandbox</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-7">
            Use the sandbox area to test client-side workflows, documents, messages, photos, and project interactions without affecting live company data.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TestTube className="w-4 h-4 text-purple-600" />
              Sandbox Testing
            </CardTitle>
            <CardDescription>Test features in an isolated environment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sandboxLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !sandboxData?.project ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm mb-4">
                  No sandbox data. Initialize to create test accounts.
                </p>
                <Button
                  onClick={() => initSandboxMutation.mutate()}
                  disabled={initSandboxMutation.isPending}
                  className="w-full"
                  data-testid="button-init-sandbox"
                >
                  {initSandboxMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initializing…
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-2" />
                      Initialize Sandbox
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    <strong>Test Client:</strong> {sandboxData.client?.name}
                    <br />
                    <strong>Test Contractor:</strong> {sandboxData.contractor?.name}
                    <br />
                    <strong>Test Project:</strong> {sandboxData.project.name}
                  </p>
                </div>
                <Link href="/sandbox/dashboard">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    data-testid="button-sandbox-dashboard"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Client Dashboard
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-amber-600 border-amber-300 hover:bg-amber-50"
                  onClick={() => resetSandboxMutation.mutate()}
                  disabled={resetSandboxMutation.isPending}
                  data-testid="button-reset-sandbox"
                >
                  {resetSandboxMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Reset Sandbox Data
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}

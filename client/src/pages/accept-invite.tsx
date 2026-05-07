import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, User, Lock, Mail, CheckCircle, AlertCircle, Loader2, LogIn, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";

type Mode = "new-user" | "existing-user";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("new-user");

  const [newUserForm, setNewUserForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
  });

  const [loginForm, setLoginForm] = useState({
    password: "",
  });

  const { data: inviteData, isLoading: inviteLoading, error: inviteError } = useQuery({
    queryKey: ["/api/invites", token],
    queryFn: async () => {
      const res = await fetch(`/api/invites/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Invalid invitation");
      }
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (inviteData?.clientName) {
      setNewUserForm(prev => ({ ...prev, name: inviteData.clientName }));
    }
    if (inviteData?.existingUser) {
      setMode("existing-user");
    }
  }, [inviteData]);

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invites/${token}/accept`, {
        username: newUserForm.username,
        password: newUserForm.password,
        name: newUserForm.name,
      });
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: "Welcome to BuildVision!",
        description: "Your account has been created and you're now logged in.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/client/dashboard");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: parseErrorMessage(error), variant: "destructive" });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invites/${token}/login`, {
        email: inviteData?.email,
        password: loginForm.password,
      });
      return res.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Invitation accepted!",
        description: "You've been added to the project.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const role = data.user?.role;
      if (role === "contractor" || role === "company_owner") {
        setLocation("/contractor/dashboard");
      } else {
        setLocation("/client/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: parseErrorMessage(error), variant: "destructive" });
    },
  });

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.username.trim()) {
      toast({ title: "Missing Information", description: "Please enter a username.", variant: "destructive" });
      return;
    }
    if (newUserForm.password.length < 6) {
      toast({ title: "Password Too Short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newUserForm.password !== newUserForm.confirmPassword) {
      toast({ title: "Passwords Don't Match", description: "Please make sure your passwords match.", variant: "destructive" });
      return;
    }
    createAccountMutation.mutate();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.password) {
      toast({ title: "Missing Password", description: "Please enter your password.", variant: "destructive" });
      return;
    }
    loginMutation.mutate();
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              {(inviteError as Error).message || "This invitation link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/")} data-testid="button-go-home">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <Building2 className="w-12 h-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to BuildVision</CardTitle>
          <CardDescription>
            {inviteData?.companyName && (
              <span className="block"><strong>{inviteData.companyName}</strong> has invited you to collaborate on:</span>
            )}
            <span className="block mt-1">Project: <strong>{inviteData?.projectName}</strong></span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode switcher */}
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1 bg-muted/30">
            <button
              type="button"
              onClick={() => setMode("new-user")}
              className={`flex items-center justify-center gap-2 rounded-md py-2 px-3 text-sm font-medium transition-colors ${
                mode === "new-user"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-mode-new-user"
            >
              <UserPlus className="w-4 h-4" />
              Create Account
            </button>
            <button
              type="button"
              onClick={() => setMode("existing-user")}
              className={`flex items-center justify-center gap-2 rounded-md py-2 px-3 text-sm font-medium transition-colors ${
                mode === "existing-user"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-mode-existing-user"
            >
              <LogIn className="w-4 h-4" />
              Already Have an Account
            </button>
          </div>

          {/* New user form */}
          {mode === "new-user" && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="John Smith"
                    className="pl-10"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={inviteData?.email || ""}
                    disabled
                    className="pl-10 bg-muted"
                    data-testid="input-email"
                  />
                </div>
                <p className="text-xs text-muted-foreground">This email is linked to your invitation</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="johnsmith"
                    className="pl-10"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                    data-testid="input-username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                    data-testid="input-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={newUserForm.confirmPassword}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createAccountMutation.isPending}
                data-testid="button-create-account"
              >
                {createAccountMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Account...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" />Create Account & View Project</>
                )}
              </Button>
            </form>
          )}

          {/* Existing user login form */}
          {mode === "existing-user" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    value={inviteData?.email || ""}
                    disabled
                    className="pl-10 bg-muted"
                    data-testid="input-login-email"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Log in with the account registered to this email</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    data-testid="input-login-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login-accept"
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing In...</>
                ) : (
                  <><LogIn className="w-4 h-4 mr-2" />Sign In & Accept Invitation</>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

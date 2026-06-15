import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";

type PageState = "loading" | "valid" | "invalid" | "success";

export default function ResetPasswordPage() {
  const [, params] = useRoute("/reset-password/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = params?.token ?? "";

  const [pageState, setPageState] = useState<PageState>("loading");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPageState("invalid");
      return;
    }
    fetch(`/api/auth/reset-password/${token}`)
      .then((res) => {
        if (res.ok) {
          setPageState("valid");
        } else {
          setPageState("invalid");
        }
      })
      .catch(() => setPageState("invalid"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm-password") as string;

    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPageState("success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Reset failed",
          description: data.message || "Unable to reset password. The link may have expired.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-light.png" alt="Near Me Construct" className="h-12 w-12 rounded-lg dark:hidden" />
            <img src="/logo-dark.png" alt="Near Me Construct" className="h-12 w-12 rounded-lg hidden dark:block" />
            <div>
              <h1 className="font-heading font-bold text-2xl tracking-tight">Near Me Construct</h1>
              <p className="text-sm text-muted-foreground">Construction Management Portal</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {pageState === "loading" && (
          <Card className="border-border/50 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Validating reset link…</p>
            </CardContent>
          </Card>
        )}

        {pageState === "invalid" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-center">Link Expired or Invalid</CardTitle>
              <CardDescription className="text-center">
                This password reset link has expired or already been used. Reset links are valid for 1 hour.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setLocation("/auth")}
                data-testid="button-back-to-login"
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        )}

        {pageState === "success" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-center">Password Reset!</CardTitle>
              <CardDescription className="text-center">
                Your password has been updated successfully. You can now log in with your new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full font-medium"
                onClick={() => setLocation("/auth")}
                data-testid="button-go-to-login"
              >
                Go to Login
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {pageState === "valid" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>Set New Password</CardTitle>
              <CardDescription>
                Choose a strong password for your Near Me Construct account. It must be at least 8 characters.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      data-testid="input-new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      required
                      minLength={8}
                      data-testid="input-confirm-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirm(!showConfirm)}
                      data-testid="button-toggle-confirm"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full font-medium"
                  disabled={submitting}
                  data-testid="button-reset-submit"
                >
                  {submitting ? "Resetting…" : "Reset Password"}
                  {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

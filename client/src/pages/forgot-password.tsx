import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { HardHat, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    setSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show success to avoid email enumeration
      setSubmitted(true);
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
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <HardHat className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl tracking-tight">BuildVision</h1>
              <p className="text-sm text-muted-foreground">Construction Management Portal</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {submitted ? (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-center">Check Your Email</CardTitle>
              <CardDescription className="text-center">
                If an account exists for that email address, we've sent a password reset link. Check your inbox and spam folder. The link expires in 1 hour.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setLocation("/auth")}
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>Forgot Your Password?</CardTitle>
              <CardDescription>
                Enter the email address associated with your account and we'll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    data-testid="input-email"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full font-medium"
                  disabled={submitting}
                  data-testid="button-send-reset"
                >
                  {submitting ? "Sending…" : "Send Reset Link"}
                  {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => setLocation("/auth")}
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

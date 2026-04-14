import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { HardHat, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export default function AcceptSubcontractorInvite() {
  const [, params] = useRoute("/subcontractor-invite/:token");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const token = params?.token;

  const [form, setForm] = useState({
    username: "",
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [accepted, setAccepted] = useState(false);

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ["/api/contractor-invites/token", token],
    queryFn: async () => {
      const res = await fetch(`/api/contractor-invites/token/${token}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid or expired invite");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      const res = await fetch(`/api/contractor-invites/accept/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: form.username,
          name: form.name,
          password: form.password,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to accept invite");
      }
      return res.json();
    },
    onSuccess: () => {
      setAccepted(true);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Invalid Invite</h2>
            <p className="text-muted-foreground">
              {(error as Error)?.message || "This invite link is invalid or has expired."}
            </p>
            <Button onClick={() => navigate("/")} variant="outline">Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold">Account Created!</h2>
            <p className="text-muted-foreground">
              Your subcontractor account has been set up. You can now log in to the Contractor Portal.
            </p>
            <Button onClick={() => navigate("/auth")} data-testid="button-go-to-login">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
            <HardHat className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join{" "}
            <strong>{invite.companyName || "a company"}</strong> on BuildVision
            {invite.subcontractorSpecialty && ` as a ${invite.subcontractorSpecialty}`}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={invite.email} disabled data-testid="input-email" />
          </div>
          <div>
            <Label>Full Name</Label>
            <Input
              placeholder="Your full name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              data-testid="input-name"
            />
          </div>
          <div>
            <Label>Username</Label>
            <Input
              placeholder="Choose a username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              data-testid="input-username"
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Create a password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              data-testid="input-password"
            />
          </div>
          <div>
            <Label>Confirm Password</Label>
            <Input
              type="password"
              placeholder="Confirm your password"
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              data-testid="input-confirm-password"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => acceptMutation.mutate()}
            disabled={
              !form.username || !form.name || !form.password || !form.confirmPassword ||
              acceptMutation.isPending
            }
            data-testid="button-accept-invite"
          >
            {acceptMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Account...</>
            ) : (
              "Accept & Create Account"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

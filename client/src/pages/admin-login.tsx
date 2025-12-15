import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { HardHat, ArrowRight, ArrowLeft, Shield } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [_, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { login, logout } = useAuth();
  const { toast } = useToast();

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const loginId = formData.get("admin-email") as string;
    const password = formData.get("admin-password") as string;

    try {
      const user = await login(loginId, password);
      
      if (user.role !== "admin") {
        await logout();
        toast({
          title: "Access Denied",
          description: "This portal is for administrators only.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Welcome, Administrator",
        description: "You have successfully logged in.",
      });
      setLocation("/super-admin");
    } catch (error: any) {
      toast({
        title: "Access Denied",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl bg-primary mx-auto flex items-center justify-center text-primary-foreground mb-4">
            <Shield className="w-9 h-9" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-foreground tracking-tight">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">BuildVision System Administration</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Administrator Login</CardTitle>
            <CardDescription>
              Authorized personnel only. All access is logged.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAdminLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email or Username</Label>
                <Input 
                  id="admin-email" 
                  name="admin-email"
                  type="text"
                  placeholder="admin@buildvision.com" 
                  required 
                  data-testid="input-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input 
                  id="admin-password" 
                  name="admin-password"
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  data-testid="input-admin-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                className="w-full" 
                type="submit"
                disabled={loading}
                data-testid="button-admin-login"
              >
                {loading ? "Authenticating..." : "Access Dashboard"} 
                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
              <Link href="/" className="w-full">
                <Button 
                  variant="ghost" 
                  className="w-full"
                  type="button"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Main Login
                </Button>
              </Link>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Protected by BuildVision Security
        </p>
      </div>
    </div>
  );
}

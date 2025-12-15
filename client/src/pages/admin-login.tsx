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
  const { login } = useAuth();
  const { toast } = useToast();

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const loginId = formData.get("admin-email") as string;
    const password = formData.get("admin-password") as string;

    try {
      await login(loginId, password);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl bg-primary mx-auto flex items-center justify-center text-primary-foreground mb-4">
            <Shield className="w-9 h-9" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-white tracking-tight">Admin Portal</h1>
          <p className="text-sm text-slate-400 mt-1">BuildVision System Administration</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Administrator Login</CardTitle>
            <CardDescription className="text-slate-400">
              Authorized personnel only. All access is logged.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAdminLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-slate-300">Email or Username</Label>
                <Input 
                  id="admin-email" 
                  name="admin-email"
                  type="text"
                  placeholder="admin@buildvision.com" 
                  required 
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  data-testid="input-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-slate-300">Password</Label>
                <Input 
                  id="admin-password" 
                  name="admin-password"
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  data-testid="input-admin-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                className="w-full bg-primary hover:bg-primary/90" 
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
                  className="w-full text-slate-400 hover:text-white hover:bg-slate-700"
                  type="button"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Main Login
                </Button>
              </Link>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-slate-500">
          Protected by BuildVision Security
        </p>
      </div>
    </div>
  );
}

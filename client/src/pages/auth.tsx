import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HardHat, ArrowRight, Eye, EyeOff, CalendarCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { parseErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@assets/generated_images/construction_site_frame_with_sunset.png";

type TabValue = "client" | "contractor";

export default function AuthPage() {
  const [_, setLocation] = useLocation();

  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "contractor" || tab === "subcontractor" || tab === "notary" || tab === "company") {
      return "contractor" as TabValue;
    }
    return "client" as TabValue;
  };

  const [activeTab, setActiveTab] = useState<TabValue>(getInitialTab());
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    setActiveTab(getInitialTab());
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  const [showContractorPassword, setShowContractorPassword] = useState(false);

  const handleClientAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const loginId = formData.get("email") as string;
    const password = formData.get("password") as string;
    try {
      const loggedInUser = await login(loginId, password, "client");
      toast({ title: "Welcome back!", description: "You have successfully logged in." });
      if (loggedInUser.role === "admin") {
        setLocation("/admin/dashboard");
      } else {
        setLocation("/client/dashboard");
      }
    } catch (error: unknown) {
      toast({ title: "Error", description: parseErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleContractorAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const loginId = formData.get("contractor-email") as string;
    const password = formData.get("contractor-password") as string;
    try {
      const loggedInUser = await login(loginId, password, "contractor");
      toast({ title: "Welcome back!", description: "You have successfully logged in." });
      if (loggedInUser.role === "admin") {
        setLocation("/admin/dashboard");
      } else if (loggedInUser.role === "company_owner") {
        setLocation("/company/dashboard");
      } else if (loggedInUser.role === "contractor" && loggedInUser.contractorType === "notary") {
        setLocation("/notary/portal");
      } else if (loggedInUser.role === "contractor" && loggedInUser.contractorType === "subcontractor") {
        setLocation("/subcontractor/dashboard");
      } else {
        setLocation("/contractor/dashboard");
      }
    } catch (error: unknown) {
      toast({ title: "Error", description: parseErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center justify-between mb-8">
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

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="client" data-testid="tab-client">Client</TabsTrigger>
              <TabsTrigger value="contractor" data-testid="tab-contractor">Contractor</TabsTrigger>
            </TabsList>

            <TabsContent value="client">
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle>Welcome Back</CardTitle>
                  <CardDescription>
                    Enter your credentials to access your project dashboard.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleClientAuth}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email or Username</Label>
                      <Input id="email" name="email" type="text" placeholder="email or username" required data-testid="input-email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input id="password" name="password" type={showPassword ? "text" : "password"} required data-testid="input-password" />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} data-testid="button-toggle-password">
                          {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full font-medium" disabled={loading} data-testid="button-submit">
                      {loading ? "Please wait..." : "Sign In"}
                      {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="contractor">
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle>Contractor Login</CardTitle>
                  <CardDescription>
                    Log in to access your dashboard. This portal is for company owners, contractors, subcontractors, and notaries.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleContractorAuth}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="contractor-email">Email or Username</Label>
                      <Input id="contractor-email" name="contractor-email" type="text" placeholder="email or username" required data-testid="input-contractor-email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contractor-password">Password</Label>
                      <div className="relative">
                        <Input id="contractor-password" name="contractor-password" type={showContractorPassword ? "text" : "password"} required data-testid="input-contractor-password" />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowContractorPassword(!showContractorPassword)} data-testid="button-toggle-contractor-password">
                          {showContractorPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full font-medium" disabled={loading} data-testid="button-contractor-submit">
                      {loading ? "Please wait..." : "Sign In"}
                      {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Need access? Clients and team members must be invited.
              Companies can request a demo to get started.
            </p>
            <Link href="/demo">
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-request-demo-auth">
                <CalendarCheck className="h-4 w-4" />
                Request a Demo
              </Button>
            </Link>
          </div>

          <div className="pt-4 border-t border-border">
            <Link href="/admin-login">
              <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:text-foreground" data-testid="link-admin-login">
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative bg-muted">
        <img src={heroImage} alt="Construction Site" className="absolute inset-0 w-full h-full object-cover grayscale-[20%] contrast-[1.1]" />
        <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
        <div className="absolute bottom-0 left-0 p-12 text-white max-w-lg">
          <blockquote className="text-3xl font-heading font-semibold leading-tight mb-4">
            "The details are not the details. They make the design."
          </blockquote>
          <cite className="not-italic text-white/80 font-medium">— Charles Eames</cite>
        </div>
      </div>
    </div>
  );
}

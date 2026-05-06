import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HardHat, ArrowRight, Eye, EyeOff, CheckCircle2, CalendarCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { parseErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@assets/generated_images/construction_site_frame_with_sunset.png";

type TabValue = "client" | "contractor";

export default function AuthPage() {
  const [_, setLocation] = useLocation();

  const getInitialState = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const tab = params.get("tab");
    let activeTab: TabValue = "client";
    if (tab === "contractor" || tab === "subcontractor" || tab === "notary" || tab === "company") {
      activeTab = "contractor";
    }
    return { isLogin: mode !== "register", activeTab };
  };

  const initialState = getInitialState();
  const [isLogin, setIsLogin] = useState(initialState.isLogin);
  const [activeTab, setActiveTab] = useState<TabValue>(initialState.activeTab);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const state = getInitialState();
    setIsLogin(state.isLogin);
    setActiveTab(state.activeTab);
  }, []);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showContractorPassword, setShowContractorPassword] = useState(false);
  const [showContractorConfirmPassword, setShowContractorConfirmPassword] = useState(false);

  // Contractor registration state
  const [contractorRegistered, setContractorRegistered] = useState(false);
  const [contractorRole, setContractorRole] = useState<"subcontractor" | "notary">("subcontractor");

  const handleClientAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    try {
      if (isLogin) {
        const loginId = formData.get("email") as string;
        const loggedInUser = await login(loginId, password, "client");
        toast({ title: "Welcome back!", description: "You have successfully logged in." });
        if (loggedInUser.role === "admin") {
          setLocation("/admin/dashboard");
        } else {
          setLocation("/client/dashboard");
        }
      } else {
        const firstName = formData.get("first-name") as string;
        const lastName = formData.get("last-name") as string;
        const username = formData.get("username") as string;
        const email = formData.get("signup-email") as string;
        const phone = formData.get("phone") as string;
        const confirmPassword = formData.get("confirm-password") as string;
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        await register(username, email, password, "client", `${firstName} ${lastName}`, undefined, undefined, phone);
        toast({ title: "Account created!", description: "Welcome to BuildVision." });
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
    const password = formData.get("contractor-password") as string;
    try {
      if (isLogin) {
        const loginId = formData.get("contractor-email") as string;
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
      } else {
        const firstName = formData.get("contractor-first-name") as string;
        const lastName = formData.get("contractor-last-name") as string;
        const username = formData.get("contractor-username") as string;
        const email = formData.get("contractor-signup-email") as string;
        const confirmPassword = formData.get("contractor-confirm-password") as string;
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        await register(
          username, email, password, "contractor",
          `${firstName} ${lastName}`,
          undefined, undefined, undefined,
          contractorRole
        );
        setContractorRegistered(true);
      }
    } catch (error: unknown) {
      toast({ title: "Error", description: parseErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setContractorRegistered(false);
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
                  <CardTitle>{isLogin ? "Welcome Back" : "Create Account"}</CardTitle>
                  <CardDescription>
                    {isLogin
                      ? "Enter your credentials to access your project dashboard."
                      : "Register to view your project details and progress."}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleClientAuth}>
                  <CardContent className="space-y-4">
                    {!isLogin && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="client-first-name">First Name</Label>
                            <Input id="client-first-name" name="first-name" placeholder="Jane" required data-testid="input-first-name" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="client-last-name">Last Name</Label>
                            <Input id="client-last-name" name="last-name" placeholder="Doe" required data-testid="input-last-name" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-username">Username</Label>
                          <Input id="client-username" name="username" placeholder="janedoe" required data-testid="input-username" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-email">Email</Label>
                          <Input id="client-email" name="signup-email" type="email" placeholder="jane@example.com" required data-testid="input-signup-email" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-phone">Phone Number</Label>
                          <Input id="client-phone" name="phone" type="tel" placeholder="(555) 123-4567" required data-testid="input-phone" />
                        </div>
                      </>
                    )}
                    {isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="email">Email or Username</Label>
                        <Input id="email" name="email" type="text" placeholder="email or username" required data-testid="input-email" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input id="password" name="password" type={showPassword ? "text" : "password"} required data-testid="input-password" />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} data-testid="button-toggle-password">
                          {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <div className="relative">
                          <Input id="confirm-password" name="confirm-password" type={showConfirmPassword ? "text" : "password"} required data-testid="input-confirm-password" />
                          <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)} data-testid="button-toggle-confirm-password">
                            {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full font-medium" disabled={loading} data-testid="button-submit">
                      {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
                      {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="contractor">
              <Card className="border-border/50 shadow-lg">
                {contractorRegistered && !isLogin ? (
                  <>
                    <CardHeader>
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <CardTitle className="text-center">Registration Submitted!</CardTitle>
                      <CardDescription className="text-center">
                        Your {contractorRole === "notary" ? "notary" : "sub-contractor"} account is pending admin approval.
                        You'll receive an email once approved.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full" variant="outline" onClick={() => { setContractorRegistered(false); setIsLogin(true); }} data-testid="button-back-to-login">
                        Back to Login
                      </Button>
                    </CardContent>
                  </>
                ) : isLogin ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <CardHeader>
                      <CardTitle>Create Your Account</CardTitle>
                      <CardDescription>
                        Register as a subcontractor or notary to get started.
                      </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleContractorAuth}>
                      <CardContent className="space-y-4">
                        {/* Company owner info box */}
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <CalendarCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-blue-900">Are you a company owner?</p>
                              <p className="text-xs text-blue-700 mt-0.5">
                                Company accounts are created through our onboarding process. Schedule a demo to get your company set up.
                              </p>
                            </div>
                          </div>
                          <a href="mailto:hello@buildvision.io?subject=Demo Request" className="block">
                            <Button type="button" size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-request-demo-register">
                              Request a Demo
                            </Button>
                          </a>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Subcontractor or Notary</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contractor-role">I am a</Label>
                          <Select value={contractorRole} onValueChange={(v) => setContractorRole(v as "subcontractor" | "notary")}>
                            <SelectTrigger data-testid="select-contractor-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="subcontractor">Sub-Contractor</SelectItem>
                              <SelectItem value="notary">Notary</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="contractor-first-name">First Name</Label>
                            <Input id="contractor-first-name" name="contractor-first-name" placeholder="Mike" required data-testid="input-contractor-first-name" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contractor-last-name">Last Name</Label>
                            <Input id="contractor-last-name" name="contractor-last-name" placeholder="Smith" required data-testid="input-contractor-last-name" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contractor-username">Username</Label>
                          <Input id="contractor-username" name="contractor-username" placeholder="mikesmith" required data-testid="input-contractor-username" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contractor-signup-email">Email</Label>
                          <Input id="contractor-signup-email" name="contractor-signup-email" type="email" placeholder="mike@example.com" required data-testid="input-contractor-signup-email" />
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
                        <div className="space-y-2">
                          <Label htmlFor="contractor-confirm-password">Confirm Password</Label>
                          <div className="relative">
                            <Input id="contractor-confirm-password" name="contractor-confirm-password" type={showContractorConfirmPassword ? "text" : "password"} required data-testid="input-contractor-confirm-password" />
                            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowContractorConfirmPassword(!showContractorConfirmPassword)} data-testid="button-toggle-contractor-confirm-password">
                              {showContractorConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button type="submit" className="w-full font-medium" disabled={loading} data-testid="button-contractor-submit">
                          {loading ? "Please wait..." : `Create ${contractorRole === "notary" ? "Notary" : "Subcontractor"} Account`}
                          {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                        </Button>
                      </CardFooter>
                    </form>
                  </>
                )}
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-center gap-2 pt-2">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </p>
            <Button variant="link" onClick={toggleMode} className="p-0 h-auto font-semibold" data-testid="button-toggle-mode">
              {isLogin ? "Sign up for a new account" : "Sign in to your account"}
            </Button>
          </div>

          <div className="pt-6 border-t border-border mt-6">
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

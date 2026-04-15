import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HardHat, ArrowRight, Eye, EyeOff, CheckCircle2, Mail, Info } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@assets/generated_images/construction_site_frame_with_sunset.png";
import { CONTRACTOR_ROLES } from "@shared/contractor-roles";

type TabValue = "client" | "contractor" | "subcontractor";

export default function AuthPage() {
  const [_, setLocation] = useLocation();
  
  const getInitialState = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const tab = params.get("tab");
    let activeTab: TabValue = "client";
    if (tab === "contractor") activeTab = "contractor";
    else if (tab === "subcontractor" || tab === "notary") activeTab = "subcontractor";
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
  const [showCompanyPassword, setShowCompanyPassword] = useState(false);
  const [showCompanyConfirmPassword, setShowCompanyConfirmPassword] = useState(false);
  const [showSubPassword, setShowSubPassword] = useState(false);
  const [showSubConfirmPassword, setShowSubConfirmPassword] = useState(false);
  
  // Company registration state
  const [companyRegistered, setCompanyRegistered] = useState(false);
  const [companyType, setCompanyType] = useState("");
  const [customCompanyType, setCustomCompanyType] = useState("");

  // Sub-contractor/notary registration state
  const [subRegistered, setSubRegistered] = useState(false);
  const [subRole, setSubRole] = useState<"subcontractor" | "notary">("subcontractor");

  const handleClientAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    try {
      if (isLogin) {
        const loginId = formData.get("email") as string;
        await login(loginId, password, "client");
        toast({ title: "Welcome back!", description: "You have successfully logged in." });
        setLocation("/client/dashboard");
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
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Authentication failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("company-password") as string;
    try {
      if (isLogin) {
        const loginId = formData.get("company-email") as string;
        const loggedInUser = await login(loginId, password, "contractor");
        toast({ title: "Welcome back!", description: "You have successfully logged in." });
        if (loggedInUser.role === "company_owner") {
          setLocation("/company/dashboard");
        } else if (loggedInUser.role === "contractor" && (loggedInUser.contractorType === "notary" || loggedInUser.contractorType === "subcontractor")) {
          setLocation("/subcontractor/dashboard");
        } else {
          setLocation("/contractor/dashboard");
        }
      } else {
        const firstName = formData.get("company-first-name") as string;
        const lastName = formData.get("company-last-name") as string;
        const username = formData.get("company-username") as string;
        const companyName = formData.get("company-name") as string;
        const email = formData.get("company-signup-email") as string;
        const confirmPassword = formData.get("company-confirm-password") as string;
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        if (!companyType) throw new Error("Please select a company type");
        if (companyType === "Other" && !customCompanyType.trim()) throw new Error("Please specify your company type");
        const finalCompanyType = companyType === "Other" ? customCompanyType : companyType;
        await register(username, email, password, "contractor", `${firstName} ${lastName}`, companyName, finalCompanyType);
        setCompanyRegistered(true);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Registration failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("sub-password") as string;
    try {
      if (isLogin) {
        const loginId = formData.get("sub-email") as string;
        await login(loginId, password, "contractor");
        toast({ title: "Welcome back!", description: "You have successfully logged in." });
        setLocation("/subcontractor/dashboard");
      } else {
        const firstName = formData.get("sub-first-name") as string;
        const lastName = formData.get("sub-last-name") as string;
        const username = formData.get("sub-username") as string;
        const email = formData.get("sub-signup-email") as string;
        const confirmPassword = formData.get("sub-confirm-password") as string;
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        await register(
          username, email, password, "contractor",
          `${firstName} ${lastName}`,
          undefined, undefined, undefined,
          subRole
        );
        setSubRegistered(true);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Authentication failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setCompanyRegistered(false);
    setSubRegistered(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <HardHat className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl tracking-tight">BuildVision</h1>
              <p className="text-sm text-muted-foreground">Construction Management Portal</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="client" data-testid="tab-client">Client</TabsTrigger>
              <TabsTrigger value="contractor" data-testid="tab-contractor">Company</TabsTrigger>
              <TabsTrigger value="subcontractor" data-testid="tab-subcontractor">Sub / Notary</TabsTrigger>
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
                {companyRegistered && !isLogin ? (
                  <>
                    <CardHeader>
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <CardTitle className="text-center">Account Created!</CardTitle>
                      <CardDescription className="text-center">
                        Your company account is pending admin approval. You'll be able to log in once approved.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full" variant="outline" onClick={() => { setCompanyRegistered(false); setIsLogin(true); }} data-testid="button-back-to-login">
                        Back to Login
                      </Button>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader>
                      <CardTitle>{isLogin ? "Company Login" : "Register Your Company"}</CardTitle>
                      <CardDescription>
                        {isLogin 
                          ? "Log in to access your company dashboard and projects." 
                          : "Create a company account and start managing your projects and team."}
                      </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleCompanyAuth}>
                      <CardContent className="space-y-4">
                        {!isLogin && (
                          <>
                            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700">
                              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <span>
                                This creates a <strong>company owner</strong> account. Team members join via email invitation from your dashboard.
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="company-first-name">First Name</Label>
                                <Input id="company-first-name" name="company-first-name" placeholder="Mike" required data-testid="input-company-first-name" />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="company-last-name">Last Name</Label>
                                <Input id="company-last-name" name="company-last-name" placeholder="Builder" required data-testid="input-company-last-name" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="company-username">Username</Label>
                              <Input id="company-username" name="company-username" placeholder="mikebuilder" required data-testid="input-company-username" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="company-name">Company Name</Label>
                              <Input id="company-name" name="company-name" placeholder="Acme Construction" required data-testid="input-company-name" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="company-type">Company Type</Label>
                              <Select value={companyType} onValueChange={setCompanyType}>
                                <SelectTrigger data-testid="select-company-type">
                                  <SelectValue placeholder="Select company type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONTRACTOR_ROLES.map((type) => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {companyType === "Other" && (
                              <div className="space-y-2">
                                <Label htmlFor="custom-company-type">Please specify</Label>
                                <Input id="custom-company-type" value={customCompanyType} onChange={(e) => setCustomCompanyType(e.target.value)} placeholder="e.g., Solar Installer, Pool Builder" required data-testid="input-custom-company-type" />
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label htmlFor="company-signup-email">Work Email</Label>
                              <Input id="company-signup-email" name="company-signup-email" type="email" placeholder="mike@acmeconstruction.com" required data-testid="input-company-signup-email" />
                            </div>
                          </>
                        )}
                        {isLogin && (
                          <div className="space-y-2">
                            <Label htmlFor="company-email">Email or Username</Label>
                            <Input id="company-email" name="company-email" type="text" placeholder="email or username" required data-testid="input-company-email" />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="company-password">Password</Label>
                          <div className="relative">
                            <Input id="company-password" name="company-password" type={showCompanyPassword ? "text" : "password"} required data-testid="input-company-password" />
                            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowCompanyPassword(!showCompanyPassword)} data-testid="button-toggle-company-password">
                              {showCompanyPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          </div>
                        </div>
                        {!isLogin && (
                          <div className="space-y-2">
                            <Label htmlFor="company-confirm-password">Confirm Password</Label>
                            <div className="relative">
                              <Input id="company-confirm-password" name="company-confirm-password" type={showCompanyConfirmPassword ? "text" : "password"} required data-testid="input-company-confirm-password" />
                              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowCompanyConfirmPassword(!showCompanyConfirmPassword)} data-testid="button-toggle-company-confirm-password">
                                {showCompanyConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex-col gap-3">
                        <Button type="submit" className="w-full font-medium" disabled={loading} data-testid="button-company-submit">
                          {loading ? "Please wait..." : isLogin ? "Access Dashboard" : "Create Company Account"} 
                          {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                        </Button>
                      </CardFooter>
                    </form>
                  </>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="subcontractor">
              <Card className="border-border/50 shadow-lg">
                {subRegistered && !isLogin ? (
                  <>
                    <CardHeader>
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <CardTitle className="text-center">Registration Submitted!</CardTitle>
                      <CardDescription className="text-center">
                        Your {subRole === "notary" ? "notary" : "sub-contractor"} account is pending admin approval. 
                        You'll receive an email once approved.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full" variant="outline" onClick={() => { setSubRegistered(false); setIsLogin(true); }} data-testid="button-sub-back-to-login">
                        Back to Login
                      </Button>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader>
                      <CardTitle>{isLogin ? "Sub-Contractor / Notary Login" : "Create Your Account"}</CardTitle>
                      <CardDescription>
                        {isLogin 
                          ? "Access your project assignments across all companies." 
                          : "Register as a sub-contractor or notary to get started."}
                      </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubAuth}>
                      <CardContent className="space-y-4">
                        {!isLogin && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="sub-role">I am a</Label>
                              <Select value={subRole} onValueChange={(v) => setSubRole(v as "subcontractor" | "notary")}>
                                <SelectTrigger data-testid="select-sub-role">
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
                                <Label htmlFor="sub-first-name">First Name</Label>
                                <Input id="sub-first-name" name="sub-first-name" placeholder="John" required data-testid="input-sub-first-name" />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="sub-last-name">Last Name</Label>
                                <Input id="sub-last-name" name="sub-last-name" placeholder="Smith" required data-testid="input-sub-last-name" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sub-username">Username</Label>
                              <Input id="sub-username" name="sub-username" placeholder="johnsmith" required data-testid="input-sub-username" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sub-signup-email">Email</Label>
                              <Input id="sub-signup-email" name="sub-signup-email" type="email" placeholder="john@example.com" required data-testid="input-sub-signup-email" />
                            </div>
                          </>
                        )}
                        {isLogin && (
                          <div className="space-y-2">
                            <Label htmlFor="sub-email">Email or Username</Label>
                            <Input id="sub-email" name="sub-email" type="text" placeholder="email or username" required data-testid="input-sub-email" />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="sub-password">Password</Label>
                          <div className="relative">
                            <Input id="sub-password" name="sub-password" type={showSubPassword ? "text" : "password"} required data-testid="input-sub-password" />
                            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowSubPassword(!showSubPassword)} data-testid="button-toggle-sub-password">
                              {showSubPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          </div>
                        </div>
                        {!isLogin && (
                          <div className="space-y-2">
                            <Label htmlFor="sub-confirm-password">Confirm Password</Label>
                            <div className="relative">
                              <Input id="sub-confirm-password" name="sub-confirm-password" type={showSubConfirmPassword ? "text" : "password"} required data-testid="input-sub-confirm-password" />
                              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowSubConfirmPassword(!showSubConfirmPassword)} data-testid="button-toggle-sub-confirm-password">
                                {showSubConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex-col gap-3">
                        <Button type="submit" className="w-full font-medium" disabled={loading} data-testid="button-sub-submit">
                          {loading ? "Please wait..." : isLogin ? "Access My Projects" : "Create Account"} 
                          {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          <Mail className="inline h-3 w-3 mr-1" />
                          Already invited to a project? Use the link from your email instead.
                        </p>
                      </CardFooter>
                    </form>
                  </>
                )}
              </Card>
            </TabsContent>
          </Tabs>

          <div className="text-center space-y-2">
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

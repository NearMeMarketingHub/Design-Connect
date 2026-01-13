import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HardHat, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@assets/generated_images/construction_site_frame_with_sunset.png";
import { CONTRACTOR_ROLES } from "@shared/contractor-roles";

export default function AuthPage() {
  const [_, setLocation] = useLocation();
  
  const getInitialState = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const tab = params.get("tab");
    return {
      isLogin: mode !== "register",
      activeTab: tab === "contractor" ? "contractor" : "client"
    };
  };
  
  const initialState = getInitialState();
  const [isLogin, setIsLogin] = useState(initialState.isLogin);
  const [activeTab, setActiveTab] = useState(initialState.activeTab);
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
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);
  
  // Contractor request states
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [companyType, setCompanyType] = useState("");
  const [customCompanyType, setCustomCompanyType] = useState("");

  const handleClientAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    try {
      if (isLogin) {
        const loginId = formData.get("email") as string;
        await login(loginId, password, "client");
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        setLocation("/client/dashboard");
      } else {
        const firstName = formData.get("first-name") as string;
        const lastName = formData.get("last-name") as string;
        const username = formData.get("username") as string;
        const email = formData.get("signup-email") as string;
        const phone = formData.get("phone") as string;
        const confirmPassword = formData.get("confirm-password") as string;

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        await register(username, email, password, "client", `${firstName} ${lastName}`, undefined, undefined, phone);
        toast({
          title: "Account created!",
          description: "Welcome to BuildVision.",
        });
        setLocation("/client/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Authentication failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContractorAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("admin-password") as string;

    try {
      if (isLogin) {
        const loginId = formData.get("admin-email") as string;
        await login(loginId, password, "contractor");
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        setLocation("/contractor/dashboard");
      } else {
        // Submit access request (no account creation)
        const firstName = formData.get("admin-first-name") as string;
        const lastName = formData.get("admin-last-name") as string;
        const username = formData.get("admin-username") as string;
        const companyName = formData.get("company-name") as string;
        const email = formData.get("admin-signup-email") as string;

        if (!companyType) {
          throw new Error("Please select a company type");
        }

        const finalCompanyType = companyType === "Other" ? customCompanyType : companyType;
        if (companyType === "Other" && !customCompanyType.trim()) {
          throw new Error("Please specify your company type");
        }

        const res = await fetch("/api/contractor-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            username,
            companyName,
            companyType: finalCompanyType,
            email
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to submit request");
        }

        setRequestSubmitted(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => setIsLogin(!isLogin);

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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="client" data-testid="tab-client">Client Portal</TabsTrigger>
              <TabsTrigger value="contractor" data-testid="tab-contractor">Contractor Login</TabsTrigger>
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
                            <Input 
                              id="client-first-name" 
                              name="first-name"
                              placeholder="Jane" 
                              required 
                              data-testid="input-first-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="client-last-name">Last Name</Label>
                            <Input 
                              id="client-last-name" 
                              name="last-name"
                              placeholder="Doe" 
                              required 
                              data-testid="input-last-name"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-username">Username</Label>
                          <Input 
                            id="client-username" 
                            name="username"
                            placeholder="janedoe" 
                            required 
                            data-testid="input-username"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-email">Email</Label>
                          <Input 
                            id="client-email" 
                            name="signup-email"
                            type="email"
                            placeholder="jane@example.com"
                            required 
                            data-testid="input-signup-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-phone">Phone Number</Label>
                          <Input 
                            id="client-phone" 
                            name="phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            required 
                            data-testid="input-phone"
                          />
                        </div>
                      </>
                    )}
                    {isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="email">Email or Username</Label>
                        <Input 
                          id="email" 
                          name="email"
                          type="text"
                          placeholder="email or username"
                          required 
                          data-testid="input-email"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input 
                          id="password" 
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required 
                          data-testid="input-password"
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
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <div className="relative">
                          <Input 
                            id="confirm-password" 
                            name="confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            required 
                            data-testid="input-confirm-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            data-testid="button-toggle-confirm-password"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full font-medium" 
                      disabled={loading}
                      data-testid="button-submit"
                    >
                      {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"} 
                      {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            
            <TabsContent value="contractor">
              <Card className="border-border/50 shadow-lg">
                {requestSubmitted && !isLogin ? (
                  <>
                    <CardHeader>
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <CardTitle className="text-center">Request Submitted!</CardTitle>
                      <CardDescription className="text-center">
                        Your access request has been submitted successfully. Our team will review your application and you will receive login credentials via email once approved.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => {
                          setRequestSubmitted(false);
                          setIsLogin(true);
                        }}
                        data-testid="button-back-to-login"
                      >
                        Back to Login
                      </Button>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader>
                      <CardTitle>{isLogin ? "Team Access" : "Request Access"}</CardTitle>
                      <CardDescription>
                        {isLogin 
                          ? "Secure login for project managers and estimators." 
                          : "Submit your request to join the BuildVision network."}
                      </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleContractorAuth}>
                      <CardContent className="space-y-4">
                        {!isLogin && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="admin-first-name">First Name</Label>
                                <Input 
                                  id="admin-first-name" 
                                  name="admin-first-name"
                                  placeholder="Mike" 
                                  required 
                                  data-testid="input-admin-first-name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="admin-last-name">Last Name</Label>
                                <Input 
                                  id="admin-last-name" 
                                  name="admin-last-name"
                                  placeholder="Builder" 
                                  required 
                                  data-testid="input-admin-last-name"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="admin-username">Username</Label>
                              <Input 
                                id="admin-username" 
                                name="admin-username"
                                placeholder="mikebuilder" 
                                required 
                                data-testid="input-admin-username"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="company-name">Company Name</Label>
                              <Input 
                                id="company-name" 
                                name="company-name"
                                placeholder="Acme Construction" 
                                required 
                                data-testid="input-company-name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="company-type">Company Type</Label>
                              <Select value={companyType} onValueChange={setCompanyType}>
                                <SelectTrigger data-testid="select-company-type">
                                  <SelectValue placeholder="Select company type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONTRACTOR_ROLES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {companyType === "Other" && (
                              <div className="space-y-2">
                                <Label htmlFor="custom-company-type">Please specify</Label>
                                <Input 
                                  id="custom-company-type" 
                                  value={customCompanyType}
                                  onChange={(e) => setCustomCompanyType(e.target.value)}
                                  placeholder="e.g., Solar Installer, Pool Builder" 
                                  required 
                                  data-testid="input-custom-company-type"
                                />
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label htmlFor="admin-signup-email">Work Email (Optional)</Label>
                              <Input 
                                id="admin-signup-email" 
                                name="admin-signup-email"
                                type="email"
                                placeholder="admin@company.com"
                                data-testid="input-admin-signup-email"
                              />
                            </div>
                          </>
                        )}
                        {isLogin && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="admin-email">Email or Username</Label>
                              <Input 
                                id="admin-email" 
                                name="admin-email"
                                type="text"
                                placeholder="email or username"
                                required 
                                data-testid="input-admin-email"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="admin-password">Password</Label>
                              <div className="relative">
                                <Input 
                                  id="admin-password" 
                                  name="admin-password"
                                  type={showAdminPassword ? "text" : "password"}
                                  required 
                                  data-testid="input-admin-password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                                  data-testid="button-toggle-admin-password"
                                >
                                  {showAdminPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button 
                          type="submit" 
                          className="w-full font-medium" 
                          variant="default" 
                          disabled={loading}
                          data-testid="button-contractor-submit"
                        >
                          {loading ? "Please wait..." : isLogin ? "Access Dashboard" : "Submit Request"} 
                          {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                        </Button>
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
            <Button 
              variant="link" 
              onClick={toggleMode} 
              className="p-0 h-auto font-semibold"
              data-testid="button-toggle-mode"
            >
              {isLogin ? "Sign up for a new account" : "Sign in to your account"}
            </Button>
          </div>

          <div className="pt-6 border-t border-border mt-6">
            <Link href="/admin-login">
              <Button 
                variant="ghost" 
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                data-testid="link-admin-login"
              >Admin Login</Button>
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative bg-muted">
        <img 
          src={heroImage} 
          alt="Construction Site" 
          className="absolute inset-0 w-full h-full object-cover grayscale-[20%] contrast-[1.1]"
        />
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

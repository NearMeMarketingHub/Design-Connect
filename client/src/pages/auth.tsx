import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HardHat, ArrowRight } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@assets/generated_images/construction_site_frame_with_sunset.png";

export default function AuthPage() {
  const [_, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [activeTab, setActiveTab] = useState("client");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  const handleClientAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    try {
      if (isLogin) {
        const loginId = formData.get("email") as string;
        await login(loginId, password);
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        setLocation("/dashboard");
      } else {
        const firstName = formData.get("first-name") as string;
        const lastName = formData.get("last-name") as string;
        const username = formData.get("username") as string;
        const email = formData.get("signup-email") as string;
        const confirmPassword = formData.get("confirm-password") as string;

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        await register(username, email, password, "client", `${firstName} ${lastName}`);
        toast({
          title: "Account created!",
          description: "Welcome to BuildVision.",
        });
        setLocation("/dashboard");
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
        await login(loginId, password);
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        setLocation("/admin-dashboard");
      } else {
        const companyName = formData.get("company-name") as string;
        const firstName = formData.get("admin-first-name") as string;
        const lastName = formData.get("admin-last-name") as string;
        const username = formData.get("admin-username") as string;
        const email = formData.get("admin-signup-email") as string;
        const confirmPassword = formData.get("admin-confirm-password") as string;

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        await register(username, email, password, "contractor", `${firstName} ${lastName} - ${companyName}`);
        toast({
          title: "Account created!",
          description: "Welcome to BuildVision.",
        });
        setLocation("/admin-dashboard");
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
                      <Input 
                        id="password" 
                        name="password"
                        type="password" 
                        required 
                        data-testid="input-password"
                      />
                    </div>
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input 
                          id="confirm-password" 
                          name="confirm-password"
                          type="password" 
                          required 
                          data-testid="input-confirm-password"
                        />
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
                <CardHeader>
                  <CardTitle>{isLogin ? "Team Access" : "Partner Registration"}</CardTitle>
                  <CardDescription>
                    {isLogin 
                      ? "Secure login for project managers and estimators." 
                      : "Join the network of certified contractors."}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleContractorAuth}>
                  <CardContent className="space-y-4">
                    {!isLogin && (
                      <>
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
                          <Label htmlFor="admin-signup-email">Work Email</Label>
                          <Input 
                            id="admin-signup-email" 
                            name="admin-signup-email"
                            type="email"
                            placeholder="admin@buildvision.com"
                            required 
                            data-testid="input-admin-signup-email"
                          />
                        </div>
                      </>
                    )}
                    {isLogin && (
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
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Password</Label>
                      <Input 
                        id="admin-password" 
                        name="admin-password"
                        type="password" 
                        required 
                        data-testid="input-admin-password"
                      />
                    </div>
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                        <Input 
                          id="admin-confirm-password" 
                          name="admin-confirm-password"
                          type="password" 
                          required 
                          data-testid="input-admin-confirm-password"
                        />
                      </div>
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
                      {loading ? "Please wait..." : isLogin ? "Access Dashboard" : "Register Company"} 
                      {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  </CardFooter>
                </form>
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

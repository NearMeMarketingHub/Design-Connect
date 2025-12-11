import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HardHat, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import heroImage from "@assets/generated_images/construction_site_frame_with_sunset.png";

export default function AuthPage() {
  const [_, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth delay
    setTimeout(() => {
      setLocation('/dashboard');
    }, 500);
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

          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="client">Client Portal</TabsTrigger>
              <TabsTrigger value="contractor">Contractor Login</TabsTrigger>
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
                <form onSubmit={handleAuth}>
                  <CardContent className="space-y-4">
                    {!isLogin && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="client-first-name">First Name</Label>
                          <Input id="client-first-name" placeholder="Jane" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-last-name">Last Name</Label>
                          <Input id="client-last-name" placeholder="Doe" required />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="client@example.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" required />
                    </div>
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input id="confirm-password" type="password" required />
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full font-medium">
                      {isLogin ? "Sign In" : "Create Account"} <ArrowRight className="w-4 h-4 ml-2" />
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
                <form onSubmit={handleAuth}>
                  <CardContent className="space-y-4">
                    {!isLogin && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="company-name">Company Name</Label>
                          <Input id="company-name" placeholder="Acme Construction" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="admin-first-name">First Name</Label>
                            <Input id="admin-first-name" placeholder="Mike" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="admin-last-name">Last Name</Label>
                            <Input id="admin-last-name" placeholder="Builder" required />
                          </div>
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">Work Email</Label>
                      <Input id="admin-email" type="email" placeholder="admin@buildvision.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Password</Label>
                      <Input id="admin-password" type="password" required />
                    </div>
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                        <Input id="admin-confirm-password" type="password" required />
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full font-medium" variant="default">
                      {isLogin ? "Access Dashboard" : "Register Company"} <ArrowRight className="w-4 h-4 ml-2" />
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
            <Button variant="link" onClick={toggleMode} className="p-0 h-auto font-semibold">
              {isLogin ? "Sign up for a new account" : "Sign in to your account"}
            </Button>
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
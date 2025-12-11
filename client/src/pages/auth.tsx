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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation('/dashboard');
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

          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="client">Client Portal</TabsTrigger>
              <TabsTrigger value="contractor">Contractor Login</TabsTrigger>
            </TabsList>
            
            <TabsContent value="client">
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle>Welcome Back</CardTitle>
                  <CardDescription>Enter your credentials to access your project dashboard.</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="client@example.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" required />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full font-medium">
                      Sign In <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            
            <TabsContent value="contractor">
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle>Team Access</CardTitle>
                  <CardDescription>Secure login for project managers and estimators.</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">Work Email</Label>
                      <Input id="admin-email" type="email" placeholder="admin@buildvision.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Password</Label>
                      <Input id="admin-password" type="password" required />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full font-medium" variant="default">
                      Access Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account? Contact your project manager.
          </p>
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
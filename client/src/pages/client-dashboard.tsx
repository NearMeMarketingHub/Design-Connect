import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  CalendarDays,
  DollarSign,
  FileText
} from "lucide-react";
import { Link } from "wouter";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";

export default function ClientDashboard() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Welcome Home, Sarah</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your project today.</p>
        </div>
        <Button className="md:w-auto w-full">
          <FileText className="w-4 h-4 mr-2" />
          View Contract
        </Button>
      </div>

      {/* Project Hero Card */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 overflow-hidden relative group border-0 shadow-lg">
          <div className="absolute inset-0">
            <img 
              src={projectImage} 
              alt="Project Render" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>
          <div className="relative h-full flex flex-col justify-end p-6 text-white min-h-[300px]">
            <Badge className="w-fit mb-3 bg-accent text-accent-foreground border-none">Phase 3: Rough-in</Badge>
            <h2 className="text-3xl font-heading font-bold mb-2">The Jenkins Residence</h2>
            <p className="text-white/80 max-w-xl mb-6">
              Current progress is on schedule. Plumbing and electrical rough-ins are 80% complete. Next inspection scheduled for Friday.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span>45%</span>
                </div>
                <Progress value={45} className="h-2 bg-white/20 [&>div]:bg-accent" />
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="h-full border-l-4 border-l-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-accent" />
                Action Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <h4 className="font-medium text-sm">Approve Change Order #03</h4>
                <p className="text-xs text-muted-foreground mt-1">Master bath tile upgrade request pending approval.</p>
                <Button size="sm" variant="outline" className="mt-3 w-full">Review & Sign</Button>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <h4 className="font-medium text-sm">Select Lighting Fixtures</h4>
                <p className="text-xs text-muted-foreground mt-1">Kitchen island pendant selection needed by Friday.</p>
                <Link href="/inspiration">
                  <Button size="sm" variant="outline" className="mt-3 w-full">Go to Selections</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Days Remaining</p>
              <h3 className="text-2xl font-bold">45</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Budget Status</p>
              <h3 className="text-2xl font-bold">On Track</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completed Tasks</p>
              <h3 className="text-2xl font-bold">24/58</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Next Milestone</p>
              <h3 className="text-lg font-bold">Drywall</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Project Updates</CardTitle>
          <CardDescription>Daily logs from your project manager</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 pb-6 border-b border-border last:border-0 last:pb-0">
                <div className="flex-shrink-0 w-24 text-sm text-muted-foreground pt-1">
                  Today, 9:00 AM
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Electrical Rough-in Inspection Passed</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    The city inspector signed off on all electrical work this morning. The crew is now proceeding with insulation installation.
                  </p>
                  {i === 1 && (
                    <div className="mt-3 flex gap-2">
                      <div className="w-20 h-20 rounded-md bg-muted border border-border" />
                      <div className="w-20 h-20 rounded-md bg-muted border border-border" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
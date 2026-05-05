import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Building2, 
  Users, 
  FileText, 
  MessageSquare, 
  Camera, 
  DollarSign,
  CheckCircle,
  ArrowRight,
  Hammer,
  ClipboardList,
  Shield,
  Stamp,
  Briefcase,
  CalendarCheck
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-slate-900">BuildVision</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth">
                <Button variant="ghost" data-testid="link-login">Log In</Button>
              </Link>
              <Link href="/demo">
                <Button data-testid="link-request-demo">Request a Demo</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
              Construction Management<br />
              <span className="text-blue-600">Built for Teams</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10">
              BuildVision gives contractors a company dashboard to manage projects, build their team, 
              and keep clients informed — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
              <Link href="/demo">
                <Button size="lg" className="text-lg px-8" data-testid="button-request-demo">
                  <CalendarCheck className="mr-2 h-5 w-5" />
                  Request a Demo
                </Button>
              </Link>
              <Link href="/auth?tab=client">
                <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-client-login">
                  <Users className="mr-2 h-5 w-5" />
                  Client Login
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-contractor-login">
                  <Briefcase className="mr-2 h-5 w-5" />
                  Contractor Login
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Company accounts are set up through our onboarding process. 
              Subcontractors and notaries can create an account or accept an invite from their company.
            </p>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
              How BuildVision Works
            </h2>
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarCheck className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Request a Demo</h3>
                <p className="text-slate-600">
                  Schedule a demo with our team. We'll set up your company account 
                  and walk you through the platform.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Build Your Team</h3>
                <p className="text-slate-600">
                  Invite contractors, subcontractors, and notaries to your company by email. 
                  Assign roles and control what each member can see and do.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Run Your Projects</h3>
                <p className="text-slate-600">
                  Create projects with timelines, budgets, and milestones. 
                  Clients receive an invitation to view their dedicated project portal.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">4. Complete with Confidence</h3>
                <p className="text-slate-600">
                  Track milestones, manage invoices, and sign documents electronically 
                  for a smooth project completion.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">
              Powerful Features for Every Project
            </h2>
            <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
              Everything you need to manage construction projects from start to finish
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <FileText className="h-10 w-10 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Document Management</h3>
                  <p className="text-slate-600 text-sm">
                    Upload, organize, and share contracts, permits, and plans. 
                    Built-in e-signature for seamless document signing.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <Camera className="h-10 w-10 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Progress Photos</h3>
                  <p className="text-slate-600 text-sm">
                    Share visual updates with clients. Document every phase 
                    of construction with timestamped photos.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <DollarSign className="h-10 w-10 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Budget Tracking</h3>
                  <p className="text-slate-600 text-sm">
                    Transparent budget management with detailed breakdowns. 
                    Clients always know where their money is going.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <MessageSquare className="h-10 w-10 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Real-Time Messaging</h3>
                  <p className="text-slate-600 text-sm">
                    Keep conversations organized by project. 
                    Never lose important discussions in email threads.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <Users className="h-10 w-10 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Team Management</h3>
                  <p className="text-slate-600 text-sm">
                    Invite contractors, subcontractors, and notaries to your company. 
                    Assign roles and control project-level access per member.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <Shield className="h-10 w-10 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">E-Signatures</h3>
                  <p className="text-slate-600 text-sm">
                    Legally binding electronic signatures with audit trails. 
                    Sign contracts and change orders from anywhere.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <ClipboardList className="h-10 w-10 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Milestone Tracking</h3>
                  <p className="text-slate-600 text-sm">
                    Break projects into phases with clear milestones. 
                    Track progress and keep projects on schedule.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md bg-purple-50">
                <CardContent className="p-6">
                  <Stamp className="h-10 w-10 text-purple-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Notarization Services</h3>
                  <p className="text-slate-600 text-sm">
                    Streamlined document notarization workflow. Connect with notaries 
                    and track notarization status in real-time.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-amber-50">
                <CardContent className="p-6">
                  <Hammer className="h-10 w-10 text-amber-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Change Orders</h3>
                  <p className="text-slate-600 text-sm">
                    Create and track change orders with line-item breakdowns. 
                    Clients approve or reject with a full audit trail.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 bg-blue-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Transform Your Construction Business?
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              Join contractors and companies across Florida who are building smarter with BuildVision.
              Schedule a demo to see the platform in action and get your company set up.
            </p>
            <Link href="/demo">
              <Button size="lg" variant="secondary" className="text-lg px-8" data-testid="button-get-started-cta">
                Schedule a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-5 flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  For Companies
                </h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Company accounts are set up by our team after a demo — no self-signup required</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Invite team members, assign roles, and set company admins</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Manage all company projects from a single view</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Create estimates, send invoices, and track payments</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Collect e-signatures and manage change orders</span>
                  </li>
                </ul>
                <div className="mt-4">
                  <Link href="/demo">
                    <Button size="sm" className="w-full" data-testid="button-company-demo">
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      Request a Demo
                    </Button>
                  </Link>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-5 flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-orange-500" />
                  For Subcontractors
                </h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Create a free account or accept an invite from your company</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Join multiple companies from one account</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">See only the projects you've been assigned to</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">View project documents, progress, and messages</span>
                  </li>
                </ul>
                <div className="mt-4">
                  <Link href="/auth?mode=register&tab=contractor">
                    <Button size="sm" variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-50" data-testid="button-sub-signup">
                      Create Subcontractor Account
                    </Button>
                  </Link>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-5 flex items-center gap-2">
                  <Users className="h-6 w-6 text-blue-500" />
                  For Clients
                </h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Track your project's progress in real-time</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">View photos and updates from your contractor</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Review and approve change orders</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Access all project documents in one place</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">See exactly where your budget is being spent</span>
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-purple-700 mb-5 flex items-center gap-2">
                  <Stamp className="h-6 w-6 text-purple-600" />
                  For Notaries
                </h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Create a free account or accept an invite from a company</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Find documents requiring notarization across projects</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Upload notarized documents directly to projects</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 text-sm">Streamlined workflow for Florida construction projects</span>
                  </li>
                </ul>
                <div className="mt-4">
                  <Link href="/auth?mode=register&tab=contractor">
                    <Button size="sm" variant="outline" className="w-full border-purple-300 text-purple-700 hover:bg-purple-50" data-testid="button-notary-signup">
                      Create Notary Account
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Building2 className="h-6 w-6 text-blue-400" />
              <span className="text-xl font-bold text-white">BuildVision</span>
            </div>
            <div className="text-sm">
              <span>Florida-based Construction Management Platform</span>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} BuildVision. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

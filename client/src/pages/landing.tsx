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
  Stamp
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
              <Link href="/auth?mode=register">
                <Button data-testid="link-register">Get Started</Button>
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
              <span className="text-blue-600">Made Simple</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10">
              BuildVision connects contractors and clients with a powerful platform for project tracking, 
              document management, real-time communication, and transparent budgeting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
              <Link href="/auth?mode=register&tab=contractor">
                <Button size="lg" className="text-lg px-8" data-testid="button-contractor-signup">
                  <Hammer className="mr-2 h-5 w-5" />
                  I'm a Contractor
                </Button>
              </Link>
              <Link href="/auth?mode=register&tab=client">
                <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-client-signup">
                  <Users className="mr-2 h-5 w-5" />
                  I'm a Client
                </Button>
              </Link>
              <Link href="/auth?mode=register&tab=notary">
                <Button size="lg" variant="outline" className="text-lg px-8 border-purple-300 text-purple-700 hover:bg-purple-50" data-testid="button-notary-signup">
                  <Stamp className="mr-2 h-5 w-5" />
                  I'm a Notary
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
              How BuildVision Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Create Your Project</h3>
                <p className="text-slate-600">
                  Contractors set up projects with timelines, budgets, and milestones. 
                  Clients receive an invitation to join their project portal.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Stay Connected</h3>
                <p className="text-slate-600">
                  Real-time messaging, progress photos, and document sharing keep everyone 
                  aligned throughout the construction process.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Complete with Confidence</h3>
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
                  <ClipboardList className="h-10 w-10 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Milestone Tracking</h3>
                  <p className="text-slate-600 text-sm">
                    Break projects into phases with clear milestones. 
                    Track progress and keep projects on schedule.
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
            </div>
          </div>
        </section>

        <section className="py-16 bg-blue-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Transform Your Construction Projects?
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              Join contractors and homeowners across Florida who are building better together with BuildVision.
            </p>
            <Link href="/auth?mode=register">
              <Button size="lg" variant="secondary" className="text-lg px-8" data-testid="button-get-started-cta">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-12">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-6">
                  For Contractors
                </h2>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Manage multiple projects from a single dashboard</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Create professional estimates with our built-in calculator</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Send invoices and track payments easily</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Tag documents for notarization and assign notaries</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Collect signatures on contracts digitally</span>
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-6">
                  For Clients
                </h2>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Track your project's progress in real-time</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">View photos and updates from your contractor</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Upload notarized documents directly</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Access all project documents in one place</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">See exactly where your budget is being spent</span>
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-purple-700 mb-6">
                  For Notaries
                </h2>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Search and find documents requiring notarization</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Upload notarized documents directly to projects</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Track pending and completed notarizations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Filter documents by status and due date</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Streamlined workflow for Florida construction projects</span>
                  </li>
                </ul>
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

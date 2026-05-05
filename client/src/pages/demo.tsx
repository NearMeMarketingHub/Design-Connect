import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, CheckCircle, CalendarCheck, ArrowLeft, Phone, Mail, User, Briefcase, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ContactFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
}

export default function DemoPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<ContactFormData>({
    name: "",
    company: "",
    email: "",
    phone: "",
    message: "",
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const res = await apiRequest("POST", "/api/contact", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: unknown) => {
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again or email us directly.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    submitMutation.mutate(form);
  };

  const handleChange = (field: keyof ContactFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
                <Building2 className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold text-slate-900">BuildVision</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="link-back-home">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
              <Link href="/auth">
                <Button variant="outline" size="sm" data-testid="link-login">Log In</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {submitted ? (
          <div className="max-w-lg mx-auto text-center py-20">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4" data-testid="text-success-heading">
              Request Received!
            </h1>
            <p className="text-slate-600 text-lg mb-8" data-testid="text-success-message">
              Thanks for reaching out. Our team will be in touch within one business day to schedule your demo.
            </p>
            <Link href="/">
              <Button data-testid="button-back-home">Return to Home</Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium mb-4">
                  <CalendarCheck className="h-4 w-4" />
                  Schedule a Demo
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-4">
                  See BuildVision in Action
                </h1>
                <p className="text-lg text-slate-600">
                  Fill out the form and our team will reach out within one business day to schedule 
                  a personalized walkthrough of the platform.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CalendarCheck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Personalized Demo</h3>
                    <p className="text-slate-600 text-sm">We'll tailor the walkthrough to your company's specific needs and project types.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Full Platform Access</h3>
                    <p className="text-slate-600 text-sm">Your company account is set up by our team after the demo — no self-signup required.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">7-Day Free Trial</h3>
                    <p className="text-slate-600 text-sm">Start with a free trial to explore all features before committing to a plan.</p>
                  </div>
                </div>
              </div>
            </div>

            <Card className="border-0 shadow-xl">
              <CardContent className="p-8">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Request a Demo</h2>
                <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-demo-request">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="flex items-center gap-1.5 text-slate-700">
                      <User className="h-3.5 w-3.5" />
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      data-testid="input-name"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={handleChange("name")}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company" className="flex items-center gap-1.5 text-slate-700">
                      <Briefcase className="h-3.5 w-3.5" />
                      Company Name
                    </Label>
                    <Input
                      id="company"
                      data-testid="input-company"
                      placeholder="Acme Construction LLC"
                      value={form.company}
                      onChange={handleChange("company")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="flex items-center gap-1.5 text-slate-700">
                      <Mail className="h-3.5 w-3.5" />
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      data-testid="input-email"
                      placeholder="jane@acme.com"
                      value={form.email}
                      onChange={handleChange("email")}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="flex items-center gap-1.5 text-slate-700">
                      <Phone className="h-3.5 w-3.5" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      data-testid="input-phone"
                      placeholder="(555) 123-4567"
                      value={form.phone}
                      onChange={handleChange("phone")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="flex items-center gap-1.5 text-slate-700">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Tell us about your business
                    </Label>
                    <Textarea
                      id="message"
                      data-testid="input-message"
                      placeholder="How many projects do you run at once? What's your team size? Any specific features you're interested in?"
                      value={form.message}
                      onChange={handleChange("message")}
                      rows={4}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={submitMutation.isPending}
                    data-testid="button-submit-demo"
                  >
                    {submitMutation.isPending ? (
                      "Sending..."
                    ) : (
                      <>
                        <CalendarCheck className="mr-2 h-5 w-5" />
                        Request My Demo
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-slate-500 text-center">
                    We'll respond within one business day. No spam, ever.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} BuildVision. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import SignatureCanvas from 'react-signature-canvas';
import { 
  FileText, 
  Download, 
  MessageSquare, 
  Send, 
  Paperclip,
  CheckCircle2,
  Image as ImageIcon,
  PenTool,
  ZoomIn,
  Eye,
  Plus
} from "lucide-react";
import blueprintImage from "@assets/generated_images/construction_blueprints_and_hard_hat_on_table.png";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";

export default function ProjectDetails() {
  const sigPad = useRef<any>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const clearSignature = () => {
    sigPad.current?.clear();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold">Jenkins Residence</h1>
          <p className="text-muted-foreground">123 Maple Avenue • Renovation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">View Schedule</Button>
          <Button>Contact Team</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 rounded-none h-auto overflow-x-auto">
          {["Overview", "Inspiration & Selections", "Plans & Drawings", "Contracts", "Messages"].map((tab) => (
            <TabsTrigger 
              key={tab} 
              value={tab.toLowerCase().split(' ')[0]}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Current Phase: Rough-in</CardTitle>
                    <CardDescription>Week 6 of 24</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <img 
                      src={projectImage} 
                      alt="Project Progress" 
                      className="w-full h-64 object-cover rounded-md mb-4"
                    />
                    <div className="prose prose-sm text-muted-foreground max-w-none">
                      <p>
                        The framing is complete and inspections have been passed. The team is currently working on electrical and plumbing rough-ins throughout the main floor. 
                      </p>
                      <ul>
                        <li>HVAC ductwork installation - 60% complete</li>
                        <li>Plumbing top-out - 80% complete</li>
                        <li>Electrical wiring - 40% complete</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Team</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>PM</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">Mike Builder</p>
                        <p className="text-xs text-muted-foreground">Project Manager</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>JD</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">Jane Design</p>
                        <p className="text-xs text-muted-foreground">Lead Designer</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inspiration">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Mock Inspiration Images */}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="group relative aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="icon" variant="secondary"><MessageSquare className="w-4 h-4" /></Button>
                    <Button size="icon" variant="secondary"><CheckCircle2 className="w-4 h-4" /></Button>
                  </div>
                  <img 
                    src={`https://picsum.photos/seed/${i * 123}/400/400`} 
                    alt="Inspiration" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent text-white text-xs font-medium">
                    Kitchen Idea #{i}
                  </div>
                </div>
              ))}
              <div className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                <Plus className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Upload Image</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="plans">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Approved Drawings</h3>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Upload New Version
                </Button>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                 {/* Blueprint Card 1 */}
                 <Card className="group cursor-pointer hover:border-primary transition-colors">
                   <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                     <img 
                       src={blueprintImage} 
                       alt="Floor Plan Level 1" 
                       className="w-full h-full object-cover opacity-80 grayscale group-hover:grayscale-0 transition-all"
                     />
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Button variant="secondary" size="sm">
                         <ZoomIn className="w-4 h-4 mr-2" />
                         View Detail
                       </Button>
                     </div>
                   </div>
                   <CardContent className="p-4">
                     <div className="flex justify-between items-start">
                       <div>
                         <h4 className="font-bold text-sm">A1.0 - First Floor Plan</h4>
                         <p className="text-xs text-muted-foreground mt-1">Rev 3 • Approved 10/12/2025</p>
                       </div>
                       <Badge variant="outline">Approved</Badge>
                     </div>
                   </CardContent>
                 </Card>

                 {/* Blueprint Card 2 */}
                 <Card className="group cursor-pointer hover:border-primary transition-colors">
                   <div className="aspect-[4/3] bg-muted relative overflow-hidden flex items-center justify-center bg-slate-100">
                     <FileText className="w-16 h-16 text-slate-300" />
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Button variant="secondary" size="sm">
                         <Eye className="w-4 h-4 mr-2" />
                         Preview
                       </Button>
                     </div>
                   </div>
                   <CardContent className="p-4">
                     <div className="flex justify-between items-start">
                       <div>
                         <h4 className="font-bold text-sm">A2.1 - Elevations</h4>
                         <p className="text-xs text-muted-foreground mt-1">Rev 1 • Draft</p>
                       </div>
                       <Badge variant="secondary">In Review</Badge>
                     </div>
                   </CardContent>
                 </Card>

                  {/* Blueprint Card 3 */}
                 <Card className="group cursor-pointer hover:border-primary transition-colors">
                   <div className="aspect-[4/3] bg-muted relative overflow-hidden flex items-center justify-center bg-slate-100">
                     <FileText className="w-16 h-16 text-slate-300" />
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Button variant="secondary" size="sm">
                         <Eye className="w-4 h-4 mr-2" />
                         Preview
                       </Button>
                     </div>
                   </div>
                   <CardContent className="p-4">
                     <div className="flex justify-between items-start">
                       <div>
                         <h4 className="font-bold text-sm">E1.0 - Electrical Plan</h4>
                         <p className="text-xs text-muted-foreground mt-1">Rev 2 • Approved 10/15/2025</p>
                       </div>
                       <Badge variant="outline">Approved</Badge>
                     </div>
                   </CardContent>
                 </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Comments on Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-3 text-sm border-b border-border pb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">A1.0</div>
                      <div>
                        <p className="font-medium">Kitchen Island Outlet</p>
                        <p className="text-muted-foreground">"Can we move the outlet on the island to the side panel?"</p>
                        <p className="text-xs text-muted-foreground mt-1">Sarah Jenkins • Yesterday</p>
                      </div>
                    </div>
                     <div className="flex gap-3 text-sm pb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">E1.0</div>
                      <div>
                        <p className="font-medium">Sconces Height</p>
                        <p className="text-muted-foreground">"Confirming 66 inches AFF for the master bath sconces."</p>
                        <p className="text-xs text-muted-foreground mt-1">Mike Builder • 2 days ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contracts">
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Contract Document</CardTitle>
                  <CardDescription>Residential Construction Agreement v2.1</CardDescription>
                </CardHeader>
                <CardContent className="h-[500px] overflow-y-auto bg-muted/20 p-6 rounded-md border border-border text-sm leading-relaxed">
                  <h3 className="font-bold text-lg mb-4">CONSTRUCTION AGREEMENT</h3>
                  <p className="mb-4">This Agreement is made this 11th day of December, 2025, between BuildVision Construction ("Contractor") and Sarah Jenkins ("Client").</p>
                  <p className="mb-4"><strong>1. SCOPE OF WORK.</strong> Contractor shall provide all labor and materials to construct the improvements described in the attached Plans and Specifications.</p>
                  <p className="mb-4"><strong>2. CONTRACT PRICE.</strong> Client agrees to pay Contractor the fixed sum of $145,000.00. Payment shall be made according to the Payment Schedule attached hereto.</p>
                  <p className="mb-4"><strong>3. TIMELINE.</strong> Work shall commence on October 1st, 2025 and is estimated to be substantially complete by January 15th, 2026.</p>
                  <p className="mb-4"><strong>4. CHANGE ORDERS.</strong> Any deviation from the Plans and Specifications involving extra cost must be executed in writing (Change Order) and signed by both parties.</p>
                  <p className="mb-4"><strong>5. WARRANTY.</strong> Contractor warrants all work for a period of 12 months from the date of substantial completion.</p>
                  <div className="h-32"></div> {/* Spacer */}
                </CardContent>
                <div className="p-4 border-t border-border flex justify-between items-center bg-muted/10">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <span className="text-xs text-muted-foreground">Last updated: 2 days ago</span>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Electronic Signature</CardTitle>
                  <CardDescription>Please sign below to accept the terms.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <input type="text" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="Sarah Jenkins" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Draw Signature</label>
                    <div className="border border-input rounded-md overflow-hidden bg-white">
                      <SignatureCanvas 
                        ref={sigPad}
                        penColor="black"
                        canvasProps={{width: 500, height: 200, className: 'w-full h-48'}} 
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearSignature} className="text-xs text-muted-foreground">
                      Clear Signature
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="terms" className="rounded border-gray-300" />
                    <label htmlFor="terms" className="text-sm text-muted-foreground">
                      I agree to be legally bound by this electronic signature.
                    </label>
                  </div>
                  
                  <Button className="w-full">Sign & Accept Contract</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="text-lg">Project Communication</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex gap-3">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                  </Avatar>
                  <div className="bg-muted p-3 rounded-lg rounded-tl-none max-w-[80%]">
                    <p className="text-sm">Hi Sarah, just wanted to let you know the tile samples arrived. I'll leave them on the counter for you to check out this weekend.</p>
                    <span className="text-xs text-muted-foreground mt-1 block">Mike • 10:30 AM</span>
                  </div>
                </div>
                
                <div className="flex gap-3 flex-row-reverse">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                  </Avatar>
                  <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-none max-w-[80%]">
                    <p className="text-sm">Thanks Mike! We'll swing by Saturday morning. Are the new lighting fixtures there too?</p>
                    <span className="text-xs text-primary-foreground/70 mt-1 block">You • 10:45 AM</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                  </Avatar>
                  <div className="bg-muted p-3 rounded-lg rounded-tl-none max-w-[80%]">
                    <p className="text-sm">Yes, the pendant lights are in box 4 in the garage. Let me know if you want to open them up.</p>
                    <span className="text-xs text-muted-foreground mt-1 block">Mike • 10:48 AM</span>
                  </div>
                </div>
              </CardContent>
              <div className="p-4 border-t border-border bg-muted/10">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                  <Textarea placeholder="Type a message..." className="min-h-[40px] resize-none py-2" />
                  <Button size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
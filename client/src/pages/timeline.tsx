import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";

export default function TimelinePage() {
  const phases = [
    {
      id: 1,
      name: "Phase 1: Demolition & Prep",
      status: "completed",
      date: "Oct 1 - Oct 15",
      tasks: [
        "Site protection installed",
        "Kitchen demolition",
        "Debris removal",
        "Rough plumbing disconnect"
      ]
    },
    {
      id: 2,
      name: "Phase 2: Framing & Structural",
      status: "completed",
      date: "Oct 16 - Nov 05",
      tasks: [
        "Wall framing modifications",
        "Window header installation",
        "Subfloor repair",
        "Structural inspection passed"
      ]
    },
    {
      id: 3,
      name: "Phase 3: Rough-ins",
      status: "in-progress",
      date: "Nov 06 - Dec 15",
      tasks: [
        "HVAC ductwork (Completed)",
        "Plumbing top-out (In Progress)",
        "Electrical wiring (In Progress)",
        "Rough-in Inspection (Scheduled Dec 14)"
      ]
    },
    {
      id: 4,
      name: "Phase 4: Insulation & Drywall",
      status: "upcoming",
      date: "Dec 16 - Jan 10",
      tasks: [
        "Insulation installation",
        "Insulation inspection",
        "Drywall hanging",
        "Tape and texture"
      ]
    },
    {
      id: 5,
      name: "Phase 5: Finishes",
      status: "upcoming",
      date: "Jan 11 - Feb 28",
      tasks: [
        "Flooring installation",
        "Cabinet installation",
        "Trim carpentry",
        "Painting",
        "Final clean"
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold">Project Timeline</h1>
        <p className="text-muted-foreground">Master Schedule: Jenkins Residence</p>
      </div>

      <div className="relative border-l-2 border-muted ml-4 space-y-12 pb-12">
        {phases.map((phase, index) => (
          <div key={phase.id} className="relative pl-8">
            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${
              phase.status === 'completed' ? 'bg-primary border-primary' : 
              phase.status === 'in-progress' ? 'bg-background border-primary' : 
              'bg-background border-muted'
            }`}>
              {phase.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-white absolute -top-0.5 -left-0.5" />}
              {phase.status === 'in-progress' && <div className="w-2 h-2 bg-primary rounded-full absolute top-0.5 left-0.5 animate-pulse" />}
            </div>

            <Card className={`${phase.status === 'upcoming' ? 'opacity-70' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant={
                      phase.status === 'completed' ? 'secondary' : 
                      phase.status === 'in-progress' ? 'default' : 
                      'outline'
                    } className="mb-2">
                      {phase.status === 'completed' ? 'Completed' : 
                       phase.status === 'in-progress' ? 'In Progress' : 
                       'Upcoming'}
                    </Badge>
                    <CardTitle className="text-xl">{phase.name}</CardTitle>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    <Clock className="w-4 h-4 mr-2" />
                    {phase.date}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mt-2">
                  {phase.tasks.map((task, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      {phase.status === 'completed' || (phase.status === 'in-progress' && i < 2) ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/40" />
                      )}
                      <span className={
                        phase.status === 'completed' || (phase.status === 'in-progress' && i < 2) 
                        ? "text-foreground" 
                        : "text-muted-foreground"
                      }>
                        {task}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
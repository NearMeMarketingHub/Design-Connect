import bcrypt from "bcryptjs";
import { storage } from "./storage";

async function seed() {
  console.log("Starting database seed...");

  try {
    // Create contractor user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const contractor = await storage.createUser({
      username: "contractor",
      password: hashedPassword,
      role: "contractor",
      name: "BuildVision Contractors",
    });
    console.log("✓ Created contractor user");

    // Create client users
    const clientJenkins = await storage.createUser({
      username: "sarah.jenkins",
      password: hashedPassword,
      role: "client",
      name: "Sarah Jenkins",
    });
    console.log("✓ Created client user: Sarah Jenkins");

    const clientMiller = await storage.createUser({
      username: "mike.miller",
      password: hashedPassword,
      role: "client",
      name: "Mike Miller",
    });
    console.log("✓ Created client user: Mike Miller");

    // Create projects
    const jenkinsProject = await storage.createProject({
      name: "The Jenkins Residence",
      address: "123 Maple Avenue",
      status: "Active",
      phase: "Phase 3: Rough-in",
      progress: 45,
      budgetStatus: "On Track",
      nextMilestone: "Drywall",
      dueDate: "Jan 15, 2026",
      description: "Current progress is on schedule. Plumbing and electrical rough-ins are 80% complete. Next inspection scheduled for Friday.",
      type: "Renovation",
      budget: "145000",
      clientId: clientJenkins.id,
    });
    console.log("✓ Created project: Jenkins Residence");

    const lakehouseProject = await storage.createProject({
      name: "Lake House Retreat",
      address: "889 Shoreline Drive",
      status: "Planning",
      phase: "Phase 1: Design",
      progress: 15,
      budgetStatus: "Pending",
      nextMilestone: "Permit Approval",
      dueDate: "Mar 01, 2026",
      description: "Architectural drawings are under review by the city. Final material selections for the exterior are needed.",
      type: "New Construction",
      budget: "850000",
      clientId: clientJenkins.id,
    });
    console.log("✓ Created project: Lake House Retreat");

    const loftProject = await storage.createProject({
      name: "Downtown Loft",
      address: "450 Main St, Unit 4B",
      status: "Completed",
      phase: "Phase 6: Handover",
      progress: 100,
      budgetStatus: "Closed",
      nextMilestone: "Warranty Period",
      dueDate: "Completed",
      description: "Project completed on Jan 15, 2025. Final walkthrough signed off.",
      type: "Commercial",
      budget: "120000",
      clientId: clientJenkins.id,
    });
    console.log("✓ Created project: Downtown Loft");

    const millerProject = await storage.createProject({
      name: "Miller Kitchen",
      address: "567 Oak Street",
      status: "Planning",
      phase: "Phase 1: Design",
      progress: 15,
      budgetStatus: "Pending",
      nextMilestone: "Design Approval",
      dueDate: "Feb 15, 2026",
      description: "Kitchen remodel project. Awaiting final cabinet selections.",
      type: "Remodel",
      budget: "65000",
      clientId: clientMiller.id,
    });
    console.log("✓ Created project: Miller Kitchen");

    // Create estimate for Jenkins project
    const jenkinsEstimate = await storage.createEstimate({
      customId: "EST-1024",
      clientName: "Sarah Jenkins",
      projectName: "Jenkins Residence",
      amount: "145000",
      status: "Approved",
      date: "Dec 10, 2025",
      projectId: jenkinsProject.id,
    });
    console.log("✓ Created estimate: EST-1024");

    // Create estimate line items
    const lineItems = [
      { category: "01 - General Conditions", item: "Project Management", quantity: "120", unit: "Hrs", rate: "85", total: "10200" },
      { category: "01 - General Conditions", item: "Permits & Fees", quantity: "1", unit: "LS", rate: "2500", total: "2500" },
      { category: "02 - Demolition", item: "Kitchen Demolition", quantity: "1", unit: "LS", rate: "3500", total: "3500" },
      { category: "02 - Demolition", item: "Debris Removal", quantity: "2", unit: "Load", rate: "450", total: "900" },
      { category: "06 - Wood & Plastics", item: "Rough Lumber Package", quantity: "1", unit: "LS", rate: "4500", total: "4500" },
      { category: "06 - Wood & Plastics", item: "Framing Labor", quantity: "350", unit: "SF", rate: "12", total: "4200" },
      { category: "15 - Mechanical", item: "HVAC Rough-in", quantity: "1", unit: "LS", rate: "6500", total: "6500" },
      { category: "16 - Electrical", item: "Rough Wiring", quantity: "25", unit: "Opening", rate: "120", total: "3000" },
    ];

    for (const item of lineItems) {
      await storage.createEstimateLineItem({
        estimateId: jenkinsEstimate.id,
        ...item,
      });
    }
    console.log("✓ Created estimate line items");

    // Create invoice for Jenkins project
    const jenkinsInvoice = await storage.createInvoice({
      customId: "INV-2024-001",
      clientName: "Sarah Jenkins",
      projectName: "Jenkins Residence",
      amount: "45000",
      dueDate: "Dec 15, 2025",
      status: "Unpaid",
      type: "Standard",
      projectId: jenkinsProject.id,
    });
    console.log("✓ Created invoice: INV-2024-001");

    await storage.createInvoiceLineItem({
      invoiceId: jenkinsInvoice.id,
      description: "Labor - Week 6",
      quantity: "40",
      rate: "85",
      amount: "3400",
    });

    await storage.createInvoiceLineItem({
      invoiceId: jenkinsInvoice.id,
      description: "Materials - Lumber",
      quantity: "1",
      rate: "1200",
      amount: "1200",
    });
    console.log("✓ Created invoice line items");

    // Create project phases for Jenkins project
    const phases = [
      {
        name: "Phase 1: Demolition & Prep",
        status: "completed",
        dateRange: "Oct 1 - Oct 15",
        tasks: ["Site protection installed", "Kitchen demolition", "Debris removal", "Rough plumbing disconnect"],
      },
      {
        name: "Phase 2: Framing & Structural",
        status: "completed",
        dateRange: "Oct 16 - Nov 05",
        tasks: ["Wall framing modifications", "Window header installation", "Subfloor repair", "Structural inspection passed"],
      },
      {
        name: "Phase 3: Rough-ins",
        status: "in-progress",
        dateRange: "Nov 06 - Dec 15",
        tasks: ["HVAC ductwork (Completed)", "Plumbing top-out (In Progress)", "Electrical wiring (In Progress)", "Rough-in Inspection (Scheduled Dec 14)"],
      },
      {
        name: "Phase 4: Insulation & Drywall",
        status: "upcoming",
        dateRange: "Dec 16 - Jan 10",
        tasks: ["Insulation installation", "Insulation inspection", "Drywall hanging", "Tape and texture"],
      },
      {
        name: "Phase 5: Finishes",
        status: "upcoming",
        dateRange: "Jan 11 - Feb 28",
        tasks: ["Flooring installation", "Cabinet installation", "Trim carpentry", "Painting", "Final clean"],
      },
    ];

    for (const phase of phases) {
      await storage.createProjectPhase({
        projectId: jenkinsProject.id,
        ...phase,
      });
    }
    console.log("✓ Created project phases");

    // Create action items for Jenkins project
    await storage.createActionItem({
      projectId: jenkinsProject.id,
      title: "Schedule final electrical inspection",
      assignedTo: "Mike Thompson",
      dueDate: "Dec 14, 2025",
      status: "pending",
    });

    await storage.createActionItem({
      projectId: jenkinsProject.id,
      title: "Order bathroom fixtures",
      assignedTo: "Sarah Jenkins",
      dueDate: "Dec 20, 2025",
      status: "pending",
    });
    console.log("✓ Created action items");

    // Create recurring billing
    await storage.createRecurringBilling({
      customId: "REC-101",
      clientName: "West Lake Dev",
      projectName: "West Lake Build",
      amount: "12500",
      frequency: "Monthly",
      nextRunDate: "Jan 01, 2026",
      status: "Active",
      projectId: lakehouseProject.id,
    });
    console.log("✓ Created recurring billing");

    // Create additional test contractor accounts
    const contractorPM = await storage.createUser({
      username: "mike.thompson",
      password: hashedPassword,
      role: "contractor",
      name: "Mike Thompson",
      companyName: "Thompson Construction",
      companyType: "Project Manager",
      isApproved: true,
    });
    console.log("✓ Created contractor: Mike Thompson (Project Manager)");

    const contractorElectrician = await storage.createUser({
      username: "tom.electric",
      password: hashedPassword,
      role: "contractor",
      name: "Tom Electric",
      companyName: "Electric Pro Services",
      companyType: "Electrical",
      isApproved: true,
    });
    console.log("✓ Created contractor: Tom Electric (Electrician)");

    const contractorPlumber = await storage.createUser({
      username: "sarah.plumber",
      password: hashedPassword,
      role: "contractor",
      name: "Sarah Plumber",
      companyName: "Premier Plumbing LLC",
      companyType: "Plumbing",
      isApproved: true,
    });
    console.log("✓ Created contractor: Sarah Plumber (Plumber)");

    const contractorHVAC = await storage.createUser({
      username: "john.hvac",
      password: hashedPassword,
      role: "contractor",
      name: "John HVAC",
      companyName: "Cool Air Systems",
      companyType: "HVAC",
      isApproved: true,
    });
    console.log("✓ Created contractor: John HVAC (HVAC Specialist)");

    // Assign contractors to Jenkins project as team members
    await storage.addProjectTeamMember({
      projectId: jenkinsProject.id,
      contractorId: contractorPM.id,
      role: "Project Manager",
      addedBy: contractor.id,
    });
    await storage.addProjectTeamMember({
      projectId: jenkinsProject.id,
      contractorId: contractorElectrician.id,
      role: "Electrician",
      addedBy: contractor.id,
    });
    await storage.addProjectTeamMember({
      projectId: jenkinsProject.id,
      contractorId: contractorPlumber.id,
      role: "Plumber",
      addedBy: contractor.id,
    });
    console.log("✓ Assigned contractors to Jenkins project");

    // Assign contractors to Miller project
    await storage.addProjectTeamMember({
      projectId: millerProject.id,
      contractorId: contractorPM.id,
      role: "Project Manager",
      addedBy: contractor.id,
    });
    await storage.addProjectTeamMember({
      projectId: millerProject.id,
      contractorId: contractorPlumber.id,
      role: "Plumber",
      addedBy: contractor.id,
    });
    console.log("✓ Assigned contractors to Miller project");

    // Assign contractors to Lakehouse project
    await storage.addProjectTeamMember({
      projectId: lakehouseProject.id,
      contractorId: contractorPM.id,
      role: "Project Manager",
      addedBy: contractor.id,
    });
    await storage.addProjectTeamMember({
      projectId: lakehouseProject.id,
      contractorId: contractorHVAC.id,
      role: "HVAC Specialist",
      addedBy: contractor.id,
    });
    console.log("✓ Assigned contractors to Lakehouse project");

    // Create default chats for all projects
    const allProjects = [jenkinsProject, millerProject, lakehouseProject, loftProject];
    for (const project of allProjects) {
      const teamMembers = await storage.getProjectTeamMembers(project.id);
      if (teamMembers.length > 0 && project.clientId) {
        await storage.createDefaultChatsForProject(
          project.id,
          project.clientId,
          teamMembers.map(m => ({
            contractorId: m.contractorId,
            role: m.role,
            name: m.contractor?.name || 'Contractor',
            companyName: m.contractor?.companyName || null,
          }))
        );
        console.log(`✓ Created default chats for ${project.name}`);
      }
    }

    console.log("\n✓ Database seeded successfully!");
    console.log("\nTest credentials:");
    console.log("Contractor: contractor / password123");
    console.log("Client 1: sarah.jenkins / password123");
    console.log("Client 2: mike.miller / password123");
    console.log("Project Manager: mike.thompson / password123");
    console.log("Electrician: tom.electric / password123");
    console.log("Plumber: sarah.plumber / password123");
    console.log("HVAC: john.hvac / password123");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });

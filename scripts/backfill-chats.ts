import { storage } from "../server/storage";

async function backfillDefaultChats() {
  console.log("Starting default chat backfill...");
  
  const projects = await storage.getProjects();
  const results = { processed: 0, skipped: 0, created: 0, errors: [] as string[] };
  
  for (const project of projects) {
    results.processed++;
    
    // Skip projects without clients
    if (!project.clientId) {
      console.log(`  Skipped ${project.name}: no client`);
      results.skipped++;
      continue;
    }
    
    // Check if project already has default chats
    const existingChats = await storage.getProjectChats(project.id, project.clientId, true);
    const hasDefaultChats = existingChats.some(chat => chat.isDefault);
    
    if (hasDefaultChats) {
      console.log(`  Skipped ${project.name}: already has default chats`);
      results.skipped++;
      continue;
    }
    
    // Get team members for the project
    const teamMembers = await storage.getProjectTeamMembers(project.id);
    
    if (teamMembers.length === 0) {
      console.log(`  Skipped ${project.name}: no team members`);
      results.skipped++;
      continue;
    }
    
    try {
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
      console.log(`  Created default chats for ${project.name}`);
      results.created++;
    } catch (err: any) {
      console.log(`  Error for ${project.name}: ${err.message}`);
      results.errors.push(`Project ${project.id}: ${err.message}`);
    }
  }
  
  console.log("\n✓ Backfill complete!");
  console.log(`Processed: ${results.processed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Created: ${results.created}`);
  if (results.errors.length > 0) {
    console.log(`Errors: ${results.errors.length}`);
  }
}

backfillDefaultChats()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });

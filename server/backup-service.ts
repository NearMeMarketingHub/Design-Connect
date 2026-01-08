// Project Backup Service
// Creates Client Package and PM Package backups for completed projects

import { storage } from './storage';
import { uploadToSharePoint, uploadFilesToSharePoint, downloadFileAsBuffer } from './sharepoint-client';
import type { Project, User, ProjectPhase, PhaseUpdate, MilestoneTask, InspirationImage, Message, Invoice, Estimate, ActionItem, Chat, ChatMessage, ProgressPost, PostComment, ContractorPhoto } from '@shared/schema';

export interface BackupResult {
  success: boolean;
  projectId: string;
  projectName: string;
  clientPackagePath?: string;
  pmPackagePath?: string;
  errors: string[];
  uploadedFiles: number;
}

interface ProjectBackupData {
  project: Project;
  client: Omit<User, 'password'> | null;
  teamMembers: (any & { contractor?: User })[];
  phases: ProjectPhase[];
  phaseUpdates: PhaseUpdate[];
  milestoneTasks: MilestoneTask[];
  inspirationImages: InspirationImage[];
  messages: Message[];
  chats: Chat[];
  chatMessages: ChatMessage[];
  progressPosts: ProgressPost[];
  postComments: PostComment[];
  contractorPhotos: ContractorPhoto[];
  invoices: Invoice[];
  estimates: Estimate[];
  actionItems: ActionItem[];
}

// Collect all project data for backup
async function collectProjectData(projectId: string): Promise<ProjectBackupData | null> {
  const project = await storage.getProject(projectId);
  if (!project) return null;

  let client: Omit<User, 'password'> | null = null;
  if (project.clientId) {
    const clientUser = await storage.getUser(project.clientId);
    if (clientUser) {
      const { password: _, ...clientWithoutPassword } = clientUser;
      client = clientWithoutPassword;
    }
  }

  const [
    teamMembers,
    phases,
    phaseUpdates,
    milestoneTasks,
    inspirationImages,
    messages,
    invoices,
    estimates,
    actionItems,
    progressPosts,
    contractorPhotos
  ] = await Promise.all([
    storage.getProjectTeamMembers(projectId),
    storage.getProjectPhases(projectId),
    storage.getProjectPhaseUpdates(projectId),
    storage.getProjectMilestoneTasks(projectId),
    storage.getInspirationImages(projectId),
    storage.getMessages(projectId),
    storage.getInvoices().then(inv => inv.filter(i => i.projectId === projectId)),
    storage.getEstimates().then(est => est.filter(e => e.projectId === projectId)),
    storage.getActionItems(projectId),
    storage.getProgressPosts(projectId),
    storage.getContractorPhotos(projectId)
  ]);

  // Get all chats for this project (admin view to get all)
  let chats: Chat[] = [];
  let chatMessages: ChatMessage[] = [];
  try {
    const allChats = await storage.getProjectChats(projectId, 'admin', true);
    chats = allChats.map(c => ({
      id: c.id,
      projectId: c.projectId,
      type: c.type,
      title: c.title,
      createdById: c.createdById,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageSenderId: c.lastMessageSenderId,
      lastMessageSenderName: c.lastMessageSenderName,
      isDefault: c.isDefault,
      createdAt: c.createdAt
    }));
    
    for (const chat of allChats) {
      const messages = await storage.getChatMessages(chat.id);
      chatMessages.push(...messages);
    }
  } catch (error) {
    console.error('Error fetching chats:', error);
  }

  // Get post comments
  let postComments: PostComment[] = [];
  for (const post of progressPosts) {
    const comments = await storage.getPostComments(post.id);
    postComments.push(...comments);
  }

  return {
    project,
    client,
    teamMembers,
    phases,
    phaseUpdates,
    milestoneTasks,
    inspirationImages,
    messages,
    chats,
    chatMessages,
    progressPosts,
    postComments,
    contractorPhotos,
    invoices,
    estimates,
    actionItems
  };
}

// Format date for folder names
function formatDateForFolder(date: Date = new Date()): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

// Sanitize folder/file names
function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 100);
}

// Generate project summary PDF content (plain text for now, can be enhanced with proper PDF library)
function generateProjectSummary(data: ProjectBackupData, isClientVersion: boolean): string {
  const { project, client, teamMembers, phases } = data;
  
  let content = `
================================================================================
                        PROJECT COMPLETION SUMMARY
================================================================================

PROJECT DETAILS
---------------
Name: ${project.name}
Address: ${project.address}
Status: ${project.status}
Progress: ${project.progress}%
Phase: ${project.phase}
Type: ${project.type || 'N/A'}
Budget: $${project.budget || 'N/A'}

TIMELINE
--------
Created: ${project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
Due Date: ${project.dueDate || 'N/A'}

DESCRIPTION
-----------
${project.description || 'No description provided.'}

`;

  if (client) {
    content += `
CLIENT INFORMATION
------------------
Name: ${client.name || client.username}
Email: ${client.email || 'N/A'}
Phone: ${client.phone || 'N/A'}

`;
  }

  content += `
TEAM MEMBERS
------------
`;
  for (const member of teamMembers) {
    const contractor = member.contractor;
    if (contractor) {
      content += `- ${contractor.name || contractor.username}`;
      if (member.role) content += ` (${member.role})`;
      content += `\n  Email: ${contractor.email || 'N/A'}`;
      content += `\n  Phone: ${contractor.phone || 'N/A'}`;
      if (contractor.companyName) content += `\n  Company: ${contractor.companyName}`;
      content += `\n\n`;
    }
  }

  content += `
PROJECT PHASES
--------------
`;
  for (const phase of phases) {
    const status = phase.status === 'completed' ? '[COMPLETED]' : phase.status === 'in_progress' ? '[IN PROGRESS]' : '[PENDING]';
    content += `${status} ${phase.name}\n`;
    content += `  Date Range: ${phase.dateRange}\n`;
    if (phase.tasks && phase.tasks.length > 0) {
      content += `  Tasks: ${phase.tasks.join(', ')}\n`;
    }
    content += '\n';
  }

  content += `
================================================================================
                           Generated: ${new Date().toLocaleString()}
================================================================================
`;

  return content;
}

// Generate chat log content
function generateChatLog(data: ProjectBackupData, includeInternal: boolean): string {
  const { chats, chatMessages, messages } = data;
  
  let content = `
================================================================================
                              CHAT HISTORY
================================================================================
Project: ${data.project.name}
Generated: ${new Date().toLocaleString()}
================================================================================

`;

  // Group chat messages by chat
  const chatMap = new Map<string, typeof chatMessages>();
  for (const msg of chatMessages) {
    const existing = chatMap.get(msg.chatId) || [];
    existing.push(msg);
    chatMap.set(msg.chatId, existing);
  }

  for (const chat of chats) {
    // Skip internal chats for client version
    if (!includeInternal && chat.type === 'group' && chat.title?.toLowerCase().includes('internal')) {
      continue;
    }

    content += `\n--- ${chat.title || 'Direct Chat'} ---\n`;
    content += `Type: ${chat.type}\n\n`;

    const msgs = chatMap.get(chat.id) || [];
    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const msg of msgs) {
      const timestamp = new Date(msg.createdAt).toLocaleString();
      content += `[${timestamp}] ${msg.senderName}:\n`;
      content += `  ${msg.content}\n`;
      if (msg.attachmentUrl) {
        content += `  [Attachment: ${msg.attachmentName || 'file'}]\n`;
      }
      content += '\n';
    }
  }

  // Also include legacy messages
  if (messages.length > 0) {
    content += `\n--- Legacy Messages ---\n\n`;
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const msg of sortedMessages) {
      if (msg.isDeleted) continue;
      const timestamp = new Date(msg.timestamp).toLocaleString();
      content += `[${timestamp}] ${msg.senderName}:\n`;
      content += `  ${msg.content}\n`;
      if (msg.attachmentUrl) {
        content += `  [Attachment: ${msg.attachmentName || 'file'}]\n`;
      }
      content += '\n';
    }
  }

  return content;
}

// Generate financial summary
function generateFinancialSummary(data: ProjectBackupData): string {
  const { invoices, estimates, project } = data;
  
  let content = `
================================================================================
                           FINANCIAL SUMMARY
================================================================================
Project: ${project.name}
Generated: ${new Date().toLocaleString()}
================================================================================

PROJECT BUDGET
--------------
Budget: $${project.budget || '0'}

ESTIMATES
---------
`;

  if (estimates.length === 0) {
    content += 'No estimates on record.\n';
  } else {
    for (const est of estimates) {
      content += `\n${est.customId} - ${est.projectName}\n`;
      content += `  Client: ${est.clientName}\n`;
      content += `  Amount: $${est.amount}\n`;
      content += `  Status: ${est.status}\n`;
      content += `  Date: ${est.date}\n`;
    }
  }

  content += `\nINVOICES\n--------\n`;

  if (invoices.length === 0) {
    content += 'No invoices on record.\n';
  } else {
    let totalBilled = 0;
    let totalPaid = 0;
    
    for (const inv of invoices) {
      content += `\n${inv.customId} - ${inv.projectName}\n`;
      content += `  Client: ${inv.clientName}\n`;
      content += `  Amount: $${inv.amount}\n`;
      content += `  Due Date: ${inv.dueDate}\n`;
      content += `  Status: ${inv.status}\n`;
      content += `  Type: ${inv.type}\n`;
      
      totalBilled += parseFloat(inv.amount.toString());
      if (inv.status === 'paid') {
        totalPaid += parseFloat(inv.amount.toString());
      }
    }

    content += `\nSUMMARY\n-------\n`;
    content += `Total Invoiced: $${totalBilled.toFixed(2)}\n`;
    content += `Total Paid: $${totalPaid.toFixed(2)}\n`;
    content += `Outstanding: $${(totalBilled - totalPaid).toFixed(2)}\n`;
  }

  return content;
}

// Generate action items summary (PM only)
function generateActionItemsSummary(data: ProjectBackupData): string {
  const { actionItems, project } = data;
  
  let content = `
================================================================================
                           ACTION ITEMS LOG
================================================================================
Project: ${project.name}
Generated: ${new Date().toLocaleString()}
================================================================================

`;

  if (actionItems.length === 0) {
    content += 'No action items on record.\n';
  } else {
    const grouped = {
      completed: actionItems.filter(a => a.status === 'completed'),
      pending: actionItems.filter(a => a.status === 'pending'),
      inProgress: actionItems.filter(a => a.status === 'in_progress')
    };

    if (grouped.pending.length > 0) {
      content += `PENDING (${grouped.pending.length})\n`;
      for (const item of grouped.pending) {
        content += `  - ${item.title}\n`;
        if (item.assignedTo) content += `    Assigned: ${item.assignedTo}\n`;
        if (item.dueDate) content += `    Due: ${item.dueDate}\n`;
      }
      content += '\n';
    }

    if (grouped.inProgress.length > 0) {
      content += `IN PROGRESS (${grouped.inProgress.length})\n`;
      for (const item of grouped.inProgress) {
        content += `  - ${item.title}\n`;
        if (item.assignedTo) content += `    Assigned: ${item.assignedTo}\n`;
        if (item.dueDate) content += `    Due: ${item.dueDate}\n`;
      }
      content += '\n';
    }

    if (grouped.completed.length > 0) {
      content += `COMPLETED (${grouped.completed.length})\n`;
      for (const item of grouped.completed) {
        content += `  - ${item.title}\n`;
        if (item.assignedTo) content += `    Assigned: ${item.assignedTo}\n`;
      }
    }
  }

  return content;
}

// Generate phase updates log (PM only - full details)
function generatePhaseUpdatesLog(data: ProjectBackupData): string {
  const { phases, phaseUpdates, milestoneTasks, project } = data;
  
  let content = `
================================================================================
                         PHASE UPDATES & NOTES
================================================================================
Project: ${project.name}
Generated: ${new Date().toLocaleString()}
================================================================================

`;

  for (const phase of phases) {
    content += `\n${'='.repeat(60)}\n`;
    content += `PHASE: ${phase.name}\n`;
    content += `Status: ${phase.status}\n`;
    content += `Date Range: ${phase.dateRange}\n`;
    content += `${'='.repeat(60)}\n`;

    // Milestone tasks for this phase
    const tasks = milestoneTasks.filter(t => t.phaseId === phase.id);
    if (tasks.length > 0) {
      content += `\nTASKS:\n`;
      for (const task of tasks) {
        const status = task.isComplete ? '[X]' : '[ ]';
        content += `  ${status} ${task.title}`;
        if (task.requiresPercentage) {
          content += ` (${task.progressPercent || 0}%)`;
        }
        content += '\n';
      }
    }

    // Phase updates/notes
    const updates = phaseUpdates.filter(u => u.phaseId === phase.id);
    if (updates.length > 0) {
      content += `\nUPDATES:\n`;
      for (const update of updates) {
        const date = new Date(update.createdAt).toLocaleString();
        content += `\n  [${date}] ${update.createdByName || 'Unknown'}:\n`;
        content += `  ${update.content}\n`;
      }
    }
  }

  return content;
}

// Create and upload backup packages
export async function createProjectBackup(projectId: string): Promise<BackupResult> {
  const errors: string[] = [];
  let uploadedFiles = 0;

  const data = await collectProjectData(projectId);
  if (!data) {
    return {
      success: false,
      projectId,
      projectName: 'Unknown',
      errors: ['Project not found'],
      uploadedFiles: 0
    };
  }

  const projectName = sanitizeName(data.project.name);
  const dateStr = formatDateForFolder();
  const baseFolderName = `${projectName}_Completed_${dateStr}`;

  // === CLIENT PACKAGE ===
  const clientFolder = `${baseFolderName}/Client_Package`;
  
  // Upload client documents
  const clientDocs = [
    { name: 'Project_Summary.txt', content: generateProjectSummary(data, true), contentType: 'text/plain' },
    { name: 'Chat_History.txt', content: generateChatLog(data, false), contentType: 'text/plain' },
    { name: 'Financial_Summary.txt', content: generateFinancialSummary(data), contentType: 'text/plain' }
  ];

  for (const doc of clientDocs) {
    const result = await uploadToSharePoint(clientFolder, doc.name, doc.content, doc.contentType);
    if (result.success) uploadedFiles++;
    else errors.push(`Client: ${doc.name} - ${result.error}`);
  }

  // Upload inspiration images to client package
  for (let i = 0; i < data.inspirationImages.length; i++) {
    const img = data.inspirationImages[i];
    const buffer = await downloadFileAsBuffer(img.imageUrl);
    if (buffer) {
      const ext = img.imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `${sanitizeName(img.title || `inspiration_${i + 1}`)}.${ext}`;
      const result = await uploadToSharePoint(`${clientFolder}/Inspiration_Photos`, fileName, buffer, `image/${ext}`);
      if (result.success) uploadedFiles++;
      else errors.push(`Inspiration: ${fileName} - ${result.error}`);
    }
  }

  // Upload progress photos to client package
  for (let i = 0; i < data.progressPosts.length; i++) {
    const post = data.progressPosts[i];
    if (post.coverImage) {
      const buffer = await downloadFileAsBuffer(post.coverImage);
      if (buffer) {
        const ext = post.coverImage.split('.').pop()?.split('?')[0] || 'jpg';
        const fileName = `${sanitizeName(post.title || `progress_${i + 1}`)}.${ext}`;
        const result = await uploadToSharePoint(`${clientFolder}/Progress_Photos`, fileName, buffer, `image/${ext}`);
        if (result.success) uploadedFiles++;
        else errors.push(`Progress: ${fileName} - ${result.error}`);
      }
    }
  }

  // === PM PACKAGE ===
  const pmFolder = `${baseFolderName}/PM_Package`;
  
  // PM gets everything client gets plus more
  const pmDocs = [
    { name: 'Project_Summary_Full.txt', content: generateProjectSummary(data, false), contentType: 'text/plain' },
    { name: 'All_Chat_History.txt', content: generateChatLog(data, true), contentType: 'text/plain' },
    { name: 'Financial_Summary.txt', content: generateFinancialSummary(data), contentType: 'text/plain' },
    { name: 'Action_Items.txt', content: generateActionItemsSummary(data), contentType: 'text/plain' },
    { name: 'Phase_Updates_Log.txt', content: generatePhaseUpdatesLog(data), contentType: 'text/plain' }
  ];

  for (const doc of pmDocs) {
    const result = await uploadToSharePoint(pmFolder, doc.name, doc.content, doc.contentType);
    if (result.success) uploadedFiles++;
    else errors.push(`PM: ${doc.name} - ${result.error}`);
  }

  // Upload all images to PM package as well
  for (let i = 0; i < data.inspirationImages.length; i++) {
    const img = data.inspirationImages[i];
    const buffer = await downloadFileAsBuffer(img.imageUrl);
    if (buffer) {
      const ext = img.imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `${sanitizeName(img.title || `inspiration_${i + 1}`)}.${ext}`;
      const result = await uploadToSharePoint(`${pmFolder}/All_Photos/Inspiration`, fileName, buffer, `image/${ext}`);
      if (result.success) uploadedFiles++;
    }
  }

  for (let i = 0; i < data.progressPosts.length; i++) {
    const post = data.progressPosts[i];
    if (post.coverImage) {
      const buffer = await downloadFileAsBuffer(post.coverImage);
      if (buffer) {
        const ext = post.coverImage.split('.').pop()?.split('?')[0] || 'jpg';
        const fileName = `${sanitizeName(post.title || `progress_${i + 1}`)}.${ext}`;
        const result = await uploadToSharePoint(`${pmFolder}/All_Photos/Progress`, fileName, buffer, `image/${ext}`);
        if (result.success) uploadedFiles++;
      }
    }
  }

  // Upload contractor photos to PM package only (not client package)
  for (let i = 0; i < data.contractorPhotos.length; i++) {
    const photo = data.contractorPhotos[i];
    if (photo.coverImage) {
      const buffer = await downloadFileAsBuffer(photo.coverImage);
      if (buffer) {
        const ext = photo.coverImage.split('.').pop()?.split('?')[0] || 'jpg';
        const fileName = `${sanitizeName(photo.title || `contractor_photo_${i + 1}`)}.${ext}`;
        const result = await uploadToSharePoint(`${pmFolder}/All_Photos/Contractor_Only`, fileName, buffer, `image/${ext}`);
        if (result.success) uploadedFiles++;
        else errors.push(`Contractor Photo: ${fileName} - ${result.error}`);
      }
    }
  }

  // Export raw data as JSON for PM
  const rawDataJson = JSON.stringify({
    project: data.project,
    client: data.client,
    teamMembers: data.teamMembers.map(m => ({
      ...m,
      contractor: m.contractor ? { ...m.contractor, password: undefined } : null
    })),
    phases: data.phases,
    phaseUpdates: data.phaseUpdates,
    milestoneTasks: data.milestoneTasks,
    invoices: data.invoices,
    estimates: data.estimates,
    actionItems: data.actionItems,
    chats: data.chats,
    messageCount: data.chatMessages.length + data.messages.length,
    contractorPhotosCount: data.contractorPhotos.length
  }, null, 2);

  const jsonResult = await uploadToSharePoint(pmFolder, 'project_data.json', rawDataJson, 'application/json');
  if (jsonResult.success) uploadedFiles++;

  return {
    success: errors.length === 0,
    projectId,
    projectName: data.project.name,
    clientPackagePath: clientFolder,
    pmPackagePath: pmFolder,
    errors,
    uploadedFiles
  };
}

// Check if project should trigger backup (100% progress)
export function shouldTriggerBackup(oldProgress: number, newProgress: number): boolean {
  return oldProgress < 100 && newProgress >= 100;
}

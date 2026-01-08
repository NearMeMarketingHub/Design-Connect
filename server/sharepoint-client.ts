// SharePoint Client - Integration with Microsoft Graph API
// Reference: Replit SharePoint connector integration

import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sharepoint',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('SharePoint not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client. Access tokens expire, so a new client must be created each time.
export async function getSharePointClient(): Promise<Client> {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

// SharePoint configuration for Avery Construction
const SHAREPOINT_CONFIG = {
  siteHost: 'nearmemarketing.sharepoint.com',
  sitePath: '/sites/AppStorage',
  basePath: '/Shared Documents/Avery Construction/Contractor App/Completed Projects'
};

export interface SharePointUploadResult {
  success: boolean;
  path: string;
  webUrl?: string;
  error?: string;
}

// Get the site ID for the SharePoint site
async function getSiteId(client: Client): Promise<string> {
  const site = await client.api(`/sites/${SHAREPOINT_CONFIG.siteHost}:${SHAREPOINT_CONFIG.sitePath}`).get();
  return site.id;
}

// Get the drive ID for the document library
async function getDriveId(client: Client, siteId: string): Promise<string> {
  const drives = await client.api(`/sites/${siteId}/drives`).get();
  const documentsDrive = drives.value.find((d: any) => d.name === 'Documents' || d.name === 'Shared Documents');
  if (!documentsDrive) {
    throw new Error('Could not find Documents drive');
  }
  return documentsDrive.id;
}

// Create folder structure if it doesn't exist
async function ensureFolderPath(client: Client, driveId: string, folderPath: string): Promise<string> {
  const parts = folderPath.split('/').filter(p => p);
  let currentPath = '';
  let folderId = 'root';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    try {
      const folder = await client.api(`/drives/${driveId}/root:/${currentPath}`).get();
      folderId = folder.id;
    } catch (error: any) {
      if (error.statusCode === 404) {
        const parentPath = currentPath.split('/').slice(0, -1).join('/');
        const parentEndpoint = parentPath 
          ? `/drives/${driveId}/root:/${parentPath}:/children`
          : `/drives/${driveId}/root/children`;
        
        const newFolder = await client.api(parentEndpoint).post({
          name: part,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        });
        folderId = newFolder.id;
      } else {
        throw error;
      }
    }
  }
  
  return folderId;
}

// Upload a file to SharePoint
export async function uploadToSharePoint(
  folderPath: string,
  fileName: string,
  content: Buffer | string,
  contentType: string = 'application/octet-stream'
): Promise<SharePointUploadResult> {
  try {
    const client = await getSharePointClient();
    const siteId = await getSiteId(client);
    const driveId = await getDriveId(client, siteId);
    
    const fullPath = `${SHAREPOINT_CONFIG.basePath}/${folderPath}`;
    await ensureFolderPath(client, driveId, fullPath);
    
    const uploadPath = `${fullPath}/${fileName}`;
    const contentBuffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    
    const result = await client.api(`/drives/${driveId}/root:/${uploadPath}:/content`)
      .header('Content-Type', contentType)
      .put(contentBuffer);
    
    return {
      success: true,
      path: uploadPath,
      webUrl: result.webUrl
    };
  } catch (error: any) {
    console.error('SharePoint upload error:', error);
    return {
      success: false,
      path: `${folderPath}/${fileName}`,
      error: error.message || 'Upload failed'
    };
  }
}

// Upload multiple files to a folder
export async function uploadFilesToSharePoint(
  folderPath: string,
  files: { name: string; content: Buffer | string; contentType?: string }[]
): Promise<SharePointUploadResult[]> {
  const results: SharePointUploadResult[] = [];
  
  for (const file of files) {
    const result = await uploadToSharePoint(
      folderPath,
      file.name,
      file.content,
      file.contentType || 'application/octet-stream'
    );
    results.push(result);
  }
  
  return results;
}

// Download a file from a URL and return as buffer
export async function downloadFileAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading file:', error);
    return null;
  }
}

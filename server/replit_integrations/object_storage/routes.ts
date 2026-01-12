import type { Express, Request } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "documents");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Register object storage routes for file uploads.
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Local file upload endpoint - stores files on local filesystem.
   * This bypasses cloud storage to avoid runtime crashes.
   */
  app.post("/api/uploads/local", async (req: Request, res) => {
    try {
      const contentType = req.headers['content-type'] || 'application/octet-stream';
      const fileName = decodeURIComponent(req.headers['x-file-name'] as string || 'upload');
      const fileSize = parseInt(req.headers['content-length'] || '0', 10);
      
      if (!req.rawBody) {
        return res.status(400).json({ error: "No file data received" });
      }

      const objectId = randomUUID();
      const ext = path.extname(fileName) || '.bin';
      const storedFileName = `${objectId}${ext}`;
      const filePath = path.join(UPLOADS_DIR, storedFileName);
      
      // Write file to local filesystem
      fs.writeFileSync(filePath, req.rawBody as Buffer);
      
      const objectPath = `/uploads/documents/${storedFileName}`;
      
      res.json({
        objectPath,
        metadata: { name: fileName, size: fileSize, contentType },
      });
    } catch (error) {
      console.error("[local-upload] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to upload file" });
      }
    }
  });

  /**
   * Serve locally uploaded files
   */
  app.get("/uploads/documents/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(UPLOADS_DIR, filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Determine content type from extension
      const ext = path.extname(filename).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.sendFile(filePath);
    } catch (error) {
      console.error("[serve-local] Error:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  /**
   * Request a presigned URL for file upload (legacy - may cause crashes).
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("[upload-url] Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}


import type { Express, Request } from "express";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";

/**
 * Register object storage routes for file uploads.
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Direct file upload endpoint - bypasses presigned URL to avoid runtime crashes.
   * Uses streaming upload to handle large files and avoid GCS client cleanup issues.
   */
  app.post("/api/uploads/direct", async (req: Request, res) => {
    try {
      const contentType = req.headers['content-type'] || 'application/octet-stream';
      const fileName = decodeURIComponent(req.headers['x-file-name'] as string || 'upload');
      const fileSize = parseInt(req.headers['content-length'] || '0', 10);
      
      if (!req.rawBody) {
        return res.status(400).json({ error: "No file data received" });
      }

      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const objectId = randomUUID();
      const fullPath = `${privateObjectDir}/uploads/${objectId}`;
      
      const pathParts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join('/');
      
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      const objectPath = `/objects/uploads/${objectId}`;
      
      // Use streaming upload with explicit end handling
      const writeStream = file.createWriteStream({
        contentType,
        metadata: {
          metadata: {
            originalName: fileName,
          },
        },
        resumable: false,
      });
      
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
          resolve();
        });
        writeStream.on('error', (err) => {
          reject(err);
        });
        writeStream.end(req.rawBody as Buffer);
      });
      
      // Send response immediately before any cleanup occurs
      res.json({
        objectPath,
        metadata: { name: fileName, size: fileSize, contentType },
      });
    } catch (error) {
      console.error("[direct-upload] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to upload file" });
      }
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


import type { Express, Request } from "express";
import express from "express";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "documents");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const objectId = randomUUID();
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${objectId}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

/**
 * Register file upload routes - uses local filesystem only.
 */
export function registerObjectStorageRoutes(app: Express): void {

  /**
   * Multipart form file upload endpoint - stores files on local filesystem.
   */
  app.post("/api/uploads/file", upload.single('file'), (req: Request, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const objectPath = `/uploads/documents/${file.filename}`;
      
      res.json({
        objectPath,
        metadata: { 
          name: file.originalname, 
          size: file.size, 
          contentType: file.mimetype 
        },
      });
    } catch (error) {
      console.error("[file-upload] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to upload file" });
      }
    }
  });

  // Use express.static for robust file serving (for inline viewing)
  app.use("/uploads/documents", express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      }
    }
  }));

  // Download endpoint with proper filename from database
  app.get("/api/download/*", async (req: Request, res) => {
    try {
      const filePath = "/" + req.params[0];
      
      // Import storage to look up document name
      const { storage } = await import("../../storage");
      const document = await storage.getProjectDocumentByFileUrl(filePath);
      
      if (document) {
        const filename = encodeURIComponent(document.name);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      
      // Serve the file from local uploads
      if (filePath.startsWith('/uploads/documents/')) {
        const localPath = path.join(UPLOADS_DIR, path.basename(filePath));
        const ext = path.extname(localPath).toLowerCase();
        if (ext === '.pdf') {
          res.setHeader('Content-Type', 'application/pdf');
        }
        return res.sendFile(localPath);
      }
      
      res.status(404).json({ error: "File not found" });
    } catch (error) {
      console.error("[download] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download file" });
      }
    }
  });
}

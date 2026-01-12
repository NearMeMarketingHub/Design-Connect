import type { Express, Request } from "express";
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
}

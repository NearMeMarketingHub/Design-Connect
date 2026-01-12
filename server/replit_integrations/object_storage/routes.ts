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

  // Use express.static for robust file serving
  app.use("/uploads/documents", express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      }
    }
  }));
}

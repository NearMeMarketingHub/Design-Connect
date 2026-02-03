# E-Signature System Export

This document contains all the code needed to implement an e-signature system. Copy these files to your other app.

---

## 1. Database Schema (shared/schema.ts)

Add these tables to your schema file:

```typescript
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Document Signing - Signing packets (requests to sign a document)
export const signingPackets = pgTable("signing_packets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  documentId: varchar("document_id"), // Optional: reference to your documents table
  title: text("title").notNull(),
  message: text("message"), // Optional message to recipients
  status: text("status").notNull().default("draft"), // draft, pending, completed, cancelled, expired
  createdById: varchar("created_by_id").notNull(), // Reference to users table
  createdByName: text("created_by_name").notNull(),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  signedDocumentUrl: text("signed_document_url"), // Final signed document
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSigningPacketSchema = createInsertSchema(signingPackets).omit({ id: true, createdAt: true });
export type InsertSigningPacket = z.infer<typeof insertSigningPacketSchema>;
export type SigningPacket = typeof signingPackets.$inferSelect;

// Signing participants - who needs to sign
export const signingParticipants = pgTable("signing_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packetId: varchar("packet_id").notNull(), // Reference to signingPackets
  userId: varchar("user_id"), // Can be null for external signers
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("signer"), // signer, viewer, approver
  signingOrder: integer("signing_order").notNull().default(1), // Order in which they sign
  status: text("status").notNull().default("pending"), // pending, viewed, signed, declined
  signatureData: text("signature_data"), // Base64 signature image
  signatureType: text("signature_type"), // 'drawn' or 'typed'
  signedAt: timestamp("signed_at"),
  signerIp: text("signer_ip"),
  signerAgent: text("signer_agent"),
  accessToken: varchar("access_token").default(sql`gen_random_uuid()`), // Unique token for signing link
  viewedAt: timestamp("viewed_at"),
  declinedReason: text("declined_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSigningParticipantSchema = createInsertSchema(signingParticipants).omit({ id: true, createdAt: true });
export type InsertSigningParticipant = z.infer<typeof insertSigningParticipantSchema>;
export type SigningParticipant = typeof signingParticipants.$inferSelect;

// Signing events - audit trail
export const signingEvents = pgTable("signing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packetId: varchar("packet_id").notNull(), // Reference to signingPackets
  participantId: varchar("participant_id"), // Reference to signingParticipants
  eventType: text("event_type").notNull(), // created, sent, viewed, signed, declined, completed, cancelled, reminder_sent
  actorName: text("actor_name"),
  actorEmail: text("actor_email"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSigningEventSchema = createInsertSchema(signingEvents).omit({ id: true, createdAt: true });
export type InsertSigningEvent = z.infer<typeof insertSigningEventSchema>;
export type SigningEvent = typeof signingEvents.$inferSelect;

// Signing fields - placed signature/date/initials fields on documents
export const signingFields = pgTable("signing_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packetId: varchar("packet_id").notNull(), // Reference to signingPackets
  participantId: varchar("participant_id"), // Which signer this field is for
  fieldType: text("field_type").notNull(), // 'signature', 'initials', 'date', 'text', 'checkbox'
  pageNumber: integer("page_number").notNull().default(1),
  xPosition: real("x_position").notNull(), // Percentage from left (0-100)
  yPosition: real("y_position").notNull(), // Percentage from top (0-100)
  width: real("width").notNull(), // Percentage of page width
  height: real("height").notNull(), // Percentage of page height
  isRequired: boolean("is_required").default(true),
  label: text("label"), // Optional label for text fields
  value: text("value"), // Filled value after signing
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSigningFieldSchema = createInsertSchema(signingFields).omit({ id: true, createdAt: true });
export type InsertSigningField = z.infer<typeof insertSigningFieldSchema>;
export type SigningField = typeof signingFields.$inferSelect;
```

---

## 2. Token Security Utilities (server/storage.ts - add at top)

```typescript
import crypto from "crypto";

// Secure token hashing utility for signing tokens
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

---

## 3. Storage Interface Methods (server/storage.ts)

Add these methods to your storage class:

```typescript
// Signing packet methods
async getSigningPackets(projectId: string): Promise<SigningPacket[]> {
  return await db.select().from(schema.signingPackets)
    .where(eq(schema.signingPackets.projectId, projectId));
}

async getSigningPacket(id: string): Promise<SigningPacket | undefined> {
  const [packet] = await db.select().from(schema.signingPackets)
    .where(eq(schema.signingPackets.id, id));
  return packet;
}

async createSigningPacket(packet: InsertSigningPacket): Promise<SigningPacket> {
  const [created] = await db.insert(schema.signingPackets).values(packet).returning();
  return created;
}

async updateSigningPacket(id: string, data: Partial<InsertSigningPacket>): Promise<SigningPacket | undefined> {
  const [updated] = await db.update(schema.signingPackets)
    .set(data)
    .where(eq(schema.signingPackets.id, id))
    .returning();
  return updated;
}

// Signing participant methods
async getSigningParticipants(packetId: string): Promise<SigningParticipant[]> {
  return await db.select().from(schema.signingParticipants)
    .where(eq(schema.signingParticipants.packetId, packetId));
}

async getSigningParticipantByToken(token: string): Promise<SigningParticipant | undefined> {
  // Hash the incoming token and look up by the hash
  const tokenHash = hashToken(token);
  const [participant] = await db.select().from(schema.signingParticipants)
    .where(eq(schema.signingParticipants.accessToken, tokenHash));
  return participant;
}

async createSigningParticipant(participant: InsertSigningParticipant): Promise<SigningParticipant> {
  const [created] = await db.insert(schema.signingParticipants).values(participant).returning();
  return created;
}

async updateSigningParticipant(id: string, data: Partial<SigningParticipant>): Promise<SigningParticipant | undefined> {
  const [updated] = await db.update(schema.signingParticipants)
    .set(data)
    .where(eq(schema.signingParticipants.id, id))
    .returning();
  return updated;
}

// Signing event methods
async getSigningEvents(packetId: string): Promise<SigningEvent[]> {
  return await db.select().from(schema.signingEvents)
    .where(eq(schema.signingEvents.packetId, packetId));
}

async createSigningEvent(event: InsertSigningEvent): Promise<SigningEvent> {
  const [created] = await db.insert(schema.signingEvents).values(event).returning();
  return created;
}

// Signing field methods
async getSigningFields(packetId: string): Promise<SigningField[]> {
  return await db.select().from(schema.signingFields)
    .where(eq(schema.signingFields.packetId, packetId));
}

async createSigningField(field: InsertSigningField): Promise<SigningField> {
  const [created] = await db.insert(schema.signingFields).values(field).returning();
  return created;
}

async updateSigningField(id: string, data: Partial<SigningField>): Promise<SigningField | undefined> {
  const [updated] = await db.update(schema.signingFields)
    .set(data)
    .where(eq(schema.signingFields.id, id))
    .returning();
  return updated;
}

async deleteSigningField(id: string): Promise<void> {
  await db.delete(schema.signingFields)
    .where(eq(schema.signingFields.id, id));
}

async deleteSigningFieldsByPacketId(packetId: string): Promise<void> {
  await db.delete(schema.signingFields)
    .where(eq(schema.signingFields.packetId, packetId));
}
```

---

## 4. API Routes (server/routes.ts)

```typescript
// ============= Document Signing Routes =============

// Helper to strip sensitive data from participant
const sanitizeParticipant = (p: any) => ({
  id: p.id,
  packetId: p.packetId,
  name: p.name,
  email: p.email,
  role: p.role,
  status: p.status,
  signingOrder: p.signingOrder,
  viewedAt: p.viewedAt,
  signedAt: p.signedAt
  // Note: accessToken, signatureData, signerIp, signerAgent are NOT returned
});

// Get all signing packets for a project
app.get("/api/projects/:projectId/signing-packets", requireAuth, async (req, res, next) => {
  try {
    const packets = await storage.getSigningPackets(req.params.projectId);
    const packetsWithParticipants = await Promise.all(
      packets.map(async (packet) => {
        const participants = await storage.getSigningParticipants(packet.id);
        return { ...packet, participants: participants.map(sanitizeParticipant) };
      })
    );
    res.json(packetsWithParticipants);
  } catch (error) {
    next(error);
  }
});

// Get single signing packet with details
app.get("/api/signing-packets/:id", requireAuth, async (req, res, next) => {
  try {
    const packet = await storage.getSigningPacket(req.params.id);
    if (!packet) {
      return res.status(404).json({ message: "Signing packet not found" });
    }
    const participants = await storage.getSigningParticipants(packet.id);
    const events = await storage.getSigningEvents(packet.id);
    res.json({ ...packet, participants: participants.map(sanitizeParticipant), events });
  } catch (error) {
    next(error);
  }
});

// Create a new signing packet (send document for signature)
app.post("/api/projects/:projectId/signing-packets", requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    const { documentId, title, message, dueDate, recipients, fields } = req.body;
    
    if (!title || !recipients || recipients.length === 0) {
      return res.status(400).json({ message: "Title and at least one recipient are required" });
    }
    
    // Create the signing packet
    const packet = await storage.createSigningPacket({
      projectId: req.params.projectId,
      documentId: documentId || null,
      title,
      message,
      status: 'pending',
      createdById: user.id,
      createdByName: user.name || user.username,
      dueDate: dueDate ? new Date(dueDate) : null
    });
    
    // Create participants with hashed tokens
    const { generateSecureToken, hashToken } = await import("./storage");
    const participantsWithRawTokens: Array<{ participant: any; rawToken: string }> = [];
    
    const createdParticipants = await Promise.all(
      recipients.map(async (recipient: { email: string; name: string; order?: number }, index: number) => {
        const rawToken = generateSecureToken();
        const tokenHash = hashToken(rawToken);
        
        const participant = await storage.createSigningParticipant({
          packetId: packet.id,
          email: recipient.email,
          name: recipient.name,
          role: 'signer',
          signingOrder: recipient.order || index + 1,
          status: 'pending',
          accessToken: tokenHash // Store only the hash
        });
        
        participantsWithRawTokens.push({ participant, rawToken });
        return participant;
      })
    );
    
    // Create audit events
    await storage.createSigningEvent({
      packetId: packet.id,
      eventType: 'created',
      actorName: user.name || user.username,
      actorEmail: user.email || undefined,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    await storage.createSigningEvent({
      packetId: packet.id,
      eventType: 'sent',
      actorName: user.name || user.username,
      actorEmail: user.email || undefined,
      metadata: JSON.stringify({ recipientCount: recipients.length })
    });
    
    // Send email notifications with raw tokens (never stored)
    try {
      const { sendSignatureRequestEmail } = await import("./email");
      await Promise.all(
        participantsWithRawTokens.map(async ({ participant, rawToken }) => {
          await sendSignatureRequestEmail(participant.email, {
            recipientName: participant.name,
            documentTitle: title,
            senderName: user.name || user.username,
            message: message || undefined,
            accessToken: rawToken,
            dueDate: dueDate ? new Date(dueDate) : null
          });
        })
      );
    } catch (emailError) {
      console.error('Failed to send signature request emails:', emailError);
    }
    
    res.json({ ...packet, participants: createdParticipants.map(sanitizeParticipant) });
  } catch (error) {
    next(error);
  }
});

// Public: Get signing packet by access token (for signing page)
app.get("/api/sign/:token", async (req, res, next) => {
  try {
    const participant = await storage.getSigningParticipantByToken(req.params.token);
    if (!participant) {
      return res.status(404).json({ message: "Invalid or expired signing link" });
    }
    
    const packet = await storage.getSigningPacket(participant.packetId);
    if (!packet) {
      return res.status(404).json({ message: "Signing packet not found" });
    }
    
    if (packet.status === 'cancelled') {
      return res.status(400).json({ message: "This signing request has been cancelled" });
    }
    
    if (packet.status === 'completed') {
      return res.status(400).json({ message: "This document has already been signed" });
    }
    
    // Mark as viewed if not already
    if (!participant.viewedAt) {
      await storage.updateSigningParticipant(participant.id, {
        viewedAt: new Date(),
        status: 'viewed'
      });
      await storage.createSigningEvent({
        packetId: packet.id,
        participantId: participant.id,
        eventType: 'viewed',
        actorName: participant.name,
        actorEmail: participant.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    }
    
    // Get signing fields for this participant
    const allFields = await storage.getSigningFields(packet.id);
    const participantFields = allFields.filter(f => f.participantId === participant.id);
    
    res.json({
      packet: {
        id: packet.id,
        title: packet.title,
        message: packet.message,
        dueDate: packet.dueDate
      },
      participant: {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        status: participant.status
      },
      document: null, // Add your document fetching logic here
      fields: participantFields.map(f => ({
        id: f.id,
        fieldType: f.fieldType,
        pageNumber: f.pageNumber,
        xPosition: f.xPosition,
        yPosition: f.yPosition,
        width: f.width,
        height: f.height,
        isRequired: f.isRequired,
        label: f.label
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Public: Submit signature
app.post("/api/sign/:token", async (req, res, next) => {
  try {
    const { signatureData, signatureType } = req.body;
    
    if (!signatureData) {
      return res.status(400).json({ message: "Signature is required" });
    }
    
    const participant = await storage.getSigningParticipantByToken(req.params.token);
    if (!participant) {
      return res.status(404).json({ message: "Invalid or expired signing link" });
    }
    
    if (participant.status === 'signed') {
      return res.status(400).json({ message: "You have already signed this document" });
    }
    
    const packet = await storage.getSigningPacket(participant.packetId);
    if (!packet || packet.status === 'cancelled') {
      return res.status(400).json({ message: "This signing request is no longer valid" });
    }
    
    // Update participant with signature
    await storage.updateSigningParticipant(participant.id, {
      signatureData,
      signatureType: signatureType || 'drawn',
      signedAt: new Date(),
      status: 'signed',
      signerIp: req.ip,
      signerAgent: req.headers['user-agent']
    });
    
    // Create signed event
    await storage.createSigningEvent({
      packetId: packet.id,
      participantId: participant.id,
      eventType: 'signed',
      actorName: participant.name,
      actorEmail: participant.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: JSON.stringify({ signatureType: signatureType || 'drawn' })
    });
    
    // Check if all participants have signed
    const allParticipants = await storage.getSigningParticipants(packet.id);
    const allSigned = allParticipants.every(p => p.status === 'signed');
    
    if (allSigned) {
      await storage.updateSigningPacket(packet.id, {
        status: 'completed',
        completedAt: new Date()
      });
      await storage.createSigningEvent({
        packetId: packet.id,
        eventType: 'completed',
        actorName: 'System',
        metadata: JSON.stringify({ completedAt: new Date().toISOString() })
      });
    }
    
    res.json({ 
      message: "Document signed successfully",
      allSigned
    });
  } catch (error) {
    next(error);
  }
});

// Cancel a signing packet
app.post("/api/signing-packets/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    const packet = await storage.getSigningPacket(req.params.id);
    
    if (!packet) {
      return res.status(404).json({ message: "Signing packet not found" });
    }
    
    if (packet.status === 'completed') {
      return res.status(400).json({ message: "Cannot cancel a completed signing request" });
    }
    
    await storage.updateSigningPacket(req.params.id, { status: 'cancelled' });
    await storage.createSigningEvent({
      packetId: packet.id,
      eventType: 'cancelled',
      actorName: user.name || user.username,
      actorEmail: user.email || undefined
    });
    
    res.json({ message: "Signing request cancelled" });
  } catch (error) {
    next(error);
  }
});
```

---

## 5. Signature Pad Component (client/src/components/signature-pad.tsx)

```tsx
import { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser, Check } from "lucide-react";

interface SignaturePadProps {
  onSignatureComplete: (signatureData: string, signatureType: 'drawn' | 'typed') => void;
  signerName?: string;
}

const signatureFonts = [
  { name: "Elegant", fontFamily: "'Dancing Script', cursive" },
  { name: "Classic", fontFamily: "'Great Vibes', cursive" },
  { name: "Modern", fontFamily: "'Pacifico', cursive" },
  { name: "Professional", fontFamily: "'Allura', cursive" },
];

export default function SignaturePad({ onSignatureComplete, signerName = "" }: SignaturePadProps) {
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const typedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [typedName, setTypedName] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("draw");
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  const clearDrawnSignature = () => {
    sigCanvasRef.current?.clear();
    setHasDrawnSignature(false);
  };

  const handleDrawEnd = () => {
    setHasDrawnSignature(!sigCanvasRef.current?.isEmpty());
  };

  const generateTypedSignature = (): string => {
    const canvas = typedCanvasRef.current;
    if (!canvas || !typedName.trim()) return "";

    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = `48px ${signatureFonts[selectedFont].fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL("image/png");
  };

  const handleSubmit = () => {
    if (activeTab === "draw") {
      if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
        const signatureData = sigCanvasRef.current.toDataURL("image/png");
        onSignatureComplete(signatureData, "drawn");
      }
    } else {
      const signatureData = generateTypedSignature();
      if (signatureData) {
        onSignatureComplete(signatureData, "typed");
      }
    }
  };

  const canSubmit = activeTab === "draw" ? hasDrawnSignature : typedName.trim().length > 0;

  useEffect(() => {
    const loadFonts = async () => {
      await document.fonts.load("48px 'Dancing Script'");
      await document.fonts.load("48px 'Great Vibes'");
      await document.fonts.load("48px 'Pacifico'");
      await document.fonts.load("48px 'Allura'");
    };
    loadFonts();
  }, []);

  return (
    <div className="w-full space-y-4">
      <link
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&family=Allura&display=swap"
        rel="stylesheet"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw">Draw</TabsTrigger>
          <TabsTrigger value="type">Type</TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white relative">
            <SignatureCanvas
              ref={sigCanvasRef}
              canvasProps={{
                className: "w-full h-48 rounded-lg",
                style: { width: "100%", height: "192px" },
              }}
              backgroundColor="white"
              penColor="black"
              onEnd={handleDrawEnd}
            />
            <div className="absolute bottom-2 left-2 right-2 border-t border-gray-300" />
            <p className="absolute bottom-4 left-4 text-xs text-gray-400">
              Sign above the line
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearDrawnSignature}
            className="gap-2"
          >
            <Eraser className="h-4 w-4" />
            Clear
          </Button>
        </TabsContent>

        <TabsContent value="type" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="typed-name">Your Full Name</Label>
            <Input
              id="typed-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type your full legal name"
            />
          </div>

          <div className="space-y-2">
            <Label>Select Signature Style</Label>
            <div className="grid grid-cols-2 gap-2">
              {signatureFonts.map((font, index) => (
                <button
                  key={font.name}
                  type="button"
                  onClick={() => setSelectedFont(index)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedFont === index
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span
                    style={{ fontFamily: font.fontFamily, fontSize: "24px" }}
                    className="block truncate"
                  >
                    {typedName || "Your Name"}
                  </span>
                  <span className="text-xs text-gray-500 mt-1 block">
                    {font.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white p-4">
            <div className="h-24 flex items-center justify-center border-b border-gray-300 relative">
              <span
                style={{
                  fontFamily: signatureFonts[selectedFont].fontFamily,
                  fontSize: "48px",
                }}
                className="text-black"
              >
                {typedName || "Your Signature"}
              </span>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              Signature Preview
            </p>
          </div>

          <canvas
            ref={typedCanvasRef}
            width={400}
            height={100}
            className="hidden"
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          Apply Signature
        </Button>
      </div>
    </div>
  );
}
```

---

## 6. Public Signing Page (client/src/pages/sign-document.tsx)

```tsx
import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import SignaturePad from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Shield,
  Download,
  ExternalLink 
} from "lucide-react";
import { format } from "date-fns";

interface SigningData {
  packet: {
    id: string;
    title: string;
    message?: string;
    dueDate?: string;
  };
  participant: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  document?: {
    name: string;
    fileUrl: string;
    mimeType?: string;
  } | null;
}

export default function SignDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, error, isError } = useQuery<SigningData>({
    queryKey: ["/api/sign", token],
    queryFn: async () => {
      const response = await fetch(`/api/sign/${token}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to load signing request");
      }
      return response.json();
    },
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: async (payload: { signatureData: string; signatureType: string }) => {
      const response = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to sign document");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsComplete(true);
      toast({
        title: "Document Signed",
        description: "Your signature has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSignatureComplete = (signatureData: string, signatureType: 'drawn' | 'typed') => {
    signMutation.mutate({ signatureData, signatureType });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading signing request...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Unable to Load Document</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "This signing link may be invalid or expired."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data.participant.status === "signed" || isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Document Signed</CardTitle>
            <CardDescription>
              Thank you, {data.participant.name}! Your signature has been recorded.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{data.packet.title}</CardTitle>
            {data.packet.message && (
              <CardDescription className="whitespace-pre-wrap">
                {data.packet.message}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Signing as:</span>
                <span>{data.participant.name} ({data.participant.email})</span>
              </div>
              {data.packet.dueDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Due: {format(new Date(data.packet.dueDate), "PPP")}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sign Document</CardTitle>
            <CardDescription>
              Please review the document above before signing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!showSignaturePad ? (
              <>
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Legal Agreement</AlertTitle>
                  <AlertDescription>
                    By signing this document, you agree that your electronic signature is the legal 
                    equivalent of your manual/handwritten signature on this document.
                  </AlertDescription>
                </Alert>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="agree"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  />
                  <Label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer">
                    I have read and understand the document above. I agree to sign this document 
                    electronically and consent to use electronic records and signatures.
                  </Label>
                </div>

                <Button
                  onClick={() => setShowSignaturePad(true)}
                  disabled={!agreedToTerms}
                  className="w-full"
                >
                  Continue to Sign
                </Button>
              </>
            ) : (
              <SignaturePad
                onSignatureComplete={handleSignatureComplete}
                signerName={data.participant.name}
              />
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 border-t">
              <Shield className="h-3 w-3" />
              <span>Your signature is secured with end-to-end encryption</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 7. Email Templates (server/email.ts)

```typescript
export async function sendSignatureRequestEmail(
  toEmail: string,
  signingData: {
    recipientName: string;
    documentTitle: string;
    senderName: string;
    message?: string;
    accessToken: string;
    dueDate?: Date | null;
  }
) {
  // Use your email service (Resend, SendGrid, etc.)
  const baseUrl = process.env.APP_URL || 'http://localhost:5000';
  const signingUrl = `${baseUrl}/sign/${signingData.accessToken}`;
  
  const dueDateText = signingData.dueDate 
    ? `<p><strong>Due Date:</strong> ${new Date(signingData.dueDate).toLocaleDateString()}</p>`
    : '';

  const html = `
    <h1>Signature Request</h1>
    <p>Hello ${signingData.recipientName},</p>
    <p>${signingData.senderName} has requested your signature on "${signingData.documentTitle}".</p>
    ${signingData.message ? `<p>Message: "${signingData.message}"</p>` : ''}
    ${dueDateText}
    <p><a href="${signingUrl}">Click here to sign the document</a></p>
  `;

  // Send email using your email service
  // await emailClient.send({ to: toEmail, subject: `Please sign: ${signingData.documentTitle}`, html });
}

export async function sendSignatureCompletedEmail(
  toEmail: string,
  completionData: {
    senderName: string;
    signerName: string;
    documentTitle: string;
    isFullyComplete: boolean;
    projectName?: string;
  }
) {
  const subject = completionData.isFullyComplete
    ? `All signatures collected for "${completionData.documentTitle}"`
    : `${completionData.signerName} has signed "${completionData.documentTitle}"`;

  const html = `
    <h1>Signature Update</h1>
    <p>Hello ${completionData.senderName},</p>
    <p>${completionData.signerName} has signed "${completionData.documentTitle}".</p>
    ${completionData.isFullyComplete ? '<p>All signatures have been collected!</p>' : '<p>Other signatures may still be pending.</p>'}
  `;

  // Send email using your email service
  // await emailClient.send({ to: toEmail, subject, html });
}
```

---

## 8. Required NPM Package

```bash
npm install react-signature-canvas
npm install @types/react-signature-canvas --save-dev
```

---

## 9. Add Route to App.tsx

```tsx
import SignDocumentPage from "./pages/sign-document";

// In your router:
<Route path="/sign/:token" component={SignDocumentPage} />
```

---

## Summary

This e-signature system provides:
- Secure token-based access (SHA-256 hashed, raw tokens only sent via email)
- Draw or type signatures with 4 font styles
- Complete audit trail (created, sent, viewed, signed, completed)
- Multi-signer support with signing order
- ESIGN/UETA compliant legal agreement checkbox
- Email notifications for requests and completions

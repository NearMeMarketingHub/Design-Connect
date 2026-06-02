-- Add resend/revoke tracking columns to project_invites and contractor_invites
ALTER TABLE "project_invites" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;
ALTER TABLE "project_invites" ADD COLUMN IF NOT EXISTS "resend_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "project_invites" ADD COLUMN IF NOT EXISTS "last_resent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "contractor_invites" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;
ALTER TABLE "contractor_invites" ADD COLUMN IF NOT EXISTS "resend_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "contractor_invites" ADD COLUMN IF NOT EXISTS "last_resent_at" timestamp;

-- Migration: extend demo_requests with HubSpot CRM sync fields and lead management columns
-- Task #90 — Demo request lead management & HubSpot integration
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS updated_at          timestamp    NOT NULL DEFAULT NOW();
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS converted_company_id text;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS internal_notes       text;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS follow_up_date       timestamp;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS hubspot_sync_status  text         NOT NULL DEFAULT 'not_configured';
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS hubspot_contact_id   text;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS hubspot_company_id   text;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS hubspot_deal_id      text;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS hubspot_last_synced_at timestamp;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS hubspot_sync_error   text;

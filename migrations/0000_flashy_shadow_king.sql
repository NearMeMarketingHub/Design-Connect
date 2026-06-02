CREATE TABLE "action_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"assigned_to" text,
	"due_date" text,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"company_id" varchar
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"item_type" text NOT NULL,
	"description" text NOT NULL,
	"unit_type" text NOT NULL,
	"cost" numeric DEFAULT '0',
	"burdens" numeric DEFAULT '0',
	"material_fee" numeric DEFAULT '0',
	"labor_rate" numeric DEFAULT '0',
	"sub_rate" numeric DEFAULT '0',
	"retail_price" numeric DEFAULT '0',
	"notes" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"company_id" varchar
);
--> statement-breakpoint
CREATE TABLE "change_order_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_order_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric NOT NULL,
	"unit" text NOT NULL,
	"rate" numeric NOT NULL,
	"amount" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"order_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reason" text NOT NULL,
	"cost_impact" numeric DEFAULT '0' NOT NULL,
	"timeline_impact" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_id" varchar NOT NULL,
	"created_by_name" text NOT NULL,
	"approved_by_id" varchar,
	"approved_by_name" text,
	"approved_at" timestamp,
	"rejection_reason" text,
	"signing_packet_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" text NOT NULL,
	"sender_avatar" text,
	"content" text NOT NULL,
	"attachment_type" text,
	"attachment_url" text,
	"attachment_name" text,
	"reply_to_image_url" text,
	"reply_to_image_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"type" text DEFAULT 'direct' NOT NULL,
	"title" text,
	"created_by_id" varchar,
	"last_message_at" timestamp,
	"last_message_preview" text,
	"last_message_sender_id" varchar,
	"last_message_sender_name" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_material_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"due_date" text,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"completed_by_id" varchar,
	"completed_by_name" text,
	"created_by_id" varchar NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"owner_id" varchar,
	"subscription_status" text DEFAULT 'trialing',
	"trial_started_at" timestamp,
	"billing_type" text DEFAULT 'manual',
	"monthly_price" numeric(10, 2),
	"trial_ends_at" timestamp,
	"prepaid_through_date" timestamp,
	"billing_notes" text,
	"admin_notes" text,
	"access_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"role_definition_id" varchar,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"company_id" varchar,
	"email" text NOT NULL,
	"company_name" text,
	"company_type" text,
	"contractor_type" text,
	"subcontractor_specialty" text,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" varchar,
	"accepted_user_id" varchar,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"last_resent_at" timestamp,
	"permissions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contractor_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "contractor_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"caption" text,
	"cover_image" text NOT NULL,
	"images" text[] NOT NULL,
	"creator_id" varchar,
	"creator_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"username" text NOT NULL,
	"company_name" text NOT NULL,
	"company_type" text NOT NULL,
	"email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" varchar
);
--> statement-breakpoint
CREATE TABLE "contractor_role_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_by_admin_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"converted_company_id" text,
	"internal_notes" text,
	"follow_up_date" timestamp,
	"hubspot_sync_status" text DEFAULT 'not_configured' NOT NULL,
	"hubspot_contact_id" text,
	"hubspot_company_id" text,
	"hubspot_deal_id" text,
	"hubspot_last_synced_at" timestamp,
	"hubspot_sync_error" text
);
--> statement-breakpoint
CREATE TABLE "estimate_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" varchar NOT NULL,
	"category" text NOT NULL,
	"item" text NOT NULL,
	"quantity" numeric NOT NULL,
	"unit" text NOT NULL,
	"rate" numeric NOT NULL,
	"total" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_id" text NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text NOT NULL,
	"amount" numeric NOT NULL,
	"status" text NOT NULL,
	"date" text NOT NULL,
	"project_id" varchar
);
--> statement-breakpoint
CREATE TABLE "inspiration_images" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"image_url" text NOT NULL,
	"cover_image" text,
	"images" text[],
	"title" text DEFAULT '' NOT NULL,
	"caption" text,
	"category" text,
	"creator_id" varchar,
	"creator_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric NOT NULL,
	"rate" numeric NOT NULL,
	"amount" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_id" text NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text NOT NULL,
	"amount" numeric NOT NULL,
	"due_date" text NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"project_id" varchar
);
--> statement-breakpoint
CREATE TABLE "message_reads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" text NOT NULL,
	"sender_avatar" text,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"attachment_type" text,
	"attachment_url" text,
	"attachment_name" text,
	"reply_to_id" varchar,
	"reply_to_sender" text,
	"reply_to_content" text,
	"reply_to_image_url" text,
	"reply_to_image_title" text,
	"is_system" boolean DEFAULT false,
	"read_at" timestamp,
	"edited_at" timestamp,
	"is_deleted" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "milestone_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"requires_percentage" boolean DEFAULT false NOT NULL,
	"progress_percent" integer DEFAULT 0,
	"is_complete" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"due_date" text
);
--> statement-breakpoint
CREATE TABLE "notary_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company_name" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"notes" text,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "phase_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_by" varchar,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"default_trial_days" integer DEFAULT 7 NOT NULL,
	"manual_billing_enabled" boolean DEFAULT true NOT NULL,
	"free_access_enabled" boolean DEFAULT false NOT NULL,
	"prepaid_access_enabled" boolean DEFAULT false NOT NULL,
	"default_monthly_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar,
	"user_name" text NOT NULL,
	"user_avatar" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar,
	"user_name" text NOT NULL,
	"reaction_type" text DEFAULT 'like' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"caption" text,
	"cover_image" text NOT NULL,
	"images" text[] NOT NULL,
	"creator_id" varchar,
	"creator_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by_id" varchar,
	"uploaded_by_name" text NOT NULL,
	"requires_signature" boolean DEFAULT false,
	"signature_status" text,
	"final_document_type" text,
	"pending_packet_id" varchar,
	"requires_notarization" boolean DEFAULT false,
	"notarization_status" text,
	"notarization_due_date" text,
	"notarization_rejection_reason" text,
	"notary_profile_id" varchar,
	"notarized_file_url" text,
	"notarized_uploaded_by_id" varchar,
	"notarized_uploaded_by_name" text,
	"notarized_uploaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"client_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" varchar,
	"invited_user_id" varchar,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"last_resent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"date_range" text NOT NULL,
	"tasks" text[] NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"due_date" text
);
--> statement-breakpoint
CREATE TABLE "project_team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"role" text,
	"is_project_lead" boolean DEFAULT false,
	"added_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"permissions" jsonb DEFAULT '{"canViewDocuments":true,"canUploadDocuments":false,"canViewBudget":false,"canViewMessages":true,"canPostMessages":false,"canViewEstimates":false}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"status" text NOT NULL,
	"phase" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"budget_status" text,
	"next_milestone" text,
	"due_date" text,
	"description" text,
	"image" text,
	"type" text,
	"budget" numeric,
	"client_id" varchar,
	"contractor_id" varchar,
	"is_sandbox" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recurring_billing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_id" text NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text NOT NULL,
	"amount" numeric NOT NULL,
	"frequency" text NOT NULL,
	"next_run_date" text NOT NULL,
	"status" text NOT NULL,
	"project_id" varchar
);
--> statement-breakpoint
CREATE TABLE "signing_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" varchar NOT NULL,
	"participant_id" varchar,
	"event_type" text NOT NULL,
	"actor_name" text,
	"actor_email" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" varchar NOT NULL,
	"participant_id" varchar,
	"field_type" text NOT NULL,
	"page_number" integer DEFAULT 1 NOT NULL,
	"x_position" real NOT NULL,
	"y_position" real NOT NULL,
	"width" real NOT NULL,
	"height" real NOT NULL,
	"is_required" boolean DEFAULT true,
	"label" text,
	"value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_packets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"document_id" varchar,
	"title" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" varchar NOT NULL,
	"created_by_name" text NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"signed_document_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" varchar NOT NULL,
	"user_id" varchar,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'signer' NOT NULL,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signature_data" text,
	"signature_type" text,
	"signed_at" timestamp,
	"signer_ip" text,
	"signer_agent" text,
	"access_token" varchar DEFAULT gen_random_uuid(),
	"viewed_at" timestamp,
	"declined_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password" text NOT NULL,
	"role" text DEFAULT 'client' NOT NULL,
	"name" text,
	"phone" text,
	"company_name" text,
	"company_type" text,
	"profile_picture" text,
	"is_sandbox" boolean DEFAULT false,
	"is_approved" boolean DEFAULT true,
	"company_id" varchar,
	"contractor_type" text,
	"is_company_admin" boolean DEFAULT false,
	"subcontractor_specialty" text,
	"is_disabled" boolean DEFAULT false,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_line_items" ADD CONSTRAINT "change_order_line_items_change_order_id_change_orders_id_fk" FOREIGN KEY ("change_order_id") REFERENCES "public"."change_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_signing_packet_id_signing_packets_id_fk" FOREIGN KEY ("signing_packet_id") REFERENCES "public"."signing_packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_last_message_sender_id_users_id_fk" FOREIGN KEY ("last_message_sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_material_items" ADD CONSTRAINT "client_material_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_material_items" ADD CONSTRAINT "client_material_items_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_material_items" ADD CONSTRAINT "client_material_items_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_invites" ADD CONSTRAINT "contractor_invites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_invites" ADD CONSTRAINT "contractor_invites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_invites" ADD CONSTRAINT "contractor_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_invites" ADD CONSTRAINT "contractor_invites_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_requests" ADD CONSTRAINT "contractor_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspiration_images" ADD CONSTRAINT "inspiration_images_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_tasks" ADD CONSTRAINT "milestone_tasks_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_tasks" ADD CONSTRAINT "milestone_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_profiles" ADD CONSTRAINT "notary_profiles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_updates" ADD CONSTRAINT "phase_updates_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_updates" ADD CONSTRAINT "phase_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_notary_profile_id_notary_profiles_id_fk" FOREIGN KEY ("notary_profile_id") REFERENCES "public"."notary_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_members" ADD CONSTRAINT "project_team_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_members" ADD CONSTRAINT "project_team_members_contractor_id_users_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_members" ADD CONSTRAINT "project_team_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_contractor_id_users_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_billing" ADD CONSTRAINT "recurring_billing_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_events" ADD CONSTRAINT "signing_events_packet_id_signing_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."signing_packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_events" ADD CONSTRAINT "signing_events_participant_id_signing_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."signing_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_fields" ADD CONSTRAINT "signing_fields_packet_id_signing_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."signing_packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_fields" ADD CONSTRAINT "signing_fields_participant_id_signing_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."signing_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_packets" ADD CONSTRAINT "signing_packets_document_id_project_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_packets" ADD CONSTRAINT "signing_packets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_participants" ADD CONSTRAINT "signing_participants_packet_id_signing_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."signing_packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_participants" ADD CONSTRAINT "signing_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
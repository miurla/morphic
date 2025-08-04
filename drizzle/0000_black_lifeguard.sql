CREATE TABLE "chats" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"visibility" varchar(256) DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"chat_id" varchar(191) NOT NULL,
	"role" varchar(256) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"message_id" varchar(191) NOT NULL,
	"order" integer NOT NULL,
	"type" varchar(256) NOT NULL,
	"text_text" text,
	"reasoning_text" text,
	"file_media_type" varchar(256),
	"file_filename" varchar(1024),
	"file_url" text,
	"source_url_source_id" varchar(256),
	"source_url_url" text,
	"source_url_title" text,
	"source_document_source_id" varchar(256),
	"source_document_media_type" varchar(256),
	"source_document_title" text,
	"source_document_filename" varchar(1024),
	"source_document_url" text,
	"source_document_snippet" text,
	"tool_tool_call_id" varchar(256),
	"tool_state" varchar(256),
	"tool_error_text" text,
	"tool_search_input" json,
	"tool_search_output" json,
	"tool_fetch_input" json,
	"tool_fetch_output" json,
	"tool_question_input" json,
	"tool_question_output" json,
	"tool_todoWrite_input" json,
	"tool_todoWrite_output" json,
	"tool_todoRead_input" json,
	"tool_todoRead_output" json,
	"tool_dynamic_input" json,
	"tool_dynamic_output" json,
	"tool_dynamic_name" varchar(256),
	"tool_dynamic_type" varchar(256),
	"data_prefix" varchar(256),
	"data_content" json,
	"data_id" varchar(256),
	"provider_metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "text_text_required" CHECK ((type != 'text' OR text_text IS NOT NULL)),
	CONSTRAINT "reasoning_text_required" CHECK ((type != 'reasoning' OR reasoning_text IS NOT NULL)),
	CONSTRAINT "file_fields_required" CHECK ((type != 'file' OR (file_media_type IS NOT NULL AND file_filename IS NOT NULL AND file_url IS NOT NULL))),
	CONSTRAINT "tool_state_valid" CHECK ((tool_state IS NULL OR tool_state IN ('input-streaming', 'input-available', 'output-available', 'output-error'))),
	CONSTRAINT "tool_fields_required" CHECK ((type NOT LIKE 'tool-%' OR (tool_tool_call_id IS NOT NULL AND tool_state IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_chat_id_idx" ON "messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "messages_chat_id_created_at_idx" ON "messages" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "parts_message_id_idx" ON "parts" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "parts_message_id_order_idx" ON "parts" USING btree ("message_id","order");
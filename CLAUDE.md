# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application called "ChatGuru Atool" - a batch import tool for adding WhatsApp chats to the ChatGuru CRM system. The project is currently in initial setup phase with comprehensive specifications in the `ChatGuru Atool Docs/` folder.

## Key Commands

```bash
# Development (with Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## Architecture & Implementation Requirements

### Core Functionality
The application implements a batch chat import system for ChatGuru with these key constraints:
- **Hard rate limit**: 1 request per minute per workspace (no user configuration)
- **Target throughput**: ~10 chat additions per 10 minutes
- **Form-encoded requests** to ChatGuru API (`application/x-www-form-urlencoded`)
- **No credential storage**: Credentials stored only in localStorage, never in database

### Tech Stack
- **Next.js 15** with App Router and TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (strict black & white UI only)
- **lucide-react** icons for icon-only sidebar
- **exceljs** for XLSX file operations
- **Supabase** for database (Postgres + Realtime + RLS)
- **Vercel Cron** for processing queue (runs every minute)

### API Integration Pattern

ChatGuru API calls require these fields in every request:
- `key`, `account_id`, `phone_id`, `chat_number` (authentication)
- Base URL: `https://{server}.chatguru.app/api/v1`

Two main actions:
1. **chat_add**: Creates a chat (returns `chat_add_id`)
2. **chat_add_status**: Checks creation status using `chat_add_id`

Important: When `text` field is empty/null, send a single space `" "` instead.

### Security Model

Uses workspace-based isolation without storing credentials:
1. Client computes: `workspace_hash = sha256(server + key + account_id + phone_id)`
2. Hash included in all API requests as header
3. Server sets Postgres `app.workspace_hash` for RLS enforcement
4. Multiple users with same credentials see same jobs via Realtime

### Database Schema

Located in `ChatGuru Atool Docs/Supabase_Schema.sql`:
- `workspaces`: Tracks rate limiting (`last_outbound_at`)
- `uploads`: Job metadata
- `upload_items`: Individual chat items with states
- `run_logs`: Execution logs
- All tables use RLS based on `workspace_hash`

### API Routes to Implement

As specified in `ChatGuru Atool Docs/API_Routes_Spec.md`:
- `POST /api/template.xlsx` - Generate XLSX template
- `POST /api/uploads` - Upload and parse XLSX
- `GET /api/uploads/:id` - Get upload status
- `POST /api/uploads/:id/retry-failed` - Retry failed items
- `GET /api/uploads/:id/failures.xlsx` - Export failures
- `POST /api/jobs/tick` - Cron job processor (1 req/min enforcement)
- `POST /api/cleanup/daily` - Delete data older than 30 days
- `GET /health` - Health check endpoint

### UI Requirements

From `ChatGuru Atool Docs/UX_Wireframe.md`:
- **Strict black & white design** (no colors allowed)
- **Icon-only left sidebar** (like ChatGPT)
- Copy in Portuguese (PT-BR)
- Pages: `/tools/add-chats` and `/tools/add-chats/[uploadId]`

### Implementation Specifications

The complete implementation prompt is in `ChatGuru Atool Docs/Prompt_for_CloudCode.md`. This contains all business logic, validation rules, and technical requirements.

### Environment Variables

Create `.env.local` with:
- Supabase connection details (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- Vercel Cron configuration (`CRON_SECRET`)
- Optional: `MOCK_CHATGURU=true` for local development

## Development Notes

- The project uses Tailwind CSS v4 with PostCSS configuration
- TypeScript is configured with strict mode
- Path alias `@/*` maps to project root
- Currently using Turbopack for faster development builds
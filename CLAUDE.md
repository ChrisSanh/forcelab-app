# CLAUDE.md - ForceLab Architecture & Engineering Rules

## 1. Project Overview
ForceLab is a science-based, multi-tenant strength & hypertrophy SaaS web application (PWA-ready). It supports multiple periodization methodologies (Hybrid Bilbo + Heavy Strength, Pure Bilbo, Daily Undulating Periodization, Linear Progression) and includes a biomechanical audit & predictive analytics engine.

## 2. Tech Stack & Conventions
- **Framework:** Next.js 14+ (App Router), TypeScript (strict mode).
- **Styling:** Tailwind CSS + Shadcn/UI (Lucide icons). Mobile-first dark/clean gym UI.
- **Backend / Auth:** Supabase (`@supabase/ssr` + `@supabase/supabase-js`) with PostgreSQL and strict Row Level Security (RLS).
- **Language Rule:**
  - All code, file names, variables, TypeScript interfaces, database tables/columns, and git commits MUST be in **English**.
  - All user-facing UI text, labels, alerts, and fitness terminology MUST be in **Spanish** (Chilean/neutral Spanish).

## 3. Git Workflow Rules
- **Active Development Branch:** Always work on `develop`. Never commit directly to `main`.
- **Commit Convention:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).

## 4. Directory Structure
```text
/src
  /app
    /(auth)            # Login & Register pages
    /dashboard         # Main progress hub & routine overview
    /onboarding        # Initial profile, PR & methodology setup
    /workout/[day]     # Active mobile-first gym logger
  /components
    /ui                # Shadcn components
    /workout           # Rest timer, set logger cards, RIR selectors
  /lib
    /supabase          # client.ts, server.ts, middleware.ts
    /math
      e1rm.ts          # Hybrid e1RM calculator (Brzycki + high-rep dampening)
    /presets
      defaultSplit.ts  # Pre-configured UP-X-P-P-L template
# BloomieVacation 🌸

Lightweight vacation & leave management tool for teams. Built with Next.js 14, Supabase, and Resend.

## Features

- 🗓️ Multi-project calendar with team visibility
- 🏖️ Annual leave with approval flow + threshold warnings
- 🏥 Sick leave with optional doctor's note upload
- 🕌 Religious holidays (user-selected from global pool, auto-approved)
- 🎉 National holidays (admin-managed, global)
- 👥 Three roles per project: Admin / Lead / Employee
- 📧 Email notifications via Resend
- 📊 Custom thresholds, year reset dates, carry-over policies per project

---

## Setup Guide (10 minutes)

### 1. Prerequisites

- **Node.js 18+** and **npm** installed
- A free **Supabase** account → [supabase.com](https://supabase.com)
- A free **Resend** account → [resend.com](https://resend.com)

### 2. Clone & Install

```bash
cd ~/Desktop/bloomievacation
npm install
```

### 3. Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com) → "New Project"
2. Name it `bloomievacation`, pick a region close to you (Frankfurt for EU)
3. Save your **database password** somewhere safe
4. Wait ~2 minutes for it to provision
5. Once ready, go to **Project Settings → API**, copy:
   - `Project URL` → goes to `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → goes to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (under "Reveal") → goes to `SUPABASE_SERVICE_ROLE_KEY`

### 4. Run the SQL Migration

1. In Supabase dashboard, go to **SQL Editor** → "New query"
2. Open `supabase/migrations/001_initial_schema.sql` from this repo
3. Copy the entire file content, paste into SQL Editor
4. Click "Run". You should see "Success".
5. Open `supabase/seeds/001_seed_admin_and_holidays.sql`, paste, run.

This creates all tables, RLS policies, storage buckets, and seeds:
- The first admin user (`vekaz.hadzic@bloomteq.com`)
- Bosnian national holidays
- Common religious holidays for all major religions

### 5. Create the Admin User in Supabase Auth

The seed creates the user record but the auth credential needs to be created separately:

1. Go to **Authentication → Users** → "Add user" → "Create new user"
2. Email: `vekaz.hadzic@bloomteq.com`
3. Password: `Bloomteq2025!`
4. Check "Auto Confirm User"
5. Click "Create user"

Then in **SQL Editor**, run this to link the auth user to your `users` row:

```sql
UPDATE public.users
SET id = (SELECT id FROM auth.users WHERE email = 'vekaz.hadzic@bloomteq.com')
WHERE email = 'vekaz.hadzic@bloomteq.com';
```

### 6. Setup Storage Buckets

The migration creates buckets, but verify in **Storage**:
- `avatars` (public)
- `project-logos` (public)
- `sick-leave-attachments` (private)

### 7. Setup Resend

1. Go to [resend.com/api-keys](https://resend.com/api-keys) → "Create API Key"
2. Name: `bloomievacation-dev`, permission: "Full access"
3. Copy the key → goes to `RESEND_API_KEY`
4. **For dev**: emails will be sent FROM `onboarding@resend.dev` only TO your verified email
5. **For production**: verify your domain at [resend.com/domains](https://resend.com/domains) and update `EMAIL_FROM` in `.env.local`

### 8. Environment Variables

```bash
cp .env.example .env.local
```

Then fill in `.env.local` with values from steps 3 and 7.

### 9. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in with:
- Email: `vekaz.hadzic@bloomteq.com`
- Password: `Bloomteq2025!`

---

## Project Structure

```
bloomievacation/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Login, signup, invite acceptance
│   │   ├── (dashboard)/        # Authenticated app
│   │   └── api/                # API routes (webhooks, server actions)
│   ├── components/             # React components
│   ├── lib/                    # Supabase clients, email, utils
│   ├── types/                  # TypeScript types
│   └── hooks/                  # Custom React hooks
├── supabase/
│   ├── migrations/             # SQL migrations
│   └── seeds/                  # Seed data
└── emails/                     # React Email templates for Resend
```

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database & Auth**: Supabase (Postgres + RLS)
- **Storage**: Supabase Storage (logos, avatars, attachments)
- **Email**: Resend + React Email
- **UI**: Tailwind CSS + shadcn/ui + Radix primitives
- **Forms**: React Hook Form + Zod
- **Data**: TanStack Query
- **Calendar**: react-day-picker
- **Dates**: date-fns

## Roadmap

- [x] Phase 1: Foundation (DB, auth, layout)
- [ ] Phase 2: Projects & invites
- [ ] Phase 3: Holidays system
- [ ] Phase 4: Leave requests
- [ ] Phase 5: Calendars
- [ ] Phase 6: Notifications
- [ ] Phase 7: Dashboards
- [ ] Phase 8: Carry-over & polish

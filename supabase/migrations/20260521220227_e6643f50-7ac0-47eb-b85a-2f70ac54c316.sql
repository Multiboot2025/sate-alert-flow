
-- 1. Policyholders
create table public.policyholders (
  id uuid primary key default gen_random_uuid(),
  national_id text unique not null,
  full_name text not null,
  date_of_birth date not null,
  email text,
  phone text,
  blood_type text,
  created_at timestamptz not null default now()
);

-- 2. Policies
create table public.policies (
  id uuid primary key default gen_random_uuid(),
  policy_number text unique not null,
  policyholder_id uuid references public.policyholders(id) on delete cascade,
  plan_type text not null,
  status text not null default 'active',
  coverage_limit numeric(12,2) not null,
  deductible numeric(12,2) not null default 0,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

-- 3. Medical history
create table public.medical_history (
  id uuid primary key default gen_random_uuid(),
  policyholder_id uuid references public.policyholders(id) on delete cascade,
  condition text not null,
  icd10_code text,
  diagnosed_at date,
  is_preexisting boolean default false,
  severity text,
  notes text
);

-- 4. Hospitals
create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  admissions_contact text not null,
  api_key text unique not null,
  created_at timestamptz not null default now()
);

-- 5. Case managers
create table public.case_managers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  specialty text,
  is_on_call boolean default true
);

-- 6. Emergency cases
create table public.emergency_cases (
  id uuid primary key default gen_random_uuid(),
  case_code text unique not null,
  policyholder_id uuid references public.policyholders(id),
  policy_id uuid references public.policies(id),
  hospital_id uuid references public.hospitals(id),
  assigned_manager_id uuid references public.case_managers(id),
  admitted_at timestamptz not null default now(),
  chief_complaint text not null,
  triage_level int,
  vital_signs jsonb,
  policy_validation_status text,
  policy_validation_notes text,
  risk_score int,
  risk_level text,
  risk_analysis jsonb,
  ai_engine text,
  status text default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.emergency_cases(id) on delete cascade,
  recipient_type text not null,
  recipient_name text not null,
  channel text not null,
  subject text,
  body text not null,
  status text default 'sent',
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

-- 8. Webhook logs
create table public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id),
  payload jsonb not null,
  response jsonb,
  status_code int,
  processing_time_ms int,
  case_id uuid references public.emergency_cases(id),
  received_at timestamptz not null default now()
);

-- Sequence for case codes
create sequence public.case_code_seq start 1;

-- Auto-update updated_at on emergency_cases
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger emergency_cases_touch
before update on public.emergency_cases
for each row execute function public.touch_updated_at();

-- Enable RLS
alter table public.policyholders enable row level security;
alter table public.policies enable row level security;
alter table public.medical_history enable row level security;
alter table public.hospitals enable row level security;
alter table public.case_managers enable row level security;
alter table public.emergency_cases enable row level security;
alter table public.notifications enable row level security;
alter table public.webhook_logs enable row level security;

-- Policies: authenticated users can read everything (insurer-internal app)
create policy "auth read policyholders" on public.policyholders for select to authenticated using (true);
create policy "auth read policies" on public.policies for select to authenticated using (true);
create policy "auth read medical_history" on public.medical_history for select to authenticated using (true);
create policy "auth read hospitals" on public.hospitals for select to authenticated using (true);
create policy "auth read case_managers" on public.case_managers for select to authenticated using (true);
create policy "auth read emergency_cases" on public.emergency_cases for select to authenticated using (true);
create policy "auth read notifications" on public.notifications for select to authenticated using (true);
create policy "auth read webhook_logs" on public.webhook_logs for select to authenticated using (true);

-- Allow authenticated users to update emergency cases (status changes by case managers)
create policy "auth update emergency_cases" on public.emergency_cases for update to authenticated using (true) with check (true);

-- Allow authenticated users to manage hospitals + case_managers (settings page)
create policy "auth insert hospitals" on public.hospitals for insert to authenticated with check (true);
create policy "auth update hospitals" on public.hospitals for update to authenticated using (true) with check (true);
create policy "auth delete hospitals" on public.hospitals for delete to authenticated using (true);

create policy "auth insert case_managers" on public.case_managers for insert to authenticated with check (true);
create policy "auth update case_managers" on public.case_managers for update to authenticated using (true) with check (true);
create policy "auth delete case_managers" on public.case_managers for delete to authenticated using (true);

-- Allow authenticated users to update notifications (mark as read)
create policy "auth update notifications" on public.notifications for update to authenticated using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table public.emergency_cases;
alter publication supabase_realtime add table public.notifications;

create schema if not exists private;
revoke all on schema private from public;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;
create table public.profiles (
 id uuid primary key references auth.users(id), full_name text not null check(length(full_name) between 2 and 160),
 email text not null, phone text, registration text, requested_class text,
 status text not null default 'pending' check(status in ('pending','active','suspended','inactive','blocked')),
 onboarded_at timestamptz, terms_accepted_at timestamptz, last_seen_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.roles (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, description text not null default '',
 level integer not null default 1 check(level between 1 and 100), scope text not null default 'organization' check(scope in ('organization','self')),
 privileged boolean not null default true, active boolean not null default true, archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.permissions (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, module text not null);
create table public.role_permissions (role_id uuid references public.roles(id), permission_id uuid references public.permissions(id), primary key(role_id,permission_id));
create table public.user_roles (user_id uuid references public.profiles(id), role_id uuid references public.roles(id), primary key(user_id,role_id));
create table public.classes (id uuid primary key default gen_random_uuid(), name text not null unique, code text not null unique, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.departments (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.job_positions (id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.managers (id uuid primary key default gen_random_uuid(), full_name text not null, profile_id uuid unique references public.profiles(id), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.employees (
 id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id), full_name text not null check(length(full_name) between 2 and 160), social_name text,
 email text, phone text, registration text not null unique, join_date date not null default current_date,
 class_id uuid references public.classes(id), department_id uuid references public.departments(id), job_position_id uuid references public.job_positions(id), manager_id uuid references public.managers(id),
 expected_arrival time not null default '08:00', expected_departure time not null default '14:00', status text not null default 'active' check(status in ('active','inactive')),
 photo_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 check(expected_departure > expected_arrival)
);
create table public.employee_admin_notes (id uuid primary key default gen_random_uuid(), employee_id uuid not null unique references public.employees(id), notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.course_calendar (
 id uuid primary key default gen_random_uuid(), class_id uuid references public.classes(id), scheduled_date date not null, has_course boolean not null default false,
 kind text not null check(kind in ('holiday','recess','cancelled','replacement','exception','normal')), reason text not null check(length(trim(reason)) >= 3),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique nulls not distinct(class_id,scheduled_date)
);
create table public.attendance_sessions (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id), scheduled_date date not null,
 status text not null default 'editing' check(status in ('editing','finalized','maintenance','closed')),
 original_member_count integer not null default 0, opened_by uuid not null references public.profiles(id), opened_at timestamptz not null default now(),
 finalized_by uuid references public.profiles(id), finalized_at timestamptz, finalization_reason text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, unique(class_id,scheduled_date)
);
create table public.attendance_members (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.attendance_sessions(id), employee_id uuid not null references public.employees(id),
 full_name_snapshot text not null, registration_snapshot text not null, expected_arrival time not null, expected_departure time not null,
 status text not null default 'pending' check(status in ('pending','present','absent','justified','late','early_exit','occurrence')),
 actual_arrival time, actual_departure time, notes text not null default '',
 delay_minutes integer generated always as (greatest(0,(extract(epoch from (actual_arrival-expected_arrival))/60)::integer)) stored,
 early_minutes integer generated always as (greatest(0,(extract(epoch from (expected_departure-actual_departure))/60)::integer)) stored,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(session_id,employee_id), check(status <> 'late' or actual_arrival is not null), check(status <> 'early_exit' or actual_departure is not null)
);
create table public.attendance_maintenance (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.attendance_sessions(id), opened_by uuid not null references public.profiles(id),
 opened_at timestamptz not null default now(), reason text not null check(length(trim(reason)) >= 3), closed_by uuid references public.profiles(id), closed_at timestamptz
);
create unique index one_open_maintenance on public.attendance_maintenance(session_id) where closed_at is null;
create table public.justification_categories (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.absence_justifications (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.attendance_members(id), employee_id uuid not null references public.employees(id), category_id uuid references public.justification_categories(id),
 reason text not null check(length(trim(reason)) >= 3), status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 review_comment text, reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.feedbacks (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id), author_id uuid not null default auth.uid() references public.profiles(id),
 title text not null check(length(title) >= 3), kind text not null check(kind in ('positive','development','alignment','recognition','guidance','formal','other')),
 description text not null, strengths text not null default '', improvements text not null default '', actions text not null default '', due_date date,
 status text not null default 'open' check(status in ('open','following','completed','archived')), released boolean not null default false, allow_response boolean not null default true,
 read_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.feedback_followups (
 id uuid primary key default gen_random_uuid(), feedback_id uuid not null references public.feedbacks(id), author_id uuid not null default auth.uid() references public.profiles(id),
 body text not null check(length(trim(body)) >= 1), created_at timestamptz not null default now()
);
create table public.performance_cycles (
 id uuid primary key default gen_random_uuid(), title text not null, start_date date not null, end_date date not null,
 status text not null default 'draft' check(status in ('draft','scheduled','open','closed','archived')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, check(end_date >= start_date)
);
create table public.performance_criteria (
 id uuid primary key default gen_random_uuid(), name text not null unique, weight numeric not null default 1 check(weight > 0 and weight <= 100), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.performance_reviews (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id), cycle_id uuid not null references public.performance_cycles(id),
 reviewer_id uuid not null default auth.uid() references public.profiles(id), notes text not null default '', released boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, unique(employee_id,cycle_id)
);
create table public.performance_scores (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references public.performance_reviews(id), criterion_id uuid not null references public.performance_criteria(id),
 criterion_name text not null, score numeric not null check(score between 0 and 10), weight numeric not null check(weight > 0 and weight <= 100), unique(review_id,criterion_id)
);
create table public.manager_review_cycles (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '', start_date date not null, end_date date not null,
 status text not null default 'draft' check(status in ('draft','scheduled','open','closed','archived')),
 minimum_responses integer not null default 5 check(minimum_responses >= 5),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, check(end_date >= start_date)
);
create table public.manager_review_criteria (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.manager_cycle_targets (cycle_id uuid references public.manager_review_cycles(id), manager_id uuid references public.managers(id), primary key(cycle_id,manager_id));
create table public.manager_cycle_criteria (cycle_id uuid references public.manager_review_cycles(id), criterion_id uuid references public.manager_review_criteria(id), name_snapshot text not null, primary key(cycle_id,criterion_id));
create table private.manager_review_eligibility (
 cycle_id uuid not null, manager_id uuid not null, user_id uuid not null references public.profiles(id), used boolean not null default false,
 primary key(cycle_id,manager_id,user_id), foreign key(cycle_id,manager_id) references public.manager_cycle_targets(cycle_id,manager_id)
);
create table private.anonymous_manager_reviews (
 id uuid primary key default gen_random_uuid(), cycle_id uuid not null, manager_id uuid not null, scores jsonb not null,
 strengths text not null default '', improvements text not null default '', message text not null default '',
 foreign key(cycle_id,manager_id) references public.manager_cycle_targets(cycle_id,manager_id),
 check(length(strengths) <= 1500 and length(improvements) <= 1500 and length(message) <= 1500)
);
create table public.events (id uuid primary key default gen_random_uuid(), title text not null, event_date date not null, class_id uuid references public.classes(id), description text not null default '', status text not null default 'open' check(status in ('open','completed','cancelled')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), title text not null, body text not null default '', path text not null default '/', read_at timestamptz, created_at timestamptz not null default now());
create table public.reports (id uuid primary key default gen_random_uuid(), title text not null, kind text not null, period_start date not null, period_end date not null, employee_id uuid references public.employees(id), class_id uuid references public.classes(id), created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), check(period_end >= period_start));
create table public.report_exports (id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id), format text not null check(format in ('pdf','pptx','xlsx','csv','png')), path text not null, created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now());
create table public.attachments (
 id uuid primary key default gen_random_uuid(), employee_id uuid references public.employees(id), justification_id uuid references public.absence_justifications(id), feedback_id uuid references public.feedbacks(id),
 bucket text not null check(bucket in ('justifications','medical-certificates','documents','feedback-files','exports','institutional-images')), path text not null unique, filename text not null,
 size_bytes integer not null check(size_bytes between 1 and 10485760), mime_type text not null, created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), archived boolean not null default false
);
create table public.settings (id uuid primary key default gen_random_uuid(), key text not null unique, value jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), event_type text not null default 'data_change', severity text not null default 'info', actor_user_id uuid, actor_name text, actor_roles text[],
 action text not null, module text not null, entity_id uuid, old_values jsonb, new_values jsonb, context jsonb not null default '{}', success boolean not null default true, created_at timestamptz not null default now()
);
create table public.releases (id uuid primary key default gen_random_uuid(), version text not null unique, changes text not null, created_at timestamptz not null default now());
create table private.session_security (session_id uuid primary key, user_id uuid not null references public.profiles(id), verified_until timestamptz, revoked_at timestamptz, created_at timestamptz not null default now());
create table private.otp_challenges (id uuid primary key default gen_random_uuid(), session_id uuid not null, user_id uuid not null references public.profiles(id), code_hash text not null, expires_at timestamptz not null, attempts integer not null default 0, consumed_at timestamptz, created_at timestamptz not null default now());
create index otp_rate_window on private.otp_challenges(user_id,created_at desc);
create index session_security_user on private.session_security(user_id);
create index attendance_members_employee on public.attendance_members(employee_id,session_id);
create index attendance_sessions_date on public.attendance_sessions(scheduled_date desc,class_id);
create index employees_class_status on public.employees(class_id,status,full_name);
create index feedbacks_employee_created on public.feedbacks(employee_id,created_at desc);
create index feedback_followups_parent on public.feedback_followups(feedback_id,created_at);
create index justifications_employee on public.absence_justifications(employee_id,status);
create index justifications_member on public.absence_justifications(member_id);
create index review_scores_parent on public.performance_scores(review_id);
create index performance_reviews_cycle on public.performance_reviews(cycle_id);
create index notification_owner on public.notifications(user_id,created_at desc);
create index audit_created on public.audit_logs(created_at desc);

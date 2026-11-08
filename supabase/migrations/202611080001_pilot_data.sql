create table if not exists public.pilot_participants (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  assigned_group text not null check (assigned_group in ('A', 'B', 'C', 'D')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key,
  participant_id uuid not null references public.pilot_participants(id),
  assigned_group text not null check (assigned_group in ('A', 'B', 'C', 'D')),
  mode text not null check (mode in ('pretest', 'training', 'posttest')),
  app_version text not null check (char_length(app_version) between 1 and 80),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (completed_at is null or completed_at >= started_at)
);

create table if not exists public.study_trials (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  question_number smallint not null check (question_number between 1 and 10),
  reference_midi real not null check (reference_midi between 24 and 96),
  target_midi real not null check (target_midi between 24 and 96),
  target_interval_semitones real not null check (target_interval_semitones between -12.1 and 12.1),
  answer_midi real check (answer_midi between 24 and 96),
  signed_error_semitones real,
  absolute_error_semitones real check (absolute_error_semitones is null or absolute_error_semitones >= 0),
  correct boolean not null,
  skipped boolean not null default false,
  response_time_ms integer not null check (response_time_ms between 0 and 600000),
  target_crossings integer not null check (target_crossings between 0 and 1000),
  reference_crossings integer not null check (reference_crossings between 0 and 1000),
  first_move_ms integer check (first_move_ms is null or first_move_ms between 0 and 600000),
  time_to_target_ms integer check (time_to_target_ms is null or time_to_target_ms between 0 and 600000),
  max_post_target_deviation_cents real check (max_post_target_deviation_cents is null or max_post_target_deviation_cents between 0 and 2400),
  snap_count integer not null check (snap_count between 0 and 1000),
  movement_trace jsonb not null default '[]'::jsonb check (jsonb_typeof(movement_trace) = 'array'),
  saved_at timestamptz not null default now(),
  unique (session_id, question_number)
);

create index if not exists study_sessions_participant_mode_idx
  on public.study_sessions (participant_id, mode, started_at);
create index if not exists study_sessions_group_mode_idx
  on public.study_sessions (assigned_group, mode);
create index if not exists study_trials_session_question_idx
  on public.study_trials (session_id, question_number);

alter table public.pilot_participants enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_trials enable row level security;

-- No browser role can list participants or access raw study records.
-- The Edge Function uses its server-only secret key after validating a code.
revoke all on table public.pilot_participants from public, anon, authenticated;
revoke all on table public.study_sessions from public, anon, authenticated;
revoke all on table public.study_trials from public, anon, authenticated;

-- Classroom study schema. Apply only to a new classroom Supabase project.
-- Attendance numbers and names are intentionally excluded.
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.participant_baseline (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  music_experience_band smallint not null check (music_experience_band between 1 and 3),
  primary_instrument text not null check (primary_instrument in ('none', 'piano_keyboard', 'wind', 'strings', 'guitar_bass', 'percussion', 'other')),
  instrument_experience_years smallint not null check (instrument_experience_years between 0 and 80),
  wind_band_member boolean not null,
  absolute_pitch_self_report text not null check (absolute_pitch_self_report in ('yes', 'no', 'unsure')),
  relative_pitch_self_report text not null check (relative_pitch_self_report in ('yes', 'no', 'unsure')),
  other_pitch_app_experience boolean not null,
  survey_version text not null check (char_length(survey_version) between 1 and 80),
  captured_at timestamptz not null default now()
);

create table public.baseline_knowledge_answers (
  participant_id uuid not null references public.participant_baseline(participant_id) on delete cascade,
  question_code text not null check (question_code in ('q1_do_fa_interval', 'q2_do_mib_interval', 'q3_do_sol_interval')),
  selected_option text not null,
  is_correct boolean not null,
  quiz_version text not null check (char_length(quiz_version) between 1 and 80),
  answered_at timestamptz not null default now(),
  primary key (participant_id, question_code)
);

create table public.randomization_runs (
  id uuid primary key default gen_random_uuid(),
  algorithm_version text not null,
  random_seed text not null,
  strata_definition text not null,
  eligible_count integer not null check (eligible_count >= 0),
  created_at timestamptz not null default now()
);

create table public.randomization_assignments (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  run_id uuid not null references public.randomization_runs(id),
  music_experience_band smallint not null check (music_experience_band between 1 and 3),
  baseline_performance_tertile smallint not null check (baseline_performance_tertile between 1 and 3),
  assigned_group text not null check (assigned_group in ('A', 'B', 'C', 'D')),
  assigned_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key,
  participant_id uuid not null references public.participants(id),
  mode text not null check (mode in ('pretest', 'training', 'posttest')),
  session_number smallint not null check (session_number > 0),
  assessment_wave text not null check (char_length(assessment_wave) between 1 and 80),
  headphone_type text not null check (headphone_type in ('speaker', 'wired', 'bluetooth', 'other')),
  app_version text not null check (char_length(app_version) between 1 and 80),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (participant_id, mode, session_number),
  check (completed_at is null or completed_at >= started_at)
);

create table public.study_trials (
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
  target_replay_count integer not null default 0 check (target_replay_count between 0 and 1000),
  movement_trace jsonb not null default '[]'::jsonb check (jsonb_typeof(movement_trace) = 'array'),
  saved_at timestamptz not null default now(),
  unique (session_id, question_number)
);

create index study_sessions_participant_mode_idx on public.study_sessions (participant_id, mode, session_number);
create index study_trials_session_question_idx on public.study_trials (session_id, question_number);
create index participant_baseline_strata_idx on public.participant_baseline (music_experience_band, participant_id);
create index baseline_knowledge_answers_question_idx on public.baseline_knowledge_answers (question_code, is_correct);
create index assignments_group_idx on public.randomization_assignments (assigned_group, music_experience_band, baseline_performance_tertile);

alter table public.participants enable row level security;
alter table public.participant_baseline enable row level security;
alter table public.baseline_knowledge_answers enable row level security;
alter table public.randomization_runs enable row level security;
alter table public.randomization_assignments enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_trials enable row level security;
revoke all on table public.participants from public, anon, authenticated;
revoke all on table public.participant_baseline from public, anon, authenticated;
revoke all on table public.baseline_knowledge_answers from public, anon, authenticated;
revoke all on table public.randomization_runs from public, anon, authenticated;
revoke all on table public.randomization_assignments from public, anon, authenticated;
revoke all on table public.study_sessions from public, anon, authenticated;
revoke all on table public.study_trials from public, anon, authenticated;

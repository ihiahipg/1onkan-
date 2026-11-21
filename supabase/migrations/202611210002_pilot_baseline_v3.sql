-- Versioned baseline survey: preserve v1/v2 pilot answers unchanged.
create table if not exists public.participant_baseline_v3 (
  participant_id uuid primary key references public.pilot_participants(id) on delete cascade,
  music_experience_duration text not null check (music_experience_duration in ('none', 'under_1', '1_to_3', '3_to_6', '6_plus')),
  music_experience_band smallint not null check (music_experience_band between 1 and 3),
  primary_instrument_family text not null check (primary_instrument_family in (
    'none', 'keyboard', 'woodwind', 'valved_brass', 'slide_brass', 'bowed_strings',
    'fretted_strings', 'pitched_percussion', 'unpitched_percussion', 'other'
  )),
  instrument_pitch_control text not null check (instrument_pitch_control in ('none', 'stepwise', 'continuous', 'unpitched', 'other')),
  wind_band_member boolean not null,
  absolute_pitch_self_report text not null check (absolute_pitch_self_report in ('yes', 'no', 'unsure')),
  other_pitch_app_experience boolean not null,
  relative_pitch_rating smallint not null check (relative_pitch_rating between 1 and 5),
  survey_version text not null check (char_length(survey_version) between 1 and 80),
  captured_at timestamptz not null default now()
);

create table if not exists public.participant_knowledge_answers_v3 (
  participant_id uuid not null references public.pilot_participants(id) on delete cascade,
  question_code text not null check (question_code in ('q1_do_fa_interval', 'q2_do_mib_interval', 'q3_do_sol_interval')),
  selected_option text not null,
  is_correct boolean not null,
  quiz_version text not null check (char_length(quiz_version) between 1 and 80),
  answered_at timestamptz not null default now(),
  primary key (participant_id, question_code)
);

create index if not exists participant_baseline_v3_strata_idx
  on public.participant_baseline_v3 (music_experience_band, primary_instrument_family);
create index if not exists participant_knowledge_answers_v3_question_idx
  on public.participant_knowledge_answers_v3 (question_code, is_correct);

alter table public.participant_baseline_v3 enable row level security;
alter table public.participant_knowledge_answers_v3 enable row level security;
revoke all on table public.participant_baseline_v3 from public, anon, authenticated;
revoke all on table public.participant_knowledge_answers_v3 from public, anon, authenticated;

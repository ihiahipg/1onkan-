-- Extend the pilot baseline to use the same questionnaire as the classroom app.
-- Keep music_experience_level unchanged for historical pilot rows; it used a
-- different definition and must not be reinterpreted as the new duration band.
alter table public.participant_baseline
  alter column music_experience_level drop not null,
  add column if not exists legacy_music_experience_survey_version text,
  add column if not exists music_experience_band smallint
    check (music_experience_band between 1 and 3),
  add column if not exists primary_instrument text
    check (primary_instrument in ('none', 'piano_keyboard', 'wind', 'strings', 'guitar_bass', 'percussion', 'other')),
  add column if not exists instrument_experience_years smallint
    check (instrument_experience_years between 0 and 80),
  add column if not exists wind_band_member boolean,
  add column if not exists absolute_pitch_self_report text
    check (absolute_pitch_self_report in ('yes', 'no', 'unsure')),
  add column if not exists relative_pitch_self_report text
    check (relative_pitch_self_report in ('yes', 'no', 'unsure')),
  add column if not exists other_pitch_app_experience boolean;

update public.participant_baseline
set legacy_music_experience_survey_version = survey_version
where music_experience_level is not null
  and legacy_music_experience_survey_version is null;

create table if not exists public.baseline_knowledge_answers (
  participant_id uuid not null references public.participant_baseline(participant_id) on delete cascade,
  question_code text not null check (question_code in ('q1_do_fa_interval', 'q2_do_mib_interval', 'q3_do_sol_interval')),
  selected_option text not null,
  is_correct boolean not null,
  quiz_version text not null check (char_length(quiz_version) between 1 and 80),
  answered_at timestamptz not null default now(),
  primary key (participant_id, question_code)
);

create index if not exists participant_baseline_band_idx
  on public.participant_baseline (music_experience_band, participant_id);
create index if not exists baseline_knowledge_question_idx
  on public.baseline_knowledge_answers (question_code, is_correct);

alter table public.baseline_knowledge_answers enable row level security;
revoke all on table public.baseline_knowledge_answers from public, anon, authenticated;

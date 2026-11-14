-- Store baseline music experience once per participant and number every
-- participant's sessions within each study mode for longitudinal analysis.
create table if not exists public.participant_baseline (
  participant_id uuid primary key references public.pilot_participants(id) on delete cascade,
  music_experience_level smallint not null check (music_experience_level in (1, 2, 3)),
  survey_version text not null default 'music-experience-v1'
    check (char_length(survey_version) between 1 and 80),
  captured_at timestamptz not null default now()
);

alter table public.study_sessions
  add column if not exists session_number smallint,
  add column if not exists assessment_wave text;

with numbered as (
  select id,
         row_number() over (
           partition by participant_id, mode
           order by started_at, id
         )::smallint as n
  from public.study_sessions
)
update public.study_sessions s
set session_number = n.n,
    assessment_wave = case
      when s.mode = 'pretest' then 'pretest_' || n.n::text
      when s.mode = 'posttest' then 'posttest_' || n.n::text
      else 'training_' || n.n::text
    end
from numbered n
where s.id = n.id and (s.session_number is null or s.assessment_wave is null);

alter table public.study_sessions
  alter column session_number set not null,
  alter column assessment_wave set not null,
  add constraint study_sessions_session_number_positive check (session_number > 0),
  add constraint study_sessions_assessment_wave_length check (char_length(assessment_wave) between 1 and 80);

create unique index if not exists study_sessions_participant_mode_number_uidx
  on public.study_sessions (participant_id, mode, session_number);
create index if not exists participant_baseline_experience_idx
  on public.participant_baseline (music_experience_level, participant_id);

alter table public.participant_baseline enable row level security;
revoke all on table public.participant_baseline from public, anon, authenticated;

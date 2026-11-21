-- Export this only after both baseline pretest sets are complete for all participants.
-- Requires 10 answered trials in each of pretest_1 and pretest_2; incomplete cases
-- are surfaced for follow-up instead of silently randomized with missing baselines.
with per_pretest as (
  select
    s.participant_id,
    s.session_number,
    count(t.id) as trial_rows,
    count(t.id) filter (where not t.skipped and t.absolute_error_semitones is not null) as answered_rows,
    avg(t.absolute_error_semitones) filter (where not t.skipped) as mean_absolute_error
  from public.study_sessions s
  left join public.study_trials t on t.session_id = s.id
  where s.mode = 'pretest' and s.session_number in (1, 2) and s.completed_at is not null
  group by s.participant_id, s.session_number
), complete_baselines as (
  select
    participant_id,
    avg(mean_absolute_error) as baseline_mean_absolute_error
  from per_pretest
  group by participant_id
  having count(*) = 2
    and bool_and(trial_rows = 10 and answered_rows = 10)
)
select
  p.id as participant_id,
  b.music_experience_band,
  c.baseline_mean_absolute_error
from complete_baselines c
join public.participants p on p.id = c.participant_id and p.active
join public.participant_baseline b on b.participant_id = p.id
left join public.randomization_assignments a on a.participant_id = p.id
where a.participant_id is null
order by p.id;

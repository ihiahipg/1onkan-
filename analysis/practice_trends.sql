-- Group-level only: practice-session summaries, with no participant identifiers.
-- One practice set is one 10-question training session.
with ranked_sessions as (
  select
    s.id as session_id,
    s.participant_id,
    s.assigned_group,
    b.music_experience_level,
    s.started_at,
    s.session_number as practice_set
  from public.study_sessions s
  join public.pilot_participants p on p.id = s.participant_id
  join public.participant_baseline b on b.participant_id = p.id
  where s.mode = 'training'
    and p.pilot_batch = 'ad_10_pilot_2026_11'
    and p.active = true
), participant_set as (
  select
    r.participant_id,
    r.assigned_group,
    r.music_experience_level,
    r.practice_set,
    count(t.id) filter (where not coalesce(t.skipped, false)) as answered_trials,
    avg(t.absolute_error_semitones) filter (where not coalesce(t.skipped, false)) as mean_absolute_error,
    avg(t.correct::int) filter (where not coalesce(t.skipped, false)) as exact_accuracy,
    avg(t.target_crossings) filter (where not coalesce(t.skipped, false)) as mean_target_crossings,
    avg(t.time_to_target_ms) filter (where not coalesce(t.skipped, false)) as mean_time_to_target_ms
  from ranked_sessions r
  left join public.study_trials t on t.session_id = r.session_id
  group by r.participant_id, r.assigned_group, r.music_experience_level, r.practice_set
)
select
  assigned_group,
  music_experience_level,
  practice_set,
  count(*) filter (where answered_trials > 0) as participants_contributing,
  count(*) filter (
    where answered_trials > 0
      and exists (
        select 1 from participant_set previous
        where previous.participant_id = participant_set.participant_id
          and previous.assigned_group = participant_set.assigned_group
          and previous.music_experience_level = participant_set.music_experience_level
          and previous.practice_set = participant_set.practice_set - 1
          and previous.answered_trials > 0
      )
  ) as participants_also_in_previous_set,
  sum(answered_trials)::int as answered_trials,
  avg(mean_absolute_error) as mean_absolute_error_semitones,
  avg(exact_accuracy) as mean_exact_accuracy,
  avg(mean_target_crossings) as mean_target_crossings_per_question,
  avg(mean_time_to_target_ms) as mean_time_to_target_ms
from participant_set
group by assigned_group, music_experience_level, practice_set
order by assigned_group, music_experience_level, practice_set;

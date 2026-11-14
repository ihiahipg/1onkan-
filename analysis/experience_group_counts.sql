-- All 12 group × experience cells, including empty cells (useful for pilot accounting).
-- This is a descriptive count table; small pilot cells are not evidence of group effects.
with cells as (
  select g.group_code as assigned_group, e.level as music_experience_level
  from unnest(array['A', 'B', 'C', 'D']::text[]) as g(group_code)
  cross join unnest(array[1, 2, 3]::smallint[]) as e(level)
), participants as (
  select p.id, p.assigned_group, b.music_experience_level
  from public.pilot_participants p
  left join public.participant_baseline b on b.participant_id = p.id
  where p.active = true
), activity as (
  select
    s.participant_id,
    count(*) filter (where s.mode = 'pretest') as pretest_sessions,
    count(*) filter (where s.mode = 'training') as training_sessions,
    count(*) filter (where s.mode = 'posttest') as posttest_sessions,
    count(t.id) as trial_rows
  from public.study_sessions s
  left join public.study_trials t on t.session_id = s.id
  group by s.participant_id
)
select
  c.assigned_group,
  c.music_experience_level,
  count(p.id) as participant_count,
  count(p.id) filter (where a.participant_id is not null) as participants_with_activity,
  coalesce(sum(a.pretest_sessions), 0) as pretest_sessions,
  coalesce(sum(a.training_sessions), 0) as training_sessions,
  coalesce(sum(a.posttest_sessions), 0) as posttest_sessions,
  coalesce(sum(a.trial_rows), 0) as trial_rows
from cells c
left join participants p
  on p.assigned_group = c.assigned_group
 and p.music_experience_level = c.music_experience_level
left join activity a on a.participant_id = p.id
group by c.assigned_group, c.music_experience_level
order by c.assigned_group, c.music_experience_level;

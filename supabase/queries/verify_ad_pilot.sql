-- A/D pilot checks. These queries reveal random participant UUIDs only,
-- never attendance numbers, participant codes, or code hashes.

-- 1) Assignment totals. Expected for ad_10_pilot_2026_11: A=5, D=5.
select
  pilot_batch,
  assigned_group,
  count(*) as participant_count,
  count(*) filter (where active) as active_count
from public.pilot_participants
group by pilot_batch, assigned_group
order by pilot_batch, assigned_group;

-- 2) Sessions and trials per participant/mode.
-- Pretest should eventually be 2, posttest 1, and training at least 1.
select
  p.pilot_batch,
  p.assigned_group,
  p.id as participant_id,
  s.mode,
  count(distinct s.id) as session_count,
  count(t.id) as trial_count,
  count(t.id) filter (where t.skipped) as skipped_count,
  count(distinct s.id) filter (where s.completed_at is not null) as completed_sessions
from public.pilot_participants p
left join public.study_sessions s on s.participant_id = p.id
left join public.study_trials t on t.session_id = s.id
where p.pilot_batch = 'ad_10_pilot_2026_11'
group by p.pilot_batch, p.assigned_group, p.id, s.mode
order by p.assigned_group, p.id, s.mode;

-- 3) Per-session completeness and quality summary.
-- A finished 10-question session normally has 10 trial rows.
select
  p.assigned_group,
  p.id as participant_id,
  s.mode,
  s.id as session_id,
  s.started_at,
  s.completed_at,
  count(t.id) as trial_count,
  count(t.id) filter (where t.skipped) as skipped_count,
  round((avg(t.absolute_error_semitones) filter (where not t.skipped))::numeric, 3) as mean_absolute_error_semitones,
  round((avg(t.response_time_ms) filter (where not t.skipped))::numeric, 0) as mean_response_time_ms,
  round((avg(t.target_crossings) filter (where not t.skipped))::numeric, 2) as mean_target_crossings
from public.pilot_participants p
join public.study_sessions s on s.participant_id = p.id
left join public.study_trials t on t.session_id = s.id
where p.pilot_batch = 'ad_10_pilot_2026_11'
group by p.assigned_group, p.id, s.mode, s.id, s.started_at, s.completed_at
order by s.started_at, p.assigned_group, p.id;

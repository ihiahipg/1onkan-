-- Run in the Supabase SQL Editor as the project owner, then export the result as CSV.
-- This exports one row per trial with a random participant UUID, never the login code.
select
  p.id as participant_id,
  s.assigned_group,
  s.mode,
  s.id as session_id,
  s.app_version,
  s.started_at,
  s.completed_at,
  t.question_number,
  t.reference_midi,
  t.target_midi,
  t.target_interval_semitones,
  t.answer_midi,
  t.signed_error_semitones,
  t.absolute_error_semitones,
  t.correct,
  t.skipped,
  t.response_time_ms,
  t.target_crossings,
  t.reference_crossings,
  t.first_move_ms,
  t.time_to_target_ms,
  t.max_post_target_deviation_cents,
  t.snap_count,
  t.movement_trace,
  t.saved_at
from public.study_trials t
join public.study_sessions s on s.id = t.session_id
join public.pilot_participants p on p.id = s.participant_id
order by p.id, s.mode, s.started_at, t.question_number;

-- Per-participant summary for a first pre/post report. Keep trial-level data for models.
select
  p.id as participant_id,
  s.assigned_group,
  s.mode,
  count(t.id) as answered_or_skipped_trials,
  count(t.id) filter (where not t.skipped) as answered_trials,
  avg(t.absolute_error_semitones) filter (where not t.skipped) as mean_absolute_error_semitones,
  avg((t.correct)::int::numeric) filter (where not t.skipped) as exact_accuracy,
  avg(t.response_time_ms) filter (where not t.skipped) as mean_response_time_ms,
  avg(t.reference_crossings) filter (where not t.skipped) as mean_reference_crossings,
  avg(t.target_crossings) filter (where not t.skipped) as mean_target_crossings
from public.study_sessions s
join public.pilot_participants p on p.id = s.participant_id
left join public.study_trials t on t.session_id = s.id
group by p.id, s.assigned_group, s.mode
order by s.assigned_group, p.id, s.mode;

-- Paired pre/post change. Positive improvement means lower error after training.
with person_mode as (
  select
    p.id as participant_id,
    s.assigned_group,
    s.mode,
    avg(t.absolute_error_semitones) filter (where not t.skipped) as mean_absolute_error_semitones
  from public.study_sessions s
  join public.pilot_participants p on p.id = s.participant_id
  join public.study_trials t on t.session_id = s.id
  group by p.id, s.assigned_group, s.mode
)
select
  participant_id,
  assigned_group,
  max(mean_absolute_error_semitones) filter (where mode = 'pretest') as pretest_mae_semitones,
  max(mean_absolute_error_semitones) filter (where mode = 'posttest') as posttest_mae_semitones,
  max(mean_absolute_error_semitones) filter (where mode = 'pretest') -
    max(mean_absolute_error_semitones) filter (where mode = 'posttest') as improvement_semitones
from person_mode
group by participant_id, assigned_group
order by assigned_group, participant_id;

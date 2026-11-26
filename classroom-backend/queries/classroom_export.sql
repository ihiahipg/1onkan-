-- De-identified trial-level analysis export. Never includes raw participant codes.
select
  p.id as participant_id,
  b.music_experience_duration,
  b.music_experience_band,
  b.primary_instrument_family,
  b.instrument_pitch_control,
  b.wind_band_member,
  b.music_club_experience,
  b.music_club_experience_captured_at,
  b.absolute_pitch_self_report,
  b.other_pitch_app_experience,
  b.relative_pitch_rating,
  q.knowledge_quiz_answers,
  a.assigned_group,
  a.baseline_performance_tertile,
  a.run_id as randomization_run_id,
  s.id as session_id,
  s.mode,
  s.session_number,
  s.assessment_wave,
  s.headphone_type,
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
  t.target_replay_count,
  t.movement_trace,
  t.saved_at
from public.study_trials t
join public.study_sessions s on s.id = t.session_id
join public.participants p on p.id = s.participant_id
left join public.participant_baseline_v3 b on b.participant_id = p.id
left join public.randomization_assignments a on a.participant_id = p.id
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'question_code', k.question_code,
    'selected_option', k.selected_option,
    'is_correct', k.is_correct,
    'quiz_version', k.quiz_version
  ) order by k.question_code) as knowledge_quiz_answers
  from public.participant_knowledge_answers_v3 k
  where k.participant_id = p.id
) q on true
order by p.id, s.mode, s.session_number, t.question_number;

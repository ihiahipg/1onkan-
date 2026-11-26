-- Trial-level export. Participant IDs are pseudonymous UUIDs, never login codes.
-- Survey v3 lives separately so historical v1/v2 answers are not overwritten.
select
  p.id as participant_id,
  p.pilot_batch,
  coalesce(b3.music_experience_band, b.music_experience_band) as music_experience_band,
  b3.music_experience_duration,
  b3.primary_instrument_family,
  b3.instrument_pitch_control,
  b3.wind_band_member,
  b3.music_club_experience,
  b3.music_club_experience_captured_at,
  b3.absolute_pitch_self_report,
  b3.other_pitch_app_experience,
  b3.relative_pitch_rating,
  q3.knowledge_answers as baseline_knowledge_answers,
  b.music_experience_level as legacy_music_experience_level,
  b.survey_version as legacy_survey_version,
  b.legacy_music_experience_survey_version,
  s.assigned_group,
  s.mode,
  s.session_number,
  s.assessment_wave,
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
  t.target_replay_count,
  t.movement_trace,
  t.saved_at
from public.study_trials t
join public.study_sessions s on s.id = t.session_id
join public.pilot_participants p on p.id = s.participant_id
left join public.participant_baseline b on b.participant_id = p.id
left join public.participant_baseline_v3 b3 on b3.participant_id = p.id
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'question_code', k.question_code,
    'selected_option', k.selected_option,
    'is_correct', k.is_correct,
    'quiz_version', k.quiz_version
  ) order by k.question_code) as knowledge_answers
  from public.participant_knowledge_answers_v3 k
  where k.participant_id = p.id
) q3 on true
order by p.id, s.mode, s.session_number, t.question_number;

-- One row per participant and session; retain trial-level rows above for models.
select
  p.id as participant_id,
  p.pilot_batch,
  coalesce(b3.music_experience_band, b.music_experience_band) as music_experience_band,
  b3.music_experience_duration,
  b3.primary_instrument_family,
  b3.instrument_pitch_control,
  b3.music_club_experience,
  s.assigned_group,
  s.mode,
  s.session_number,
  s.assessment_wave,
  count(t.id) as answered_or_skipped_trials,
  count(t.id) filter (where not t.skipped) as answered_trials,
  avg(t.absolute_error_semitones) filter (where not t.skipped) as mean_absolute_error_semitones,
  avg(t.correct::int::numeric) filter (where not t.skipped) as exact_accuracy,
  avg(t.response_time_ms) filter (where not t.skipped) as mean_response_time_ms,
  avg(t.reference_crossings) filter (where not t.skipped) as mean_reference_crossings,
  avg(t.target_crossings) filter (where not t.skipped) as mean_target_crossings
from public.study_sessions s
join public.pilot_participants p on p.id = s.participant_id
left join public.participant_baseline b on b.participant_id = p.id
left join public.participant_baseline_v3 b3 on b3.participant_id = p.id
left join public.study_trials t on t.session_id = s.id
group by p.id, p.pilot_batch, b3.music_experience_band, b.music_experience_band,
  b3.music_experience_duration, b3.primary_instrument_family, b3.instrument_pitch_control,
  b3.music_club_experience,
  s.assigned_group, s.mode, s.session_number, s.assessment_wave
order by s.assigned_group, music_experience_band, p.id, s.mode, s.session_number;

-- Paired first-pretest/first-posttest summary; each mode may have repeated waves.
with person_mode as (
  select
    p.id as participant_id,
    p.pilot_batch,
    coalesce(b3.music_experience_band, b.music_experience_band) as music_experience_band,
    b3.music_experience_duration,
    b3.primary_instrument_family,
    b3.instrument_pitch_control,
    b3.music_club_experience,
    s.assigned_group,
    s.mode,
    s.session_number,
    avg(t.absolute_error_semitones) filter (where not t.skipped) as mean_absolute_error_semitones
  from public.study_sessions s
  join public.pilot_participants p on p.id = s.participant_id
  left join public.participant_baseline b on b.participant_id = p.id
  left join public.participant_baseline_v3 b3 on b3.participant_id = p.id
  join public.study_trials t on t.session_id = s.id
  group by p.id, p.pilot_batch, b3.music_experience_band, b.music_experience_band,
    b3.music_experience_duration, b3.primary_instrument_family, b3.instrument_pitch_control,
    b3.music_club_experience,
    s.assigned_group, s.mode, s.session_number
)
select
  participant_id,
  pilot_batch,
  music_experience_band,
  music_experience_duration,
  primary_instrument_family,
  instrument_pitch_control,
  music_club_experience,
  assigned_group,
  max(mean_absolute_error_semitones) filter (where mode = 'pretest' and session_number = 1) as pretest_1_mae_semitones,
  max(mean_absolute_error_semitones) filter (where mode = 'pretest' and session_number = 2) as pretest_2_mae_semitones,
  max(mean_absolute_error_semitones) filter (where mode = 'posttest' and session_number = 1) as posttest_1_mae_semitones
from person_mode
group by participant_id, pilot_batch, music_experience_band, music_experience_duration,
  primary_instrument_family, instrument_pitch_control, music_club_experience, assigned_group
order by assigned_group, music_experience_band, participant_id;

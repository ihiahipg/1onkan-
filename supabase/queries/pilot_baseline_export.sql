-- One row per pilot participant, with the current baseline and knowledge quiz.
-- Legacy music_experience_level is retained as recorded; do not treat it as
-- equivalent to music_experience_band when survey_version is not v2.
select
  p.id as participant_id,
  p.pilot_batch,
  p.assigned_group,
  b.survey_version,
  b.music_experience_level as legacy_music_experience_level,
  b.legacy_music_experience_survey_version,
  b.music_experience_band,
  b.primary_instrument,
  b.instrument_experience_years,
  b.wind_band_member,
  b.absolute_pitch_self_report,
  b.relative_pitch_self_report,
  b.other_pitch_app_experience,
  max(a.selected_option) filter (where a.question_code = 'q1_do_fa_interval') as q1_selected_option,
  bool_or(a.is_correct) filter (where a.question_code = 'q1_do_fa_interval') as q1_correct,
  max(a.selected_option) filter (where a.question_code = 'q2_do_mib_interval') as q2_selected_option,
  bool_or(a.is_correct) filter (where a.question_code = 'q2_do_mib_interval') as q2_correct,
  max(a.selected_option) filter (where a.question_code = 'q3_do_sol_interval') as q3_selected_option,
  bool_or(a.is_correct) filter (where a.question_code = 'q3_do_sol_interval') as q3_correct,
  b.captured_at
from public.pilot_participants p
left join public.participant_baseline b on b.participant_id = p.id
left join public.baseline_knowledge_answers a on a.participant_id = p.id
where p.active = true
group by p.id, p.pilot_batch, p.assigned_group, b.survey_version, b.music_experience_level,
  b.music_experience_band, b.primary_instrument, b.instrument_experience_years,
  b.wind_band_member,
  b.absolute_pitch_self_report, b.relative_pitch_self_report, b.other_pitch_app_experience, b.captured_at
order by p.assigned_group, p.id;

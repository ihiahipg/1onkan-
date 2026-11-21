-- One row per participant; only pseudonymous database UUIDs, never participant codes.
select
  p.id as participant_id,
  p.pilot_batch,
  p.assigned_group,
  b.survey_version,
  b.music_experience_duration,
  b.music_experience_band,
  b.primary_instrument_family,
  b.instrument_pitch_control,
  b.wind_band_member,
  b.absolute_pitch_self_report,
  b.other_pitch_app_experience,
  b.relative_pitch_rating,
  max(a.selected_option) filter (where a.question_code = 'q1_do_fa_interval') as q1_selected_option,
  bool_or(a.is_correct) filter (where a.question_code = 'q1_do_fa_interval') as q1_correct,
  max(a.selected_option) filter (where a.question_code = 'q2_do_mib_interval') as q2_selected_option,
  bool_or(a.is_correct) filter (where a.question_code = 'q2_do_mib_interval') as q2_correct,
  max(a.selected_option) filter (where a.question_code = 'q3_do_sol_interval') as q3_selected_option,
  bool_or(a.is_correct) filter (where a.question_code = 'q3_do_sol_interval') as q3_correct,
  b.captured_at as baseline_captured_at
from public.pilot_participants p
join public.participant_baseline_v3 b on b.participant_id = p.id
left join public.participant_knowledge_answers_v3 a on a.participant_id = p.id
where p.active = true
group by p.id, p.pilot_batch, p.assigned_group, b.survey_version, b.music_experience_duration,
  b.music_experience_band, b.primary_instrument_family, b.instrument_pitch_control,
  b.wind_band_member, b.absolute_pitch_self_report, b.other_pitch_app_experience,
  b.relative_pitch_rating, b.captured_at
order by p.assigned_group, b.music_experience_band, p.id;

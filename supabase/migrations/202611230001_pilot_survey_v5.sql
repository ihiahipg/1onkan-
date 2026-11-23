-- Keep legacy instrument values for existing pilot rows, and allow the new broad pitch-control groups.
alter table public.participant_baseline_v3
  drop constraint if exists participant_baseline_v3_primary_instrument_family_check;
alter table public.participant_baseline_v3
  add constraint participant_baseline_v3_primary_instrument_family_check
  check (primary_instrument_family in (
    'none', 'keyboard', 'woodwind', 'valved_brass', 'slide_brass', 'bowed_strings',
    'fretted_strings', 'pitched_percussion', 'unpitched_percussion', 'other',
    'continuous_pitch', 'stepwise_pitch'
  ));

alter table public.participant_knowledge_answers_v3
  drop constraint if exists participant_knowledge_answers_v3_question_code_check;
alter table public.participant_knowledge_answers_v3
  add constraint participant_knowledge_answers_v3_question_code_check
  check (question_code in (
    'q1_do_fa_interval', 'q2_do_mib_interval', 'q3_do_sol_interval',
    'q4_do_mi_interval', 'q5_do_la_interval'
  ));

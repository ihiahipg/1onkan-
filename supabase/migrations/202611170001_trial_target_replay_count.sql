-- Count manual reference + target replay clicks per question. Initial prompt playback is not counted.
alter table public.study_trials
  add column if not exists target_replay_count integer not null default 0
  check (target_replay_count between 0 and 1000);

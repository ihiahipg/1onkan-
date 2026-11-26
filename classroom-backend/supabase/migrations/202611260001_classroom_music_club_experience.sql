-- Add a broad music-club item while preserving historical wind-band answers.
alter table public.participant_baseline_v3
  add column if not exists music_club_experience boolean,
  add column if not exists music_club_experience_captured_at timestamptz;

alter table public.participant_baseline_v3
  alter column wind_band_member drop not null;

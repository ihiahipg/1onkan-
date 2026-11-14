-- Additive pilot cohort label. Existing pilot participants remain in their
-- original four-group batch and are not reassigned.
alter table public.pilot_participants
  add column if not exists pilot_batch text not null default 'initial_4group_pilot'
  check (char_length(pilot_batch) between 1 and 80);

create index if not exists pilot_participants_batch_group_idx
  on public.pilot_participants (pilot_batch, assigned_group, active);

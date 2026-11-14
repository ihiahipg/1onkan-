select
  pilot_batch,
  assigned_group,
  count(*) as participant_count,
  count(*) filter (where active) as active_count
from public.pilot_participants
group by pilot_batch, assigned_group
order by pilot_batch, assigned_group;

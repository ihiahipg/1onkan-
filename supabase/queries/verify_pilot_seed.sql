select
  assigned_group,
  count(*) as participant_count,
  count(*) filter (where active) as active_count
from public.pilot_participants
group by assigned_group
order by assigned_group;

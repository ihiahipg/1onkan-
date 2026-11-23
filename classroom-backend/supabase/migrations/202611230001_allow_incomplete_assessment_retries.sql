-- Preserve a single completed posttest while allowing an interrupted, incomplete
-- attempt to be retried. The function still rejects a second completed posttest.
drop index if exists public.study_sessions_one_posttest_per_participant_idx;

create unique index study_sessions_one_posttest_per_participant_idx
  on public.study_sessions (participant_id, mode)
  where mode = 'posttest' and completed_at is not null;

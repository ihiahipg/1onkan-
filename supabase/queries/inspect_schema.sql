select
  'column'::text as result_type,
  table_name::text as object_name,
  column_name::text as detail,
  data_type::text as value
from information_schema.columns
where table_schema = 'public'
  and table_name in ('participants', 'pilot_participants', 'study_sessions', 'study_trials')

union all

select
  'migration_history'::text as result_type,
  'supabase_migrations'::text as object_name,
  'schema_migrations'::text as detail,
  case
    when to_regclass('supabase_migrations.schema_migrations') is null then 'missing'
    else 'present'
  end::text as value

union all

select
  'migration_version'::text as result_type,
  '202611080001'::text as object_name,
  'pilot_data'::text as detail,
  case
    when exists (
      select 1
      from supabase_migrations.schema_migrations
      where version = '202611080001'
    ) then 'applied'
    else 'not_applied'
  end::text as value

order by result_type, object_name, detail;

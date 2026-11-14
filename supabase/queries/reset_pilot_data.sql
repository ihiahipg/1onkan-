-- Destructive reset, explicitly intended for a pilot reinitialization.
-- This removes participant IDs and cascades to experience profiles, sessions, and trials.
-- It does not remove schema, Edge Function secrets, or code files stored on local devices.
truncate table public.pilot_participants restart identity cascade;

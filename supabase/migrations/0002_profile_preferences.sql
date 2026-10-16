-- ===========================================================================
-- Agent Mobile — 0002 profile preferences
-- ===========================================================================
-- ADDITIVE migration.
--
-- Adds the per-user "custom system prompt" that pairs with the existing
-- `default_model` column, plus database-level length guards so the API's own
-- validation cannot be bypassed by a direct PostgREST call with the anon key.
--
-- Row Level Security is already enabled on `public.profiles` in 0001 and the
-- policies there are ROW-scoped, not column-scoped — so the new column is
-- protected by the existing `profiles_select_own` / `profiles_update_own`
-- policies with no change required. The update policy is re-asserted below so
-- this migration is self-contained and safe to run on a database whose policies
-- were edited by hand.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- New column
-- ---------------------------------------------------------------------------

-- The user's standing instructions, prepended to every conversation unless the
-- conversation carries its own override. NULL means "use the app default".
alter table public.profiles
  add column if not exists system_prompt text;

comment on column public.profiles.system_prompt is
  'User-authored custom instruction. Prepended to every turn unless the conversation has its own override. NULL = app default.';

-- ---------------------------------------------------------------------------
-- Length guards
-- ---------------------------------------------------------------------------
-- Mirrors MAX_PROMPT_LENGTH / MAX_MODEL_LENGTH in src/app/api/profile/route.ts.
-- Defence in depth: the route validates, and so does the database, so a crafted
-- PostgREST request cannot store an unbounded blob.

alter table public.profiles
  drop constraint if exists profiles_system_prompt_length;

alter table public.profiles
  add constraint profiles_system_prompt_length
  check (system_prompt is null or char_length(system_prompt) <= 8000);

alter table public.profiles
  drop constraint if exists profiles_default_model_length;

alter table public.profiles
  add constraint profiles_default_model_length
  check (char_length(default_model) between 1 and 64);

-- ---------------------------------------------------------------------------
-- RLS (re-asserted)
-- ---------------------------------------------------------------------------
-- Unchanged semantics: a user may only read and write their own row. Restated
-- here so the policy set for `profiles` is provably complete after this
-- migration runs.

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

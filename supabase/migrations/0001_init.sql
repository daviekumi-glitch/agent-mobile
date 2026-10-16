-- ===========================================================================
-- Agent Mobile — initial schema
-- ===========================================================================
-- Tables: profiles, conversations, messages, tool_calls
-- Every table is protected by Row Level Security scoped to auth.uid().
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created automatically on signup
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  default_model text not null default 'gpt-4o-mini',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Public profile mirror of auth.users, one row per user.';

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null default 'New chat',
  model           text not null default 'gpt-4o-mini',
  system_prompt   text,
  pinned          boolean not null default false,
  archived        boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Sidebar query: newest-first, per user, excluding archived.
create index if not exists conversations_user_recent_idx
  on public.conversations (user_id, last_message_at desc)
  where archived = false;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content         text not null default '',
  model           text,
  attachments     jsonb not null default '[]'::jsonb,
  token_count     integer,
  created_at      timestamptz not null default now()
);

-- Thread load: chronological within a conversation.
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

-- ---------------------------------------------------------------------------
-- tool_calls — one row per tool invocation, attached to an assistant message
-- ---------------------------------------------------------------------------
create table if not exists public.tool_calls (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  name        text not null,
  arguments   jsonb not null default '{}'::jsonb,
  result      jsonb,
  status      text not null default 'running' check (status in ('running', 'success', 'error')),
  error       text,
  duration_ms integer,
  created_at  timestamptz not null default now()
);

create index if not exists tool_calls_message_idx
  on public.tool_calls (message_id, created_at asc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.tool_calls    enable row level security;

-- --- profiles --------------------------------------------------------------
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

-- --- conversations ---------------------------------------------------------
drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
  on public.conversations for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
  on public.conversations for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own"
  on public.conversations for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own"
  on public.conversations for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- --- messages --------------------------------------------------------------
-- Ownership is checked against the parent conversation as well as the row,
-- so a forged conversation_id cannot be used to read someone else's thread.
drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
  on public.messages for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
  on public.messages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
  on public.messages for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- --- tool_calls ------------------------------------------------------------
drop policy if exists "tool_calls_select_own" on public.tool_calls;
create policy "tool_calls_select_own"
  on public.tool_calls for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = tool_calls.message_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "tool_calls_insert_own" on public.tool_calls;
create policy "tool_calls_insert_own"
  on public.tool_calls for insert
  to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = tool_calls.message_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "tool_calls_delete_own" on public.tool_calls;
create policy "tool_calls_delete_own"
  on public.tool_calls for delete
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = tool_calls.message_id
        and m.user_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- Storage: chat attachments
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  true,
  10485760, -- 10 MB
  array[
    'image/png','image/jpeg','image/webp','image/gif',
    'text/plain','text/markdown','text/csv','application/json',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

-- Users may only write into a folder named after their own uid: {user_id}/...
drop policy if exists "attachments_read_public" on storage.objects;
create policy "attachments_read_public"
  on storage.objects for select
  using (bucket_id = 'attachments');

drop policy if exists "attachments_insert_own_folder" on storage.objects;
create policy "attachments_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "attachments_delete_own_folder" on storage.objects;
create policy "attachments_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

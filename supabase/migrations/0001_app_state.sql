-- Hackathon storage: one row holding the same Db object the fake backend keeps in AsyncStorage.
-- Only the rpc Edge Function (service role) touches it. Clients never read it directly.
create table if not exists public.app_state (
  id         int primary key check (id = 1),
  db         jsonb not null,
  links      jsonb not null default '{}'::jsonb, -- auth user id -> domain user id
  version    int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security; -- no policies: anon/authenticated get nothing

-- Realtime without leaking data: clients may only see that the version changed, then call rpc fetch.
create table if not exists public.app_state_ping (
  id      int primary key check (id = 1),
  version int not null
);
alter table public.app_state_ping enable row level security;
drop policy if exists "signed-in users can see pings" on public.app_state_ping;
create policy "signed-in users can see pings" on public.app_state_ping for select to authenticated using (true);

create or replace function public.app_state_ping_fn() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_state_ping (id, version) values (1, new.version)
  on conflict (id) do update set version = excluded.version;
  return new;
end $$;

drop trigger if exists app_state_ping_trg on public.app_state;
create trigger app_state_ping_trg after insert or update on public.app_state
  for each row execute function public.app_state_ping_fn();

do $$ begin
  alter publication supabase_realtime add table public.app_state_ping;
exception when duplicate_object then null; end $$;

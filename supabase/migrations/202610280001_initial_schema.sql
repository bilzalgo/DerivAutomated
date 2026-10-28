create extension if not exists pgcrypto;

create sequence if not exists public.gsquad_account_id_seq
  minvalue 1000000000 maxvalue 9999999999 start with 1000000000 no cycle;

create or replace function public.new_gsquad_account_id()
returns text
language sql
volatile
as $$
  select 'GSQ-' || nextval('public.gsquad_account_id_seq')::text
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_id text not null unique default public.new_gsquad_account_id(),
  full_name text not null default '',
  email text not null,
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  current_plan text not null default 'Free' check (current_plan in ('Free', 'VIP')),
  joined_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  insert into public.subscriptions (user_id, current_plan, status)
  values (new.id, 'Free', 'active');
  return new;
end;
$$;

create table if not exists public.user_configurations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  target_profit numeric(18, 8) not null check (target_profit > 0),
  target_loss numeric(18, 8) not null check (target_loss > 0),
  stake_amount numeric(18, 8) not null check (stake_amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3,8}$'),
  updated_at timestamptz not null default now()
);

create table if not exists public.deriv_connections (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'expired')),
  token_ciphertext text not null,
  token_iv text not null,
  token_tag text not null,
  authorized_accounts jsonb not null default '[]'::jsonb,
  selected_account_id text,
  account_mode text check (account_mode in ('demo', 'real')),
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.deriv_oauth_states (
  state text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_verifier text not null,
  return_to text not null default 'web' check (return_to in ('web', 'mobile')),
  expires_at timestamptz not null
);

create table if not exists public.trading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  deriv_account_id text not null,
  account_mode text not null check (account_mode in ('demo', 'real')),
  status text not null check (status in ('ready', 'running', 'paused', 'stopped', 'error')),
  stop_reason text,
  started_at timestamptz not null default now(),
  stopped_at timestamptz
);

create unique index if not exists one_running_session_per_user
on public.trading_sessions (user_id)
where status in ('ready', 'running', 'paused');

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.trading_sessions (id) on delete cascade,
  deriv_contract_id text unique,
  symbol text not null,
  contract_type text not null,
  duration integer not null,
  stake numeric(18, 8) not null check (stake > 0),
  entry_price numeric(18, 8),
  settlement_price numeric(18, 8),
  profit_loss numeric(18, 8),
  contract_status text not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_plan text not null default 'Free' check (current_plan in ('Free', 'VIP')),
  status text not null default 'active',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('success', 'information', 'warning', 'error')),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.operational_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.trading_sessions (id) on delete cascade,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_configurations enable row level security;
alter table public.deriv_connections enable row level security;
alter table public.deriv_oauth_states enable row level security;
alter table public.trading_sessions enable row level security;
alter table public.trades enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.operational_logs enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select using ((select auth.uid()) = id);
drop policy if exists "Users can manage own configuration" on public.user_configurations;
create policy "Users can manage own configuration" on public.user_configurations
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read own sessions" on public.trading_sessions;
create policy "Users can read own sessions" on public.trading_sessions
  for select using ((select auth.uid()) = user_id);
drop policy if exists "Users can read own trades" on public.trades;
create policy "Users can read own trades" on public.trades
  for select using ((select auth.uid()) = user_id);
drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription" on public.subscriptions
  for select using ((select auth.uid()) = user_id);
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications" on public.notifications
  for select using ((select auth.uid()) = user_id);
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read own operational logs" on public.operational_logs;
create policy "Users can read own operational logs" on public.operational_logs
  for select using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.user_configurations, public.deriv_connections,
  public.deriv_oauth_states, public.trading_sessions, public.trades,
  public.subscriptions, public.notifications, public.operational_logs
from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.user_configurations to authenticated;
grant select on public.trading_sessions, public.trades, public.subscriptions, public.operational_logs to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

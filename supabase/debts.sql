create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  create type public.debt_type as enum ('loan', 'credit_card', 'family', 'store', 'other');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.debt_payment_frequency as enum ('once', 'weekly', 'biweekly', 'monthly');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.debt_status as enum ('active', 'paid', 'overdue');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.debt_type not null default 'loan',
  creditor text not null,
  initial_amount numeric(14, 2) not null check (initial_amount >= 0),
  outstanding_balance numeric(14, 2) not null check (outstanding_balance >= 0),
  start_date date not null default current_date,
  due_date date,
  interest_rate numeric(7, 4) check (interest_rate is null or interest_rate >= 0),
  minimum_payment numeric(14, 2) check (minimum_payment is null or minimum_payment >= 0),
  payment_frequency public.debt_payment_frequency not null default 'monthly',
  status public.debt_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debts_due_date_after_start_date check (due_date is null or due_date >= start_date),
  constraint debts_outstanding_not_above_initial check (outstanding_balance <= initial_amount)
);

alter table public.debts drop constraint if exists debts_initial_amount_check;
alter table public.debts drop constraint if exists debts_outstanding_balance_check;
alter table public.debts drop constraint if exists debts_outstanding_not_above_initial;
alter table public.debts
  add constraint debts_initial_amount_check check (initial_amount >= 0),
  add constraint debts_outstanding_balance_check check (outstanding_balance >= 0),
  add constraint debts_outstanding_not_above_initial check (outstanding_balance <= initial_amount);

create index if not exists debts_user_id_idx on public.debts(user_id);
create index if not exists debts_user_status_idx on public.debts(user_id, status);
create index if not exists debts_user_due_date_idx on public.debts(user_id, due_date);

drop trigger if exists set_debts_updated_at on public.debts;
create trigger set_debts_updated_at
before update on public.debts
for each row
execute function public.set_updated_at();

alter table public.debts enable row level security;

grant usage on schema public to anon, authenticated;
grant usage on type public.debt_type to authenticated;
grant usage on type public.debt_payment_frequency to authenticated;
grant usage on type public.debt_status to authenticated;
grant select, insert, update, delete on public.debts to authenticated;

drop policy if exists "Users can read their debts" on public.debts;
create policy "Users can read their debts"
  on public.debts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their debts" on public.debts;
create policy "Users can create their debts"
  on public.debts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their debts" on public.debts;
create policy "Users can update their debts"
  on public.debts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their debts" on public.debts;
create policy "Users can delete their debts"
  on public.debts for delete
  using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'debts'
    ) then
      alter publication supabase_realtime add table public.debts;
    end if;
  end if;
end;
$$;

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  name text not null,
  description text,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  currency text not null default 'DOP' check (currency in ('DOP', 'USD', 'EUR', 'BOB')),
  goal_type text not null default 'custom' check (goal_type in ('emergency_fund', 'vehicle_down_payment', 'travel', 'purchase', 'monthly_savings', 'custom')),
  target_date date,
  monthly_target numeric(14, 2) check (monthly_target is null or monthly_target >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  color text not null default '#198c7c',
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_goals_current_not_excessive check (current_amount <= target_amount * 10)
);

create index if not exists savings_goals_user_status_idx on public.savings_goals(user_id, status);
create index if not exists savings_goals_user_target_date_idx on public.savings_goals(user_id, target_date);
create index if not exists savings_goals_account_id_idx on public.savings_goals(account_id);

drop trigger if exists set_savings_goals_updated_at on public.savings_goals;
create trigger set_savings_goals_updated_at
before update on public.savings_goals
for each row
execute function public.set_updated_at();

alter table public.savings_goals enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.savings_goals to authenticated;

drop policy if exists "Users can read their savings goals" on public.savings_goals;
create policy "Users can read their savings goals"
  on public.savings_goals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their savings goals" on public.savings_goals;
create policy "Users can create their savings goals"
  on public.savings_goals for insert
  with check (
    auth.uid() = user_id
    and (
      account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = account_id
          and accounts.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update their savings goals" on public.savings_goals;
create policy "Users can update their savings goals"
  on public.savings_goals for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = account_id
          and accounts.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can delete their savings goals" on public.savings_goals;
create policy "Users can delete their savings goals"
  on public.savings_goals for delete
  using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'savings_goals'
    ) then
      alter publication supabase_realtime add table public.savings_goals;
    end if;
  end if;
end;
$$;

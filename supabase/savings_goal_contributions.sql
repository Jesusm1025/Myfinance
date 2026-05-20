create table if not exists public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  contribution_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists savings_goal_contributions_user_goal_idx
  on public.savings_goal_contributions(user_id, goal_id);

create index if not exists savings_goal_contributions_user_date_idx
  on public.savings_goal_contributions(user_id, contribution_date desc);

create index if not exists savings_goal_contributions_goal_id_idx
  on public.savings_goal_contributions(goal_id);

create index if not exists savings_goal_contributions_account_id_idx
  on public.savings_goal_contributions(account_id);

drop trigger if exists set_savings_goal_contributions_updated_at on public.savings_goal_contributions;
create trigger set_savings_goal_contributions_updated_at
before update on public.savings_goal_contributions
for each row
execute function public.set_updated_at();

create or replace function public.recalculate_savings_goal_current_amount(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric(14, 2);
  v_target numeric(14, 2);
  v_status text;
begin
  if p_goal_id is null then
    return;
  end if;

  select
    coalesce(sum(amount), 0)::numeric(14, 2)
  into v_total
  from public.savings_goal_contributions
  where goal_id = p_goal_id;

  select target_amount, status
  into v_target, v_status
  from public.savings_goals
  where id = p_goal_id;

  if not found then
    return;
  end if;

  update public.savings_goals
  set
    current_amount = v_total,
    status = case
      when v_status in ('paused', 'cancelled') then v_status
      when v_total >= v_target then 'completed'
      when v_status = 'completed' and v_total < v_target then 'active'
      else v_status
    end,
    updated_at = now()
  where id = p_goal_id;
end;
$$;

create or replace function public.handle_savings_goal_contribution_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_savings_goal_current_amount(old.goal_id);
    return old;
  end if;

  perform public.recalculate_savings_goal_current_amount(new.goal_id);

  if tg_op = 'UPDATE' and old.goal_id is distinct from new.goal_id then
    perform public.recalculate_savings_goal_current_amount(old.goal_id);
  end if;

  return new;
end;
$$;

drop trigger if exists recalculate_savings_goal_after_contribution on public.savings_goal_contributions;
create trigger recalculate_savings_goal_after_contribution
after insert or update or delete on public.savings_goal_contributions
for each row
execute function public.handle_savings_goal_contribution_change();

alter table public.savings_goal_contributions enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.savings_goal_contributions to authenticated;

drop policy if exists "Users can read their savings goal contributions" on public.savings_goal_contributions;
create policy "Users can read their savings goal contributions"
  on public.savings_goal_contributions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their savings goal contributions" on public.savings_goal_contributions;
create policy "Users can create their savings goal contributions"
  on public.savings_goal_contributions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.savings_goals
      where savings_goals.id = goal_id
        and savings_goals.user_id = auth.uid()
        and savings_goals.status <> 'cancelled'
    )
    and (
      account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = account_id
          and accounts.user_id = auth.uid()
      )
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions
        where transactions.id = transaction_id
          and transactions.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update their savings goal contributions" on public.savings_goal_contributions;
create policy "Users can update their savings goal contributions"
  on public.savings_goal_contributions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.savings_goals
      where savings_goals.id = goal_id
        and savings_goals.user_id = auth.uid()
        and savings_goals.status <> 'cancelled'
    )
    and (
      account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = account_id
          and accounts.user_id = auth.uid()
      )
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions
        where transactions.id = transaction_id
          and transactions.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can delete their savings goal contributions" on public.savings_goal_contributions;
create policy "Users can delete their savings goal contributions"
  on public.savings_goal_contributions for delete
  using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'savings_goal_contributions'
    ) then
      alter publication supabase_realtime add table public.savings_goal_contributions;
    end if;
  end if;
end;
$$;

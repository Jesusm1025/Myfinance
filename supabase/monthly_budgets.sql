create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  category_id uuid references public.categories(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists monthly_budgets_general_unique
  on public.monthly_budgets(user_id, month)
  where category_id is null;

create unique index if not exists monthly_budgets_category_unique
  on public.monthly_budgets(user_id, month, category_id)
  where category_id is not null;

create index if not exists monthly_budgets_user_month_idx on public.monthly_budgets(user_id, month);

drop trigger if exists set_monthly_budgets_updated_at on public.monthly_budgets;
create trigger set_monthly_budgets_updated_at
before update on public.monthly_budgets
for each row
execute function public.set_updated_at();

alter table public.monthly_budgets enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.monthly_budgets to authenticated;

drop policy if exists "Users can read their budgets" on public.monthly_budgets;
create policy "Users can read their budgets"
  on public.monthly_budgets for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their budgets" on public.monthly_budgets;
create policy "Users can create their budgets"
  on public.monthly_budgets for insert
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from public.categories
        where categories.id = category_id
          and categories.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update their budgets" on public.monthly_budgets;
create policy "Users can update their budgets"
  on public.monthly_budgets for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from public.categories
        where categories.id = category_id
          and categories.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can delete their budgets" on public.monthly_budgets;
create policy "Users can delete their budgets"
  on public.monthly_budgets for delete
  using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'monthly_budgets'
    ) then
      alter publication supabase_realtime add table public.monthly_budgets;
    end if;
  end if;
end;
$$;

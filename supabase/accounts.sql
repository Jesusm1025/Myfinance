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

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'debit_card', 'credit_card', 'savings', 'other')),
  color text not null default '#198c7c',
  initial_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.transactions add column if not exists account_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_account_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_account_id_fkey
      foreign key (account_id) references public.accounts(id) on delete restrict;
  end if;
end;
$$;

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  description text,
  transfer_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_transfers_different_accounts check (from_account_id <> to_account_id),
  constraint account_transfers_from_account_id_fkey
    foreign key (from_account_id) references public.accounts(id) on delete restrict,
  constraint account_transfers_to_account_id_fkey
    foreign key (to_account_id) references public.accounts(id) on delete restrict
);

create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists accounts_user_type_idx on public.accounts(user_id, type);
create index if not exists transactions_account_id_idx on public.transactions(account_id);
create index if not exists account_transfers_user_date_idx on public.account_transfers(user_id, transfer_date desc);
create index if not exists account_transfers_from_account_id_idx on public.account_transfers(from_account_id);
create index if not exists account_transfers_to_account_id_idx on public.account_transfers(to_account_id);

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
before update on public.accounts
for each row
execute function public.set_updated_at();

drop trigger if exists set_account_transfers_updated_at on public.account_transfers;
create trigger set_account_transfers_updated_at
before update on public.account_transfers
for each row
execute function public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.account_transfers enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.account_transfers to authenticated;

drop policy if exists "Users can read their accounts" on public.accounts;
create policy "Users can read their accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their accounts" on public.accounts;
create policy "Users can create their accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their accounts" on public.accounts;
create policy "Users can update their accounts"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their accounts" on public.accounts;
create policy "Users can delete their accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can create their transactions" on public.transactions;
create policy "Users can create their transactions"
  on public.transactions for insert
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

drop policy if exists "Users can update their transactions" on public.transactions;
create policy "Users can update their transactions"
  on public.transactions for update
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

drop policy if exists "Users can read their transfers" on public.account_transfers;
create policy "Users can read their transfers"
  on public.account_transfers for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their transfers" on public.account_transfers;
create policy "Users can create their transfers"
  on public.account_transfers for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts
      where accounts.id = from_account_id
        and accounts.user_id = auth.uid()
    )
    and exists (
      select 1 from public.accounts
      where accounts.id = to_account_id
        and accounts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their transfers" on public.account_transfers;
create policy "Users can update their transfers"
  on public.account_transfers for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts
      where accounts.id = from_account_id
        and accounts.user_id = auth.uid()
    )
    and exists (
      select 1 from public.accounts
      where accounts.id = to_account_id
        and accounts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their transfers" on public.account_transfers;
create policy "Users can delete their transfers"
  on public.account_transfers for delete
  using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'accounts'
    ) then
      alter publication supabase_realtime add table public.accounts;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'account_transfers'
    ) then
      alter publication supabase_realtime add table public.account_transfers;
    end if;
  end if;
end;
$$;

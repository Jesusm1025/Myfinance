create extension if not exists "pgcrypto";

do $$
begin
  create type transaction_type as enum ('income', 'expense');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.debt_type as enum ('loan', 'credit_card', 'education', 'family', 'store', 'other');
exception
  when duplicate_object then null;
end;
$$;

alter type public.debt_type add value if not exists 'education';

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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'DOP' check (currency in ('DOP', 'USD', 'EUR', 'BOB')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type transaction_type not null,
  color text not null default '#198c7c',
  icon text,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

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

create or replace function public.create_default_categories_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id, currency)
  values (new.id, 'DOP')
  on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, type, color, icon)
  values
    (new.id, 'Comida', 'expense', '#ee6c4d', 'utensils'),
    (new.id, 'Transporte', 'expense', '#2563eb', 'bus'),
    (new.id, 'Vivienda', 'expense', '#198c7c', 'home'),
    (new.id, 'Servicios', 'expense', '#d99f18', 'zap'),
    (new.id, 'Salud', 'expense', '#dc5538', 'heart-pulse'),
    (new.id, 'Educacion', 'expense', '#7c3aed', 'graduation-cap'),
    (new.id, 'Entretenimiento', 'expense', '#0891b2', 'film'),
    (new.id, 'Ropa', 'expense', '#db2777', 'shirt'),
    (new.id, 'Deudas', 'expense', '#475569', 'credit-card'),
    (new.id, 'Otros', 'expense', '#64748b', 'circle-ellipsis'),
    (new.id, 'Salario', 'income', '#198c7c', 'briefcase'),
    (new.id, 'Freelance', 'income', '#0f766e', 'laptop'),
    (new.id, 'Negocio', 'income', '#2563eb', 'store'),
    (new.id, 'Regalo', 'income', '#d99f18', 'gift'),
    (new.id, 'Otros', 'income', '#64748b', 'circle-ellipsis')
  on conflict (user_id, name, type) do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_categories_after_signup on auth.users;
create trigger create_default_categories_after_signup
after insert on auth.users
for each row
execute function public.create_default_categories_for_user();

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete restrict,
  type transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  description text,
  payment_method text not null default 'cash',
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  category_id uuid references public.categories(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.debt_type not null default 'loan',
  creditor text not null,
  currency text not null default 'DOP' check (currency in ('DOP', 'USD', 'EUR', 'BOB')),
  initial_amount numeric(14, 2) not null check (initial_amount >= 0),
  outstanding_balance numeric(14, 2) not null check (outstanding_balance >= 0),
  start_date date not null default current_date,
  due_date date,
  interest_rate numeric(7, 4) check (interest_rate is null or interest_rate >= 0),
  minimum_payment numeric(14, 2) check (minimum_payment is null or minimum_payment >= 0),
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  credit_limit numeric(14, 2) check (credit_limit is null or credit_limit >= 0),
  used_balance numeric(14, 2) check (used_balance is null or used_balance >= 0),
  statement_balance numeric(14, 2) check (statement_balance is null or statement_balance >= 0),
  balance_dop numeric(14, 2) check (balance_dop is null or balance_dop >= 0),
  balance_usd numeric(14, 2) check (balance_usd is null or balance_usd >= 0),
  minimum_payment_dop numeric(14, 2) check (minimum_payment_dop is null or minimum_payment_dop >= 0),
  minimum_payment_usd numeric(14, 2) check (minimum_payment_usd is null or minimum_payment_usd >= 0),
  credit_limit_dop numeric(14, 2) check (credit_limit_dop is null or credit_limit_dop >= 0),
  credit_limit_usd numeric(14, 2) check (credit_limit_usd is null or credit_limit_usd >= 0),
  usd_to_dop_rate numeric(14, 4) check (usd_to_dop_rate is null or usd_to_dop_rate > 0),
  statement_date date,
  credit_card_status text check (credit_card_status is null or credit_card_status in ('al_dia', 'vencida', 'mora', 'sobregirada')),
  payment_frequency public.debt_payment_frequency not null default 'monthly',
  status public.debt_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debts_due_date_after_start_date check (due_date is null or due_date >= start_date),
  constraint debts_outstanding_not_above_initial check (outstanding_balance <= initial_amount)
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text check (payment_method is null or payment_method in ('cash', 'card', 'transfer', 'other')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.debt_subaccounts (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  credit_limit numeric(14, 2) not null default 0 check (credit_limit >= 0),
  available numeric(14, 2) generated always as (credit_limit - balance) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, debt_id, name)
);

create table if not exists public.debt_installments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14, 2) not null check (amount > 0),
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  paid_at date,
  debt_payment_id uuid references public.debt_payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, debt_id, description, amount, due_date)
);

alter table public.debts drop constraint if exists debts_initial_amount_check;
alter table public.debts drop constraint if exists debts_outstanding_balance_check;
alter table public.debts drop constraint if exists debts_outstanding_not_above_initial;
alter table public.debts
  add constraint debts_initial_amount_check check (initial_amount >= 0),
  add constraint debts_outstanding_balance_check check (outstanding_balance >= 0),
  add constraint debts_outstanding_not_above_initial check (outstanding_balance <= initial_amount);

alter table public.debts add column if not exists card_last4 text;
alter table public.debts add column if not exists currency text not null default 'DOP';
alter table public.debts add column if not exists credit_limit numeric(14, 2);
alter table public.debts add column if not exists used_balance numeric(14, 2);
alter table public.debts add column if not exists statement_balance numeric(14, 2);
alter table public.debts add column if not exists balance_dop numeric(14, 2);
alter table public.debts add column if not exists balance_usd numeric(14, 2);
alter table public.debts add column if not exists minimum_payment_dop numeric(14, 2);
alter table public.debts add column if not exists minimum_payment_usd numeric(14, 2);
alter table public.debts add column if not exists credit_limit_dop numeric(14, 2);
alter table public.debts add column if not exists credit_limit_usd numeric(14, 2);
alter table public.debts add column if not exists usd_to_dop_rate numeric(14, 4);
alter table public.debts add column if not exists statement_date date;
alter table public.debts add column if not exists credit_card_status text;

update public.debts
   set credit_card_status = case credit_card_status
     when 'current' then 'al_dia'
     when 'overdue' then 'vencida'
     when 'delinquent' then 'mora'
     else credit_card_status
   end
 where credit_card_status in ('current', 'overdue', 'delinquent');

alter table public.debts drop constraint if exists debts_card_last4_check;
alter table public.debts drop constraint if exists debts_currency_check;
alter table public.debts drop constraint if exists debts_credit_limit_check;
alter table public.debts drop constraint if exists debts_used_balance_check;
alter table public.debts drop constraint if exists debts_statement_balance_check;
alter table public.debts drop constraint if exists debts_balance_dop_check;
alter table public.debts drop constraint if exists debts_balance_usd_check;
alter table public.debts drop constraint if exists debts_minimum_payment_dop_check;
alter table public.debts drop constraint if exists debts_minimum_payment_usd_check;
alter table public.debts drop constraint if exists debts_credit_limit_dop_check;
alter table public.debts drop constraint if exists debts_credit_limit_usd_check;
alter table public.debts drop constraint if exists debts_usd_to_dop_rate_check;
alter table public.debts drop constraint if exists debts_credit_card_status_check;
alter table public.debts
  add constraint debts_card_last4_check check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  add constraint debts_currency_check check (currency in ('DOP', 'USD', 'EUR', 'BOB')),
  add constraint debts_credit_limit_check check (credit_limit is null or credit_limit >= 0),
  add constraint debts_used_balance_check check (used_balance is null or used_balance >= 0),
  add constraint debts_statement_balance_check check (statement_balance is null or statement_balance >= 0),
  add constraint debts_balance_dop_check check (balance_dop is null or balance_dop >= 0),
  add constraint debts_balance_usd_check check (balance_usd is null or balance_usd >= 0),
  add constraint debts_minimum_payment_dop_check check (minimum_payment_dop is null or minimum_payment_dop >= 0),
  add constraint debts_minimum_payment_usd_check check (minimum_payment_usd is null or minimum_payment_usd >= 0),
  add constraint debts_credit_limit_dop_check check (credit_limit_dop is null or credit_limit_dop >= 0),
  add constraint debts_credit_limit_usd_check check (credit_limit_usd is null or credit_limit_usd >= 0),
  add constraint debts_usd_to_dop_rate_check check (usd_to_dop_rate is null or usd_to_dop_rate > 0),
  add constraint debts_credit_card_status_check check (credit_card_status is null or credit_card_status in ('al_dia', 'vencida', 'mora', 'sobregirada'));

create unique index if not exists monthly_budgets_general_unique
  on public.monthly_budgets(user_id, month)
  where category_id is null;

create unique index if not exists monthly_budgets_category_unique
  on public.monthly_budgets(user_id, month, category_id)
  where category_id is not null;

create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists categories_user_type_idx on public.categories(user_id, type);
create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists accounts_user_type_idx on public.accounts(user_id, type);
create index if not exists transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index if not exists transactions_user_type_idx on public.transactions(user_id, type);
create index if not exists transactions_category_id_idx on public.transactions(category_id);
create index if not exists transactions_account_id_idx on public.transactions(account_id);
create index if not exists account_transfers_user_date_idx on public.account_transfers(user_id, transfer_date desc);
create index if not exists account_transfers_from_account_id_idx on public.account_transfers(from_account_id);
create index if not exists account_transfers_to_account_id_idx on public.account_transfers(to_account_id);
create index if not exists monthly_budgets_user_month_idx on public.monthly_budgets(user_id, month);
create index if not exists debts_user_id_idx on public.debts(user_id);
create index if not exists debts_user_status_idx on public.debts(user_id, status);
create index if not exists debts_user_due_date_idx on public.debts(user_id, due_date);
create index if not exists debt_payments_user_id_idx on public.debt_payments(user_id);
create index if not exists debt_payments_debt_id_idx on public.debt_payments(debt_id);
create index if not exists debt_payments_user_date_idx on public.debt_payments(user_id, payment_date desc);
create index if not exists debt_subaccounts_user_id_idx on public.debt_subaccounts(user_id);
create index if not exists debt_subaccounts_debt_id_idx on public.debt_subaccounts(debt_id);
create index if not exists debt_installments_user_id_idx on public.debt_installments(user_id);
create index if not exists debt_installments_debt_id_idx on public.debt_installments(debt_id);
create index if not exists debt_installments_user_status_idx on public.debt_installments(user_id, status);
alter table public.debt_payments add column if not exists transaction_id uuid;
alter table public.transactions add column if not exists debt_id uuid;
alter table public.transactions add column if not exists debt_payment_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'debt_payments_transaction_id_fkey'
  ) then
    alter table public.debt_payments
      add constraint debt_payments_transaction_id_fkey
      foreign key (transaction_id) references public.transactions(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_debt_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_debt_id_fkey
      foreign key (debt_id) references public.debts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_debt_payment_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_debt_payment_id_fkey
      foreign key (debt_payment_id) references public.debt_payments(id) on delete set null;
  end if;
end;
$$;

create index if not exists transactions_debt_id_idx on public.transactions(debt_id);
create unique index if not exists transactions_debt_payment_unique_idx
  on public.transactions(user_id, debt_payment_id)
  where debt_payment_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
before update on public.accounts
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

drop trigger if exists set_account_transfers_updated_at on public.account_transfers;
create trigger set_account_transfers_updated_at
before update on public.account_transfers
for each row
execute function public.set_updated_at();

drop trigger if exists set_monthly_budgets_updated_at on public.monthly_budgets;
create trigger set_monthly_budgets_updated_at
before update on public.monthly_budgets
for each row
execute function public.set_updated_at();

drop trigger if exists set_debts_updated_at on public.debts;
create trigger set_debts_updated_at
before update on public.debts
for each row
execute function public.set_updated_at();

drop trigger if exists set_debt_subaccounts_updated_at on public.debt_subaccounts;
create trigger set_debt_subaccounts_updated_at
before update on public.debt_subaccounts
for each row
execute function public.set_updated_at();

drop trigger if exists set_debt_installments_updated_at on public.debt_installments;
create trigger set_debt_installments_updated_at
before update on public.debt_installments
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.account_transfers enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.debt_subaccounts enable row level security;
alter table public.debt_installments enable row level security;

grant usage on schema public to anon, authenticated;
grant usage on type public.transaction_type to authenticated;
grant usage on type public.debt_type to authenticated;
grant usage on type public.debt_payment_frequency to authenticated;
grant usage on type public.debt_status to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.account_transfers to authenticated;
grant select, insert, update, delete on public.monthly_budgets to authenticated;
grant select, insert, update, delete on public.debts to authenticated;
grant select, insert, update, delete on public.debt_payments to authenticated;
grant select, insert, update, delete on public.debt_subaccounts to authenticated;
grant select, insert, update, delete on public.debt_installments to authenticated;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete their profile" on public.profiles;
create policy "Users can delete their profile"
  on public.profiles for delete
  using (auth.uid() = id);

drop policy if exists "Users can read their preferences" on public.user_preferences;
create policy "Users can read their preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their preferences" on public.user_preferences;
create policy "Users can create their preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their preferences" on public.user_preferences;
create policy "Users can update their preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their preferences" on public.user_preferences;
create policy "Users can delete their preferences"
  on public.user_preferences for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their categories" on public.categories;
create policy "Users can read their categories"
  on public.categories for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their categories" on public.categories;
create policy "Users can create their categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their categories" on public.categories;
create policy "Users can update their categories"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their categories" on public.categories;
create policy "Users can delete their categories"
  on public.categories for delete
  using (auth.uid() = user_id);

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

drop policy if exists "Users can read their transactions" on public.transactions;
create policy "Users can read their transactions"
  on public.transactions for select
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
    and (
      category_id is null
      or exists (
        select 1 from public.categories
        where categories.id = category_id
          and categories.user_id = auth.uid()
      )
    )
    and (
      debt_id is null
      or exists (
        select 1 from public.debts
        where debts.id = debt_id
          and debts.user_id = auth.uid()
      )
    )
    and (
      debt_payment_id is null
      or exists (
        select 1 from public.debt_payments
        where debt_payments.id = debt_payment_id
          and debt_payments.user_id = auth.uid()
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
    and (
      category_id is null
      or exists (
        select 1 from public.categories
        where categories.id = category_id
          and categories.user_id = auth.uid()
      )
    )
    and (
      debt_id is null
      or exists (
        select 1 from public.debts
        where debts.id = debt_id
          and debts.user_id = auth.uid()
      )
    )
    and (
      debt_payment_id is null
      or exists (
        select 1 from public.debt_payments
        where debt_payments.id = debt_payment_id
          and debt_payments.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can delete their transactions" on public.transactions;
create policy "Users can delete their transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

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

drop policy if exists "Users can read their debt payments" on public.debt_payments;
create policy "Users can read their debt payments"
  on public.debt_payments for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their debt payments" on public.debt_payments;
create policy "Users can create their debt payments"
  on public.debt_payments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debts
      where debts.id = debt_id
        and debts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their debt payments" on public.debt_payments;
create policy "Users can delete their debt payments"
  on public.debt_payments for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their debt subaccounts" on public.debt_subaccounts;
create policy "Users can read their debt subaccounts"
  on public.debt_subaccounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their debt subaccounts" on public.debt_subaccounts;
create policy "Users can create their debt subaccounts"
  on public.debt_subaccounts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debts
      where debts.id = debt_id
        and debts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their debt subaccounts" on public.debt_subaccounts;
create policy "Users can update their debt subaccounts"
  on public.debt_subaccounts for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debts
      where debts.id = debt_id
        and debts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their debt subaccounts" on public.debt_subaccounts;
create policy "Users can delete their debt subaccounts"
  on public.debt_subaccounts for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their debt installments" on public.debt_installments;
create policy "Users can read their debt installments"
  on public.debt_installments for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their debt installments" on public.debt_installments;
create policy "Users can create their debt installments"
  on public.debt_installments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debts
      where debts.id = debt_id
        and debts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their debt installments" on public.debt_installments;
create policy "Users can update their debt installments"
  on public.debt_installments for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debts
      where debts.id = debt_id
        and debts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their debt installments" on public.debt_installments;
create policy "Users can delete their debt installments"
  on public.debt_installments for delete
  using (auth.uid() = user_id);

drop function if exists public.register_debt_payment(uuid, numeric, date, text, text);

create or replace function public.register_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_payment_method text default null,
  p_note text default null,
  p_create_movement boolean default false,
  p_category_id uuid default null,
  p_account_id uuid default null
)
returns public.debt_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.debts%rowtype;
  v_payment public.debt_payments%rowtype;
  v_transaction_id uuid;
  v_next_balance numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para registrar pagos.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El pago debe ser mayor que 0.';
  end if;

  if p_payment_method is not null and p_payment_method not in ('cash', 'card', 'transfer', 'other') then
    raise exception 'Metodo de pago no valido.';
  end if;

  select *
    into v_debt
    from public.debts
   where id = p_debt_id
     and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'No se encontro la deuda para este usuario.';
  end if;

  if v_debt.outstanding_balance <= 0 then
    raise exception 'Esta deuda ya esta pagada.';
  end if;

  if p_amount > v_debt.outstanding_balance then
    raise exception 'El pago no puede ser mayor que el saldo pendiente.';
  end if;

  if p_create_movement then
    if p_category_id is null then
      raise exception 'La categoria del movimiento es obligatoria.';
    end if;

    if p_account_id is null then
      raise exception 'La cuenta del movimiento es obligatoria.';
    end if;

    if not exists (
      select 1 from public.categories
      where id = p_category_id
        and user_id = auth.uid()
        and type = 'expense'
    ) then
      raise exception 'La categoria del movimiento no es valida.';
    end if;

    if not exists (
      select 1 from public.accounts
      where id = p_account_id
        and user_id = auth.uid()
    ) then
      raise exception 'La cuenta del movimiento no es valida.';
    end if;
  end if;

  v_next_balance := round(v_debt.outstanding_balance - p_amount, 2);

  insert into public.debt_payments (debt_id, user_id, amount, payment_date, payment_method, note)
  values (p_debt_id, auth.uid(), p_amount, coalesce(p_payment_date, current_date), p_payment_method, nullif(trim(p_note), ''))
  returning * into v_payment;

  if p_create_movement then
    insert into public.transactions (
      user_id,
      category_id,
      account_id,
      debt_id,
      debt_payment_id,
      type,
      amount,
      description,
      payment_method,
      transaction_date
    )
    values (
      auth.uid(),
      p_category_id,
      p_account_id,
      p_debt_id,
      v_payment.id,
      'expense',
      p_amount,
      coalesce(nullif(trim(p_note), ''), 'Pago de deuda: ' || v_debt.name),
      coalesce(p_payment_method, 'transfer'),
      coalesce(p_payment_date, current_date)
    )
    returning id into v_transaction_id;

    update public.debt_payments
       set transaction_id = v_transaction_id
     where id = v_payment.id
     returning * into v_payment;
  end if;

  update public.debts
     set outstanding_balance = v_next_balance,
         status = case when v_next_balance = 0 then 'paid'::public.debt_status else status end
   where id = p_debt_id
     and user_id = auth.uid();

  return v_payment;
end;
$$;

grant execute on function public.register_debt_payment(uuid, numeric, date, text, text, boolean, uuid, uuid) to authenticated;

create or replace function public.create_education_debt_seed()
returns public.debts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.debts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para crear el plan de cuotas.';
  end if;

  select *
    into v_debt
    from public.debts
   where user_id = auth.uid()
     and name = 'Deuda educacion / matricula'
     and creditor = 'Universidad'
   order by created_at desc
   limit 1;

  if not found then
    insert into public.debts (
      user_id,
      name,
      type,
      creditor,
      currency,
      initial_amount,
      outstanding_balance,
      start_date,
      due_date,
      payment_frequency,
      status,
      notes
    )
    values (
      auth.uid(),
      'Deuda educacion / matricula',
      'education',
      'Universidad',
      'DOP',
      173565.67,
      173565.67,
      current_date,
      '2026-07-15',
      'monthly',
      'active',
      'Deuda de matricula con varias cuotas pendientes y un recargo por incumplimiento.'
    )
    returning * into v_debt;
  end if;

  insert into public.debt_installments (debt_id, user_id, description, amount, due_date, status)
  select v_debt.id, auth.uid(), seed.description, seed.amount, seed.due_date,
         case when seed.due_date is not null and seed.due_date < current_date then 'overdue' else 'pending' end
  from (
    values
      ('Recargo por incumplimiento cuota no. 1 del acuerdo de pago, correspondiente al semestre 2026-3', 1966.67::numeric, null::date),
      ('Pago matricula - cuota pendiente', 30866.34::numeric, '2025-02-15'::date),
      ('Pago matricula - cuota pendiente', 30866.33::numeric, '2025-03-15'::date),
      ('Pago matricula - cuota pendiente', 30866.33::numeric, '2025-01-15'::date),
      ('Pago matricula - cuota pendiente', 24750.00::numeric, '2025-10-15'::date),
      ('Pago matricula - cuota pendiente', 24750.00::numeric, '2025-11-15'::date),
      ('Pago matricula - cuota pendiente', 9833.33::numeric, '2026-05-15'::date),
      ('Pago matricula - cuota pendiente', 9833.33::numeric, '2026-06-15'::date),
      ('Pago matricula - cuota pendiente', 9833.34::numeric, '2026-07-15'::date)
  ) as seed(description, amount, due_date)
  where not exists (
    select 1
    from public.debt_installments existing
    where existing.user_id = auth.uid()
      and existing.debt_id = v_debt.id
      and existing.description = seed.description
      and existing.amount = seed.amount
      and existing.due_date is not distinct from seed.due_date
  );

  return v_debt;
end;
$$;

create or replace function public.pay_debt_installment(
  p_installment_id uuid,
  p_payment_date date default current_date,
  p_payment_method text default null,
  p_note text default null
)
returns public.debt_installments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_installment public.debt_installments%rowtype;
  v_debt public.debts%rowtype;
  v_payment public.debt_payments%rowtype;
  v_next_balance numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para pagar cuotas.';
  end if;

  if p_payment_method is not null and p_payment_method not in ('cash', 'card', 'transfer', 'other') then
    raise exception 'Metodo de pago no valido.';
  end if;

  select *
    into v_installment
    from public.debt_installments
   where id = p_installment_id
     and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'No se encontro la cuota para este usuario.';
  end if;

  if v_installment.status = 'paid' then
    raise exception 'Esta cuota ya esta pagada.';
  end if;

  select *
    into v_debt
    from public.debts
   where id = v_installment.debt_id
     and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'No se encontro la deuda principal.';
  end if;

  if v_debt.outstanding_balance <= 0 then
    raise exception 'Esta deuda ya esta pagada.';
  end if;

  if v_installment.amount > v_debt.outstanding_balance then
    raise exception 'La cuota no puede ser mayor que el saldo pendiente.';
  end if;

  v_next_balance := round(v_debt.outstanding_balance - v_installment.amount, 2);

  insert into public.debt_payments (debt_id, user_id, amount, payment_date, payment_method, note)
  values (
    v_debt.id,
    auth.uid(),
    v_installment.amount,
    coalesce(p_payment_date, current_date),
    p_payment_method,
    coalesce(nullif(trim(p_note), ''), 'Pago de cuota: ' || v_installment.description)
  )
  returning * into v_payment;

  update public.debt_installments
     set status = 'paid',
         paid_at = coalesce(p_payment_date, current_date),
         debt_payment_id = v_payment.id
   where id = v_installment.id
   returning * into v_installment;

  update public.debts
     set outstanding_balance = v_next_balance,
         status = case
           when v_next_balance = 0
             or not exists (
               select 1
               from public.debt_installments
               where debt_id = v_debt.id
                 and user_id = auth.uid()
                 and status <> 'paid'
             )
           then 'paid'::public.debt_status
           else status
         end
   where id = v_debt.id
     and user_id = auth.uid();

  return v_installment;
end;
$$;

grant execute on function public.create_education_debt_seed() to authenticated;
grant execute on function public.pay_debt_installment(uuid, date, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'transactions'
    ) then
      alter publication supabase_realtime add table public.transactions;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'categories'
    ) then
      alter publication supabase_realtime add table public.categories;
    end if;

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

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'monthly_budgets'
    ) then
      alter publication supabase_realtime add table public.monthly_budgets;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'debts'
    ) then
      alter publication supabase_realtime add table public.debts;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'debt_payments'
    ) then
      alter publication supabase_realtime add table public.debt_payments;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'debt_subaccounts'
    ) then
      alter publication supabase_realtime add table public.debt_subaccounts;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'debt_installments'
    ) then
      alter publication supabase_realtime add table public.debt_installments;
    end if;
  end if;
end;
$$;

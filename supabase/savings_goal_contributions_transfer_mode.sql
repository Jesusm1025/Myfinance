alter table public.savings_goal_contributions
  add column if not exists source_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists destination_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists transfer_id uuid references public.account_transfers(id) on delete set null,
  add column if not exists contribution_mode text not null default 'manual';

alter table public.savings_goal_contributions
  drop constraint if exists savings_goal_contributions_mode_check;

alter table public.savings_goal_contributions
  add constraint savings_goal_contributions_mode_check
  check (contribution_mode in ('manual', 'transfer'));

create index if not exists savings_goal_contributions_transfer_id_idx
  on public.savings_goal_contributions(transfer_id);

create index if not exists savings_goal_contributions_source_account_id_idx
  on public.savings_goal_contributions(source_account_id);

create index if not exists savings_goal_contributions_destination_account_id_idx
  on public.savings_goal_contributions(destination_account_id);

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
      source_account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = source_account_id
          and accounts.user_id = auth.uid()
      )
    )
    and (
      destination_account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = destination_account_id
          and accounts.user_id = auth.uid()
      )
    )
    and (
      transfer_id is null
      or exists (
        select 1 from public.account_transfers
        where account_transfers.id = transfer_id
          and account_transfers.user_id = auth.uid()
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
      source_account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = source_account_id
          and accounts.user_id = auth.uid()
      )
    )
    and (
      destination_account_id is null
      or exists (
        select 1 from public.accounts
        where accounts.id = destination_account_id
          and accounts.user_id = auth.uid()
      )
    )
    and (
      transfer_id is null
      or exists (
        select 1 from public.account_transfers
        where account_transfers.id = transfer_id
          and account_transfers.user_id = auth.uid()
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

create or replace function public.assert_savings_goal_contribution_ownership(
  p_goal_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_transfer_id uuid,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesion.';
  end if;

  if not exists (
    select 1 from public.savings_goals
    where id = p_goal_id
      and user_id = v_user_id
      and status <> 'cancelled'
  ) then
    raise exception 'Selecciona una meta valida.';
  end if;

  if p_mode not in ('manual', 'transfer') then
    raise exception 'Modo de aporte invalido.';
  end if;

  if p_mode = 'transfer' then
    if p_source_account_id is null or p_destination_account_id is null then
      raise exception 'Selecciona cuenta origen y destino.';
    end if;
    if p_source_account_id = p_destination_account_id then
      raise exception 'La cuenta origen y destino deben ser diferentes.';
    end if;
  end if;

  if p_source_account_id is not null and not exists (
    select 1 from public.accounts where id = p_source_account_id and user_id = v_user_id
  ) then
    raise exception 'Selecciona una cuenta origen valida.';
  end if;

  if p_destination_account_id is not null and not exists (
    select 1 from public.accounts where id = p_destination_account_id and user_id = v_user_id
  ) then
    raise exception 'Selecciona una cuenta destino valida.';
  end if;

  if p_transfer_id is not null and not exists (
    select 1 from public.account_transfers where id = p_transfer_id and user_id = v_user_id
  ) then
    raise exception 'Selecciona una transferencia valida.';
  end if;
end;
$$;

create or replace function public.register_savings_goal_contribution(
  p_goal_id uuid,
  p_amount numeric,
  p_contribution_date date,
  p_note text default null,
  p_account_id uuid default null,
  p_contribution_mode text default 'manual',
  p_source_account_id uuid default null,
  p_destination_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_transfer_id uuid;
  v_contribution_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El aporte debe ser mayor que 0.';
  end if;

  perform public.assert_savings_goal_contribution_ownership(
    p_goal_id,
    p_source_account_id,
    p_destination_account_id,
    null,
    p_contribution_mode
  );

  if p_account_id is not null and not exists (
    select 1 from public.accounts where id = p_account_id and user_id = v_user_id
  ) then
    raise exception 'Selecciona una cuenta valida.';
  end if;

  if p_contribution_mode = 'transfer' then
    insert into public.account_transfers (
      user_id,
      from_account_id,
      to_account_id,
      amount,
      description,
      transfer_date
    )
    values (
      v_user_id,
      p_source_account_id,
      p_destination_account_id,
      p_amount,
      coalesce(nullif(trim(p_note), ''), 'Aporte a meta de ahorro'),
      p_contribution_date
    )
    returning id into v_transfer_id;
  end if;

  insert into public.savings_goal_contributions (
    user_id,
    goal_id,
    account_id,
    source_account_id,
    destination_account_id,
    transfer_id,
    contribution_mode,
    amount,
    contribution_date,
    note
  )
  values (
    v_user_id,
    p_goal_id,
    case when p_contribution_mode = 'transfer' then p_destination_account_id else p_account_id end,
    case when p_contribution_mode = 'transfer' then p_source_account_id else null end,
    case when p_contribution_mode = 'transfer' then p_destination_account_id else null end,
    v_transfer_id,
    p_contribution_mode,
    p_amount,
    p_contribution_date,
    nullif(trim(p_note), '')
  )
  returning id into v_contribution_id;

  return v_contribution_id;
end;
$$;

create or replace function public.update_savings_goal_contribution(
  p_contribution_id uuid,
  p_goal_id uuid,
  p_amount numeric,
  p_contribution_date date,
  p_note text default null,
  p_account_id uuid default null,
  p_contribution_mode text default 'manual',
  p_source_account_id uuid default null,
  p_destination_account_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_transfer_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El aporte debe ser mayor que 0.';
  end if;

  select transfer_id
  into v_existing_transfer_id
  from public.savings_goal_contributions
  where id = p_contribution_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Selecciona un aporte valido.';
  end if;

  perform public.assert_savings_goal_contribution_ownership(
    p_goal_id,
    p_source_account_id,
    p_destination_account_id,
    v_existing_transfer_id,
    p_contribution_mode
  );

  if p_account_id is not null and not exists (
    select 1 from public.accounts where id = p_account_id and user_id = v_user_id
  ) then
    raise exception 'Selecciona una cuenta valida.';
  end if;

  if p_contribution_mode = 'transfer' then
    if v_existing_transfer_id is null then
      insert into public.account_transfers (
        user_id,
        from_account_id,
        to_account_id,
        amount,
        description,
        transfer_date
      )
      values (
        v_user_id,
        p_source_account_id,
        p_destination_account_id,
        p_amount,
        coalesce(nullif(trim(p_note), ''), 'Aporte a meta de ahorro'),
        p_contribution_date
      )
      returning id into v_existing_transfer_id;
    else
      update public.account_transfers
      set
        from_account_id = p_source_account_id,
        to_account_id = p_destination_account_id,
        amount = p_amount,
        description = coalesce(nullif(trim(p_note), ''), 'Aporte a meta de ahorro'),
        transfer_date = p_contribution_date,
        updated_at = now()
      where id = v_existing_transfer_id
        and user_id = v_user_id;
    end if;
  elsif v_existing_transfer_id is not null then
    delete from public.account_transfers
    where id = v_existing_transfer_id
      and user_id = v_user_id;
    v_existing_transfer_id := null;
  end if;

  update public.savings_goal_contributions
  set
    goal_id = p_goal_id,
    account_id = case when p_contribution_mode = 'transfer' then p_destination_account_id else p_account_id end,
    source_account_id = case when p_contribution_mode = 'transfer' then p_source_account_id else null end,
    destination_account_id = case when p_contribution_mode = 'transfer' then p_destination_account_id else null end,
    transfer_id = v_existing_transfer_id,
    contribution_mode = p_contribution_mode,
    amount = p_amount,
    contribution_date = p_contribution_date,
    note = nullif(trim(p_note), ''),
    updated_at = now()
  where id = p_contribution_id
    and user_id = v_user_id;
end;
$$;

create or replace function public.delete_savings_goal_contribution(
  p_contribution_id uuid,
  p_delete_transfer boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_transfer_id uuid;
begin
  select transfer_id
  into v_transfer_id
  from public.savings_goal_contributions
  where id = p_contribution_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Selecciona un aporte valido.';
  end if;

  delete from public.savings_goal_contributions
  where id = p_contribution_id
    and user_id = v_user_id;

  if p_delete_transfer and v_transfer_id is not null then
    delete from public.account_transfers
    where id = v_transfer_id
      and user_id = v_user_id;
  end if;
end;
$$;

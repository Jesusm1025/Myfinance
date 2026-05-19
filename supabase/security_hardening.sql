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
  );

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

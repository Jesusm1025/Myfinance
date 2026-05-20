-- Proteccion final de consistencia para savings_goals.current_amount.
-- Ejecutar despues de savings_goals_stabilization.sql.
--
-- Regla:
-- - Metas sin aportes: current_amount puede editarse manualmente.
-- - Metas con aportes: current_amount solo puede cambiar por el recalculo
--   disparado desde savings_goal_contributions.

create or replace function public.protect_savings_goal_current_amount()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.current_amount is distinct from old.current_amount
    and current_setting('app.savings_goal_recalculation', true) is distinct from 'on'
    and exists (
      select 1
      from public.savings_goal_contributions
      where goal_id = old.id
        and user_id = old.user_id
      limit 1
    )
  then
    raise exception 'El monto actual se recalcula automaticamente desde los aportes y no puede editarse manualmente.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_savings_goal_current_amount_before_update on public.savings_goals;
create trigger protect_savings_goal_current_amount_before_update
before update on public.savings_goals
for each row
execute function public.protect_savings_goal_current_amount();

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
  v_goal_user_id uuid;
  v_request_user_id uuid := auth.uid();
begin
  if p_goal_id is null then
    return;
  end if;

  select target_amount, status, user_id
  into v_target, v_status, v_goal_user_id
  from public.savings_goals
  where id = p_goal_id;

  if not found then
    return;
  end if;

  if v_request_user_id is not null and v_goal_user_id <> v_request_user_id then
    raise exception 'No tienes permiso para recalcular esta meta.';
  end if;

  select coalesce(sum(amount), 0)::numeric(14, 2)
  into v_total
  from public.savings_goal_contributions
  where goal_id = p_goal_id
    and user_id = v_goal_user_id;

  perform set_config('app.savings_goal_recalculation', 'on', true);

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
  where id = p_goal_id
    and user_id = v_goal_user_id;
end;
$$;

-- Esta funcion es interna; el frontend no debe poder ejecutarla directamente.
revoke execute on function public.protect_savings_goal_current_amount() from public, anon, authenticated;
revoke execute on function public.recalculate_savings_goal_current_amount(uuid) from public, anon, authenticated;

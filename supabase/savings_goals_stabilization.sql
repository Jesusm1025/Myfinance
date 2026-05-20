-- Sprint de estabilizacion para Metas de Ahorro.
-- Ejecutar despues de savings_goals.sql, savings_goal_contributions.sql
-- y savings_goal_contributions_transfer_mode.sql.

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

-- Las funciones internas quedan disponibles solo para triggers/RPCs del esquema.
revoke execute on function public.recalculate_savings_goal_current_amount(uuid) from public, anon, authenticated;
revoke execute on function public.handle_savings_goal_contribution_change() from public, anon, authenticated;
revoke execute on function public.assert_savings_goal_contribution_ownership(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;

-- Las RPCs que usa el frontend permanecen disponibles para usuarios autenticados.
revoke execute on function public.register_savings_goal_contribution(uuid, numeric, date, text, uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.update_savings_goal_contribution(uuid, uuid, numeric, date, text, uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.delete_savings_goal_contribution(uuid, boolean) from public, anon;

grant execute on function public.register_savings_goal_contribution(uuid, numeric, date, text, uuid, text, uuid, uuid) to authenticated;
grant execute on function public.update_savings_goal_contribution(uuid, uuid, numeric, date, text, uuid, text, uuid, uuid) to authenticated;
grant execute on function public.delete_savings_goal_contribution(uuid, boolean) to authenticated;

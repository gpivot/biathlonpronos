-- Biathlonpronos — cumul des cartes de course (Guillaume, 30/10/2026). À coller APRÈS 0026.
--
-- - Ça farte se pose sur un des 4 choix d'un 4e choix actif (×3 sur un des 4 biathlètes).
-- - Aspiration ne se cumule pas avec un 4e choix, ni avec un Ça farte sur la même course.
-- Seule play_bonus_card change ; même règle que canPlayCard côté code.

create or replace function play_bonus_card(p_card_id uuid, p_race_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_card bonus_cards%rowtype;
  v_race races%rowtype;
  v_season uuid;
  v_type text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_card from bonus_cards where id = p_card_id and user_id = v_user for update;
  if not found then raise exception 'card_not_found'; end if;
  if v_card.status <> 'available' then raise exception 'card_already_used'; end if;
  v_type := v_card.card_type::text;
  if v_type = 'equipe' then raise exception 'card_activates_itself'; end if;

  select r.* into v_race from races r where r.id = p_race_id;
  if not found then raise exception 'race_not_found'; end if;
  select season_id into v_season from stages where id = v_race.stage_id;
  if v_season <> v_card.season_id then raise exception 'wrong_season'; end if;
  if v_race.locks_at <= effective_now() then raise exception 'race_locked'; end if;
  if v_race.format::text like 'relais%' then raise exception 'individual_races_only'; end if;

  -- Ça farte et Aspiration : jamais deux sur la même course.
  if v_type in ('ca_farte', 'aspiration') and exists (
    select 1 from bonus_cards c
     where c.user_id = v_user and c.status = 'used' and c.used_on_race_id = p_race_id
       and c.card_type::text in ('ca_farte', 'aspiration')
  ) then raise exception 'one_card_at_a_time'; end if;

  -- Aspiration : pas sur une course couverte par un 4e choix.
  if v_type = 'aspiration' and exists (
    select 1 from bonus_cards c
     where c.user_id = v_user and c.status = 'used' and c.card_type::text = 'balle_de_pioche'
       and c.used_on_race_id is not null
       and p_race_id in (select quatrieme_choix_window(c.used_on_race_id))
  ) then raise exception 'one_card_at_a_time'; end if;

  -- 4e choix : pas d'autre 4e choix sur cette course, ni d'Aspiration sur les courses qu'il couvrirait.
  if v_type = 'balle_de_pioche' and (
    exists (
      select 1 from bonus_cards c
       where c.user_id = v_user and c.status = 'used' and c.card_type::text = 'balle_de_pioche'
         and c.used_on_race_id is not null
         and p_race_id in (select quatrieme_choix_window(c.used_on_race_id))
    )
    or exists (
      select 1 from bonus_cards c
       where c.user_id = v_user and c.status = 'used' and c.card_type::text = 'aspiration'
         and c.used_on_race_id in (select quatrieme_choix_window(p_race_id))
    )
  ) then raise exception 'one_card_at_a_time'; end if;

  update bonus_cards
     set status = 'used', used_at = now(), used_on_race_id = p_race_id
   where id = p_card_id;
end;
$$;

revoke all on function play_bonus_card(uuid, uuid) from public;
grant execute on function play_bonus_card(uuid, uuid) to authenticated;

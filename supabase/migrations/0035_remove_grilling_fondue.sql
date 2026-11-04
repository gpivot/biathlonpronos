-- Biathlonpronos — suppression des biathlètes grillés et de la carte Fondue (Guillaume, 04/11/2026).
-- À coller APRÈS 0034, avant de fusionner la PR.
--
-- - La règle des biathlètes grillés (§2) n'existe plus : rien à changer en base, elle n'était
--   calculée que par l'écran de course. La table grilled_states (inutilisée depuis le 27/10) reste
--   en place, sans effet.
-- - La carte Fondue n'est plus proposée au 10/10 (claim_bonus_card) et ne peut plus être jouée
--   (play_bonus_card). Les cartes Fondue déjà prises sont supprimées : le 10/10 qui les avait
--   données redevient un crédit, et le joueur choisit une autre carte (à confirmer).
-- - La valeur 'fondue' reste dans le type bonus_card_type (Postgres ne sait pas retirer une valeur
--   d'un enum simplement) ; elle n'est plus utilisée.
-- - La règle du « coureur grillé » et sa carte (Grillade) restent prévues pour VéloPronos.

delete from bonus_cards where card_type::text = 'fondue';

create or replace function claim_bonus_card(p_season_id uuid, p_card_type text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_earned integer;
  v_held integer;
  v_previous text;
  v_race uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_card_type not in ('ca_farte', 'balle_de_pioche', 'aspiration', 'equipe') then
    raise exception 'card_not_offered';
  end if;

  select coalesce(max(cards_earned), 0) into v_earned
    from streak_counters where user_id = v_user and season_id = p_season_id;
  select count(*) into v_held
    from bonus_cards where user_id = v_user and season_id = p_season_id;
  if v_held >= v_earned then raise exception 'no_card_to_claim'; end if;

  select card_type::text into v_previous
    from bonus_cards where user_id = v_user and season_id = p_season_id
   order by earned_at desc, id desc limit 1;
  if v_previous = p_card_type then raise exception 'same_card_twice_in_a_row'; end if;
  if not bonus_card_unlocked(p_season_id, p_card_type) then raise exception 'card_locked'; end if;

  if p_card_type = 'balle_de_pioche' then
    v_race := next_individual_race(p_season_id);
  elsif p_card_type = 'equipe' then
    v_race := next_race(p_season_id);
  end if;

  insert into bonus_cards (user_id, season_id, card_type, status, used_at, used_on_race_id)
  values (
    v_user, p_season_id, p_card_type::bonus_card_type,
    case when v_race is null then 'available' else 'used' end::bonus_card_status,
    case when v_race is null then null else now() end,
    v_race
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function claim_bonus_card(uuid, text) from public;
grant execute on function claim_bonus_card(uuid, text) to authenticated;

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
  if v_type = 'fondue' then raise exception 'card_retired'; end if;

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

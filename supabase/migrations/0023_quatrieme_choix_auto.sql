-- Biathlonpronos — le 4e choix s'active tout seul (demande de Guillaume, 30/10/2026).
--
-- Choisir le 4e choix au 10/10 l'active aussitôt sur la prochaine course individuelle pas encore
-- partie de la saison : il couvre cette course puis les suivantes, jusqu'à 2 courses par sexe
-- (quatrieme_choix_window, 0022). Ça farte, lui, reste en main et se joue quand le joueur veut.
-- Une carte 4e choix déjà prise mais pas encore jouée est activée de la même façon.

create or replace function next_individual_race(p_season_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select r.id
    from races r join stages s on s.id = r.stage_id
   where s.season_id = p_season_id
     and r.format::text not like 'relais%'
     and r.locks_at > effective_now()
   order by r.locks_at, r.id
   limit 1;
$$;

create or replace function claim_bonus_card(p_season_id uuid, p_card_type bonus_card_type) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_earned integer;
  v_held integer;
  v_race uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_card_type not in ('ca_farte', 'balle_de_pioche') then raise exception 'card_not_offered'; end if;

  select coalesce(max(cards_earned), 0) into v_earned
    from streak_counters where user_id = v_user and season_id = p_season_id;
  select count(*) into v_held
    from bonus_cards where user_id = v_user and season_id = p_season_id;
  if v_held >= v_earned then raise exception 'no_card_to_claim'; end if;

  if p_card_type = 'balle_de_pioche' then
    v_race := next_individual_race(p_season_id);
  end if;

  insert into bonus_cards (user_id, season_id, card_type, status, used_at, used_on_race_id)
  values (
    v_user, p_season_id, p_card_type,
    case when v_race is null then 'available' else 'used' end::bonus_card_status,
    case when v_race is null then null else now() end,
    v_race
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 4e choix déjà pris mais pas encore joué : activé sur la prochaine course individuelle.
update bonus_cards c
   set status = 'used', used_at = now(), used_on_race_id = next_individual_race(c.season_id)
 where c.card_type = 'balle_de_pioche'
   and c.status = 'available'
   and next_individual_race(c.season_id) is not null;

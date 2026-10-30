-- Biathlonpronos — cartes bonus du 10/10 (octobre 2026).
--
-- 1. Lecture des cartes ouverte à tous : le pop-up d'un joueur du Classement affiche ses cartes
--    (disponibles, actives, utilisées). Rien à copier : la cible du ×3 reste dans le pronostic,
--    lisible seulement une fois la course partie (0018).
-- 2. Un joueur ne peut plus écrire directement dans bonus_cards (0012 et 0013 permettaient de
--    s'attribuer n'importe quelle carte ou de remettre une carte jouée à « disponible »). Il passe
--    par deux fonctions qui vérifient les règles :
--    - claim_bonus_card : choisir sa carte après un 10/10 (crédit restant obligatoire) ;
--    - play_bonus_card : jouer une carte sur une course pas encore partie, une seule carte à la
--      fois (pas de Ça farte sur une course couverte par un 4e choix, et inversement).
-- Le 4e choix (balle_de_pioche) couvre la course où il est joué puis les suivantes de la saison,
-- relais exclus, jusqu'à 2 courses par sexe (même règle que quatriemeChoixWindow côté code).

drop policy if exists "bonus_cards: read own" on bonus_cards;
drop policy if exists "bonus_cards: read all" on bonus_cards;
create policy "bonus_cards: read all" on bonus_cards for select using (true);

drop policy if exists "bonus_cards: update own" on bonus_cards;
drop policy if exists "bonus_cards: insert own" on bonus_cards;

-- Courses couvertes par un 4e choix joué sur p_race_id.
create or replace function quatrieme_choix_window(p_race_id uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with activation as (
    select r.id, r.locks_at, s.season_id
      from races r join stages s on s.id = r.stage_id
     where r.id = p_race_id and r.format::text not like 'relais%'
  ),
  candidates as (
    select r.id,
           row_number() over (
             partition by r.sex
             order by r.locks_at, (r.id <> a.id)
           ) as n
      from activation a
      join stages s on s.season_id = a.season_id
      join races r on r.stage_id = s.id
     where r.format::text not like 'relais%'
       and r.locks_at >= a.locks_at
  )
  select id from candidates where n <= 2;
$$;

create or replace function claim_bonus_card(p_season_id uuid, p_card_type bonus_card_type) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_earned integer;
  v_held integer;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_card_type not in ('ca_farte', 'balle_de_pioche') then raise exception 'card_not_offered'; end if;

  select coalesce(max(cards_earned), 0) into v_earned
    from streak_counters where user_id = v_user and season_id = p_season_id;
  select count(*) into v_held
    from bonus_cards where user_id = v_user and season_id = p_season_id;
  if v_held >= v_earned then raise exception 'no_card_to_claim'; end if;

  insert into bonus_cards (user_id, season_id, card_type, status)
  values (v_user, p_season_id, p_card_type, 'available')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function play_bonus_card(p_card_id uuid, p_race_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_card bonus_cards%rowtype;
  v_race races%rowtype;
  v_season uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_card from bonus_cards where id = p_card_id and user_id = v_user for update;
  if not found then raise exception 'card_not_found'; end if;
  if v_card.status <> 'available' then raise exception 'card_already_used'; end if;

  select r.* into v_race from races r where r.id = p_race_id;
  if not found then raise exception 'race_not_found'; end if;
  select season_id into v_season from stages where id = v_race.stage_id;
  if v_season <> v_card.season_id then raise exception 'wrong_season'; end if;
  if v_race.locks_at <= effective_now() then raise exception 'race_locked'; end if;
  if v_race.format::text like 'relais%' then raise exception 'individual_races_only'; end if;

  if v_card.card_type in ('ca_farte', 'balle_de_pioche') then
    -- Une seule carte à la fois : aucune autre carte déjà jouée sur cette course…
    if exists (
      select 1 from bonus_cards c
       where c.user_id = v_user and c.status = 'used' and c.card_type in ('ca_farte', 'balle_de_pioche')
         and (
           (c.card_type = 'ca_farte' and c.used_on_race_id = p_race_id)
           or (c.card_type = 'balle_de_pioche' and c.used_on_race_id is not null
               and p_race_id in (select quatrieme_choix_window(c.used_on_race_id)))
         )
    ) then raise exception 'one_card_at_a_time'; end if;
    -- … ni de Ça farte sur une des courses que couvrirait ce 4e choix.
    if v_card.card_type = 'balle_de_pioche' and exists (
      select 1 from bonus_cards c
       where c.user_id = v_user and c.status = 'used' and c.card_type = 'ca_farte'
         and c.used_on_race_id in (select quatrieme_choix_window(p_race_id))
    ) then raise exception 'one_card_at_a_time'; end if;
  end if;

  update bonus_cards
     set status = 'used', used_at = now(), used_on_race_id = p_race_id
   where id = p_card_id;
end;
$$;

revoke all on function claim_bonus_card(uuid, bonus_card_type) from public;
revoke all on function play_bonus_card(uuid, uuid) from public;
grant execute on function claim_bonus_card(uuid, bonus_card_type) to authenticated;
grant execute on function play_bonus_card(uuid, uuid) to authenticated;
grant execute on function quatrieme_choix_window(uuid) to authenticated;

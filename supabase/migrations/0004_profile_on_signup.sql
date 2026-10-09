-- Biathlonpronos — crée automatiquement la ligne profiles à l'inscription.
-- profiles.id référence auth.users(id), mais rien ne peuplait cette table :
-- toute écriture dépendant de profiles (predictions, bonus_cards...) échouait
-- pour un utilisateur fraîchement inscrit ("violates foreign key constraint
-- predictions_user_id_fkey"). Trigger standard Supabase sur auth.users.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo)
  values (new.id, coalesce(new.raw_user_meta_data->>'pseudo', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

# Biathlonpronos — contexte pour Claude Code

Ce projet a été initié dans une conversation Cowork avec Guillaume (g.pivot@teasermedias.com),
puis développé en grande partie dans Claude Code. Lis ce fichier et le dossier `docs/` avant toute
intervention : ils remplacent les conversations d'origine, qui ne sont pas accessibles.

## En une phrase

Biathlonpronos est un jeu de pronostics sur les courses de biathlon (saison 2026-27), construit
en indépendant de [base44](https://base44.com) (contrairement à l'app sœur cyclisme de Guillaume,
[VéloPronos](https://velopronos.fr), qui elle tourne sur base44), dans le but d'obtenir une base de
code propre et pérenne. Stack : Next.js 14 (App Router) + TypeScript + Tailwind + Supabase +
next-intl (FR/EN, autres langues prévues).

## À lire dans l'ordre

1. `docs/architecture-technique.md` — **le document vivant** : modèle de données, moteur de
   scoring, décisions d'interprétation du règlement (marquées « à confirmer » quand Guillaume ne
   les a pas validées), état d'avancement et prochaines étapes. Commence ici.
2. `docs/reglement.md` — le règlement complet du jeu (barèmes, bonus, cartes). Référence pour
   tout ce qui touche au scoring.
3. `docs/cahier-des-charges.md` — décisions produit actées (périmètre, identité, calendrier).
4. `docs/etude-ux-velopronos.md` — UX de VéloPronos, dont Biathlonpronos reprend les patterns
   (la navigation basse a depuis évolué, voir architecture-technique.md).
5. `README.md` — installation, structure du code, limites connues.

## État du projet

Le projet est installé, compile et tourne. Moteur de scoring, back-office `/admin`, pronostics
(individuel + relais), grillage, cartes bonus, globes de saison, Pépite, classements, ligues,
import CSV des cotes et du calendrier : tout est implémenté et testé (voir
`docs/architecture-technique.md` pour le détail et les points laissés en suspens, dont Chat Noir,
OAuth Google/Apple, publicité/RGPD). La refonte UI (dashboard d'accueil, navigation basse à
6 entrées, Calendrier en accordéon) se fait page par page avec Guillaume.

## Mise en route sur une nouvelle machine

1. `npm install`
2. Copier `.env.example` en `.env.local` et renseigner les clés Supabase (Project Settings >
   API). **Ce fichier n'est jamais versionné** : Guillaume doit le recréer à la main.
3. `npm run dev` puis http://localhost:3000. `npm test` (Vitest) et `npx tsc --noEmit` doivent
   rester verts.
4. La base Supabase est unique et partagée entre toutes les machines. Les migrations
   (`supabase/migrations/`, 0001 à 0015) sont déjà appliquées ; toute nouvelle migration se
   colle dans l'éditeur SQL de Supabase par Guillaume (Claude ne peut pas exécuter de DDL).

## Façons de travailler avec Guillaume

- Il communique en français ; réponses courtes, concrètes.
- Quand une règle du jeu est ambiguë, faire un choix pragmatique **et le consigner dans
  `docs/architecture-technique.md`** avec la mention « à confirmer » : Guillaume relit ces points
  et les corrige (c'est arrivé plusieurs fois, ex. le 10/10 avec choix de carte par le joueur, la
  Pépite comme pronostic caché).
- Vérifier chaque changement : `npx tsc --noEmit`, `npm test`, et pour l'UI un contrôle dans le
  navigateur. Ne pas importer de données réelles (calendrier, cotes) à sa place s'il a dit vouloir
  le faire lui-même.
- Synchronisation entre ses deux ordinateurs via GitHub (`gpivot/biathlonpronos`) : ne pas
  pousser sans demande ; lui rappeler de `pull` avant de commencer et de `push` en finissant.

## Identité graphique

Une planche d'identité (palette, typographie, logo) et des maquettes ont été produites dans un
canevas de design séparé pendant la conversation Cowork. Les tokens de couleur sont dans
`tailwind.config.ts`.

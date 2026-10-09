# Biathlonpronos — contexte pour Claude Code

Ce projet a été initié dans une conversation Cowork avec Guillaume (g.pivot@teasermedias.com).
Lis ce fichier et le dossier `docs/` avant toute intervention : ils remplacent la conversation
d'origine, qui n'est pas accessible depuis Claude Code.

## En une phrase

Biathlonpronos est un jeu de pronostics sur les courses de biathlon (saison 2026-27), construit
en indépendant de [base44](https://base44.com) (contrairement à l'app sœur cyclisme de Guillaume,
[VéloPronos](https://velopronos.fr), qui elle tourne sur base44), dans le but d'obtenir une base de
code propre et pérenne.

## À lire dans l'ordre

1. `docs/reglement.md` — le règlement complet du jeu (barèmes, bonus, cartes...). C'est la
   spécification fonctionnelle de référence pour tout ce qui touche au scoring.
2. `docs/cahier-des-charges.md` — décisions produit actées (périmètre, identité, calendrier).
3. `docs/etude-ux-velopronos.md` — étude de l'UX de VéloPronos, dont Biathlonpronos reprend les
   patterns (navigation, écran de pronostic) avec une identité graphique hivernale.
4. `docs/architecture-technique.md` — modèle de données, moteur de scoring détaillé, état
   d'avancement du code et prochaines étapes. **Commence par ce document pour savoir quoi faire.**

## ⚠️ Ce dépôt n'a jamais été installé ni buildé

Écrit à la main dans un environnement cloud sans accès au registre npm. **La toute première
chose à faire est `npm install && npm run dev`**, puis corriger ce qui ne compile pas avant
d'ajouter la moindre fonctionnalité.

## Où trouver l'identité graphique

Une planche d'identité (palette, typographie, logo) et des maquettes des écrans clés (accueil,
pronostic, classement, ligues) ont été produites comme un canevas de design séparé pendant la
conversation Cowork — demande le lien à Guillaume s'il n'est pas déjà partagé avec toi. Les
tokens de couleur en ont été extraits dans `tailwind.config.ts`.

## Prochaine étape technique

Voir la fin de `docs/architecture-technique.md` — en résumé : faire compiler le projet, puis
construire le moteur de scoring (aucune fonction de calcul des points n'existe encore).

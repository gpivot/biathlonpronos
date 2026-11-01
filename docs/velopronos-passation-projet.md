# VéloPronos — document de passation pour le projet « VéloPronos »

À importer dans le projet VéloPronos (fichiers de référence) avec `velopronos-trajectoire-et-regles.md`.
Il résume l'état des lieux au **01/11/2026**, pour qu'un nouveau fil dans ce projet reparte sans avoir besoin de la conversation d'origine.

## En une phrase

VéloPronos (jeu de pronostics cyclistes, sur base44 en 2026) est reconstruit **à partir du code de Biathlonpronos** (Next.js + TypeScript + Supabase + Capacitor/push), avec les règles propres au vélo, en vraie application iOS/Android. **Ordre acté : Biathlonpronos d'abord, puis on le duplique pour VéloPronos.**

## Où est quoi

| Élément | Emplacement | Statut |
|---|---|---|
| Règles, décisions, matrice vélo/biathlon | `docs/velopronos-trajectoire-et-regles.md` (dépôt Biathlonpronos). Lire en priorité la section **1 bis** (décisions du 01/11) et **1 ter**. | À jour |
| Ancien code base44 | Dépôt privé `gpivot/velopronos` ; copie lisible dans `~/Downloads/velopronos-main` (dézippé). | **Référence de règles uniquement** (scoring dans `base44/functions/saveStageResults`, règlement dans `src/pages/Aide.jsx`, classement saison dans `base44/shared/seasonScoring.ts`) |
| Calendrier 2027 | `~/Documents/VIDEO/VeloPronos/2027/bfc9c41ae_courses-2027.csv` | 20 courses ; **Paris-Roubaix manque** (5e monument, date à fournir) |
| Données de test | `~/Documents/VIDEO/VeloPronos/Tour 2026/` : coureurs (184, avec cotes) et étapes du Tour 2026 | Pour tester sur une course « Tour de France 2026 (test) », dates décalées |
| Joueurs 2026 | `~/Documents/VIDEO/VeloPronos/V_loPronos-users.csv` | 504 e-mails, **pas de pseudo**, 98 adresses relais Apple. **Ne jamais copier ces données dans un dépôt.** |
| Projet Supabase VéloPronos | Créé (voir le tableau de bord Supabase de Guillaume) | Contient le schéma de l'ancienne approche (migrations 0001–0009) : **à vider et reconstruire** avec le nouveau schéma |
| base44 | Abonnement Starter conservé | Export de données limité |

## Ce qui a été fait puis abandonné

Une couche de compatibilité base44 → Supabase (client, authentification, 45 fonctions Edge, migrations 0001–0009) a été écrite dans `~/Downloads/velopronos-main`, puis **abandonnée** : restyler l'app base44 et retirer le mode Cyclo aurait doublé le travail. Rien n'a été déployé. Ces fichiers ne servent plus que de source pour porter les règles.

Réutilisable : les CSV convertis, l'inventaire des règles, la liste des entités base44.

## Décisions structurantes (détail dans le document de trajectoire)

- Un seul mode : l'ancien mode Expert. Fin du mode Cyclo et des classements par mode.
- Graphisme, onglets et pictos de Biathlonpronos ; couleurs marron / jaune / blanc ; Ma saison fusionnée avec le Calendrier.
- Structure : « étape » biathlon (un site) = « course » vélo ; « course » biathlon = « étape » vélo. Une classique est une course à une seule étape.
- Cartes et séries (5 étapes) uniquement pour les courses par étapes et les Grands Tours. Boost (×3), Oreillette (4e choix), Aspiration, Équipe ; Chat noir réservé à la 1re semaine d'un Grand Tour.
- Bonus ×2 : un par course par étapes ; les 5 monuments et les Mondiaux comptent ×2 d'office.
- Classement saison : tous les Grands Tours + 2 meilleures courses par étapes + 8 meilleures classiques + événements bonus.
- Parcours d'accueil : « Jouer » ouvre la prochaine course ; identité demandée à la validation du premier pronostic ; code à 6 chiffres, pas de mot de passe obligatoire.
- Reprise des joueurs 2026 par invitation e-mail.

## Questions encore ouvertes

1. **Dépôt cible** de VéloPronos nouvelle formule : nouveau dépôt, ou remplacement du contenu de `gpivot/velopronos` ?
2. Date de **Paris-Roubaix 2027**.
3. **Couleur du maillot** de chaque course par étapes (Giro rose, Tour jaune, Vuelta rouge, autres courses ?).
4. **Fidélité par paliers** (points ou courses pronostiquées) : à définir.
5. **Super porteur d'eau** de saison ou carte qui réactive un porteur : en réserve.
6. Classements annexes (vert / pois / bleu) des 3 Grands Tours : deuxième vague, si pas trop complexe.

## Façon de travailler avec Guillaume

- Il écrit en français ; réponses courtes et concrètes.
- Quand une règle est ambiguë : choix pragmatique, **consigné « à confirmer »** dans la documentation, puis relu par lui.
- Vérifier chaque changement (types, tests, contrôle dans le navigateur pour l'interface).
- Il colle lui-même les migrations SQL dans Supabase (aucun DDL exécuté par Claude).
- Ne pas pousser sur GitHub sans demande ; lui rappeler de faire `git pull` au début et `git push` à la fin.
- Ne jamais lui demander de coller une clé secrète dans le chat (clé `service_role`, mots de passe).

## Texte à coller dans les instructions du projet VéloPronos

> VéloPronos est la version cyclisme de Biathlonpronos : même base de code (Next.js, Supabase, Capacitor), mêmes codes graphiques, couleurs marron / jaune / blanc, un seul mode de jeu (3 coureurs, cartes bonus, séries de 5 sur courses par étapes). Lis d'abord `velopronos-passation-projet.md` puis `velopronos-trajectoire-et-regles.md` (section 1 bis). On ne démarre le développement qu'une fois Biathlonpronos finalisé, puis dupliqué. Réponds en français, de façon courte et concrète ; consigne les interprétations « à confirmer » dans la documentation ; ne pousse sur GitHub que sur demande.

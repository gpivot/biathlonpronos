# Biathlonpronos — Architecture technique

Ce document traduit le règlement (`reglement.md`) en modèle de données et en logique de moteur de scoring. Décisions actées : reconstruction indépendante de base44, un seul mode de jeu (3 biathlètes), monétisation par pub future uniquement.

## Stack

- **Next.js (App Router, TypeScript)** — front web + back-office admin dans la même app.
- **Supabase** — Postgres managé, auth native (email / Google / Apple), row-level security, cron jobs (pg_cron) pour le verrouillage des pronostics et la réévaluation des cotes.
- **Hébergement Vercel.** Paliers gratuits suffisants pour la phase de tests d'octobre ; passer sur Vercel Pro (~20$/mois) + Supabase Pro (~25$/mois) avant le lancement grand public fin novembre si l'audience le justifie.
- Emplacements publicitaires et bannière de consentement cookies posés dès le départ dans le layout (non activés au lancement).

## Modèle de données (entités principales)

Implémenté dans `supabase/migrations/0001_init.sql` — s'y référer pour le schéma SQL exact (colonnes, contraintes, policies RLS).

- **Season**, **Nation**, **Athlete**, **Odds** (historisées, cote par athlète ou par couple nation+sexe pour "meilleure nation"), **Stage**, **Race**, **RaceResult**, **Prediction**, **SeasonPrediction** (globes), **FavoriteTeam**, **Pepite**, **BonusCard**, **StreakCounter**, **GrilledState**, **League** / **LeagueMembership**, **ScoreLedger** (source de vérité du classement), **Profile** (miroir de `auth.users`).

## Règles confirmées par Guillaume

- **Bonus Team Nation** : le doublement s'applique uniquement à l'athlète de la nation favorite de l'utilisateur qu'il a **effectivement pronostiqué** ce jour-là (pas un score séparé indépendant du pronostic).
- **Bonus Aspiration** : indépendant du pronostic de l'utilisateur — comme on ne peut parier que sur 3 athlètes, ce bonus récompense la performance collective réelle de l'équipe favorite (4 athlètes ou plus en Top 10 → bonus), même si l'utilisateur n'a pas pu tous les jouer.
- **Cote "meilleure nation"** : une cote par couple (nation, sexe), les niveaux pouvant différer fortement entre hommes et femmes d'un même pays.

## Moteur de scoring — séquence par course (à implémenter)

1. À la saisie des résultats par l'admin : figer la cote effective de chaque athlète pour cette course (recalcul spécifique pour la poursuite, à partir des écarts du sprint).
2. Pour chaque pronostic déposé sur la course : points de base = cote × multiplicateur de rang (0 si hors Top 10, sauf courses spéciales).
3. Bonus de combinaison (podium / top 5 / top 10 / prono parfait) évalués sur l'ensemble des 3 choix.
4. Malus des courses spéciales (tour de péna / brouillard / t'es collé) si la course est marquée comme telle.
5. Effets des bonus actifs de l'utilisateur : bonus ×2 saison, carte "Ça farte" (×3 sur un athlète), carte "Balle de pioche" (4 choix, 3 meilleurs comptent).
6. Coefficient ×2 Mondiaux/JO appliqué à l'ensemble du score de la course (non cumulable avec le bonus ×2 personnel).
7. **Bonus Team Nation** : si l'un des athlètes pronostiqués par l'utilisateur appartient à sa nation/sexe favori(te) ET que la course a lieu dans le pays de cette nation, les points obtenus via cet athlète (étapes 2-6 comprises) sont doublés.
8. **Bonus Aspiration** : calculé indépendamment des choix de l'utilisateur, à partir du nombre d'athlètes de sa nation/sexe favori(te) classés Top 10 sur la course (2 → +20, 3 → +50, 4+ → +100), et ajouté à son score.
9. Bonus Fusée / Gâchette si l'un des athlètes choisis correspond à la performance du jour.
10. Mise à jour du compteur de série 10/10.
11. Écriture du résultat détaillé dans le ScoreLedger ; le classement général et les classements annexes sont des agrégats du ScoreLedger, jamais recalculés "à la main".

**Implémenté** dans `src/lib/scoring/` (fonction pure TypeScript, testée avec Vitest —
`npm test` — sans dépendre de Supabase, voir `src/lib/scoring/__tests__/`). Reste à écrire :
la route API / fonction Postgres qui appelle ce moteur avec les données réelles d'une course
et écrit le résultat dans `score_ledger` (back-office de saisie de résultats, non construit).

### Décisions d'implémentation du moteur de scoring (confirmées par Guillaume)

Le règlement laissait plusieurs points d'interprétation ouverts pour l'implémentation. Choix
retenus dans `src/lib/scoring/individualRace.ts`, confirmés par Guillaume le 2026-09-11 :

- **Bonus de combinaison (podium/top5/top10)** : mutuellement exclusifs, seul le palier le
  plus élevé atteint est payé (pas de cumul). Ne s'applique que sur un pronostic complet de
  3 choix comptés.
  **Depuis fin octobre 2026 (demande de Guillaume) : le Prono parfait remplace le bonus
  Top 3/Top 5/Top 10, il ne s'y ajoute pas.** Les bonus sont affichés « Bonus Top 3 / Top 5 /
  Top 10 » (le palier est retrouvé à partir du montant enregistré). Les courses déjà notées avant
  ce changement gardent leurs points tant qu'elles ne sont pas renotées.
- **Fusée / Gâchette** : attribués par athlète (et non plus comme un bonus global de fin de
  calcul), sur l'ensemble des biathlètes réellement pronostiqués. Le filtrage "3 meilleurs sur
  4" de la carte "Balle de pioche" s'applique **après** l'ajout de ce bonus — un athlète
  auteur d'un sans-faute peut donc être "sauvé" par ce bonus au moment de la sélection.
- **Carte "Balle de pioche"** : le 4e choix exclu est celui dont le score (cote × rang + malus
  éventuels + Fusée/Gâchette) est le plus faible des 4 — pas nécessairement celui avec le plus
  mauvais classement brut.
- **Prono parfait** : évalué en comparant les 3 athlètes effectivement comptés (donc, avec la
  Balle de pioche, les 3 meilleurs des 4 choix — puisque ce sont mécaniquement les 3 qui
  comptent pour l'étape) à la combinaison des 3 athlètes du Top 10 qui rapportent objectivement
  le plus de points (cote × rang + Fusée/Gâchette).
- **Bonus Team Nation** (§10) : le doublement porte sur le score total réellement gagné par cet
  athlète — base (cote × rang, malus spéciaux inclus) **+ son bonus Fusée/Gâchette s'il y est
  éligible** — mais pas les bonus/malus de niveau pronostic (combinaison, "t'es collé(e)") qui
  ne sont pas attribuables à un athlète en particulier.
- **Carte "Ça farte" (×3) non cumulable avec un ×2** : quel qu'il soit — coefficient
  Mondiaux/JO, bonus ×2 personnel, ou Team Nation. L'athlète ciblé par "Ça farte" reçoit
  uniquement le ×3, jamais ×6 ni davantage.
- **"T'es collé(e)"** : le malus à -200 ne s'applique qu'en l'absence totale de pronostic sur
  la course ; choisir 1 ou 2 biathlètes applique le malus progressif normal (-30/-100/-300) en
  traitant les choix manquants comme hors Top 10, conformément à la formulation du règlement.

### Relais (§5) — décisions confirmées par Guillaume (2026-09-11)

- **Cotes de relais** (`relais_h`, `relais_f`, `relais_mixte`, `relais_mixte_simple`, ajoutées à
  l'enum `odds_format` par les migrations 0008/0009) : ce sont des cotes **course**, par nation,
  réévaluées aux mêmes pauses de saison que sprint/individuel/mass start — *pas* des cotes saison
  fixes. Implémenté dans `src/lib/scoring/relay.ts` (`computeRelayScore`) : cote × multiplicateur
  de rang (§5, top 5 uniquement), coefficient Mondiaux/JO et bonus ×2 personnel (§7 : utilisable
  sur un relais), mutuellement exclusifs comme pour les courses individuelles. Aucun bonus de
  combinaison ni malus de course spéciale (non mentionnés pour les relais dans le règlement — à
  confirmer si un besoin apparaît).
- **Relais mixte et mixte simple** : cote distincte par nation pour chacun des deux formats (pas
  de cote partagée), et pas de sexe associé (`nation_sex` NULL) puisqu'une nation aligne une seule
  équipe mixte.
- **Cote "meilleure nation"** (§6, pronostic de saison) : reste indépendante des cotes de relais —
  c'est une cote **saison** par (nation, sexe), fixée une fois en début de saison et ne bougeant
  plus (déjà correctement modélisée depuis 0001_init.sql, aucun changement nécessaire).
- Écrans : `/admin/athletes` (cotes par nation et par format, ex-`/admin/relais`), écran de pronostic joueur
  (`RelayPredictionForm.tsx`, sélection d'une nation), saisie des résultats admin (mode "nation"
  dans `ResultsForm.tsx`) — tout branché sur `scoreRace()` (`src/lib/admin/raceResults.ts`), y
  compris la mise à jour du 10/10 (§12 : "hommes et femmes confondus ainsi que relais").
- **Import CSV des cotes** : fichier unique depuis octobre 2026, cf. « Réorganisation du
  back-office ».

### Hors périmètre de cette première version du moteur

- **Globes de saison** (gros globe / meilleur jeune / meilleure nation, §6) et **Pépite** (§14) :
  implémentés depuis, voir plus bas. Seule la correction **Chat Noir** (§13) reste hors périmètre,
  en suspens (dépend d'un verrouillage/correction des globes non construit).
- **Grillage** (§2) : n'est pas un calcul de points, mais une contrainte de sélection à
  vérifier côté écran de pronostic (empêcher de choisir un biathlète grillé) — pas traité ici.

## État d'avancement du code

Projet installé, buildé et testé en conditions réelles sur un vrai projet Supabase (npm install fait,
compilation propre, `npm test` = 27 tests verts sur le moteur de scoring).

**Présent et testé de bout en bout** :
- authentification email (inscription + connexion, confirmation désactivée en dev) — Google/Apple
  configurés mais pas testés (nécessitent des credentials OAuth réels)
- internationalisation FR/EN (next-intl, routing par préfixe `/fr`, `/en` — voir README)
- 7 écrans joueur (nav basse + satellites) : accueil, étapes/courses, écran de pronostic
  (individuel et relais), classement général, ligues (créer/rejoindre par code, classement
  privé), pronos (mes pronostics + courses à jouer), compte (équipe favorite), règles
- moteur de scoring courses individuelles ET relais (`src/lib/scoring/`), toutes les règles
  confirmées par Guillaume — voir "Décisions d'implémentation" ci-dessus
- back-office complet (`/admin`, protégé par `profiles.is_admin`) : gestion des saisons, des
  athlètes et de leurs cotes (individuelles et relais), des étapes et des courses, saisie des
  résultats (individuels et relais) → calcul automatique des scores de tous les pronostics +
  cascade de la cote poursuite (§4) + mise à jour du 10/10
- 9 migrations SQL appliquées (`supabase/migrations/0002` à `0009`) corrigeant des bugs trouvés en
  testant en réel (lecture publique des tables de jeu, unicité des cotes courantes et des lignes
  de score, trigger de création du profil à l'inscription, rôle admin, lecture publique du
  classement) et ajoutant les cotes de relais

**Absent** : correction Chat Noir (dépend des globes, dont le pronostic joueur existe mais dont la
saisie n'est pas encore verrouillable/corrigeable), pages publicitaires/RGPD.

**Cartes bonus — implémentées et testées de bout en bout.** Confirmé par Guillaume (2026-09-11) :
au 10/10, **le joueur choisit lui-même** le type de carte (pas de tirage aléatoire) parmi les 4,
sauf s'il détient déjà un exemplaire non utilisé de ce type (grisé jusqu'à consommation) —
`streak_counters.cards_earned` sert de compteur de crédits, `/compte` affiche le sélecteur
(`ClaimCardPicker`) dès qu'un crédit n'est pas encore réclamé. Écran de pronostic : sélecteur
"Aucune / Balle de pioche / Ça farte" (mutuellement exclusifs, cf. colonne unique
`predictions.bonus_card_used`), sélection de la cible du ×3 pour Ça farte, bouton dédié "Utiliser
Fondue" sur l'écran de course. Bonus ×2 personnel (§7) : compteur "3 par saison" calculé à la volée,
désactivé sur les courses spéciales et les étapes Mondiaux/JO. **Chat Noir** non câblé (dépend du
verrouillage/correction des globes, non construit).

**Globes de saison (§6) et Pépite (§14) — implémentés et testés de bout en bout.**
`src/lib/scoring/seasonPredictions.ts` : barème gros globe vs jeune/nation (`GROS_GLOBE_MULTIPLIERS`
/ `PETIT_GLOBE_MULTIPLIERS`). Écran joueur `/globes` (lien depuis `/pronos`) : 6 pronostics de
saison + choix de la Pépite. Écran admin `/admin/globes` (section « Globes de saison » de `/admin` depuis octobre 2026) : saisie du classement final officiel
(jusqu'à 5 rangs) par catégorie, déclenche le calcul. **Pas encore fait** : verrouillage des globes
avant le début de saison au niveau base (la page affiche un message mais rien n'empêche une écriture
directe), correction Chat Noir (en suspens, cf. §12 ci-dessous).

**Pépite (§14) — mécanique corrigée par Guillaume, une par sexe.** Ce n'est pas un bonus fixe au
1er Top 10 : c'est un **pronostic caché**, actif sur chaque course individuelle jusqu'à son 1er
Top 10 de la saison. À ce moment-là, `computePepiteBonus` (cote de la course × multiplicateur de
rang, même barème que §1) calcule le score qu'elle aurait rapporté sur cette course, et ce score
s'ajoute en bonus au score du joueur (`applyPepiteBonuses` dans `scoreRace()`, indépendamment des
pronostics du joueur sur cette course). Ensuite, `bonus_claimed = true` et elle redevient un
athlète normal — plus aucun bonus automatique sur les courses suivantes. Une Pépite homme et une
Pépite femme par joueur/saison (`pepites` a désormais une clé `(user_id, season_id, sex)`, migration
`0015_pepites_per_sex.sql` — colonne `sex` ajoutée, backfillée depuis l'athlète, puis PK recréée).
Écran `/globes` : deux sélecteurs (Femmes / Hommes), chacun verrouillé une fois validé.

**Classements annexes (Dossard Rouge) — une seule dimension implémentée, le reste mis en suspens.**
L'idée initiale de Guillaume était un classement par type de course (sprint/poursuite/individuel/
mass start/relais) ; **mise en suspens pour l'instant, à reprendre plus tard**. Seule la meilleure
série 10/10 en cours (`/classement`, section rouge) est implémentée aujourd'hui.

**Import CSV des cotes — première version (`/admin/import`), remplacée en octobre 2026 par un fichier unique (cf. « Réorganisation du back-office »).** En-têtes
confirmés par Guillaume : fichiers femmes/hommes (`nom, prénom, nationalité, globe, jeune, nation,
sprint, poursuite, individuel, mass, relais`) et fichier relais mixtes (`nation, mixte, simple`).
Crée les athlètes manquants, met à jour les cotes des existants (recherche par nom+prénom+nation),
déduplique les cotes de nation répétées par ligne. Ré-exécutable sans dupliquer (même mécanisme
`setCurrentOdds` que partout ailleurs). Testé en conditions réelles via un script ponctuel appelant
directement `importAthleteOddsCsv` (upload de fichier non automatisable avec les outils de test
actuels) — logique validée, écran `/admin/import` non testé interactivement par Claude.

**Corrigé en testant le grillage** : la policy RLS `predictions: update own before lock` ne
vérifiait en réalité jamais `locks_at` malgré son nom — un pronostic restait modifiable après le
départ de la course (migration 0010). Le grillage (§2) est maintenant implémenté : à chaque
pronostic soumis sur une course individuelle, `grilled_states` est entièrement remplacé pour
l'étape avec les 3 athlètes choisis (migration 0011 pour l'autoriser en écriture côté client) ;
l'écran de pronostic désactive les athlètes grillés. Le dégrillage au changement d'étape est
automatique par construction (`grilled_states` est scopé par `stage_id`) ; la carte "Fondue"
(dégrillage anticipé) reste à câbler une fois les cartes bonus construites.

**Grillage recalculé à partir des pronostics (27/10/2026)** : `grilled_states` mélangeait les
courses (il contenait toujours les choix du dernier pronostic enregistré, y compris celui de la
course affichée), ce qui grillait ses propres choix et empêchait de modifier un pronostic avant le
départ. Désormais l'écran de course calcule les grillés à la volée (`src/lib/grilling.ts`) : ce
sont les biathlètes choisis par le joueur sur la course individuelle précédente de la même étape,
**du même sexe** (les relais et les courses de l'autre sexe sont ignorés — *à confirmer*). La
carte Fondue est rattachée à la course où elle est jouée (`bonus_cards.used_on_race_id`) et y
supprime le grillage. Un biathlète grillé déjà présent dans le pronostic peut en être retiré. La
table `grilled_states` n'est plus utilisée (aucune migration nécessaire).

## Refonte UI — dashboard d'accueil et navigation basse

**Point de départ : demande de Guillaume de repartir de la structure de VéloPronos** (captures
d'écran de son dashboard réel) pour ne pas perdre les joueurs habitués à cette app sœur, tout en
gardant la palette hivernale propre à Biathlonpronos.

**Navigation basse — 6 entrées au lieu de 5** (`src/components/BottomNav.tsx`, désormais un
composant serveur async) : Accueil / Calendrier / Classement / Ma saison / Ligues, plus **Admin**
en 6e position, affiché uniquement si `profiles.is_admin` (vérifié à chaque rendu via une requête
Supabase dans le composant lui-même, pas de prop à faire descendre depuis chaque page). Le lien
Admin est un `<a>` natif (pas le `Link` i18n) car `/admin` est hors routing `[locale]`.

**Dashboard d'accueil refait** (`src/app/[locale]/page.tsx`) :
- Carte saison : badge "Saison {label}", nation favorite (si définie) avec drapeau emoji, rang +
  points au classement général, boutons "Classement" / "Ma saison". **Décision : pas d'équivalent
  à l'« équipe de cœur » de VéloPronos** (le vélo a des équipes trade en plus des nations ; le
  biathlon n'a que des équipes nationales, donc la nation favorite *est* déjà l'équivalent complet
  de "nation + équipe" côté vélo) — à confirmer par Guillaume si un autre sens était voulu.
- Section "En ce moment" : étape dont la date du jour tombe dans `[starts_on, ends_on]` (pas de
  statut "en cours" en base pour les courses, seulement `upcoming/locked/finished` — c'est une
  lecture de date sur l'étape, pas de la course).
- Section "Prochainement" : prochaine course non verrouillée (`locks_at` croissant), lien direct
  vers l'écran de pronostic.
- Aperçu du classement (top 5) + bouton vers `/classement` complet.
- Section "Dernier résultat" (`src/components/LastResultCard.tsx`, données `src/lib/lastResult.ts`,
  modèle VéloPronos) : dernière course notée (`status = finished`, `locks_at` passé selon l'horloge
  simulée), total de points, place du joueur sur la course (parmi les lignes `score_ledger` de la
  course, ex aequo à la même place), badges Bonus ×2 / carte, chacun de ses choix avec sa place et
  ses points (en rouge si négatifs), bonus hors athlète (combinaison, prono parfait, malus, aspiration,
  Pépite) puis le podium. Les points par athlète ne sont pas stockés : ils sont **reconstitués** depuis
  `score_ledger.breakdown` en rejouant les multiplicateurs du moteur (test qui vérifie l'égalité avec
  `computeIndividualRaceScore`). Masquée tant qu'aucune course n'est notée.
- Ancienne carte promo "Pronostics à 3 biathlètes / Gratuit" et liste brute des étapes à venir
  **supprimées** (remplacées par les sections ci-dessus, plus alignées sur VéloPronos).

**Nouveaux utilitaires partagés** :
- `src/lib/leaderboard.ts` — `getLeaderboard()` extrait de `classement/page.tsx` pour être
  réutilisé par la page d'accueil (calcul du rang du joueur) sans dupliquer l'agrégation.
- `src/lib/nationFlags.ts` — `nationFlagEmoji(code)`, table de correspondance alpha-3 (codes en
  base, style IOC) → alpha-2 (pour construire l'emoji drapeau), limitée aux nations habituelles de
  la Coupe du monde de biathlon. **À étendre si une nation absente de la table apparaît en base**
  (retombe sur un drapeau blanc 🏳️ par défaut, pas d'erreur).

**Pas encore fait (mis en suspens par Guillaume pour la suite, page par page)** :
- `/courses` ("Calendrier") reste la simple liste plate actuelle — Guillaume a demandé une vue par
  étape avec menu déroulant listant les courses de chaque étape, non construite dans cette passe.
- Contenu de l'onglet "Ma saison" : pointe pour l'instant vers l'écran `/pronos` existant, inchangé
  (mes pronostics en cours + à venir). Son contenu définitif reste à définir avec Guillaume — il a
  indiqué vouloir analyser chaque page une par une.
- En-tête (logo, drapeau langue, aide, profil) : le sélecteur de langue reste un composant flottant
  global (`LocaleSwitcher`, position ajustée pour ne plus chevaucher l'icône profil) plutôt qu'un
  vrai bouton "aide" inline comme sur les maquettes VéloPronos — pas construit, pas demandé encore.

## Prochaines étapes suggérées

1. ~~`npm install`, compilation, rendu.~~ Fait.
2. ~~Moteur de scoring courses individuelles.~~ Fait, testé, règles confirmées par Guillaume.
3. ~~Back-office de saisie des résultats + pilotage (saisons/athlètes/étapes/courses).~~ Fait, testé.
4. ~~Écrans classement, ligues, pronos.~~ Fait, testés.
5. ~~Modéliser et implémenter le pronostic relais.~~ Fait, testé.
6. ~~Grillage + verrouillage réel des pronostics après le départ.~~ Fait, testé.
7. ~~Cartes bonus dans l'UI joueur + bonus ×2 saison.~~ Fait, testé — choix du joueur au 10/10,
   confirmé par Guillaume.
8. ~~Import CSV des cotes.~~ Fait, logique testée contre la vraie base (écran non testé
   interactivement — upload de fichier non automatisable ici).
9. ~~Globes de saison + Pépite.~~ Fait, testé de bout en bout ; mécanique Pépite corrigée par
   Guillaume (pronostic caché par sexe, cf. ci-dessus). Reste : verrouillage base des globes avant
   le début de saison, correction Chat Noir (en suspens).
10. ~~Classements annexes.~~ Une dimension (meilleure série 10/10) implémentée ; le classement par
    type de course évoqué par Guillaume est mis en suspens pour l'instant.
11. Emplacements publicitaires et bannière de consentement cookies (prévus dans l'architecture,
    jamais posés dans le layout).
12. ~~Refonte du dashboard d'accueil + navigation basse à 6 entrées.~~ Fait (cf. section
    ci-dessus).
13. ~~Refonte du Calendrier (`/courses`) en accordéon par étape + 3 statuts de course.~~ Fait, cf.
    section ci-dessous. Reste à traiter page par page avec Guillaume : définition du contenu de
    "Ma saison", en-tête (aide/profil).

## Refonte du Calendrier (`/courses`) — accordéon par étape, 3 statuts de course

**Demande de Guillaume** : liste des étapes de la saison (accordéon), chaque étape dépliée montrant
ses courses ; clic sur une course pour aller pronostiquer ; 3 statuts de course déterminant
l'affichage (à venir / en cours / terminée).

**Étapes triées par date** (`stages.starts_on` croissant) — lu "triées par lieu et par date" comme
"chaque étape affiche son lieu et sa date, dans l'ordre chronologique de la saison" plutôt qu'un tri
composite, une étape ayant un lieu unique. **À confirmer par Guillaume si un autre sens était
voulu.** `src/app/[locale]/courses/CalendarAccordion.tsx` (composant client) gère l'ouverture/
fermeture ; l'étape ouverte par défaut est la première qui contient encore une course non terminée.

**3 statuts de course — dérivés, pas stockés.** `races.status` ne passe en réalité jamais à
`"locked"` en base (aucun cron ne l'écrit, seul `scoreRace()` écrit `"finished"`). Plutôt que
d'ajouter un mécanisme d'écriture (cron, trigger), le statut affiché est **calculé à la demande**
(`src/lib/raceStatus.ts`, `getRaceDisplayStatus`) : `finished` si `races.status === "finished"`,
sinon `ongoing` si `locks_at` est passée, sinon `upcoming`. Robuste par construction (pas de tâche
de fond à faire tourner), calculé côté serveur et passé en prop pour éviter tout écart
serveur/client sur `new Date()`.

**Affichage par statut** (`courses/[raceId]/page.tsx`, réécrite) :
- **À venir** : inchangé, le formulaire de pronostic (liste des biathlètes/nations + cotes).
- **En cours** : pronostics fermés — affichage en lecture seule des biathlètes (ou de la nation)
  pronostiqués avec leurs cotes, message dédié si le joueur n'a rien pronostiqué. Bouton "Saisir
  les résultats (admin)" vers `/admin/races/{raceId}` affiché uniquement si `profiles.is_admin`.
- **Terminée** : classement complet de la course (rang, nom, drapeau) + carte "Tes points sur
  cette course" lue directement dans `score_ledger` (le total déjà calculé, pas de recalcul ni de
  détail du breakdown affiché pour l'instant — simple et robuste).

**Bug corrigé en construisant cet écran** : la clé `"M"` du namespace `Sex` dans `messages/{fr,
en}.json` ne correspondait à rien (les codes sexe en base sont `"H"`/`"F"`), donc `tSex("H")`
échouait silencieusement (fallback next-intl) sur toute course/athlète homme — invisible jusqu'ici
car les données de test n'affichaient que des courses femmes. Corrigé (`"M"` → `"H"`).

**Ma saison (`/pronos`) — flèche de retour + courses classées par étape en accordéon.** Les deux
listes plates (« à pronostiquer » / « mes pronostics ») sont fusionnées en un seul accordéon par
étape (`pronos/PronosAccordion.tsx`, étapes triées par date) : chaque course y apparaît soit comme
« À pronostiquer » (ouverte, rien de validé), soit comme pronostic déposé (biathlètes/nation
choisis + points, ou « En attente »). Seules les étapes contenant au moins une de ces courses sont
listées ; l'étape ouverte par défaut est la première qui a une course à pronostiquer. Le contenu
définitif de « Ma saison » reste à préciser avec Guillaume. Flèche de retour aussi ajoutée dans le
back-office (`AdminNav`).

**Bouton retour et import CSV du calendrier (demandes complémentaires de Guillaume).**
- Flèche de retour vers l'accueil en haut à gauche de chaque onglet de la navigation basse
  (Calendrier, Classement, Ma saison, Ligues), à la demande de Guillaume.
- Bouton "Importer le calendrier (CSV)" en haut de `/courses`, visible uniquement si
  `profiles.is_admin` (même mécanisme que le lien Admin de la navigation basse). Fichier
  d'exemple fourni par Guillaume : calendrier IBU complet 2026-27 (12 étapes Coupe du Monde +
  Otepää en Championnats du Monde).
- `src/lib/admin/calendarImport.ts` (`importCalendarCsv`) : une ligne CSV = une course ; les
  lignes partageant le même lieu forment une étape (dates min/max, coefficient ×2 si la colonne
  Catégorie contient "Championnats"/JO). **Ré-exécutable sans dupliquer** : étape retrouvée par
  `(season_id, location)`, course par `(stage_id, format, sex)` — mis à jour si trouvée, créée
  sinon. Colonnes attendues : `Lieu (ville), Pays (pour code drapeau) [alpha-2], Date, Heure de
  départ UTC, Catégorie, Type de course, Sexe`. Le code pays alpha-2 est converti en code nation
  alpha-3 (`alpha2ToAlpha3` dans `nationFlags.ts`) ; toute nation absente de la table `nations`
  est créée automatiquement (nom depuis une table figée dans le code, à défaut le code lui-même).
- Sécurité : le bouton n'est visible qu'aux admins côté UI, mais comme `/courses` n'est pas
  protégée par le layout `/admin` (qui redirige les non-admins avant même de rendre la page), la
  Server Action `runCalendarImport` (`courses/actions.ts`) **revérifie `is_admin` elle-même**
  avant d'écrire — sans quoi n'importe quel utilisateur authentifié aurait pu appeler l'action
  directement.
- **Testé contre la vraie base** avec un CSV de 3 lignes synthétiques (nettoyé après coup) :
  création d'étape + 3 courses au bon format, ré-exécution sans duplication (0 créée / tout mis à
  jour au 2e passage). Le vrai fichier calendrier 2026-27 n'a volontairement pas été importé par
  Claude — Guillaume a indiqué vouloir le tester lui-même via l'écran.

## Page d'accueil visiteur (vitrine façon VéloPronos)

**Demande de Guillaume** : page d'accueil sur le modèle de celle de VéloPronos (captures d'écran de
velopronos.fr), avec la même typographie.

- **Typographie : Poppins partout** (titres et texte), comme VéloPronos, à la place de Sora +
  Work Sans. Chargée dans `src/app/[locale]/layout.tsx` via `next/font/google`, exposée dans
  `--font-poppins` ; les classes `font-display` / `font-body` pointent toutes deux dessus, donc
  aucun composant n'a eu à changer.
- Nouveau token `blue` dans `tailwind.config.ts` (bleu vif des accents VéloPronos), utilisé avec
  `ice` pour le dégradé de l'accroche et du bouton « Commencer gratuitement ».
- `src/components/landing/Landing.tsx` (+ `AppCarousel.tsx`, composant client) : accroche,
  « Comment ça marche ? » en 3 étapes, « Pourquoi jouer ? » (6 avantages), carrousel « Découvre
  Biathlonpronos », pied de page. Affichée par `src/app/[locale]/page.tsx` **uniquement aux
  visiteurs non connectés** ; un joueur connecté voit toujours le dashboard. Pas de navigation
  basse sur la vitrine (comme VéloPronos).
- Choix à confirmer : les badges App Store / Google Play sont affichés « Bientôt disponible » et
  non cliquables (pas d'app mobile) ; l'avantage « Mode cyclo gratuit » devient « 100 % gratuit »
  (pas de freemium) et « Mode Expert » devient « Globes de saison »  ; le carrousel montre
  des emojis, pas encore de vraies captures de l'app. Les deux boutons (« Commencer » et « Se
  connecter ») mènent à `/sign-in`, qui propose connexion et inscription.
- **Pied de page : Support, Politique de confidentialité, CGU** (liens obligatoires, comme sur
  VéloPronos), vers `/support`, `/confidentialite`, `/cgu`. La page Support reprend la
  page Support de VéloPronos (bandeau en dégradé, cartes contact / délai de réponse / types de
  demandes / aide) ; Confidentialité et CGU partagent `src/components/InfoPage.tsx`, et les trois
  utilisent le bandeau `src/components/PageHeader.tsx` ; leur texte est dans les namespaces `Support` / `Privacy` /
  `Terms` des fichiers `messages/*.json`. **À confirmer** : l'adresse de contact
  `contact@biathlonpronos.fr` (clé `Support.email`) est provisoire, et les textes de
  confidentialité et de CGU sont des brouillons à faire relire avant l'ouverture au public.
- **Politique de confidentialité reprise de celle de VéloPronos** (9 sections, capture fournie par
  Guillaume), adaptée : pas d'« équipe de cœur », connexion Google/Apple + e-mail/mot de passe
  (pas de Facebook), mention du jeu gratuit. Rendue par `InfoPage` (sections avec paragraphes,
  puces, encadré et lien de contact). **À confirmer** : connexion Google/Apple citée alors que
  l'OAuth n'est pas encore finalisé, notifications « si activées » (pas encore implémentées),
  suppression des données sous 30 jours.
- **CGU reprises de celles de VéloPronos** (12 sections, capture fournie par Guillaume), adaptées :
  application web (pas encore mobile), saison 2026-27, inscription e-mail/Google/Apple (pas de
  Facebook), lien vers le règlement, mention des changements de calendrier/résultats officiels
  dans la limitation de responsabilité. **À confirmer** : âge minimum 13 ans et droit français
  repris tels quels de VéloPronos.
- **Page de connexion** : « Connectez-vous pour continuer » sous le logo ; boutons Google, Apple
  et **Facebook** (ajouté à la demande de Guillaume), chacun avec son logo. Facebook réintégré
  dans la Politique de confidentialité et les CGU. **Prérequis** : le fournisseur Facebook doit
  être activé dans Supabase (Authentication > Providers > Facebook, avec l'App ID et le secret
  d'une app Meta for Developers), comme Google et Apple ; sans ça le bouton renvoie une erreur.
- **Calendrier : étape des Mondiaux en doré.** Dans `CalendarAccordion`, une étape à
  `coefficient = 2` (déjà la convention « Mondiaux / JO » de la table `stages`) a un encart doré,
  le libellé « Championnats du monde » et son lieu en or. Pas de nouvelle colonne : il suffit que
  l'étape soit saisie avec le coefficient 2 (cas d'Otepää 2027).
- **Choix de la langue par drapeaux, en haut de chaque onglet** (comme VéloPronos) : bouton rond avec
  le drapeau de la langue courante, qui déroule les autres drapeaux (`LocaleSwitcher`, drapeaux
  en SVG car Windows n'affiche pas les emojis drapeaux). Affiché dans l'en-tête du dashboard (à
  côté du profil) et en haut à droite de la vitrine. **Le sélecteur FR/EN flottant présent sur
  toutes les pages a été retiré** : la langue se choisit depuis l'Accueil, puis reste dans l'URL.
- **5 langues : FR, EN, DE, IT, ES.** Menu déroulant de langue « drapeau + nom » (Français,
  English, Deutsch, Italiano, Español), langue courante cochée. `messages/de.json`, `it.json`,
  `es.json` ont été traduits par Claude depuis l'anglais/le français : **à faire relire**, en
  particulier les noms du jeu (cartes, dossards, Pépite, grillage, courses spéciales) et les
  textes légaux. Le bonus « Aspiration » / « Draft » porte un seul nom par langue
  (Windschatten-Bonus, bonus Scia, etc.).
- `src/components/HeaderActions.tsx` (langue + profil) est placé à droite du titre de chaque
  onglet de la navigation basse : Accueil, Calendrier, Classement, Ma saison, Ligues.
- **Page Profil (`/compte`) refaite sur le modèle de VéloPronos** : avatar (initiale du pseudo),
  pseudo et email ; notifications par email et apparence (interrupteurs **non fonctionnels**,
  marqués « Bientôt ») ; équipe favorite et cartes bonus (inchangés) ; langue (pastilles drapeau
  + nom, fonctionnelles) ; liens Aide & Règlement et Support ; déconnexion ; « Supprimer mon
  compte » ouvre un email au support (pas de suppression automatique). Pas de section « Mode de
  jeu » (pas de freemium sur Biathlonpronos) ni « Mes messages » (remplacé par Support).
- **Pseudo modifiable** via le crayon (`compte/PseudoEditor.tsx`, 2 à 20 caractères, contrôle
  côté interface uniquement). **Migration 0016 à coller dans Supabase** : la policy « profiles:
  update own » laissait un joueur modifier n'importe quelle colonne de son profil, y compris
  `is_admin` ; la migration limite la mise à jour côté client à la colonne `pseudo`.
- **Thème clair / sombre fonctionnel** (Profil > Apparence). Les couleurs de `tailwind.config.ts`
  pointent vers des variables CSS (`src/app/globals.css`) : palette sombre par défaut, palette
  claire sous `html.light`. Le choix est mémorisé dans le navigateur (localStorage `theme`) et
  réappliqué avant l'affichage par un petit script dans `src/app/[locale]/layout.tsx`. Le choix
  n'est pas lié au compte (à changer sur chaque appareil). Le back-office `/admin` reste sombre.

### Thème clair aux couleurs de VéloPronos (octobre 2026)

Le thème clair reprend la palette chaude de VéloPronos : fond beige (#f1ece4), cartes blanches,
barre de navigation basse blanche (token `nav`), texte brun foncé, et l'accent `ice` devient ocre
(interrupteurs, pastille de langue, onglet actif, boutons). Le texte posé sur cet accent passe par le
token `on-ice` (foncé en thème sombre, blanc en thème clair). Les dégradés de marque (avatar,
en-têtes, bouton « Commencer gratuitement ») gardent le bleu → turquoise fixe (`teal`) dans les deux
thèmes, comme VéloPronos. Le back-office `/admin` reste sombre.

### Ma saison : étapes repliées et Championnats du monde dorés (octobre 2026)

Dans l'onglet Ma saison, toutes les étapes sont repliées à l'arrivée (avant, la première étape à
pronostiquer s'ouvrait). L'étape de coefficient 2 (Otepää) reprend l'encart doré du Calendrier avec
la mention « Championnats du monde · Coeff. ×2 » ; la pastille « Coeff. ×2 » séparée est retirée
pour ne pas déborder sur mobile.

### Back-office : page « Joueurs & rôles » (octobre 2026)

`/admin/joueurs` liste les joueurs (pseudo, email lu dans Supabase Auth via la clé service_role),
avec une recherche et un bouton pour donner ou retirer le rôle d'admin (`profiles.is_admin`). La
Server Action `setAdminRole` revérifie que l'appelant est admin (`src/lib/admin/requireAdmin.ts`),
car une Server Action peut être appelée sans passer par le layout `/admin`. Un admin ne peut pas se
retirer son propre rôle, pour ne pas se fermer l'accès au back-office.

### Horloge simulée pour l'admin (octobre 2026)

Page `/admin/horloge` : un admin règle une date/heure fictive, en heure de Paris (saisie libre,
raccourcis « la veille à 20 h / 5 min avant / 5 min après » le départ d'une course, +1 h / +1 jour /
+1 semaine). Le décalage avec l'heure réelle est stocké dans `profiles.simulated_clock_offset_ms`
(migration 0017, écrit par le back-office avec la clé service_role, non modifiable côté client) ;
la pendule simulée continue donc d'avancer. Un cookie `bp_sim_offset` sert seulement au bandeau doré
d'avertissement et à éviter une requête au profil quand rien n'est simulé.

- Affichage : `getClock()` (`src/lib/clock.ts`) renvoie l'heure simulée pour un admin, l'heure réelle
  pour tous les autres. Statut des courses, formulaire de prono, « En ce moment » et « Prochainement »
  de l'accueil, courses ouvertes de Ma saison, verrouillage des globes.
- Base : `effective_now()` ajoute ce décalage à `now()` pour un admin ; les policies d'écriture des
  pronostics l'utilisent à la place de `now()`. Un admin peut donc saisir des pronos sur une saison
  passée pour la tester (demandé par Guillaume, octobre 2026). Les joueurs ne sont jamais concernés.

Limites : tout ce qui est saisi pendant une simulation est réel (pronos de l'admin, résultats saisis
dans le back-office). Une fois le jeu lancé, un admin qui oublie de revenir à l'heure réelle peut
enregistrer des pronos hors délai. Le décalage est lié au profil : il s'applique en base sur tous les
appareils de l'admin, mais le bandeau n'apparaît que sur le navigateur qui a réglé l'horloge.

Effet de bord voulu : « Prochainement » (accueil) ignore désormais les courses dont l'heure de départ
est passée mais pas encore notées (avant, une course en cours restait affichée comme prochaine).

« En ce moment » (accueil) : l'étape dont les dates encadrent le jour (simulé ou réel), même si sa
prochaine course n'a pas commencé (essai d'un affichage limité aux courses en cours, annulé à la
demande de Guillaume, octobre 2026).

Heures : tout l'affichage joueur est en heure de Paris (`src/lib/displayTimeZone.ts`), quel que soit
le fuseau du serveur ou du navigateur. L'import/export CSV du calendrier et les champs admin restent
en UTC (choix de Guillaume) : les heures du CSV doivent être saisies en UTC.

## Réorganisation du back-office (octobre 2026)

**Demande de Guillaume** : moins d'onglets, CSV dans chaque onglet, courses triées par étape.
Menu : **Calendrier** · **Athlètes & cotes** · **Résultats & globes** (`/admin`) · Joueurs & rôles ·
Horloge simulée. Supprimés : Saisons, Étapes & courses, Cotes de relais, Import CSV, Globes de saison
(leur contenu est repris ci-dessous). Toutes les Server Actions et routes d'export du back-office
revérifient `is_admin` (`requireAdmin`), le layout `/admin` ne protégeant que l'affichage.

**Calendrier** (`/admin/calendrier`) : saisons (création, activation) + étapes de la saison active en
accordéon, avec leurs courses et un formulaire d'ajout de course. Import CSV (même format et même
logique `importCalendarCsv` que le bouton de `/courses`, réimportable, ne supprime jamais rien) et
export au même format (`/admin/calendrier/export`), réimportable tel quel.

**Athlètes & cotes** (`/admin/athletes`) : filtres nation et sexe (paramètres d'URL), une carte par
nation avec relais mixtes, puis par sexe la ligne équipe (relais + meilleure nation) et le tableau
des athlètes (sprint, poursuite, individuel, mass start, globe, jeune), chaque ligne modifiable
(case vidée = cote retirée). **Fichier CSV unique** (`src/lib/admin/oddsCsv.ts`), séparateur `;`
ou `,`, en-têtes :
`Type;Nation;Sexe;Nom;Prénom;Relais mixte;Relais mixte simple;Relais;Meilleure nation;Sprint;Poursuite;Individuel;Mass start;Globe;Jeune`.
Par nation, dans l'ordre demandé par Guillaume : ligne `Nation` (relais mixte, mixte simple),
ligne `Équipe` F (relais, meilleure nation), lignes `Athlète` F, ligne `Équipe` H, lignes
`Athlète` H. L'import se fie aux colonnes Type/Sexe, pas à l'ordre ; Type vide = déduit (nom
renseigné → athlète, sexe seul → équipe, sinon nation). Export (`/admin/athletes/export`) au même
format, réimportable.
- **L'import remplace toutes les cotes courantes de la saison** (demande de Guillaume : « un csv
  qui efface le csv précédent ») : les anciennes sont historisées (`valid_until`), pas supprimées,
  et remises en place si l'écriture des nouvelles échoue. Un fichier avec la moindre erreur
  (nation inconnue, cote non entière, doublon, sexe manquant) n'écrit rien. Nations absentes de la
  table créées si leur nom est connu (`NATION_NAMES`).
- **À confirmer** : les athlètes absents du nouveau fichier ne sont pas supprimés (ils peuvent
  figurer dans des pronostics, résultats, Pépites) ; ils restent en base sans cote, donc ne sont
  plus proposés aux joueurs, et sont marqués « sans cote » dans le tableau.
- **À confirmer** : la cote « meilleure nation » (par sexe) est placée sur la ligne Équipe, avec
  la cote relais du même sexe.
- Attention : réimporter entre le sprint et la poursuite d'une étape écrase les cotes poursuite
  recalculées à partir des écarts du sprint (§4) par celles du fichier.
- Corrigé au passage : `setCurrentOdds` filtrait les relais mixtes sur `nation_sex = undefined` au
  lieu de `nation_sex is null` (requête invalide pour les cotes mixtes).
- Les lectures de cotes passent par `fetchAll` : Supabase plafonne une requête à 1000 lignes, seuil
  dépassé par une saison complète (≈ 6 cotes par athlète).

**Résultats & globes** (`/admin`) : étapes en accordéon comme le Calendrier joueur (ouverte : la
première avec une course non saisie), courses triées par heure, puis une section dépliable
« Globes de saison ». Sur la page d'une course, **import CSV des résultats**
(`src/lib/admin/resultsCsv.ts`) : `Rang;Nom;Prénom;Nation;Écart (s);Tours de péna;Fusée;Gâchette`
(relais : `Rang;Nation`). Alternatives acceptées : colonne `Athlète` (nom complet, dans un ordre
ou l'autre), `Fautes` (0 = Gâchette), écart en `m:ss.s`, nation en toutes lettres pour un relais.
Noms comparés sans accents ni casse. Le CSV **ne fait que pré-remplir le tableau** : l'admin relit
puis clique « Enregistrer et calculer les scores » (même chemin que la saisie manuelle). Bouton de
téléchargement du modèle (candidats ayant une cote, avec la saisie en cours). Format pensé pour être
généré par une IA à partir du classement officiel IBU.

**Récupération des résultats officiels IBU (octobre 2026, choix de Guillaume plutôt qu'une IA).**
Bouton « Récupérer les résultats officiels IBU » sur la page d'une course (`src/lib/admin/ibuResults.ts`,
action `loadIbuResults`). Lit l'API JSON publique du datacenter IBU (`biathlonresults.com/modules/sportapi/api`,
celle qu'utilise leur propre site, sans clé) : `Events` (saison `2627` déduite du label `2026-27`,
niveau 1 = Coupe du monde, Mondiaux, JO) → étape qui recouvre les dates de la nôtre (le lieu
départage) → `Competitions` → course de même discipline (SP, PU, IN, MS, RL, SR) et catégorie (SW,
SM, MX) la plus proche de l'heure de départ → `Results`. Converti au format du CSV de résultats et
appliqué comme un import : le tableau est pré-rempli, **l'admin relit puis valide les points**.
Gâchette = 0 faute (`ShootingTotal`), Fusée = rang 1 de l'analyse temps de ski (`AnalyticResults`
TypeId `CRST`, sinon à cocher à la main), écart = `Behind`, DNF/DNS ignorés, relais = lignes
d'équipe. Les noms sont comparés aussi sous forme translittérée (Öberg = OEBERG, Bø = BOE). Champ
facultatif pour forcer l'identifiant IBU de la course si la correspondance automatique échoue.
- **Non testé contre l'IBU depuis l'environnement de Claude** (accès réseau refusé) : structure de
  l'API reprise de son usage connu, logique de correspondance couverte par des tests unitaires. À
  vérifier en vrai sur la préversion Vercel. Conditions d'utilisation de l'API IBU non vérifiées.

**Calendrier & résultats fusionnés (octobre 2026, demande de Guillaume).** Un seul onglet `/admin`
(`/admin/calendrier` y redirige) : menu Calendrier & résultats · Athlètes & cotes · Joueurs & rôles ·
Horloge simulée.
- **Saisons** : chaque saison se déplie sur ses 6 globes de saison à compléter (classement final).
  Rien n'est créé en base à la création d'une saison : les formulaires de globes sont affichés
  d'office pour chaque saison et n'écrivent qu'à l'enregistrement d'un classement.
- **Étapes & courses** : chaque course garde son statut (à venir / résultats à saisir / résultats
  saisis, même règle que le Calendrier joueur, horloge simulée comprise), avec un crayon (page de la
  course : modification format, sexe, heure UTC, course spéciale + saisie des résultats) et une
  poubelle rouge (avec confirmation).
- **Réinitialiser les résultats** (page de la course, `resetRaceResults`) : efface les résultats et
  les points de la course (`score_ledger`), rend le bonus Pépite s'il avait été gagné dessus, repasse
  la course « à venir ». Séries 10/10 et cotes poursuite recalculées (cf. ci-dessous).
- **Supprimer une course** (`deleteRace`) : réinitialisation puis suppression ; pronostics supprimés
  par cascade, carte bonus jouée dessus détachée de la course mais laissée consommée.

**Corrections de résultats : séries et cotes poursuite recalculées (octobre 2026, demande de
Guillaume, ex. disqualification après le premier classement IBU).**
- **Séries 10/10** : après chaque notation, ressaisie, réinitialisation ou suppression, toute la saison
  est rejouée (`recomputeSeasonStreaks`, `computeSeasonStreaks`) : courses notées dans l'ordre des
  départs, points des pronostics hors bonus Pépite, un joueur sans prono sur une course n'est pas
  compté (comme avant). Remplace la mise à jour incrémentale, qui réincrémentait la série à chaque
  ressaisie. `cards_earned` est recalculé aussi ; une carte déjà choisie par un joueur reste acquise
  même si le recalcul lui en retire le crédit (à confirmer).
- **Cotes poursuite** : avant de remplacer ou d'effacer les résultats d'un sprint, la cote poursuite
  de chaque athlète qui avait un écart reprend sa dernière valeur antérieure à la saisie précédente
  (`restorePursuitOdds`), puis le recalcul se fait avec les nouveaux écarts. Si la poursuite de
  l'étape était déjà notée, elle est renotée automatiquement avec ses nouvelles cotes.
- **Notation rejouable** : `scoreRace` efface d'abord les points de la course et rend le bonus Pépite
  gagné dessus. Corrigé au passage : le bonus Pépite était écrasé par les points du pronostic quand
  le même joueur avait aussi pronostiqué la course (il est maintenant appliqué après).

**Suppression d'une saison ou d'une étape (octobre 2026).** Poubelle rouge sur chaque saison et chaque
étape de `/admin`. Étape : chaque course est supprimée via `deleteRace` (points, cartes, séries
recalculées), puis l'étape (`deleteStage`). Saison : suppression en base, la cascade efface tout ce
qui en dépend (étapes, courses, athlètes, cotes, pronostics, résultats, points, ligues, cartes,
Pépites) ; il faut retaper le label de la saison pour confirmer.

## Accueil et page de pronostic — lot « page par page » (fin octobre 2026)

**Accueil.** L'encart « En ce moment » devient « L'étape de la semaine » (`WeekStageCard`,
`src/lib/weekStage.ts`) :
- étape affichée : celle en cours (dates de l'étape, jour de Paris), sinon celle qui commence dans
  les 7 jours (à confirmer) ;
- le badge « En ce moment » n'apparaît que si une course de l'étape part aujourd'hui (heure de Paris) ;
- une ligne par course « en cours » (départ passé, pas encore notée) avec les biathlètes ou la nation
  pronostiqués, ou « Pas de pronostic sur cette course ».
« Prochainement » devient « À suivre » (`NextRaceCard`) avec un compte à rebours jusqu'au départ
(= verrouillage), qui part de l'horloge du serveur (horloge simulée de l'admin comprise). Si le
joueur n'a pas encore pronostiqué cette course, un bouton « À jouer » s'affiche dans la carte
(demande de Guillaume), sinon la mention « Pronostic validé ».

**Page de pronostic d'une course.** Encart « Mon pronostic » en haut (`PredictionSummary`) : les choix
en cours avec une croix rouge pour retirer chacun, le bouton « Activer mon bonus ×2 » (nombre restant
sur la saison, mis à jour en direct) et « Valider mon pronostic ». Retirer un choix ne supprime rien en
base : le pronostic enregistré reste valable tant que le joueur n'a pas revalidé (un message le
rappelle). Le choix de carte bonus (Balle de pioche, Ça farte) reste sous la liste.

**Saisie et affichage des résultats (fin octobre 2026).** Back-office d'une course : bouton
« Enregistrer et calculer les scores » en haut et en bas du tableau, lien retour vers la page
publique de la course. Page d'une course notée (`getRaceResult` dans `src/lib/lastResult.ts`,
partagé avec l'encart « Dernier résultat ») : le pronostic du joueur dans l'ordre d'arrivée, avec la
place et les points de chaque choix, les bonus de course, et le classement complet avec les points du
barème (cote × rang + Fusée/Gâchette, sans les multiplicateurs propres à chaque joueur) pour le
Top 10 (Top 5 en relais) et pour tout athlète Fusée/Gâchette. Pictos 🚀 Fusée et 🎯 Gâchette.
Les points du barème utilisent les cotes en vigueur, comme le calcul des scores.

**Pronostic d'une poursuite.** Liste des biathlètes par ordre de départ (classement du sprint de
l'étape, même sexe ; les non-classés ensuite, par cote), affichage par défaut, ou par cote ; en tri par
cote, la position de départ reste affichée à côté de la nation. Les cotes
affichées sont les cotes poursuite réévaluées après le sprint.

**Fusée et Gâchette selon le format (fin octobre 2026, demande de Guillaume, conforme au §15 du
règlement).** La Fusée ne compte qu'au sprint et à l'individuel, la Gâchette (20/20 au tir) qu'à la
poursuite et à la mass start (`src/lib/scoring/fuseeGachette.ts`). La règle est appliquée à la saisie
(colonnes masquées dans le back-office, cases ignorées à l'enregistrement et à l'import IBU) et à la
lecture des résultats (calcul des points, affichage), pour que d'anciennes cases cochées sur un autre
format ne rapportent rien. Les courses déjà notées gardent leurs points tant qu'elles ne sont pas
renotées.

**Accueil, 2e passe.** Compte à rebours de « À suivre » en bas à droite, sous la date. « Derniers
résultats » (demande de Guillaume) : la dernière course notée de chaque sexe reste affichée 48 h
après son départ, un nouveau résultat du même sexe remplaçant le précédent ; une carte par course,
dans l'ordre des départs (`pickLastResultRaces`). Relais mixtes : catégorie à part, gardée 48 h elle
aussi (à confirmer). Sans aucun résultat dans les 48 h, la dernière course notée reste affichée seule
(à confirmer). La légende Fusée/Gâchette est masquée
sur l'accueil (gardée sur la page d'une course).
La barre d'onglets du bas (`BottomNav`) est figée en bas de l'écran pendant le défilement
(`sticky bottom-0`), sur toutes les pages qui l'affichent.

**Bouton « i » sur la page d'une course (fin octobre 2026).** En haut à droite, il ouvre une fenêtre
« Comment ça marche ? » qui résume la règle du format (`RuleInfoButton`, textes `RuleInfo.*` en
5 langues) : barème Top 10 et bonus Top 3/5/10 pour les courses individuelles, Fusée (sprint,
individuel) ou Gâchette (poursuite, mass start), départ de la poursuite, biathlètes grillés ; relais :
une équipe, points dans le Top 5 (règlement §5, alors que l'exemple de Guillaume parlait du podium) ;
bonus ×2 pour tous. Lien vers le règlement complet.
Puis, à la demande de Guillaume, le « i » devient un « ? » placé à côté du titre « Choisis une
nation » / « Choisis tes biathlètes » ; il ne reste en haut à droite que quand aucun formulaire n'est
affiché (course en cours, terminée, ou sans cotes).
Validation : quand le pronostic affiché est celui enregistré (y compris à l'ouverture de la page), la
mention « Ton pronostic est validé ! » remplace le bouton « Valider mon pronostic », qui revient dès
qu'un choix, le bonus ×2, la carte ou la cible du ×3 change.

## Fusion Calendrier + Ma saison (fin octobre 2026)

Demande de Guillaume : l'onglet « Ma saison » (`/pronos`) disparaît de la barre du bas, son contenu
passe dans le Calendrier (`/courses`), sur le modèle de l'accordéon du Calendrier. `/pronos` redirige
vers `/courses` (avec `?etape=`, qui déplie et fait défiler jusqu'à l'étape, utilisé par « L'étape de
la semaine » de l'accueil). Chaque course affiche désormais, en plus de sa date et de son statut :
les biathlètes (ou la nation) pronostiqués, le badge Bonus ×2, les points une fois notée, et un bouton
« À jouer » sous la date pour une course à venir sans pronostic. L'en-tête d'étape compte les courses
« à jouer ». En haut, l'accordéon « Mes pronostics de saison » (replié par défaut) récapitule les
6 globes et les 2 Pépites, avec un lien vers `/globes`. Le bouton « Ma saison » de l'accueil mène au
Calendrier. L'onglet de la barre du bas (`/courses`) s'appelle désormais « Ma saison » (clé
`Nav.stages`, le titre de la page reste « Calendrier »).

## Classement : série en cours et pop-up joueur (fin octobre 2026)

**Série en cours.** La notion de « Dossard Rouge » disparaît du Classement. Le joueur connecté voit
sa carte « 🔥 Série en cours x / 10 » (10 segments, « Plus que N courses pour une carte bonus »),
sur le modèle de la capture VéloPronos fournie par Guillaume. En dessous, la liste « Meilleures
séries en cours » (top 10) est gardée, aux couleurs neutres (choix pragmatique, à confirmer : la
demande parlait de l'habillage, pas de retirer la liste).

**Pop-up joueur.** Un clic sur un joueur (classement général ou séries) ouvre sa page « Ma saison »
en lecture seule : « Pronostics de saison » replié, puis ses étapes en accordéon avec pronostics,
bonus ×2 et points (`getSeasonView` dans `src/lib/seasonView.ts`, partagé avec `/courses` ;
Server Action `getPlayerSeason`). Pour qu'on ne puisse pas copier (à confirmer) : les pronostics
d'un autre joueur n'apparaissent qu'une fois la course partie, ses globes une fois la saison
commencée, et sa Pépite seulement une fois révélée (bonus obtenu), puisque c'est un pronostic caché.
Migration **0018** (règles de lecture Supabase correspondantes) à coller par Guillaume ; tant
qu'elle n'est pas appliquée, le pop-up d'un autre joueur s'affiche sans ses pronostics.

## Page d'une course terminée et noms abrégés (fin octobre 2026)

- **Points par ligne sans le ×2.** Dans « Mon pronostic », chaque choix affiche ses points sans le
  bonus ×2 perso ni le coefficient ×2 Mondiaux/JO (ex. Horn 140, Wright 51). Ce que le ×2 a
  rapporté est affiché à part, sous « Tes points sur cette course » (« Bonus ×2 actif · +191 pts ») ;
  le total (382) ne change pas. Même chose dans « Derniers résultats » de l'accueil. Ça farte ×3 et
  Team Nation ×2 restent comptés sur la ligne concernée. (`prediction.multiplier` dans `lastResult.ts`.)
- **Prono parfait.** Les 3 lignes au plus fort score du barème (Top 10, Fusée/Gâchette comprises,
  même calcul que `computeBestPossibleTrio`) ont une étoile ⭐ et un contour doré (`markPronoParfait`).
  Pas d'étoile sur les relais (pas de Prono parfait).
- **Résultats repliés.** Top 10 + les choix du joueur classés plus loin, puis « Voir tout le
  classement ».
- **Classement des joueurs.** Sous les résultats, les 10 meilleurs joueurs sur cette course (+ la
  place du joueur s'il est plus loin), déroulant pour la suite, ex æquo à la même place
  (`racePlayers.ts`). À confirmer : « classement de l'étape » interprété comme les points sur cette
  course, pas le cumul de toutes les courses de l'étape.
- **Noms abrégés.** `shortAthleteName` (`src/lib/athleteName.ts`) : initiale du prénom + nom ; un
  nom composé garde son premier nom entier et l'initiale des suivants (« J. Dale-S. »,
  « Q. Fillon M. »). Utilisé partout où les noms courts s'affichent ; les lignes étroites tronquent
  aussi proprement au lieu de déborder.

**Série en cours déplacée (fin octobre 2026).** À la demande de Guillaume, la carte « Série en
cours » quitte le Classement (où reste la liste « Meilleures séries en cours ») : elle est sur
l'accueil sous les boutons Classement / Ma saison, et dans Ma saison entre « Mes pronostics de
saison » et les étapes (`StreakCard`, `getCurrentStreak`). Le pop-up d'un joueur affiche en haut
sa place et ses points au classement général et son équipe favorite, puis ses pronostics de
saison, sa série en cours, et ses étapes. Migration **0019** : lecture des équipes favorites
ouverte à tous (rien à copier), à coller par Guillaume.

## Courses malus et titre « Ma saison » (fin octobre 2026)

- **Admin** : « Brouillard » ne peut être choisi que pour un sprint ou une individuelle (option
  grisée dans le formulaire selon le format, revérifié par les actions serveur ;
  `SPECIAL_RULE_FORMATS` dans `admin/_components/labels.ts`).
- **Ma saison** : une course malus a un bandeau et un contour rouges « Course malus · <nom> » avec
  un picto par malus (modèle VéloPronos) : 🔁 Tour de péna, 🌫️ Brouillard, 📉 T'es collé(e)
  (`src/lib/specialRules.ts`, pictos à confirmer). La page de la course reprend le picto et le nom
  traduit, en rouge.
- Le titre en haut de `/courses` devient « Ma saison » (comme l'onglet).
- **Derniers résultats** (accueil) : le plus récent est toujours en haut.

## Course en cours, flèche retour, série dans l'encadré Saison (fin octobre 2026)

- **Accueil** : la série en cours passe en version réduite en bas de l'encadré « Saison »
  (`StreakCard compact`), plus de carte séparée.
- **Flèche retour d'une course** : revient à la page consultée juste avant (`BackButton` +
  `NavigationTracker`, qui compte les pages vues dans l'onglet), sinon à Ma saison.
- **En-tête d'une course** : le nom de la course quitte la barre du haut ; l'encadré affiche le
  drapeau de l'étape, le lieu et le nom de la course.
- **Course en cours** : sous « Mon pronostic », le classement général de tous les joueurs avec,
  sous chaque nom, son pronostic sur cette course (« Pas de pronostic » sinon) ; les joueurs sans
  points mais qui ont pronostiqué suivent à 0 pt (`getOngoingBoard`). Repose sur la migration 0018
  (pronostics lisibles une fois la course partie).
- **Page d'une course (suite)** : bonus Top 3/5/10 ou Prono parfait en bandeau vert au-dessus des
  choix (token `green`, modèle « Bonus Musette » VéloPronos) ; encadré du haut avec drapeau, lieu,
  nom de l'épreuve, date et heure ; boutons « Course préc. » / « Course suiv. » au milieu de la
  barre du haut (ordre chronologique de la saison, grisés en début/fin de saison).

## Classement : filtres Général / Ligue et Saison / Par étapes (fin octobre 2026)

En haut du Classement, deux paires de boutons (`classement/StandingsFilters.tsx`), portées par
l'URL (`?portee=ligue&ligue=…&periode=etapes&etape=…&course=…`) pour qu'un lien garde le filtre :

- **Général / Ligue.** « Ligue » ouvre un menu déroulant des ligues du joueur pour la saison active
  (première par ordre alphabétique par défaut). Les membres sans point y figurent à 0. Sans ligue,
  un encadré renvoie vers l'onglet Ligues.
- **Saison / Par étapes.** « Saison » : classement général (globes compris), comme avant ; la liste
  « Meilleures séries en cours » n'apparaît qu'en Général + Saison. « Par étapes » : un menu des
  étapes (par défaut la dernière étape commencée) et un menu des courses (« Toute l'étape » par
  défaut, ou une seule course). Les points sont ceux des courses de l'étape seulement.
- **Pronostics des joueurs.** Étape en cours (une course partie et une pas encore notée) : sous
  chaque joueur, ses pronostics sur les courses déjà verrouillées de l'étape. Une course choisie
  seule : ses pronostics dès qu'elle est verrouillée, même si l'étape est finie. Jamais sur une
  course pas encore partie (migration 0018). **À confirmer** : menus déroulants plutôt qu'une liste
  dépliée des étapes ; pronostics masqués sur une étape entièrement terminée.

Code : `src/lib/standings.ts` (`buildStandings`, `isStageOngoing`, `pickDefaultStandingsStageId`,
testés). Aucun SQL : ligues, adhésions, score_ledger et pronostics verrouillés sont déjà lisibles.

## Étape de la semaine, ouverture à J-7, légende et pop-up joueur des résultats (fin octobre 2026)

- **« L'étape de la semaine »** (`pickWeekFeature`, testé), par ordre de priorité : courses en
  cours (badge « En ce moment ») ; sinon le dernier résultat noté aujourd'hui, affiché sous
  l'encadré jusqu'à 23h59 (heure de Paris), chassé par le départ d'une 2e course le même jour ;
  sinon la prochaine course de l'étape avec compte à rebours (badge « Prochaine course »). Le
  résultat du jour n'apparaît dans « Derniers résultats » qu'à partir de minuit. Sans étape dans la
  semaine : « Les biathlètes sont au repos, profites-en pour farter tes skis ! » avec 🎿.
- **« À suivre »** : la course d'après celle que montre déjà l'encadré (la 2e course à venir quand
  l'encadré affiche la prochaine, sinon la prochaine).
- **Pronostics ouverts 7 jours avant l'étape** (`predictionWindow.ts`, testé) : avant, la page de
  la course affiche la date d'ouverture au lieu de la liste des biathlètes, et Ma saison / « À
  suivre » montrent « Ouvre le … » à la place de « À jouer ». **À confirmer** : contrôle côté
  interface seulement (le pronostic est enregistré par le navigateur) ; un verrou en base
  demanderait une règle RLS.
- **Page résultats** : la légende en toutes lettres (Fusée/Gâchette, Prono parfait) est remplacée
  par un bouton « ? » à côté de « Résultats » (`HelpButton`). Dans le classement des joueurs, un
  clic ouvre le pronostic détaillé du joueur sur la course (`PlayerRaceButton`, action
  `getPlayerRaceResult`, course notée seulement). `PredictionBreakdown` est devenu synchrone pour
  servir aussi côté client.

## Accueil : un seul encadré pour l'étape de la semaine (fin octobre 2026)

À la demande de Guillaume, « L'étape de la semaine » devient un encadré unique : bandeau bleu clair
(drapeau, lieu, dates de l'étape), puis toutes les courses de l'étape avec leur statut (À venir /
En cours / Terminée) et, pour chacune, un déroulant (`<details>`) : le résultat détaillé
(`ResultBody compact` : sans podium, les 3 choix en lignes serrées façon podium) pour une course notée, sinon le pronostic
du joueur (avec « À jouer » / « Modifier » et le compte à rebours avant le départ). La course du
moment (`pickWeekFeature`) est dépliée d'office. **À confirmer** : quand une étape a lieu cette
semaine, « À suivre » et « Derniers résultats » disparaissent (l'encadré les remplace) ; ils
reviennent les semaines sans étape, sous le message de repos.

## Course malus, retrait de Team Nation / Aspiration, équipe favorite (fin octobre 2026)

- **Course malus** : le contour rouge entoure l'encadré du haut de la page de la course, avec un
  bandeau rouge (gros picto, « Course malus · <nom> », phrase choc `Race.malusTagline_*`) et un
  bouton « ? » qui ouvre le barème illustré de pictos (`MALUS_SCALE`, `Race.malusScale_*`). Le
  bandeau rouge séparé disparaît.
- **Team Nation et Aspiration retirés** (point 9 du règlement affiché, §10-11 de
  `docs/reglement.md`) : `scoreIndividualPredictions` (`lib/admin/raceResults.ts`) passe `favoriteTeam: null` au moteur et n'ajoute plus
  le bonus Aspiration. Les fonctions du moteur restent (testées) mais ne sont plus appelées. Les
  sections suivantes du règlement sont renumérotées (9 à 12). Une course déjà notée garde ses
  anciens bonus jusqu'à ce que ses résultats soient réenregistrés dans l'admin.
- **Équipe favorite** : reste choisie en début de saison, pour le plaisir. Sur l'accueil, sous
  « Mon équipe favorite », ses victoires (🏆) et podiums (🏅, victoires comprises) de la saison
  (`favoriteTeamStats.ts`, testé) : biathlètes de la nation et du sexe de l'équipe, et relais de ce
  sexe (pas les relais mixtes, **à confirmer**).
- **Prochaine étape** : sous l'étape de la semaine, petit encart (drapeau, lieu, dates) vers Ma
  saison, étape dépliée (`/courses?etape=…`). C'est l'étape qui suit celle de la semaine, ou la
  prochaine à venir les semaines sans étape.
- **Détail du calcul** (page d'une course notée seulement, et pop-up d'un joueur) : sous chaque nom,
  en petit, « cote 8 × 25 » (cote en vigueur × multiplicateur de la place, `CalcDetail`), plus
  « 🚀 50 » / « 🎯 20 » le cas échéant ; « cote 6 » seule hors barème.
- **Tour de péna séparé** (demande de Guillaume) : les points d'un athlète affichés à droite sont
  ceux qu'il rapporte sans le malus ; le malus apparaît en rouge sur une 2e ligne plus petite sous
  son nom (« 🔁 2 tours de péna : -40 pts », `PenaltyLine`), sur l'accueil comme sur la page de la
  course. Calcul à l'affichage (`lastResult.ts`) : tours × malus par tour, ×3 sur la cible de
  « Ça farte » ; comme les points par choix, il est montré hors ×2 Mondiaux/JO ou bonus perso
  (affichés à part). Le total du pronostic, lui, ne change pas.

## Listes de départ poursuite et mass start (octobre 2026)

**Demande de Guillaume** : n'afficher dans le pronostic que les biathlètes qui prennent vraiment
le départ, et ne rien afficher tant que la liste n'est pas connue.

- **Règle IBU** : poursuite = 60 premiers du sprint. Mass start = 30 partants : les 25 premiers du
  classement général de la Coupe du monde + les 5 meilleurs de l'étape en cours (points marqués
  sur ses courses) non déjà qualifiés ; aux Mondiaux/JO, règle propre (15 premiers du général,
  médaillés des courses précédentes, meilleurs points de l'événement). Le classement général
  n'étant pas dans l'application, la liste de mass start ne peut pas être calculée : elle est
  récupérée sur le site de l'IBU.
- **Table `race_start_lists`** (migration `0020_race_start_lists.sql`) : `(race_id, athlete_id)`,
  place de départ et dossard. Lecture publique, écriture admin (clé service).
- **Résolution** (`src/lib/startList.ts`, `resolveStartList`, testée) : la liste IBU enregistrée
  prime ; à défaut, la poursuite reprend les 60 premiers du sprint saisi (même sexe, même étape) ;
  sinon la liste est « inconnue » et la page de la course affiche un message à la place du
  formulaire (pronostics fermés).
- **Back-office** (`/admin/races/{id}`, encart « Liste de départ », poursuite et mass start) :
  bouton « Récupérer la liste de départ IBU ». Lecture directe de l'API publique
  biathlonresults.com (la même que pour les résultats, `fetchIbuStartList`), pas une IA : plus
  fiable (pas d'erreur de recopie), gratuit et instantané. Les biathlètes sont rapprochés par
  nom (`matchStartList`) des athlètes ayant une cote pour ce format ; **les cotes ne sont pas
  modifiées**. Ré-exécutable ; bouton « Effacer la liste IBU ».
- **À confirmer** : un biathlète de la liste IBU sans cote dans le jeu n'est pas pronostiquable
  (il est seulement signalé à l'admin). La restriction est faite par l'écran de pronostic, pas par
  une règle de la base (un pronostic écrit directement en base n'est pas vérifié).

## Applis Android / iOS et notifications (fin octobre 2026)

Guillaume veut de vraies applis sur Google Play et l'App Store (pas une PWA comme VéloPronos), avec
des notifications : elles serviront aux questions bonus posées pendant les courses.

- **Capacitor 8, dossier `mobile/`** (son propre `package.json`, hors build Vercel et hors
  `tsconfig`). L'appli ouvre `https://www.biathlonpronos.fr/` dans une vue web native
  (`server.url`) : toute mise à jour du site arrive dans l'appli sans repasser par les stores.
  Seuls les changements natifs (plugins, icône, écran de démarrage) demandent un nouveau build.
  Identifiant : `fr.biathlonpronos.app`. Hors connexion, l'appli affiche `mobile/www/offline.html`.
- **Notifications : Firebase Cloud Messaging**, plugin natif `@capacitor-firebase/messaging`
  (Android + iOS ; Firebase relaie vers Apple avec la clé APNs déposée dans la console Firebase).
  Le site n'embarque que `@capacitor/core` et déclare lui-même la partie du plugin utilisée
  (`src/lib/native/firebaseMessaging.ts`) : dans un navigateur ordinaire, rien ne se passe.
- **Inscription du téléphone** (`PushRegistrar`, dans le layout) : au lancement de l'appli,
  demande d'autorisation puis envoi du jeton par Server Action (`src/lib/push/actions.ts`).
  Tant que personne n'est connecté, le serveur refuse et on réessaie à chaque changement de page.
  À la déconnexion, le jeton est retiré puis l'appli recharge la page de connexion.
  Profil : encadré « Notifications de l'appli » (seulement dans l'appli) pour les activer ou
  expliquer comment les réautoriser dans les réglages du téléphone.
- **Table `push_tokens`** (migration 0021) : jeton (clé), joueur, plateforme, langue, dates.
  Accès réservé au serveur (RLS sans policy, comme 0020). Un jeton passe au dernier joueur
  connecté sur le téléphone.
- **Envoi** (`src/lib/push/fcm.ts`, `send.ts`) : API FCM HTTP v1, jeton d'accès Google signé avec
  le compte de service Firebase (variable `FIREBASE_SERVICE_ACCOUNT` sur Vercel, JSON complet),
  sans dépendance supplémentaire. Les jetons périmés (appli désinstallée) sont supprimés.
  Back-office `/admin/notifications` : envoi « moi seulement » (test) ou à tous les joueurs ; le
  lien est une page sans langue (`/courses`), ouverte dans la langue du joueur.
- **Connexion dans l'appli** : les boutons Google / Apple / Facebook sont masqués (Google refuse
  les vues web intégrées, et ils ne sont pas encore branchés) ; email + mot de passe seulement.
- **Builds : Codemagic** (`codemagic.yaml` à la racine), lancés à la main. Android : AAB signé
  (clé « biathlonpronos_upload » dans Codemagic) ; le premier envoi sur Google Play se fait à la
  main, l'envoi automatique est ensuite à décommenter. iOS : signature automatique via la clé API
  App Store Connect, envoi sur TestFlight. Les numéros de version suivent le numéro de build.
- **Fichiers Firebase** à ajouter quand Guillaume les fournit : `mobile/android/app/google-services.json`
  et `mobile/ios/App/App/GoogleService-Info.plist` (déjà référencé dans le projet Xcode).
- **Icône et écran de démarrage provisoires** générés depuis le logo (cible) : sources dans
  `mobile/assets/`, regénérés par `npm run assets` dans `mobile/`.
- **À confirmer / à faire** : questions bonus (le contenu des notifications, envoi automatique),
  textes de notification par langue (la langue de chaque téléphone est déjà stockée), suppression
  de compte depuis l'appli (Apple l'exige ; aujourd'hui c'est un email au support).

## Cartes bonus du 10/10 : choix, 4e choix, une carte à la fois (fin octobre 2026)

**Constat de Guillaume** : Hugo a atteint 10/10, la série est repartie à 0 et rien ne s'est passé.
Le crédit de carte était bien compté (`streak_counters.cards_earned`), mais le choix était caché en
bas du Profil. Décisions de Guillaume (30/10/2026) :

- **Choix de la carte** dans l'encadré « Série en cours » de l'accueil et de Ma saison (plus dans le
  Profil) : bouton doré « 10/10 ! Choisis ta carte bonus » qui ouvre un pop-up ; sur l'accueil le
  pop-up s'ouvre tout seul une fois par visite (« Plus tard » le referme). Seules deux cartes sont
  proposées : **Ça farte** et **4e choix** (`balle_de_pioche` en base). Fondue et Chat noir restent
  dans le code mais ne se choisissent plus.
- **Rappel des cartes** sous la série : dorée « disponible », contour doré « active » (jouée, une
  course couverte pas encore notée ; « active, 2/4 courses » pour le 4e choix), grisée et barrée
  « utilisée ». Mêmes pastilles en haut du pop-up d'un joueur du Classement.
- **4e choix** : jusqu'à 4 biathlètes (3 suffisent), les 3 meilleurs comptent, sur la course où il
  est joué puis les suivantes de la saison, relais exclus, jusqu'à **2 courses par sexe** (4 au
  total, moins en fin de saison). Une course oubliée compte dans les 4 (à confirmer). Les courses H et
  F au même horaire : la course d'activation passe d'abord. (`quatriemeChoixWindow`, même règle en
  SQL `quatrieme_choix_window`.)
- **Ça farte** : courses individuelles seulement, ×3 jamais cumulé avec un ×2 (inchangé).
- **Une seule carte à la fois** : pas de Ça farte sur une course couverte par un 4e choix, pas de
  4e choix dont la fenêtre couvrirait un Ça farte déjà posé.
- Une carte jouée est définitive (elle ne revient pas si le joueur change d'avis).

**Sécurité / scoring** (migration **0022**, à coller par Guillaume) : les écritures directes dans
`bonus_cards` (0012, 0013) sont retirées — un joueur pouvait s'attribuer n'importe quelle carte ou
remettre une carte jouée à « disponible ». Choisir passe par `claim_bonus_card` (crédit restant
obligatoire, Ça farte ou 4e choix seulement), jouer par `play_bonus_card` (course pas partie,
individuelle, une carte à la fois ; sert aussi au bouton Fondue). Lecture des cartes ouverte à tous
pour le pop-up du Classement. À la notation, ce sont les cartes jouées qui font foi
(`resolvePredictionCard`) : sans 4e choix actif, seuls les 3 premiers biathlètes d'un pronostic
comptent ; le ×3 ne s'applique que sur la course où Ça farte a été joué.

Code : `src/lib/bonusCards.ts` (testé), `src/components/StreakCard.tsx`, `ClaimCardPicker.tsx`,
`BonusCardsList.tsx`, formulaire de pronostic (`PredictionForm`, props `playableCards` /
`activeCard`).

**Précisions de Guillaume (30/10/2026, après mise en ligne).**
- Le choix de la carte bonus est en haut du formulaire de pronostic (au-dessus de « Mon pronostic »).
- **Le 4e choix s'active tout seul** dès qu'il est choisi au 10/10 : sur la prochaine course
  individuelle pas encore partie et les suivantes (2 par sexe). Il ne se joue plus depuis le
  formulaire. Ça farte reste en main et se joue quand le joueur veut. Migration **0023**
  (`claim_bonus_card` modifiée, `next_individual_race`, et activation des 4e choix déjà pris mais pas
  joués), à coller par Guillaume.
- Si le 4e choix couvre une course où Ça farte avait déjà été posé, Ça farte l'emporte sur cette
  course (choix pragmatique, à confirmer).

## Fautes au tir et course « Tour de péna » (fin octobre 2026)

- **Bug corrigé** : à la course « Tour de péna », aucun tour n'était compté. Le moteur lisait bien
  `race_results.penalty_laps`, mais la récupération des résultats IBU laissait la colonne « Tours
  de péna » vide (seul le CSV fait main la remplissait). Règle confirmée par Guillaume : **tours de
  péna = nombre de fautes au tir de l'athlète**. L'import IBU remplit désormais cette colonne avec
  `ShootingTotal` ; à défaut, la somme des fautes par tir sert de tours de péna (CSV, saisie admin,
  enregistrement et calcul des points). Pour une course déjà notée, relancer « Récupérer les
  résultats officiels IBU » puis « Enregistrer et calculer les scores ».
- **Fautes par tir** : nouvelle colonne `race_results.shootings smallint[]` (migration 0024), lue
  dans le champ IBU `Shootings` (« 0+1+0+2 »), colonne « Tirs » du CSV et du tableau de saisie.
  Affichées en ronds noirs chiffrés en blanc (`ShootingDots`, comme biathlonworld) à côté de chaque
  athlète dans le classement d'une course terminée et dans le détail des pronostics : 2 ronds au
  sprint et en relais, 4 sinon (`shootingCount`).
- **Relais (à confirmer)** : 2 ronds pour l'équipe = fautes au couché et au debout, tous relayeurs
  additionnés ; chaque balle de pioche utilisée compte comme une faute (le format IBU d'un tir de
  relais est « tours de péna + balles de pioche »). Le format exact renvoyé par l'IBU pour la ligne
  d'équipe n'a pas pu être vérifié (site injoignable depuis l'environnement de développement) :
  le code accepte la ligne d'équipe ou, à défaut, additionne les lignes des relayeurs.

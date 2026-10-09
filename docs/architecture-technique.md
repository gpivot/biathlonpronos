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
- Écrans : `/admin/relais` (saisie des cotes par nation et par format), écran de pronostic joueur
  (`RelayPredictionForm.tsx`, sélection d'une nation), saisie des résultats admin (mode "nation"
  dans `ResultsForm.tsx`) — tout branché sur `scoreRace()` (`src/lib/admin/raceResults.ts`), y
  compris la mise à jour du 10/10 (§12 : "hommes et femmes confondus ainsi que relais").
- **Import CSV des cotes** : Guillaume saisit ses cotes dans 3 fichiers (femmes / hommes / relais
  mixtes) — format exact des colonnes à confirmer avant de construire l'import ; en attendant, la
  saisie se fait ligne par ligne dans `/admin/athletes` et `/admin/relais`.

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
saison + choix de la Pépite. Écran admin `/admin/globes` : saisie du classement final officiel
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

**Import CSV des cotes — implémenté et testé contre la vraie base (`/admin/import`).** En-têtes
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

**Bouton retour et import CSV du calendrier (demandes complémentaires de Guillaume).**
- Flèche de retour vers l'accueil en haut à gauche de `/courses`, cohérente avec le pattern déjà
  utilisé sur les sous-écrans (`/globes`, `/regles`) — pas encore répliquée sur les autres onglets
  de la navigation basse (Classement, Ma saison, Ligues) puisque ce sont des onglets racine, pas
  demandé au-delà de cette page pour l'instant.
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

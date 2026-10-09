# Biathlonpronos — Cahier des charges

## Décisions actées

- **Approche** : reconstruction from scratch, en code propre, indépendante de base44 (pas de reprise du code exporté).
- **Saison ciblée** : 2026-27, puis reconduction chaque saison suivante. Remise à zéro de l'app en fin de saison avec saisie d'un nouveau calendrier ; archivage des résultats des saisons précédentes à concevoir (voir plus bas).
- **Périmètre courses** : les 9 étapes de la Coupe du Monde IBU + les Championnats du Monde ou les JO (selon l'année).
- **Identité** : reprendre le style graphique de vélopronos pour garder une unité de marque, mais avec une palette plus hivernale / glace / neige. Le domaine **biathlonpronos.fr est déjà réservé**.
- **Authentification** : email / Google / Apple, à l'identique de vélopronos.
- **Utilisateurs cibles** : grand public, objectif d'un maximum de joueurs (pas un simple cercle d'amis) — avec une **possibilité d'intégrer de la publicité à l'avenir** à prévoir dans l'architecture (emplacements pub, consentement RGPD/cookies, etc.).
- **Internationalisation** : app multilingue pour acquérir des joueurs sur les autres territoires biathlon. Architecture FR/EN posée en priorité (implémentée avec next-intl, routing par préfixe `/fr`, `/en` — voir README > Internationalisation) ; langues suivantes à activer par simple ajout de fichier de traduction : DE, norvégien, suédois, italien, russe.
- **Mode de jeu** : contrairement à vélopronos (freemium 1 coureur gratuit / 3 coureurs payants), Biathlonpronos ne garde que le mode « 3 biathlètes » en gratuit dès le départ ; monétisation par publicité future uniquement, pas de palier payant.
- **Calendrier de lancement** : tests en **octobre 2026**, lancement en **production fin novembre 2026** (début de la saison 2026-27).
- **Règlement complet du jeu** : voir `reglement.md` — fourni intégralement par Guillaume, à considérer comme la référence pour le moteur de scoring.

## Implications pour la conception technique (déduites du règlement)

- **Biathlètes** : nom, nation, sexe, cotes par format (sprint / poursuite / individuel / mass start) + cotes « gros globe », « meilleur(e) jeune », « meilleure nation » (par couple nation+sexe). Les cotes sont réévaluées à des dates clés (pause de Noël, fin janvier, après Mondiaux/JO) → besoin d'un **historique des cotes dans le temps**, pas juste une valeur courante.
- **Courses** : étape (lieu, dates), format (sprint / poursuite / individuel / mass start / relais H, F, mixte, mixte simple), règles spéciales éventuelles (tour de péna / brouillard / t'es collé), coefficient ×2 si Mondiaux/JO, horodatage précis du départ (verrouillage des pronostics à l'heure exacte).
- **Cote poursuite** : recalcul automatique après le sprint à partir des écarts de temps (+5 de cote par tranche de 20s de retard, 1ère tranche neutre, plafond ~40) → la saisie des résultats du sprint doit inclure les écarts, pas seulement le classement.
- **Grillage** : état par joueur × biathlète × étape en cours, remis à zéro au changement d'étape (sauf carte Fondue).
- **Pronostic joueur** : 3 biathlètes (ou 1 nation pour un relais), + cartes bonus actives éventuelles, + bonus ×2 saison éventuel (max 3 utilisations/saison, hors Mondiaux/JO et courses spéciales).
- **Moteur de scoring** : barème de base (cote × multiplicateur par rang) + bonus de pronostic (podium/top5/top10/prono parfait) + malus des courses spéciales + bonus Fusée/Gâchette + coefficient Mondiaux/JO + bonus Team Nation + bonus Aspiration + suivi de série 10/10 + effets des cartes bonus (Balle de pioche, Ça farte, Fondue, Chat Noir). Détail complet dans `architecture-technique.md`.
- **Pronostics de saison (globes)** : gros globe / meilleur jeune / meilleure nation par sexe, verrouillés avant le début de saison, corrigibles une fois via la carte Chat Noir (avant la fin de la 3e étape).
- **Pépite** : sélection d'un outsider (cote ≥ 30 au moment du choix) en début de saison, bonus au 1er Top 10 de la saison.
- **Classements** : classement général (Dossard Jaune) + classements annexes (Dossard Rouge). Ligues privées entre joueurs.
- **Back-office** : saisie des résultats (classement + écarts de temps pour la poursuite + nb de tours de pénalité pour la course « tour de péna »), gestion/réévaluation des cotes, gestion du calendrier et des règles spéciales par course.
- **Archivage inter-saisons** : modéliser la « saison » comme une entité à part entière (plutôt qu'un simple reset des tables) pour permettre de conserver l'historique des saisons passées tout en repartant sur un calendrier et des cotes vierges chaque année.
- **Publicité future** : prévoir dès l'architecture des emplacements publicitaires et la gestion du consentement cookies, sans bloquer le développement initial.

## Technique / hébergement

Stack retenue : Next.js (App Router, TypeScript) + Supabase (Postgres, auth, RLS) + hébergement Vercel. Détails et justification dans `architecture-technique.md`.

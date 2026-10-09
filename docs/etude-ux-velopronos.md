# Étude UX de vélopronos.fr (exploration via compte test)

Notes prises en explorant l'application web réelle de VéloPronos (l'app sœur cyclisme de Guillaume, dont Biathlonpronos reprend l'identité visuelle), pour compléter le règlement avec la structure d'écrans et les patterns UX effectivement utilisés.

## Architecture de navigation

- **Accueil** : message de bienvenue personnalisé (pseudo du joueur), raccourcis "Découvre les règles" / "Défie tes amis", liste des « Compétitions du moment » (à venir / en cours) et « Compétitions terminées » (archive).
- **Par compétition**, 4 onglets : **Étapes / Coureurs / Mes pronostics / Mes ligues**.
- **Par étape**, barre de navigation basse fixe à 5 entrées : **Épreuve / Étapes / Classement / Ligues / Pronos**.
- Navigation séquentielle entre étapes via "Étape précédente / Étape suivante".

## Écran de pronostic (par étape)

- Bandeau d'avertissement contextuel la première fois : rappel de la règle du grillage, avec bouton "J'ai compris ! / Ne plus afficher".
- Compte à rebours bien visible avant verrouillage (ex. "16h 14m 21s").
- Fiche étape/course : type/format, lieu, date/heure, infos complémentaires (distance, dénivelé côté cyclisme — équivalent biathlon : nombre de tirs, format).
- Liste des biathlètes/coureurs disponibles : identifiant, nom, code nation/équipe, **cote affichée en `×N`**, triée par cote croissante (favoris en tête, cote basse ; outsiders en bas, cote haute).
- Bouton "Valider" pour soumettre le pronostic.

Note : côté vélopronos, il existe un palier freemium (1 coureur gratuit / 3 coureurs + options en mode payant) — **décision prise pour Biathlonpronos : pas de palier freemium, le jeu à 3 biathlètes est l'offre unique dès le départ, monétisation par publicité future uniquement** (voir `cahier-des-charges.md`).

## Classement

- Classement avec position du joueur et total de points affichés en évidence.
- Fonction sociale : comparaison des résultats entre amis.
- Ligues privées accessibles depuis l'onglet dédié.

## Identité visuelle

- Thème sombre par défaut : fond bleu marine / anthracite, accents bleu indigo.
- UI en cartes arrondies.
- Barre de navigation basse façon app mobile.

Biathlonpronos reprend ce système (cartes arrondies, navigation basse, thème sombre) avec une palette hivernale/glace (voir la planche d'identité graphique publiée pendant la conception — tokens repris dans `tailwind.config.ts`).

# 🥜 GlaGla Jeux

Plateforme de jeux de soirée multi-joueurs, façon [TOZ](https://apps.apple.com/app/toz) mais **chacun joue sur son propre téléphone** :
l'hôte crée un salon, les autres le rejoignent avec un **code à 5 caractères**, et chacun reçoit sa carte secrète sur son écran.
Pas de téléphone ? L'hôte ajoute le joueur et lui **passe son téléphone** (carte et vote en secret).

Premier jeu : **Undercover** (mots secrets, débat chronométré, vote, Mr. White optionnel).
À venir : Loup-Garou, Tu préfères, Je n'ai jamais, Action ou vérité…

## Stack
- React 18 + TypeScript + Vite (mobile first, installable en PWA)
- Supabase : Postgres + RLS, Auth (invité anonyme → compte email), Realtime
- Design : thème Spotify (fond #121212, Figtree, boutons pilules) + palette GlaGla (`8EA604 · F5BB00 · EC9F05 · D76A03 · BF3100`) + grille de jeux façon TOZ

## Démarrer
1. Crée un projet Supabase, puis dans **Authentication → Sign In / Providers**, active **Allow anonymous sign-ins**.
2. Dans le SQL editor, exécute `supabase/migrations/0001_init.sql` puis `supabase/seed.sql` (75 paires de mots FR).
3. Copie `.env.example` en `.env.local` et renseigne `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
4. `npm install && npm run dev`

Le temps réel utilise la publication `supabase_realtime` (ajoutée par la migration) ; un sondage toutes les 4 s sert de filet de sécurité.

## Sécurité : les secrets ne fuient pas
Les mots et rôles vivent dans `player_secrets` / `room_secrets` / `votes`, **sans aucune policy RLS** : impossible de les lire par `select`.
Tout passe par des fonctions `SECURITY DEFINER` (`start_game`, `get_my_secret`, `cast_vote`, …) qui vérifient que l'appelant est le joueur
concerné (ou l'hôte pour un joueur « sans téléphone »). Les rôles ne sont publics qu'à l'élimination ou en fin de partie.

## Règles d'Undercover implémentées
- Civils : même mot · Undercover(s) : mot proche · Mr. White : aucun mot.
- Débat libre chronométré (+1 min par l'hôte, passage au vote à la fin du chrono par n'importe quel joueur).
- Vote secret ; le plus ciblé est éliminé, rôle révélé ; **égalité = personne n'est éliminé**, le débat reprend.
- Mr. White éliminé : dernière chance de deviner le mot des civils (insensible à la casse/accents) pour gagner seul.
- Civils gagnent sans infiltré restant ; infiltrés gagnent à égalité de nombre avec les civils.
- Stats (parties / victoires) par compte, « Rejouer » avec les mêmes joueurs, mots proposables par les comptes (validés à la main : `approved = true`).

## Ajouter des mots
Table `word_pairs` (`civil_word`, `undercover_word`, `category`, `lang`, `approved`). Les propositions des joueurs arrivent avec `approved = false`.

## Logo
`npm run logo` régénère `public/logo.svg` (script `scripts/gen-logo.mjs`)  : deux joysticks de manette qui pendent sous la manette, aux couleurs de la marque.

## Idées pour la suite
Nettoyage automatique des vieux salons (pg_cron), nouveaux jeux (le socle `rooms`/`room_players` est générique), langues, packs de mots premium.

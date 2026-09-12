# Predictions

Application macOS en français pour suivre EuroMillions, Loto FDJ et EuroDreams. Les calculs s’exécutent sur le Mac, sans API d’IA. Interface Electron isolée, historique hors ligne, mises à jour via GitHub Releases.

## Démarrer

```sh
npm ci
npm start
```

```sh
npm test
npm run dist:test -- --x64 --arm64
```

Les installateurs sont dans `dist/`. Ouvrir le DMG puis glisser Predictions dans Applications. Une version locale sans certificat est un build de test non signé, susceptible d’être bloqué par Gatekeeper. Ne pas la confondre avec une version signée et notariée.

### Correctif 0.1.1 : crash au démarrage sur Intel

La version 0.1.0 associait une signature ad hoc, sans Team ID Apple, au Hardened Runtime sans exception de validation des bibliothèques. Sur certains Mac, dyld refusait de charger Electron avec l’erreur « different Team IDs ». `dist:test` utilise désormais un fichier d’entitlements propre aux tests : JIT et chargement de bibliothèques avec signature ad hoc, en conservant le Hardened Runtime. La configuration de publication Developer ID garde ses entitlements distincts, sans cette exception.

La CI construit chaque architecture nativement puis installe le DMG dans `/Applications` sur une autre VM macOS 15, Intel et Apple Silicon. Elle vérifie la signature et les entitlements du binaire principal et des assistants, puis exécute les parcours de l’application après installation. Ce contrôle remplace la seule exécution sur la machine ayant construit le paquet, insuffisante pour détecter le crash de la 0.1.0. Les tests ne constituent pas une validation Gatekeeper ou de notarisation.

## Fonctionnalités

- Synchronisation FDJ au lancement, à la sortie de veille et toutes les 15 minutes pendant l’exécution, même si la fenêtre est fermée. Si l’application est quittée, rattrapage au prochain lancement. Les archives FDJ peuvent paraître après les résultats : pas de promesse de temps réel.
- Historique des trois jeux ; dédoublonnage par jeu et date ; validation des numéros et des dates ; corrections FDJ prioritaires ; import/export CSV.
- Probabilités hypergéométriques exactes pour chaque nombre de correspondances et couverture du premier rang.
- Fréquences, écarts et fenêtres de 50, 100, 500 tirages ou tout l’historique compatible.
- Huit stratégies : uniforme, fréquences lissées, décroissance exponentielle, écarts, transitions Markov, double tendance, cooccurrences conditionnelles et ensemble régularisé.
- Comparaison chronologique : 100 observations initiales minimum, apprentissage sur les 500 précédentes maximum, test sur les 300 dernières maximum, 30 grilles par tirage/modèle. Graine fixe. Aucune observation future dans l’apprentissage.
- Huit diagnostics, calibrés par 499 simulations complètes sans remise : dispersion des numéros, numéro extrême, dispersion bonus, paire extrême, répétitions consécutives, autocorrélations des sommes, périodicités des sommes et décalage de la somme moyenne. Les maxima calibrent les recherches internes ; Bonferroni corrige les huit familles affichées.
- Calculs dans un Web Worker ; recalcul automatique pour le jeu sélectionné au chargement ou après changement des tirages.
- Carnet persistant, comparaison aux tirages réels, gains saisis manuellement, bilan sur les grilles renseignées, sauvegarde et restauration par fusion.

## Limites scientifiques

Les stratégies sont des expériences, pas des probabilités prédictives validées. Chaque combinaison valide a la même chance sous l’hypothèse de tirages indépendants et uniformes. Une anomalie statistique ne prouve ni fraude ni avantage exploitable. Un test non significatif ne prouve pas l’indépendance. Multiplier les algorithmes multiplie aussi les occasions de surapprentissage.

Les intervalles du backtest décrivent la variabilité entre tirages, ne corrigent pas la sélection des modèles et supposent une indépendance approximative entre observations. Le résultat ne démontre pas un rendement financier. Toute sélection après consultation du backtest doit être gelée puis évaluée sur de futurs tirages. Les scores sont des correspondances, pas des gains. Les gains, rangs financiers, My Million, Étoile+, Super Loto et second tirage Loto ne sont pas calculés.

Les bonus EuroMillions ont changé historiquement : validation à 9, 11 puis 12 étoiles ; analyses limitées au régime 12 étoiles depuis le 27 septembre 2016. Loto : formule 5/49 + 1/10 uniquement. EuroDreams : 6/40 + 1/5. La mise par défaut du carnet est 2,50 €, 2,20 € et 2,50 € respectivement, pour une grille simple sans options.

## Données et reprise du classeur

Le fichier fourni contient 1 944 tirages EuroMillions arrêtés au 22 mai 2026. Ses tableaux statistiques étaient largement constitués de résultats saisis ; ils ne sont pas repris comme preuves. La comparaison exhaustive a révélé 45 combinaisons divergentes et deux dates absentes des archives officielles (30 janvier 2004, 1er février 2016). La base livrée a donc été entièrement reconstruite à partir des 11 archives FDJ : 1 979 tirages EuroMillions, 2 806 Loto et 298 EuroDreams. Le classeur original est conservé intact et ne figure pas dans le dépôt. Le script scripts/rebuild-official-seed.mjs permet de reproduire cette reconstruction.

L’historique livré est dans `data/seed.json`. `npm run sync:seed` actualise cette base de départ. Le fichier utilisateur est `~/Library/Application Support/Predictions/predictions.json` . Les mises à jour de l’app ne remplacent pas les données utilisateur. Écritures atomiques sérialisées ; une base corrompue est conservée et empêche le démarrage plutôt que d’être écrasée. La restauration fusionne les tirages et les identifiants de grilles.

Sources consultées le 10 septembre 2026 :

- https://www.fdj.fr/jeux-de-tirage/euromillions-my-million/historique
- https://www.fdj.fr/jeux-de-tirage/loto/historique
- https://www.fdj.fr/jeux-de-tirage/eurodreams/historique
- https://www.fdj.fr/jeux-de-tirage/eurodreams/comment-jouer
- https://www.fdj.fr/jeux-de-tirage/loto/comment-jouer

Les URL d’archives sont centralisées dans `src/engine.mjs`. Un changement de format ou d’adresse FDJ provoque une erreur visible, conserve les anciennes données et peut être corrigé dans une version suivante.

## Publier une version avec mise à jour automatique

Le dépôt public est `insrtstudio/predictions`. Les utilisateurs n’ont pas besoin de jeton GitHub. Il faut un compte Apple Developer et un certificat **Developer ID Application** pour signer, ainsi que la notarisation Apple pour une distribution normale sur macOS.

Configurer dans GitHub → Settings → Secrets and variables → Actions :

| Secret | Valeur |
|---|---|
| `CSC_LINK` | Certificat `.p12` encodé en base64 |
| `CSC_KEY_PASSWORD` | Mot de passe du certificat |
| `APPLE_ID` | Identifiant Apple utilisé pour la notarisation |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mot de passe d’application Apple |
| `APPLE_TEAM_ID` | Identifiant d’équipe Apple |

Ne jamais committer ces valeurs. `GITHUB_TOKEN` est fourni automatiquement par Actions. Le workflow refuse de publier sans signature/notarisation configurée.

```sh
npm version patch
git push origin main --follow-tags
```

Le tag `vX.Y.Z` déclenche les tests, les DMG + ZIP Intel/Apple Silicon, la signature, la notarisation et la publication. Le ZIP et `latest-mac.yml` sont indispensables à `electron-updater` : publier uniquement le DMG ne suffit pas. Un simple push de code sans changement de version ne déclenche pas une nouvelle version utilisateur.

L’application vérifie GitHub au lancement et manuellement dans Sources & mises à jour, propose le téléchargement puis le redémarrage. Les données restent dans Application Support. Le passage d’une version signée à une seconde version signée doit encore être testé de bout en bout une fois les secrets Apple configurés. Le build local non signé ne valide pas ce parcours.

Documentation : https://www.electron.build/docs/features/auto-update/

## Structure

`engine.mjs` : probabilités, stratégies et backtests ; `diagnostics.mjs` : simulations ; `sync.mjs` / `importer.mjs` : FDJ et CSV ; `store.mjs` : persistance ; `main.mjs` / `preload.cjs` : macOS et pont IPC limité ; `renderer.mjs` / `worker.mjs` : interface et calculs isolés. Le contenu importé n’est jamais exécuté comme instruction.

### Version 0.1.2 — carnet et rappels
- Saisie de grilles simples déjà jouées (numéros, bonus, date, mise), validées et conservées dans le carnet avec la mention « Saisie manuelle ».
- Comptes à rebours des trois jeux jusqu'à la clôture habituelle à 20 h 15 Europe/Paris, avec gestion des changements d'heure. Tirages exceptionnels exclus.
- Notifications facultatives : rappel 15/30/60/120 minutes avant clôture et nouveaux résultats récupérés depuis les archives FDJ. Réglages persistants ; un rappel maximum par jeu et date, y compris après redémarrage.
- L'app doit rester lancée et le Mac éveillé ; fermer la fenêtre laisse l'app tourner sur macOS. Les notifications dépendent des autorisations macOS et du mode Concentration. Aucun service push distant ; la publication des archives peut retarder les alertes de résultats.
- Références horaires : https://www.fdj.fr/mag/questions/horaire-jeux-tirages et https://www.fdj.fr/jeux-de-tirage/eurodreams/comment-jouer

### Version 0.1.3 — mise à jour sans Developer ID
Le mécanisme reprend le principe de 2listen : `electron-updater` vérifie GitHub et télécharge le ZIP de la bonne architecture, mais l'installation utilise un helper local au lieu de Squirrel.Mac. Le paquet est vérifié (SHA-512, identifiant, version, signature ad hoc et architecture), extrait avant de quitter, puis déplacé sur le même volume. L'ancien bundle reste dans un dossier `.predictions-update-*` voisin de l'app ; une erreur de remplacement provoque sa restauration. Un échec de démarrage ultérieur ne déclenche pas de retour automatique. Les journaux d'état se trouvent dans `Application Support/Predictions/update-status.json`.

Après un push sur main, les deux architectures sont construites et testées. Un workflow publie ensuite une GitHub Release avec DMG, ZIP et `latest-mac.yml`, uniquement si cette version n'a pas déjà été publiée. Incrémenter `package.json` et le lockfile pour publier une nouvelle version. Les versions publiées sont immuables. Aucun secret Apple requis pour ce circuit ; les paquets ne sont pas notarisés.

Les anciennes versions 0.1.0–0.1.2 nécessitent une dernière installation manuelle du DMG pour adopter ce helper. Ensuite le téléchargement est automatique et l'installation se fait via « Redémarrer et installer ». L'app doit être dans un dossier accessible en écriture, en dehors d'une image DMG. Aucune modification globale des protections macOS, aucune suppression de quarantaine et aucune modification des données utilisateur.

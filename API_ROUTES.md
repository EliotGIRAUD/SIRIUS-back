# API SIRIUS — Référence backend (V1)

## Général

- **Base URL** : à définir selon environnement (`http://localhost:3001` en local, URL **Render** ou autre en prod). Si `PORT` est défini dans `.env`, utiliser ce port.
- **Encodage** : `Content-Type: application/json` pour toutes les requêtes avec corps.
- **Erreurs** : corps typique `{ "error": "message lisible" }` avec un code HTTP **4xx** ou **500**.

## Variables d’environnement (serveur)

| Variable | Rôle |
|----------|------|
| `PORT` | Port HTTP d’écoute (défaut **3001** si absent). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Chemin relatif ou absolu vers le JSON du compte de service Firebase (voir `config/firebase.js`). |
| `DATABASE_URL` | URL base temps réel Firebase si utilisée par la config Admin (optionnel selon projet). |
| `CORS_ORIGINS` | Liste séparée par des **virgules** d’origines autorisées. Si **vide ou absent** : **toutes** les origines sont acceptées (pratique dev mobile, **à restreindre en prod**). |

## Firestore : schéma et règles

- **`users/{uid}`** : `uid`, `pseudo`, `wallet_gold`, `wallet_gems`, `difficulty_mode`, `is_demo_mode`, `unlocked_breeds`, horodatage éventuel.
- **`dogs/{id}`** : `id` généré par Firestore ; `ownerId`, `name`, `breed`, **`food`**, **`water`**, `health`, `is_sick`, `last_update`, `abandonment_pending_video`, `abandonment_marked_at`, etc.  
  **`food` / `water`** : **100 = plein** ; le tick **décrémente** vers 0 (plus le chien manque de nourriture / d’eau). Anciens champs `hunger` / `thirst` encore lus une fois pour compat migration.
- **`inventory/{ownerId}`** : `ownerId`, `items` : `{ "croquettes": number, "water_bottle": number }`.

**Accès aux données** : cette API utilise le **SDK Admin** (`firebase-admin`) : elle **contourne** les règles de sécurité Firestore côté serveur.  
Les règles `firestore.rules` du dépôt ont été verrouillées pour `users`, `dogs` et `inventory` afin d’empêcher l’accès direct côté client. Utiliser uniquement les endpoints Express pour lire/écrire via l’API.

## Table des routes

| Méthode | Chemin | Fichier route |
|---------|--------|---------------|
| POST | `/auth/register` | `routes/authRoutes.js` |
| POST | `/auth/login` | `routes/authRoutes.js` |
| POST | `/init-dog` | `routes/dogRoutes.js` |
| GET | `/dogs/:userId` | `routes/dogRoutes.js` |
| POST | `/dog/:id/abandon` | `routes/dogRoutes.js` |
| POST | `/shop/buy` | `routes/shopRoutes.js` |
| POST | `/shop/buy-skin` | `routes/shopRoutes.js` |
| POST | `/shop/unlock-breed` | `routes/shopRoutes.js` |
| PATCH | `/user/settings` | `routes/userRoutes.js` |
| PATCH | `/interact/feed` | `routes/interactRoutes.js` |
| PATCH | `/interact/clean` | `routes/interactRoutes.js` |
| PATCH | `/walk/validate` | `routes/interactRoutes.js` |
| PATCH | `/dog/:id/equip-skin` | `routes/dogRoutes.js` |

## Objet « chien » dans `GET /dogs/:userId` (`dogs[]`)

Chaque élément est sérialisé avec au minimum :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | ID document Firestore (à utiliser pour **feed** et **abandon**). |
| `ownerId` | string | Propriétaire (= `userId` / `uid`). |
| `name` | string | Nom du chien. |
| `breed` | string | Race (identifiant snake_case côté stockage). |
| `food`, `water`, `health` | number | Après tick : **food** / **water** = 100 plein → 0 vide ; **health** = santé. |
| `is_sick` | boolean | `true` si santé &lt; 50 après règles métier. |
| `last_update` | string ISO | Moment de référence du tick. |
| `abandonment_pending_video` | boolean | Si abandon signalé. |
| `createdAt` / `updatedAt` | string ISO | Si présents en base. |

## Prix boutique (côté serveur)

**Or (`wallet_gold`)** — `POST /shop/buy` :

| `item` | Prix unitaire (or) |
|--------|----------------------|
| `croquettes` | 20 |
| `water_bottle` | 25 |

**Gemmes (`wallet_gems`)** — `POST /shop/unlock-breed` :

| `breed` (snake_case) | Coût (gemmes) |
|----------------------|----------------|
| `husky` | 150 |
| `beagle` | 120 |
| `berger_allemand` | 200 |

Alias body : `produit` pour `item` ; `race` pour `breed` (normalisé en snake_case côté serveur).

**Gemmes (`wallet_gems`)** — `POST /shop/buy-skin` :

| `skinId` | Coût (gemmes) |
|----------|----------------|
| `skin_space` | 80 |
| `skin_neon` | 120 |

---

## `POST /auth/login`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `idToken` | string | oui |
| `pseudo` | string | non (par défaut : pseudo existant, sinon email Firebase) |

**Réponses**

- **200** : exemple  
  `{"uid":"k7d...","pseudo":"Joueur1","message":"Connexion Firebase validée"}`
- **400** : idToken absent ou vide.
- **401** : token invalide.
- **500** : erreur serveur / Firebase.

Comportement : vérifie `idToken` Firebase, puis met à jour/crée **`users/{uid}`** ; complète les champs économie s’ils manquaient (voir `userService`).

---

## `POST /auth/register`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `idToken` | string | oui |
| `pseudo` | string | non (par défaut : email Firebase) |

**Réponses**

- **200** : `{"uid":"k7d...","pseudo":"Joueur1","message":"Profil utilisateur créé/initialisé"}`
- **400** : idToken absent ou vide.
- **401** : token invalide.
- **500** : erreur serveur / Firebase.

Comportement : identique à `POST /auth/login`, utilisé après création du compte côté Firebase.

---

## `PATCH /user/settings`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `userId` | string | oui |
| `difficulty_mode` | string | non (`normal` \| `hardcore`) |
| `is_demo_mode` | boolean | non |

**Réponses**

- **200** : ex.  
  `{"uid":"...","pseudo":"Joueur1","wallet_gold":500,"wallet_gems":50,"difficulty_mode":"hardcore","is_demo_mode":false,"unlocked_breeds":["golden_retriever"],"...":"..."}`
- **400** : `userId` manquant ; `difficulty_mode` invalide ; `is_demo_mode` non booléen.
- **404** : utilisateur introuvable.
- **500** : erreur serveur.

Comportement : met à jour les réglages de difficulté du profil utilisateur (`users/{uid}`).

## `POST /init-dog`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `name` | string | oui |
| `userId` | string | oui (souvent = `uid` du login) |
| `breed` ou `race` | string | non |

**Réponses**

- **201** : chien créé ; contient **`id`** (ID Firestore). Exemple :  
  `{"id":"abc123","ownerId":"proto-sirius-user-001","name":"Rex","breed":"golden_retriever","food":100,"water":100,"health":100,...}`
- **404** : utilisateur **`users/{userId}`** introuvable (login requis avant).
- **400** : `name` ou `userId` manquant.
- **500** : erreur serveur.

Comportement : nouveau document dans **`dogs`** (ID auto) ; **`ensureInventory(userId)`** si pas d’inventaire.

---

## `GET /dogs/:userId`

**Paramètre URL** : `userId` (= `uid`).

**Réponses**

- **200** : état agrégé même si **`dogs`** est un **tableau vide** `[]` (pas d’erreur « pas de chien »).
- **404** : utilisateur inconnu.

**Corps typique (succès)** :

Champs utiles pour le **client** (simulation fluide entre requêtes) :

- **`server_now_ms`** : horloge serveur (ms depuis epoch) au moment de la réponse — pour aligner le décompte local.
- Chaque chien inclut **`tick_meta`** : paramètres de perte (race + `is_demo_mode` + `hardcore`) — **à garder en sync** avec `dogService.applyTickFromValues`.

Persistance Firestore : les stats chien ne sont **écrites** qu’environ **toutes les 2 minutes** si seul `GET /dogs` est utilisé ; la réponse JSON contient toujours l’état **calculé** à l’instant `server_now_ms`.

```json
{
  "userId": "proto-sirius-user-001",
  "uid": "proto-sirius-user-001",
  "server_now_ms": 1710932400123,
  "pseudo": "Joueur1",
  "wallet_gold": 500,
  "wallet_gems": 50,
  "difficulty_mode": "normal",
  "is_demo_mode": false,
  "unlocked_breeds": ["golden_retriever"],
  "or": 500,
  "gemmes": 50,
  "wallet_soft_gold": 500,
  "wallet_hard_gems": 50,
  "inventory": { "ownerId": "proto-sirius-user-001", "items": { "croquettes": 2, "water_bottle": 1 } },
  "event_emergency": null,
  "dogs": [
    {
      "id": "XXXXXXXX",
      "ownerId": "proto-sirius-user-001",
      "name": "Rex",
      "breed": "golden_retriever",
      "food": 95,
      "water": 95,
      "health": 100,
      "is_sick": false,
      "last_update": "2026-03-20T10:00:00.000Z",
      "tick_meta": {
        "demoStepMs": 10000,
        "is_demo_mode": false,
        "difficulty_hardcore": false,
        "foodLossPerHour": 5,
        "waterLossPerHour": 7,
        "healthLossPerHourWhenDepleted": 10,
        "demoFoodLossPer10s": 1,
        "demoWaterLossPer10s": 1,
        "demoHealthLossPer10sWhenDepleted": 2
      }
    }
  ]
}
```

`event_emergency` est réservé pour des événements futurs ; **`GET /dogs/:userId` ne modifie pas** `wallet_gold` ni `wallet_gems` (pas de frais aléatoires au rafraîchissement).

**Tick** (rappel) : à chaque **`GET /dogs/:userId`**, le serveur applique le temps écoulé depuis **`last_update`**.
- **Par race** (`breed`, ex. `golden_retriever`) : vitesses de perte **`food`** / **`water`** (points / heure en mode normal ; par pas de **10 s** en `is_demo_mode`). **`hardcore`** double ces pertes.
- **Golden retriever** (exemple) : ~**5** nourriture/h, ~**7** eau/h ; autres races utilisent le profil **`default`** jusqu’à extension.
- **Santé** : ne baisse **que** si, **après** ce tick, **`food === 0` ou `water === 0`** (perte santé proportionnelle au temps écoulé dans ce cas).
- **`is_sick`** : `true` si santé &lt; 50 après règles métier.

---

## `POST /shop/buy`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `userId` | string | oui |
| `item` | string | oui (`croquettes` \| `water_bottle`) |
| `quantity` | entier | non (défaut **1**) |

**Réponses**

- **200** : ex.  
  `{"wallet_gold":480,"spent":20,"items":{"croquettes":3,"water_bottle":1},"item":"croquettes","quantity":1}`
- **400** : `userId` manquant ; `quantity` invalide ; article inconnu ; solde insuffisant.
- **404** : utilisateur inconnu ou **inventaire inexistant** (faire au moins un **`init-dog`** avant pour créer l’inventaire).

---

## `POST /shop/unlock-breed`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `userId` | string | oui |
| `breed` | string | oui (voir tableau prix gemmes) |

**Réponses**

- **200** : ex.  
  `{"wallet_gems":300,"spent_gems":150,"unlocked_breeds":["golden_retriever","husky"],"breed":"husky"}`
- **400** : `userId` / `breed` manquant ; race inconnue ; gemmes insuffisantes ; race déjà débloquée.
- **404** : utilisateur inconnu.

---

## `POST /shop/buy-skin`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `userId` | string | oui |
| `skinId` | string | oui (`skin_space` \| `skin_neon`) |

**Réponses**

- **200** : ex.  
  `{"wallet_gems":20,"spent_gems":80,"unlocked_skins":["skin_space"],"skinId":"skin_space"}`
- **400** : `userId` / `skinId` manquant ; skin inconnu ; gemmes insuffisantes ; skin déjà débloqué.
- **404** : utilisateur introuvable.

---

## `PATCH /interact/feed`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `userId` | string | oui |
| `dogId` | string | oui — **`id`** retourné par **`init-dog`** ou dans **`dogs[]`** |

**Réponses**

- **200** : ex.  
  `{"dogId":"...","food":100,"items":{"croquettes":1,"water_bottle":1}}`
- **400** : `userId` ou `dogId` manquant ; pas de croquettes.
- **403** : **`ownerId`** du chien ≠ `userId`.
- **404** : chien ou inventaire introuvable.

---

## `PATCH /interact/clean`

Interaction type **gyroscope** (« ramasser les besoins ») : crédit fixe **+5** `wallet_gold`.

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `userId` | string | oui |

**Réponses**

- **200** : ex. `{"wallet_gold":505,"wallet_gold_delta":5}`
- **400** : `userId` manquant.
- **404** : utilisateur inconnu.

---

## `PATCH /walk/validate`

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `userId` | string | oui |
| `distanceKm` | number &gt; 0 | oui (ou alias `distance`) |
| `durationSec` | number &gt; 0 | oui (ou alias `duration`) |

**Calcul** :

- `durationHours = durationSec / 3600`
- `speed_kmh = distanceKm / durationHours`

**Crédit or** : si **`0 < speed_kmh < 15`**, alors  
`wallet_gold_delta = floor(distanceKm * 8)`  
(sinon delta 0, pas de mise à jour persiste si delta 0).

**Réponses**

- **200** avec crédit : ex.  
  `{"speed_kmh":2,"wallet_gold_delta":16,"wallet_gold":516}`
- **200** sans crédit (vitesse ≥ 15 ou autre) : ex.  
  `{"speed_kmh":20,"wallet_gold_delta":0,"wallet_gold":null}`  
  *(le champ `wallet_gold` peut être `null` si aucune écriture.)*
- **400** : distance ou durée invalide ; `userId` manquant.
- **404** : utilisateur inconnu (si transaction nécessaire).

---

## `POST /dog/:id/abandon`

**Paramètre** : `id` = **`id`** Firestore du chien.

**Réponses**

- **200** : ex. `{"id":"...","abandonment_pending_video":true}`
- **404** : chien inconnu.
- **500** : erreur serveur.

---

## `PATCH /dog/:id/equip-skin`

Équipe un skin sur un chien (champ `active_skin_id` sur `dogs/{id}`).

**Paramètre** : `id` = **`id`** Firestore du chien.

**Body**

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `userId` | string | oui |
| `skinId` | string | oui |

**Réponses**

- **200** : ex. `{"dogId":"...","active_skin_id":"skin_space"}`
- **400** : `userId` manquant ; `skinId` manquant.
- **403** : chien n’appartient pas au user ; skin non possédé.
- **404** : chien ou utilisateur introuvable.

---

## CORS

Comportement défini dans [`server.js`](SIRIUS%20back/server.js) : si **`CORS_ORIGINS`** est renseigné, seules ces origines (et requêtes **sans** header `Origin`) passent ; sinon **tout** est autorisé.

---

## Flux conseillé (intégration front)

1. `POST /auth/register` (inscription) puis `POST /auth/login` (connexion) avec **`idToken` Firebase** → conserver **`uid`**.
2. `POST /init-dog` avec **`userId: uid`** → conserver **`id`** du chien (répéter pour plusieurs chiens).
3. `PATCH /user/settings` pour choisir `difficulty_mode` / `is_demo_mode` (profil).
4. `GET /dogs/{uid}` pour l’écran principal (liste **`dogs`**, wallets, inventaire).
5. `POST /shop/buy` (or) / `POST /shop/buy-skin` (gemmes) / `unlock-breed` avec **`userId: uid`**.
6. `PATCH /interact/feed` avec **`userId`** + **`dogId`**.
7. `PATCH /interact/clean` avec **`userId`**.
8. `PATCH /walk/validate` avec **`userId`** + distance/durée.
9. `POST /dog/{id}/abandon` si besoin.

---

## Sécurité — limitations du prototype actuel

L’API **ne vérifie pas de jeton** (pas de JWT / session) : toute requête peut fournir un **`userId` quelconque** dans l’URL ou le body. Qui connaît ou devine un `userId` peut lire **`GET /dogs/:userId`**, dépenser l’or, appeler **clean** / **walk** / **shop**, etc. (**IDOR**).

- **`POST /auth/login`** vérifie l’**`idToken` Firebase** et renvoie un **uid réel** (pas d’UID prototype fixe).
- **`POST /dog/:id/abandon`** ne vérifie **pas** que l’appelant est le propriétaire du chien.
- **clean** et **walk** peuvent être **spamés** (pas de rate limiting).
- En prod : restreindre **CORS**, ajouter **auth** (ex. vérifier un ID token Firebase et **ignorer** ou **contrôler** le `userId` du body), **rate limiting**, et renforcer **abandon**.

Ces points sont une **dette sécurité** assumée pour le jalon ; le front doit traiter **`userId`** comme une donnée sensible côté UX, pas comme une protection serveur.

---

## Vérification manuelle (checklist)

Exécutée contre une instance locale sur **`PORT=3010`** (le port **3001** peut être occupé par un autre service sur la machine).

| Étape | Résultat attendu | Observé |
|-------|------------------|--------|
| POST `/auth/login` | 200 + `uid` | OK |
| POST `/init-dog` | 201 + `id` auto | OK |
| GET `/dogs/:uid` | 200, `dogs.length >= 1` | OK |
| POST `/shop/buy` (user valide) | 200, or diminué | OK |
| PATCH `/interact/feed` | 200, **`food`** = 100 | OK |
| PATCH `/interact/clean` | 200, `wallet_gold_delta` = 5 | OK |
| PATCH `/walk/validate` (2 km / 3600 s) | vitesse 2 km/h, crédit `floor(16)` | OK |
| POST `/dog/:id/abandon` | 200, `abandonment_pending_video` true | OK |

Pour rejouer les tests : démarrer depuis le dossier backend avec  
`$env:PORT='3010'; node server.js`  
puis enchaîner les appels HTTP ci-dessus.

---

## Feuille de route sécurité (V2 — hors périmètre code actuel)

- Vérifier un **JWT** (ex. Firebase Auth) et **lier** `userId` au **sub** du token.
- Exiger `userId` + vérification **propriétaire** pour **abandon**.
- **Rate limiting** sur `clean`, `walk`, `shop`.
- Déployer **`firestore.rules`** cohérents si accès client direct à Firestore.

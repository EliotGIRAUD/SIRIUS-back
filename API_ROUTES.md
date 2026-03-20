# API SIRIUS — Prototype Jalon 1 (Backend)

Base URL : selon déploiement (ex. `http://localhost:3001` en local, ou URL Render).

Toutes les réponses d’erreur possibles : `{ "error": "message" }` avec un code HTTP approprié.

---

## `POST /auth/login`

Simule une connexion pour le prototype. Aucune vérification des identifiants (email / mot de passe ignorés).

**Body JSON requis** :

| Champ    | Type   | Obligatoire | Description                           |
|----------|--------|-------------|---------------------------------------|
| `pseudo` | string | oui         | Pseudo du joueur (affiché côté compte) |

**Exemple** :

```json
{ "pseudo": "Nexus42" }
```

Enregistre ou met à jour le document Firestore **`users/{uid}`** avec ce pseudo (`uid` = valeur fixe du prototype, voir ci‑dessous).

**Réponse `200`** (exemple) :

```json
{
  "uid": "proto-sirius-user-001",
  "pseudo": "Nexus42",
  "message": "Connexion simulée (prototype Jalon 1)"
}
```

- Conserver **`uid`** côté front : c’est le **`userId`** à envoyer à **`POST /init-dog`** et dans l’URL de **`GET /dog/:userId`**.
- Pour changer l’uid fixe sans toucher au code : variable d’environnement **`PROTOTYPE_FIXED_UID`**.

**Réponse `400`** : `pseudo` absent ou vide.

---

## `POST /init-dog`

Crée le document Firestore **`chiens/{userId}`** avec les stats par défaut et le nom du chien.

**Body JSON requis** :

| Champ    | Type   | Obligatoire | Description                                      |
|----------|--------|-------------|--------------------------------------------------|
| `name`   | string | oui         | Nom affiché du chien                             |
| `userId` | string | oui         | Même valeur que `uid` renvoyé par `/auth/login` |
| `race`   | string | non         | Ex. `"Golden Retriever"`                        |

**Exemple** :

```json
{
  "name": "Sirius",
  "userId": "proto-sirius-user-001",
  "race": "Golden Retriever"
}
```

**Réponse `201`** : objet chien persisté (champs principaux : `hunger`, `health`, `maladie`, `wallet_soft_gold`, `wallet_hard_gems`, `name`, `nom`, `race`, `userId`). Les champs Firestore `createdAt` / `updatedAt` sont gérés côté serveur.

**Réponse `400`** : `name` ou `userId` manquant ou vide.

---

## `GET /dog/:userId`

Retourne les données pour le dashboard pour le chien associé à cet utilisateur.

**Paramètre d’URL** : `userId` — identique à celui utilisé dans **`POST /init-dog`**.

**Réponse `200`** : stats + alias lisibles pour le front :

| Champ                | Signification dashboard |
|----------------------|-------------------------|
| `hunger`, `faim`     | Faim                    |
| `health`, `sante`    | Santé                   |
| `maladie`            | Maladie                 |
| `wallet_soft_gold`, `or` | Or (soft currency) |
| `wallet_hard_gems`, `gemmes` | Gemmes           |
| `name`, `nom`, `race` | Infos affichage        |
| `pseudo`              | Pseudo du compte (depuis `users/{userId}`) |
| `userId`             | Référence utilisateur   |

**Réponse `404`** : aucun document `chiens/{userId}` (initialiser avec **`POST /init-dog`** d’abord).

---

## CORS

- Par défaut : **toutes les origines** autorisées (pratique pour Expo Go, appareil physique, web local).
- Production : définir **`CORS_ORIGINS`** dans `.env` avec une liste d’URLs séparées par des virgules (ex. `https://monfront.com,https://www.monfront.com`).

---

## Ordre de flux conseillé (front)

1. `POST /auth/login` avec **`{ "pseudo": "..." }`** → récupérer **`uid`** et **`pseudo`**
2. `POST /init-dog` avec **`userId: uid`** et **`name`** (et éventuellement **`race`**)
3. `GET /dog/{uid}` pour afficher le dashboard (**`pseudo`** inclus dans la réponse)

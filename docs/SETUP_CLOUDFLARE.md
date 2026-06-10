# Setup Cloudflare — Ressources et déploiement

## Prérequis

- Domaine `datameme.cloud` actif dans Cloudflare (voir `SETUP_DOMAIN.md`)
- Node.js installé en local
- Wrangler CLI installé : `npm install -g wrangler`
- Repository cloné en local

---

## Étape 1 — Authentification Wrangler

```bash
wrangler login
```

Un onglet navigateur s'ouvre pour autoriser Wrangler sur ton compte Cloudflare.

---

## Étape 2 — Créer le bucket R2

```bash
wrangler r2 bucket create datameme-storage
```

Puis activer l'accès public sur le bucket :

1. Dashboard Cloudflare → **R2** → `datameme-storage`
2. Onglet **Settings** → **Public access** → **Allow access**
3. Noter l'URL publique du bucket (de la forme `https://pub-xxxx.r2.dev`) — elle sera à renseigner dans `worker/memes.js` à la ligne `REMPLACER_PAR_URL_PUBLIQUE_R2`

---

## Étape 3 — Créer la base D1

```bash
wrangler d1 create datameme-db
```

La commande retourne un bloc de configuration :

```toml
[[d1_databases]]
binding = "DB"
database_name = "datameme-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copier le `database_id` et le renseigner dans `wrangler.toml` à la place de `REMPLACER_PAR_ID_D1`.

---

## Étape 4 — Appliquer la migration initiale

```bash
wrangler d1 execute datameme-db --file=./migrations/001_init.sql
```

Pour vérifier que les tables ont bien été créées :

```bash
wrangler d1 execute datameme-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

---

## Étape 5 — Configurer les secrets Workers

Depuis le terminal, définir chaque secret :

```bash
wrangler secret put JWT_SECRET
# Saisir une chaîne aléatoire longue (ex: générée avec openssl rand -base64 32)

wrangler secret put ADMIN_USERNAME
# Saisir l'identifiant admin souhaité

wrangler secret put ADMIN_PASSWORD_HASH
# Saisir le hash SHA-256 du mot de passe initial
```

Pour générer le hash SHA-256 du mot de passe en ligne de commande :

```bash
echo -n "ton_mot_de_passe" | sha256sum
```

> **Note** : Les secrets sont chiffrés par Cloudflare et ne sont jamais visibles en clair dans le dashboard.

---

## Étape 6 — Insérer le compte admin initial en D1

Après avoir généré le hash du mot de passe :

```bash
wrangler d1 execute datameme-db --command="INSERT INTO admin (id, username, password_hash) VALUES ('$(uuidgen)', 'TON_USERNAME', 'TON_HASH')"
```

---

## Étape 7 — Déployer le Worker

```bash
wrangler deploy
```

L'URL du Worker est de la forme `https://datameme-worker.<account>.workers.dev`.

---

## Étape 8 — Déployer le frontend sur Cloudflare Pages

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → **Pages**
2. **Connect to Git** → sélectionner le repository `ThomasLEBRET/datameme`
3. Configurer le build :
   - **Branch** : `main`
   - **Build command** : (à définir selon le framework frontend retenu)
   - **Build output directory** : (à définir selon le framework)
4. Cliquer **Save and Deploy**

---

## Étape 9 — Configurer le domaine sur Pages

1. Dans le projet Pages → **Custom domains** → **Set up a custom domain**
2. Saisir `datameme.cloud`
3. Cloudflare ajoute automatiquement l'enregistrement CNAME dans le DNS

---

## Vérification finale

| Élément | URL / commande |
|---------|----------------|
| API Worker | `curl https://datameme-worker.<account>.workers.dev/api/emotions` |
| Frontend | `https://datameme.cloud` |
| R2 (test image) | `https://pub-xxxx.r2.dev/<key>` |
| D1 (test DB) | `wrangler d1 execute datameme-db --command="SELECT COUNT(*) FROM memes"` |

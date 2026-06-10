# DataMeme

Service web personnel de gestion de mèmes. Upload, tagging automatique (OCR + classification IA), recherche full-text et copie presse-papier en un clic. Stack 100 % Cloudflare — zéro infrastructure à maintenir.

**URL de production** : [datameme.cloud](https://datameme.cloud)

---

## Stack technique

| Composant       | Technologie                  |
|-----------------|------------------------------|
| Frontend        | Cloudflare Pages             |
| API             | Cloudflare Workers           |
| Stockage images | Cloudflare R2                |
| Base de données | Cloudflare D1 (SQLite)       |
| OCR             | Cloudflare Workers AI        |
| Classification  | Cloudflare Workers AI        |
| Auth            | JWT signé (mémoire uniquement)|
| Déploiement     | Wrangler CLI + GitHub        |
| Domaine         | datameme.cloud (OVH → Cloudflare DNS) |

---

## Structure du repository

```
datameme/
├── README.md
├── SPECS.md                   # Spécifications fonctionnelles et techniques
├── CLAUDE.md                  # Guide de travail pour les sessions IA
├── docs/
│   ├── SETUP_DOMAIN.md        # Paramétrage du domaine
│   ├── SETUP_CLOUDFLARE.md    # Création des ressources Cloudflare (R2, D1, Workers)
│   └── DEPLOY.md              # Procédure de déploiement
├── wrangler.toml              # Configuration Workers + bindings R2/D1
├── migrations/
│   └── 001_init.sql           # Schéma initial D1
├── worker/                    # Code Cloudflare Worker (API REST)
│   ├── index.js               # Point d'entrée et routage
│   ├── auth.js                # Authentification JWT
│   ├── memes.js               # Endpoints mèmes
│   ├── emotions.js            # Endpoints émotions
│   └── ai.js                  # OCR + classification Workers AI
└── frontend/                  # Application Cloudflare Pages
    ├── public/                # Assets statiques
    └── src/                   # Code source frontend
```

---

## Fonctionnalités

### Espace public (sans authentification)
- Grille de mèmes responsive avec infinite scroll
- Tags affichés au-dessus de chaque image
- Recherche full-text (tags libres, texte OCR, émotions)
- Copie d'un mème dans le presse-papier (`ClipboardItem` API)

### Espace admin (authentification requise)
- Upload multiple (desktop et mobile)
- Tagging en lot avec tags génériques et émotions communes
- OCR automatique sur chaque image (Cloudflare Workers AI)
- Classification visuelle automatique si peu de texte détecté
- Tags suggérés éditables avant confirmation
- Suppression via clic droit (desktop) ou appui long (mobile)
- Gestion des émotions (ajout, renommage, suppression)
- Changement de mot de passe

---

## Installation et déploiement

### Prérequis
- Compte Cloudflare actif avec `datameme.cloud` enregistré et DNS géré par Cloudflare
- Node.js installé en local
- Wrangler CLI : `npm install -g wrangler`

### Étapes

```bash
# 1. Cloner le repository
git clone https://github.com/ThomasLEBRET/datameme.git
cd datameme
npm install

# 2. Authentification Wrangler
wrangler login

# 3. Créer le bucket R2
wrangler r2 bucket create datameme-storage
# Activer l'accès public sur le bucket depuis le dashboard Cloudflare R2

# 4. Créer la base D1
wrangler d1 create datameme-db
# Noter l'id retourné et le renseigner dans wrangler.toml

# 5. Appliquer les migrations
wrangler d1 execute datameme-db --file=./migrations/001_init.sql

# 6. Déployer le Worker
wrangler deploy

# 7. Déployer le frontend
# Connecter le repository GitHub au projet Cloudflare Pages depuis le dashboard
```

### Variables d'environnement (secrets Workers)

À définir depuis le dashboard Cloudflare Workers :

| Variable             | Description                          |
|----------------------|--------------------------------------|
| `JWT_SECRET`         | Chaîne aléatoire longue pour signer les tokens |
| `ADMIN_USERNAME`     | Identifiant admin initial            |
| `ADMIN_PASSWORD_HASH`| Hash bcrypt du mot de passe initial  |

> Voir `docs/SETUP_CLOUDFLARE.md` pour le détail complet de la procédure.

---

## Schéma de base de données

### Table `memes`
| Colonne      | Type     | Description                       |
|--------------|----------|-----------------------------------|
| `id`         | TEXT     | UUID généré à l'upload            |
| `url`        | TEXT     | URL publique R2                   |
| `filename`   | TEXT     | Nom du fichier original           |
| `tags`       | TEXT     | JSON array (tags libres + OCR)    |
| `emotions`   | TEXT     | JSON array (tags émotion)         |
| `created_at` | DATETIME | Date d'ajout                      |

### Table `emotions`
| Colonne | Type | Description             |
|---------|------|-------------------------|
| `id`    | TEXT | UUID                    |
| `label` | TEXT | Nom de l'émotion        |

### Table `admin`
| Colonne         | Type | Description              |
|-----------------|------|--------------------------|
| `id`            | TEXT | UUID                     |
| `username`      | TEXT | Identifiant              |
| `password_hash` | TEXT | Hash bcrypt du mot de passe |

---

## API — endpoints

| Méthode | Endpoint               | Auth | Description                        |
|---------|------------------------|------|------------------------------------|
| POST    | `/api/auth/login`      | Non  | Connexion admin                    |
| POST    | `/api/auth/password`   | Oui  | Changement de mot de passe         |
| GET     | `/api/memes`           | Non  | Liste paginée + recherche          |
| POST    | `/api/memes`           | Oui  | Upload d'un ou plusieurs mèmes     |
| PATCH   | `/api/memes/:id`       | Oui  | Mise à jour des tags               |
| DELETE  | `/api/memes/:id`       | Oui  | Suppression d'un mème              |
| GET     | `/api/emotions`        | Non  | Liste des émotions                 |
| POST    | `/api/emotions`        | Oui  | Ajout d'une émotion                |
| PATCH   | `/api/emotions/:id`    | Oui  | Renommage d'une émotion            |
| DELETE  | `/api/emotions/:id`    | Oui  | Suppression d'une émotion          |

---

## Migration (changement de domaine ou d'hébergement)

### Images R2 → R2
```bash
wrangler r2 object list datameme-storage > objects.txt
wrangler r2 object put nouveau-bucket/<key> --file=<fichier>
```

### Base D1 → D1
```bash
wrangler d1 export datameme-db --output=backup.sql
wrangler d1 execute nouvelle-db --file=backup.sql
```

---

## État du projet

- [x] Spécifications rédigées
- [x] Domaine datameme.cloud configuré (OVH → Cloudflare)
- [ ] Repository GitHub créé
- [ ] `wrangler.toml` configuré
- [ ] Migrations D1 écrites
- [ ] Worker API développé
- [ ] Frontend développé
- [ ] Déploiement initial
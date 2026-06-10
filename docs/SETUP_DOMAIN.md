# Paramétrage du domaine — datameme.cloud

## Prérequis

- Domaine `datameme.cloud` enregistré sur OVH
- Compte Cloudflare créé sur [cloudflare.com](https://cloudflare.com) (plan Free)

---

## Étape 1 — Ajouter le domaine dans Cloudflare

1. Dans le dashboard Cloudflare → **Add a domain**
2. Saisir `datameme.cloud` → **Continue**
3. Choisir le plan **Free**
4. Cloudflare scanne les enregistrements DNS OVH existants → vérifier qu'aucun enregistrement important n'est perdu → **Continue**
5. Cloudflare fournit **deux nameservers** propres au compte, de la forme :
   - `xxx.ns.cloudflare.com`
   - `yyy.ns.cloudflare.com`

> **Important** : noter ces deux valeurs exactes avant de passer à l'étape suivante.

---

## Étape 2 — Changer les nameservers chez OVH

1. Se connecter sur [ovh.com](https://ovh.com) → espace client
2. Naviguer vers **Web Cloud → Noms de domaine → datameme.cloud**
3. Onglet **Serveurs DNS**
4. Remplacer les nameservers OVH par les deux nameservers Cloudflare notés ci-dessus
5. Valider la modification

> La propagation DNS prend entre **15 minutes et 48 heures** (généralement moins d'une heure).

---

## Étape 3 — Vérifier l'activation

**Via le dashboard Cloudflare** : le statut du domaine passe de *Pending nameserver update* à **Active**.

**Via un outil externe** : [whatsmydns.net](https://whatsmydns.net) → saisir `datameme.cloud` → type **NS** → les nameservers Cloudflare doivent apparaître sur la majorité des serveurs.

Cloudflare envoie également un email de confirmation à l'activation.

---

## État après configuration

Une fois le domaine actif dans Cloudflare :

- Le DNS de `datameme.cloud` est entièrement géré par Cloudflare
- Les enregistrements CNAME vers Cloudflare Pages seront ajoutés lors du déploiement frontend
- Le domaine OVH reste propriété OVH — seuls les nameservers ont été délégués à Cloudflare

---

## Références

- [Cloudflare — Add a domain](https://developers.cloudflare.com/fundamentals/setup/account/add-site/)
- [OVH — Modifier les serveurs DNS](https://help.ovhcloud.com/csm/fr-dns-servers?id=kb_article_view&sysparm_article=KB0051641)

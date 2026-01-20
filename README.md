# JobTracker AI - Application de Suivi de Candidatures

## 🎯 Objectif

JobTracker AI est une application web complète de gestion et suivi de candidatures professionnelles. Elle permet de centraliser, organiser et suivre l'ensemble des démarches de recherche d'emploi avec une interface moderne et intuitive.

## 📋 Caractéristiques Principales

### 1. **Gestion Multi-Vue**
- **Vue Kanban** : Organisation visuelle par étapes (Contact envoyé, Entretien prévu, Refus catégorique, etc.)
- **Vue Liste** : Table paginée avec tri, filtres et recherche globale
- Basculement fluide entre les deux vues selon le besoin

### 2. **Suivi d'Email Automatisé**
- Synchronisation bidirectionnelle avec [Resend](https://resend.com)
- Tracking des événements email en temps réel :
  - Envoi (`sent`)
  - Livraison (`delivered`)
  - Ouverture (`opened`)
  - Clic sur lien (`clicked`)
  - Réponse (`responded`)
  - Échecs (`bounced`, `failed`, `complained`)
- Mise à jour automatique du statut des candidatures selon les événements

### 3. **Import CSV Massif**
- Import de données depuis plusieurs fichiers CSV (Canada, UK, US, Suisse, Autre)
- Dédoublonnage intelligent par domaine et nom d'entreprise
- Extraction et validation d'URLs avec fallback automatique
- Récupération de l'historique (dates, commentaires, réponses)

### 4. **Système de Relances (Follow-ups)**
- Compteur de relances par application
- Tracking de la date du dernier follow-up
- Calcul automatique du nombre de jours depuis le premier contact
- Bouton "Relancer" directement sur les cartes Kanban
- Filtre J+7 pour identifier les candidatures nécessitant une relance

### 5. **Analytics & Dashboard**
- Statistiques en temps réel :
  - **Pipeline** : Total d'applications, Réponses, Taux de réponse
  - **Succès** : Entretiens, Offres
  - **Engagement** : Taux d'ouverture, Taux de clic
  - **Health** : Issues techniques, Applications "ghostées" (>7 jours sans activité)
- Calculs dynamiques basés sur les données réelles

### 6. **Export & Analyse**
- Export CSV des applications J+7 pour relances ciblées
- Format : Entreprise, Poste, Statut, Date de premier contact, Nombre de jours
- Filtrage pré-export des candidatures sans réponse

## 🏗️ Architecture Technique

### Stack Technologique

**Frontend**
- [Next.js 16](https://nextjs.org/) (App Router, React Server Components)
- [TypeScript](https://www.typescriptlang.org/)
- [TailwindCSS](https://tailwindcss.com/) pour le styling
- [Lucide React](https://lucide.dev/) pour les icônes
- [TanStack Table](https://tanstack.com/table) pour la DataTable
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) pour le drag-and-drop Kanban
- [date-fns](https://date-fns.org/) pour la manipulation de dates
- [Zustand](https://zustand-demo.pmnd.rs/) pour la gestion d'état (auth)

**Backend & Services**
- [PocketBase](https://pocketbase.io/) : Base de données et authentification
- [Resend](https://resend.com/) : Service d'emails transactionnels et tracking

### Architecture de Données

**Collections PocketBase**
1. **users** : Utilisateurs avec authentification
2. **companies** : Entreprises (nom, domaine, website)
3. **applications** : Candidatures avec relation vers `companies`
   - Champs : position, status, first_contact_at, last_follow_up_at, follow_up_count, notes
4. **email_logs** : Historique des emails envoyés avec relation vers `applications`
5. **responses** : Réponses reçues (emails entrants)

**Relations**
```
users ──┬─→ companies
        └─→ applications ──┬─→ email_logs
                           └─→ responses
```

## 🔄 Workflows Principaux

### 1. Import de Données CSV

```
CSV Files → Parsing Multi-Format
         → Extraction d'URL (regex)
         → Génération de domaine de secours (.local)
         → Dédoublonnage (domain + fuzzy name)
         → Création/Mise à jour PocketBase
```

**Robustesse** :
- Support de variations de colonnes (Website, URL, Email, etc.)
- Extraction d'URL depuis texte informel ("from https://...")
- Génération automatique de domaine si manquant

### 2. Synchronisation Email (Resend)

**Outbound (Emails Sortants)**
```
Resend API → Pagination (100/batch)
          → Récupération de tous les events
          → Correspondance email → application
          → Mise à jour statut + last_activity_at
```

**Inbound (Emails Entrants)**
```
Resend Webhook → Parsing de l'email
              → Extraction From/Subject
              → Recherche application par domaine
              → Création response + Mise à jour statut
```

### 3. Workflow Utilisateur

1. **Login** : Authentification PocketBase avec auto-refresh de token
2. **Dashboard** : Affichage des statistiques et vue Board/List
3. **Recherche** : 
   - Globale dans la barre (scanne toutes les données)
   - Filtrage par statut
   - Filtre J+7 pour relances
4. **Actions** :
   - Drag & Drop pour changer de statut (Kanban)
   - Bouton "Relancer" pour incrémenter follow-ups
   - Dropdown pour changement manuel de statut
5. **Export** : Téléchargement CSV des candidatures à relancer

## 🎨 Spécificités UX/UI

### Performance & Optimisation

1. **Pagination** :
   - DataTable : 20 lignes par page
   - Kanban : 20 cartes par colonne + bouton "Voir plus"
   - Recherche reste globale (scanne toutes les données)

2. **Mises à jour Optimistes** :
   - Les changements de statut s'affichent instantanément
   - Synchronisation en arrière-plan (silencieuse)
   - Pas de flash de chargement complet

3. **Gestion de Session** :
   - Auto-refresh du token PocketBase avant chaque fetch
   - Redirection automatique vers login si session expirée
   - Persistance de l'état d'authentification (localStorage)

### Design System

- **Glassmorphism** : Backdrop blur sur les headers
- **Micro-animations** : Transitions fluides (hover, drag, etc.)
- **Color Coding** : Statuts visuellement distincts
  - Bleu : Contact envoyé
  - Violet : Entretien
  - Rouge : Refus catégorique
  - Ambre : Refus temporaire
  - Vert : Réponse positive
- **Dark Mode Ready** : Variables CSS adaptatives

## 🔧 Services & Intégrations

### PocketBase

**URL** : `https://jobs.andy-cinquin.fr` (configurable via `NEXT_PUBLIC_PB_URL`)

**Endpoints Utilisés** :
- `/api/collections/applications/records` : CRUD applications
- `/api/collections/companies/records` : CRUD entreprises
- `/api/collections/email_logs/records` : Logs d'emails
- `/api/collections/users/auth-with-password` : Authentification
- `/api/collections/users/auth-refresh` : Refresh token

### Resend

**API Key** : Stockée dans `RESEND_API_KEY` (env)

**Endpoints** :
- `GET /emails` : Liste paginée des emails sortants
- `POST /emails` : Envoi d'email (future feature)

**Webhook** :
- Configuré pour recevoir les événements email
- Parse `data.from`, `data.subject` pour matching d'application

## 📁 Structure du Projet

```
mobile-search-job/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Dashboard principal
│   │   ├── admin/             # Panel admin (sync, import)
│   │   ├── sign-in/           # Page de connexion
│   │   ├── sign-up/           # Page d'inscription
│   │   └── applications/[id]/ # Détail d'une candidature
│   ├── components/
│   │   ├── dashboard/         # KanbanBoard, DataTable, Columns
│   │   └── ui/                # Composants réutilisables
│   ├── services/
│   │   ├── applications.service.ts  # CRUD applications
│   │   ├── pocketbase.client.ts     # Client PocketBase
│   │   ├── resend.service.ts        # API Resend
│   │   └── sync.service.ts          # Logique de synchronisation + CSV import
│   ├── stores/
│   │   └── auth.store.ts      # Zustand auth store
│   └── types/
│       └── application.ts     # Types TypeScript
├── public/                    # Assets statiques
└── README.md                  # Cette documentation
```

## 🚀 Commandes Disponibles

```bash
# Développement
bun run dev

# Build de production
bun run build

# Démarrage production
bun start

# Linting
bun run lint
```

## 🔐 Variables d'Environnement

Créer un fichier `.env` à la racine :

```env
NEXT_PUBLIC_PB_URL=https://jobs.andy-cinquin.fr
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
```

## 📊 Statuts d'Application

| Statut | Description | Catégorie |
|--------|-------------|-----------|
| `sent` | Email envoyé | Contact |
| `delivered` | Email livré | Contact |
| `opened` | Email ouvert | Engagement |
| `clicked` | Lien cliqué | Engagement |
| `responded` | Réponse reçue | Succès |
| `interview` | Entretien planifié | Succès |
| `offer` | Offre reçue | Succès |
| `rejected` | Refus catégorique | Échec |
| `rejected_later` | "Recontactez plus tard" | Échec partiel |
| `rejected_after_interview` | Refus post-entretien | Échec |
| `bounced` | Email rejeté | Problème technique |
| `failed` | Échec d'envoi | Problème technique |
| `complained` | Marqué comme spam | Problème technique |
| `queued` | En file d'attente | En cours |
| `scheduled` | Programmé | En cours |
| `delivery_delayed` | Livraison retardée | En cours |
| `suppressed` | Supprimé (liste noire) | Problème technique |

## 🎯 Prochaines Fonctionnalités Possibles

- [ ] Envoi d'emails directement depuis l'app
- [ ] Templates d'emails personnalisables
- [ ] Notes et pièces jointes par application
- [ ] Rappels/Notifications de relance
- [ ] Export PDF de CV/Lettre de motivation
- [ ] Intégration calendrier pour entretiens
- [ ] Statistiques avancées (graphiques, tendances)
- [ ] Multi-utilisateurs / Partage d'applications

## 🐛 Points d'Attention

1. **Session Expiration** : Le token PocketBase expire après 2 semaines → auto-refresh implémenté
2. **CSV Import** : Les URLs invalides sont nettoyées avec regex + fallback `.local`
3. **Pagination Kanban** : Le slice se fait APRÈS filtering pour que la recherche reste globale
4. **Optimistic Updates** : Les changements sont visibles instantanément mais peuvent être "rollback" en cas d'erreur réseau

---

**Auteur** : Andy Cinquin  
**Stack** : Next.js 16 + PocketBase + Resend  
**License** : Privé

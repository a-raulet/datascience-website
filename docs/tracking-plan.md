# Plan de tracking — arnaudraulet.com

Ce document est la spec faisant autorité du tracking analytique du site.
Toute modification de `assets/js/tracking.js` doit être reflétée ici, et inversement.

- **Outil** : Umami (SaaS `cloud.umami.is` pour l'itération courante, migration self-hosted prévue ; seuls `src` et `data-website-id` changeront).
- **Website ID actuel** : `461927ce-706a-4163-b2f7-446a71842798`
- **Configuration Umami** : voir `_includes/umami.html`
- **Code custom** : `assets/js/tracking.js` (vanilla, IIFE, ~3 Ko)
- **Référentiel privacy** : pas de cookies, pas de PII, pas de fingerprinting, respect du DNT.

## 1. Architecture du tracker

Deux niveaux empilés :

1. **Pageviews automatiques** — gérés par le snippet Umami seul. Capture URL, referrer, device, browser, country, durée de session. Aucun code custom requis.
2. **Events custom** — émis par `assets/js/tracking.js`. Enrichissent les pageviews avec des signaux de conversion et d'engagement spécifiques au site.

### Détection de langue : source de vérité unique

`window.siteLang` (et la fonction `window.detectLang(path)`) sont exposés par `_includes/nav-i18n.html`. `tracking.js` lit cette valeur — il ne contient pas sa propre logique de détection. Une seule source = pas de drift possible si la logique de mapping des `.en.html` / `.ja.html` évolue.

### Gardes empilés (ordre)

1. `?debug=tracking` dans l'URL → mode console : log + n'envoie pas en prod-host.
2. `navigator.doNotTrack === '1'` → bail (sauf debug).
3. `window.location.hostname !== 'arnaudraulet.com'` → bail (sauf debug).
   Double-protection face à `data-domains` côté Umami, qui selon les versions ne filtre que les pageviews automatiques et pas les events `umami.track()`.

## 2. Plan d'événements

### A. Engagement de conversion (priorité 1 — pilote la décision business)

| Event | Trigger | Data | Raison business |
|---|---|---|---|
| `cta_booking_click` | Clic sur lien `calendar.proton.me/bookings*` | `page`, `position`, `lang` | Mesure la conversion réelle (la prise de RDV). C'est le seul vrai signal d'intent fort sur ce site. Le découpage par `position` (`hero` / `footer` / `service-page` / `inline`) permet d'identifier *où* dans la page la conversion se déclenche. |
| `cta_email_click` | Clic sur `mailto:` | `page`, `position`, `lang` | Signal d'intent secondaire (l'email demande plus d'effort que le calendar mais reste qualifié). Permet de comparer email vs booking par langue. |
| `service_cta_click` | Clic sur lien interne `/services/japan-tech-radar` ou `/services/pricing-diag` | `service` (`jtr`\|`pricing`), `source_page`, `lang` | Mesure l'intérêt pour les offres : *combien d'accueil → JTR ?*, *quelle est la page qui qualifie le mieux pour PricingDiag ?* |

### B. Engagement de contenu (priorité 2 — qualité du contenu)

| Event | Trigger | Data | Raison business |
|---|---|---|---|
| `scroll_depth` | 25 / 50 / 75 / 100 % de la hauteur du document (1× par seuil par pageview) | `depth`, `page`, `lang` | Distingue *vu* (25 %) de *lu* (75 %+). Sur les pages services, scroll < 50 % = pitch raté ; scroll 75 %+ = candidat à convertir. |
| `time_on_page` | `beforeunload` ou `visibilitychange='hidden'` si > 30 s | `seconds` (bucket : `30-60` / `60-180` / `180-600` / `600+`), `page`, `lang` | Mesure de l'engagement temporel. Bucketé pour ne pas créer trop de dimensions cardinales dans Umami. |
| `blog_article_read` | À 75 % scroll sur `/blog/<article>` (pas l'index) | `slug`, `lang` | Identifie les articles qui retiennent vraiment l'attention. Émis 1× par session par article. |
| `outbound_click` | Clic sur lien externe (`origin` ≠ origin courante) | `target_domain`, `source_page`, `lang` | Mesure de l'amplification : *combien de visiteurs cliquent vers LinkedIn, GitHub, J-PlatPat ?* Aide aussi à voir si certaines pages génèrent des clics vers les sources que je cite. |

### C. Navigation linguistique (priorité 3 — comprend l'audience)

| Event | Trigger | Data | Raison business |
|---|---|---|---|
| `lang_switch` | Clic sur drapeau dans le dropdown `#lang-switcher` | `from`, `to`, `page` | Détecte les visiteurs qui *cherchent* une langue (vs. l'arrivent directement dans la bonne). Si beaucoup de FR → EN, ça signale qu'il y a une audience internationale qu'on devrait peut-être adresser plus directement. |

### D. Métadonnées de session (priorité 4 — segmentation)

| Event | Trigger | Data | Raison business |
|---|---|---|---|
| `session_context` | 1× par session, à l'arrivée (clé `sessionStorage`) | `referrer_category` (`search`\|`linkedin`\|`github`\|`social`\|`direct`\|`other`), `device_class` (`mobile`\|`tablet`\|`desktop`), `lang_detected` | Umami capture le referrer brut mais ne le catégorise pas. Cette catégorisation permet de répondre directement à *"combien de visiteurs viennent de LinkedIn ce mois-ci ?"* sans avoir à reclassifier les hostnames à chaque requête. |

## 3. Mapping événement → question business

| Question business | Events à croiser |
|---|---|
| Quel CTA convertit le mieux ? | `cta_booking_click.position` × `lang` |
| Quelle page d'entrée qualifie le mieux ? | `cta_booking_click.page` |
| LinkedIn rapporte-t-il des prospects qualifiés ? | `session_context.referrer_category=linkedin` ∩ `cta_booking_click` |
| La page PricingDiag tient-elle le visiteur ? | `scroll_depth.page=/services/pricing-diag` × `time_on_page` |
| Faut-il pousser plus la version EN ? | `lang_switch{from:fr, to:en}` volume + `session_context.lang_detected` |
| Quels articles de blog "tiennent" vraiment ? | `blog_article_read.slug` cumulé sur 30 jours |
| Le portfolio génère-t-il des clics sortants vers GitHub ? | `outbound_click.target_domain=github.com` × `source_page=/portfolio/*` |
| Quelle part du trafic est mobile ? | `session_context.device_class` |

## 4. Dashboards Umami à créer manuellement

Umami SaaS ne permet pas d'importer des dashboards en YAML ; il faut les créer dans l'UI.
À recréer après le déploiement initial :

1. **Conversion funnel**
   - Filter : event = `cta_booking_click`
   - Group by : `page`, puis `position`, puis `lang`
   - Période : 30 jours glissants
2. **Engagement par page service**
   - 2 panneaux : `scroll_depth.depth=75` + `time_on_page.seconds=180-600`
   - Filtré sur `page` ∈ {`/services/japan-tech-radar`, `/services/pricing-diag`} (toutes langues)
3. **Acquisition par canal**
   - Filter : event = `session_context`
   - Group by : `referrer_category`
4. **Blog : top articles lus à 75 %**
   - Filter : event = `blog_article_read`
   - Group by : `slug`
5. **Switch de langue**
   - Filter : event = `lang_switch`
   - Group by : `from`, `to`
   - Indique le besoin réel des autres langues vs. la détection automatique du navigateur

## 5. Ce que ce tracking ne capture PAS volontairement

- **Pas de heatmap, pas de session replay** : ces outils captent fatalement de la PII (champs de formulaire, parfois cookies tiers) et créent une dette de conformité disproportionnée pour un site advisory premium.
- **Pas de fingerprinting** : Umami n'en fait pas par défaut, et on ne l'augmente pas.
- **Pas de PII** : aucun email, aucun nom, aucun ID client transitant dans les events. La query string est explicitement exclue du `page` envoyé (peut contenir des tokens de redirection).
- **Pas de A/B testing intégré** : si besoin un jour, on instrumentera explicitement, on ne se base pas sur des cookies persistants.

Ces choix sont volontaires et constituent une posture défendable face à un prospect ou un auditeur : *"je vends de la rigueur analytique et je l'applique à mon propre site — pas de tracking en excès, des métriques qui pilotent une décision."*

## 6. Convention de naming (à respecter pour toute évolution)

- **snake_case partout** : noms d'events ET clés des objets data.
- **Préfixes par catégorie** : `cta_*` (conversion), `scroll_*` / `time_*` / `blog_*` / `outbound_*` (engagement), `lang_*` (i18n), `session_*` (contexte).
- **Une valeur par dimension** : pas de chaînes concaténées dans une seule clé. Si on veut croiser `lang` × `page`, on envoie les deux séparément et on croise dans Umami.

## 7. Mode debug

Ajouter `?debug=tracking` à n'importe quelle URL active le mode console :
- Tous les events sont loggés via `console.log('[tracking]', name, data)`.
- Sur prod-host, les events sont aussi envoyés à Umami.
- Hors prod-host (localhost, `*.netlify.app`), les events sont uniquement loggés, pas envoyés.

Utiliser ce mode pour valider l'instrumentation avant tout déploiement.

## 8. Migration vers Umami self-hosted

Quand on basculera (estimé : juin 2026), seuls deux changements :
- `src` du script dans `_includes/umami.html`
- `data-website-id` du script

Aucune modification du code de `tracking.js` ne devrait être nécessaire : l'API `window.umami.track(name, data)` est identique entre la version cloud et la version self-hosted.

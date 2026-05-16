# Validation post-déploiement — tracking initial (2026-05)

Date du déploiement : ____________________
Validateur : Arnaud Raulet

Cette checklist est exécutée **une fois sur la prod** après le push initial du plan de tracking.
Elle sert de trace auditable : dans 6 mois, on pourra confirmer que tel event marchait à telle date.

## Pré-requis

- [ ] Le déploiement Netlify est passé en vert (le build a bien rendu les 54 pages).
- [ ] `https://arnaudraulet.com/assets/js/tracking.js` retourne 200 (pas 404).
- [ ] DevTools → Network → `https://cloud.umami.is/script.js` est bien chargé.

## A. Vérification des includes

- [ ] La nav FR/EN/JA est intacte : tester le switcher de langue sur l'accueil → service → blog. Les drapeaux doivent rester visibles et fonctionnels (pas d'emoji brut affiché à la place du dropdown).
- [ ] Le snippet Umami est dans `<head>` : View Source sur `arnaudraulet.com/` → présence de `<script defer src="https://cloud.umami.is/script.js" data-website-id="461927ce-..." data-do-not-track="true" data-domains="arnaudraulet.com">`.
- [ ] `tracking.js` est référencé dans `<body>` : View Source → `<script src=".../assets/js/tracking.js" defer="">` avant `</body>`.

## B. Validation des events (mode debug)

Ouvrir `https://arnaudraulet.com/?debug=tracking` dans un navigateur, ouvrir la console, et vérifier :

- [ ] `[tracking] debug mode on` est loggé au chargement.
- [ ] Au scroll : `[tracking] scroll_depth { depth: 25, ... }` puis 50, 75, 100. Chaque seuil n'est loggé qu'une fois.
- [ ] Cliquer sur "Réserver un appel" (hero) → `[tracking] cta_booking_click { page: '/', position: 'hero', lang: 'fr' }`. Annuler la navigation (Cmd+clic ouvre dans un onglet — laisser la console de l'onglet courant).
- [ ] Cliquer sur "Me contacter par email" (footer) → `[tracking] cta_email_click { page: '/', position: 'footer', lang: 'fr' }`.
- [ ] Cliquer sur "JapanTechRadar →" → `[tracking] service_cta_click { service: 'jtr', source_page: '/', lang: 'fr' }`.
- [ ] Cliquer sur le drapeau 🇬🇧 dans le dropdown → `[tracking] lang_switch { from: 'fr', to: 'en', page: '/' }`.
- [ ] Sur `?debug=tracking`, recharger : `[tracking] session_context` doit apparaître **une fois** (premier chargement de la session uniquement).
- [ ] Cliquer sur le lien GitHub de la navbar → `[tracking] outbound_click { target_domain: 'github.com', ... }`.

## C. Validation côté Umami (dashboard)

Attendre 5 minutes après la session de test (Umami a un léger délai d'agrégation).

- [ ] Dans Umami → Events : au moins 6 events custom ont été reçus (un pour chaque catégorie testée).
- [ ] Les events portent les data attendues (vérifier 2-3 events au hasard).
- [ ] Aucune erreur JavaScript dans la console des pages publiques (test sur Chrome + Firefox sans `?debug`).

## D. Gardes (préviennent la pollution des données)

- [ ] Charger une preview Netlify (`*.netlify.app`) sans `?debug` → la console ne loggue rien, et aucun event n'est envoyé à Umami (vérifier dans l'UI Umami : aucun pic récent depuis ce hostname).
- [ ] Activer DNT dans le navigateur (`about:preferences#privacy` Firefox / Chrome flags) → recharger `arnaudraulet.com` → aucun event ne part. (Et avec `?debug=tracking`, le mode log s'active quand même pour confirmation.)
- [ ] Vérifier que `?debug=tracking` log mais n'envoie PAS sur preview Netlify (pas de pollution des stats prod).

## E. Dashboards Umami à créer

(Recréation manuelle dans l'UI Umami, voir `docs/tracking-plan.md` section 4 pour la spec.)

- [ ] Dashboard "Conversion funnel"
- [ ] Dashboard "Engagement par page service"
- [ ] Dashboard "Acquisition par canal"
- [ ] Dashboard "Blog : top articles"
- [ ] Dashboard "Switch de langue"

## Conclusion

- [ ] Validation **PASSED** — tous les points ci-dessus sont cochés.
- [ ] Anomalies relevées : ______________________________________________

Une fois cette checklist remplie et cochée, créer le commit (d) :
```
git add docs/tracking-validation-2026-05.md
git commit -m "chore(tracking): post-deployment validation passed"
```

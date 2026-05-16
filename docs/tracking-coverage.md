# Tracking — état de couverture et reprise

## État au 2026-05-16 (handoff)

- **Branche actuelle** : `feat/tracking-instrumentation` (3 commits, working tree clean).
- **Dernier commit avant ce fichier** : `f0efcf7 docs(tracking): plan d'événements + template de validation`.
- **Build Quarto** : passe (54/54 pages rendues localement avec quarto 1.8.25).
- **URL de preview Netlify** : `<À COMPLÉTER après push : https://deploy-preview-N--<site>.netlify.app>`
- **Tests interactifs réalisés** : *aucun durant la session de développement.* La conformité runtime du tracker (events qui partent réellement, payloads corrects) **n'a pas été vérifiée**. Seuls le build, la présence du snippet Umami dans le HTML rendu, le bon path de `tracking.js` (`./` / `../` / `../../` selon profondeur) et la syntaxe JS (`node --check`) ont été validés.
- **Merge sur `master` bloqué** tant que (a) la checklist `docs/tracking-validation-2026-05.md` n'est pas exécutée et passée sur preview Netlify, et (b) la couverture par branche linguistique n'est pas confirmée fonctionnellement.

## 1. Implémenté (code écrit, build OK)

Le code de `assets/js/tracking.js` couvre, par construction, **toutes les pages du site dans les 3 langues** : il est inclus globalement via `format.html.include-after-body` dans `_quarto.yml`. La couverture *réelle* dépend en revanche du runtime — d'où la matrice ci-dessous, à remplir page par page après tests.

Events implémentés :

| Event | Code en place | Testé runtime (home FR) | Testé EN/JA | Testé autres pages |
|---|---|---|---|---|
| `cta_booking_click` | ✅ | ⏳ | ⏳ | ⏳ |
| `cta_email_click` | ✅ | ⏳ | ⏳ | ⏳ |
| `service_cta_click` | ✅ | ⏳ | ⏳ | ⏳ |
| `scroll_depth` (25/50/75/100) | ✅ | ⏳ | ⏳ | ⏳ |
| `time_on_page` | ✅ | ⏳ | ⏳ | ⏳ |
| `blog_article_read` | ✅ | n/a (pas d'articles) | n/a | ⏳ quand il y aura un post |
| `outbound_click` | ✅ | ⏳ | ⏳ | ⏳ |
| `lang_switch` | ✅ | ⏳ | ⏳ | ⏳ |
| `session_context` | ✅ | ⏳ | ⏳ | ⏳ |

Légende : ✅ = code en place, ⏳ = à tester en runtime, ❌ = échec confirmé, n/a = sans objet.

## 2. Couverture par branche du site

Inventaire exhaustif des pages et de leurs CTA. À cocher au fur et à mesure des tests `?debug=tracking`.

### Accueil (`index{.qmd,.en.qmd,.ja.qmd}`)

CTA présents :
- Hero (ligne 22 dans `.qmd`) : `cta_booking_click` (proton) + lien interne `/services/` (service_cta_click ? non, c'est `/services/`, pas un service précis → pas matché).
- Bas de page (ligne 224) : `cta_booking_click` + `cta_email_click`.
- 4 blocs problème : 2 liens internes vers `/services/japan-tech-radar/` et `/services/pricing-diag/` → `service_cta_click` (slug `jtr` / `pricing`).
- Navbar : liens services, portfolio, blog, about + GitHub, LinkedIn (outbound).
- Lang-switcher : `lang_switch`.

À vérifier sur `/`, `/index.en`, `/index.ja`.

### Services (`services/index{.qmd,.en.qmd,.ja.qmd}`)

CTA :
- 1 `cta_booking_click` (bas de page, ligne 107).
- Liens vers `/services/japan-tech-radar/` et `/services/pricing-diag/` → `service_cta_click`.

### Service JapanTechRadar (`services/japan-tech-radar{.qmd,.en.qmd,.ja.qmd}`)

CTA :
- Hero (ligne 18) : `cta_booking_click`.
- Bas (ligne 92) : `cta_booking_click`.
- `position` attendu : `service-page` (le hero d'une page service est `.btn` sans wrapper `.hero-banner`, donc fallback sur le path → `service-page`). **À vérifier** : est-ce le bon classement, ou faut-il `hero` ?

### Service PricingDiag (`services/pricing-diag{.qmd,.en.qmd,.ja.qmd}`)

CTA :
- Hero (ligne 18) : `cta_booking_click`.
- Bas (ligne 109-112) : `cta_booking_click`.
- Même remarque que JTR sur `position`.

### Portfolio (`portfolio/index{.qmd,.en.qmd,.ja.qmd}`)

CTA :
- 1 `cta_booking_click` (ligne 118 EN/JA).
- 1 `cta_email_click` + 1 lien LinkedIn (`outbound_click`) en FR (ligne 122).
- Liens internes vers `/services/index.{lang}.html` (pas `service_cta_click` car pas un slug de service précis).

### Portfolio sous-pages (analyse, ML, viz)

- `portfolio/analysis/marketing-pipeline*.qmd`, `mmm-robyn*.qmd` — à inventorier (pas regardé en détail).
- `portfolio/ml/{causal-inference,dynamic-pricing,house-prices,penguin-explorer,index}*.qmd` — idem.
- `portfolio/viz/index*.qmd` — idem.
- Probable : liens externes (GitHub, papers, demos) → `outbound_click`.

**À faire au reprise** : grep `mailto:|http` dans ces fichiers, vérifier qu'aucun CTA spécifique n'est manqué.

### About (`about{.qmd,.en.qmd,.ja.qmd}`)

CTA :
- `cta_booking_click` + `cta_email_click` (ligne 59 FR / 71 EN-JA).
- Mention japanorama.fr → `outbound_click` (à vérifier).

### Blog (`blog/index{.qmd,.en.qmd,.ja.qmd}` + `blog/posts/`)

- Index : pas de CTA propre, juste "Contenu à venir".
- `posts/` : vide pour l'instant. `blog_article_read` se déclenchera dès qu'un article sera publié et que `isBlogArticle(path)` retournera true.

### Navbar (toutes pages)

- Switcher de langue : `lang_switch` (FR↔EN, FR↔JA, EN↔JA, etc. — 6 transitions possibles).
- Icônes GitHub (`a-raulet`) et LinkedIn (`arnaud-raulet-13308310`) à droite : `outbound_click`.
- Search Quarto : pas tracké volontairement (pas d'event prévu).

## 3. Hypothèses techniques à vérifier en priorité

### (a) `detectLang()` retourne la bonne langue sur `/index.en` et `/index.ja`

Code dans `_includes/nav-i18n.html` :
```js
function detectLang(p) {
  return /\.en\.html$/.test(p) ? 'en' : /\.ja\.html$/.test(p) ? 'ja' : 'fr';
}
// ...
var path = window.location.pathname;
if (path.endsWith('/')) path += 'index.html';
else if (!/\.html$/.test(path)) path += '.html';
var lang = detectLang(path);
window.siteLang = lang;
```

**Analyse théorique** :
- Sur Netlify pretty URLs, `/index.en` devient `/index.en.html` après normalisation → `detectLang` retourne `'en'`. ✅
- `/about.en` → `/about.en.html` → `'en'`. ✅
- `/services/japan-tech-radar.en` → `'en'`. ✅
- `/services/japan-tech-radar` (FR) → `/services/japan-tech-radar.html` → ne match aucun → `'fr'`. ✅

**Risque résiduel** : avec `quarto preview` en local, `window.location.pathname` finit en `.html` directement, le path se normalise différemment. Mais sur prod Netlify, `pretty URLs` (sans `.html`) sont la norme. **Tester en mode `?debug=tracking` sur `/index.en` et `/services/japan-tech-radar.ja` en preview**.

### (b) La délégation `document.click` capte-t-elle tous les CTA ?

Code :
```js
document.addEventListener('click', function (ev) {
  var a = ev.target.closest('a[href]');
  if (!a) return;
  // ...
}, true);
```

**Analyse théorique** :
- Quarto rend tous les CTA `[texte](href){.btn .btn-primary}` comme `<a class="btn btn-primary" href="...">texte</a>` → `closest('a[href]')` matche. ✅
- Capture phase (`true`) : récupère le clic avant les listeners Bootstrap/Quarto, donc même si quelqu'un fait `preventDefault`, on tracke. ✅
- Le lang-switcher est injecté dynamiquement par `nav-i18n.html` au `DOMContentLoaded`, AVANT que `tracking.js` (chargé `defer`) ne s'exécute. La délégation sur `document` les attrape. ✅

**Risques résiduels** :
1. Si Quarto-nav.js reécrit certains hrefs en absolus AVANT le `DOMContentLoaded` du tracker, le test `/\/services\/(japan-tech-radar|pricing-diag)/` doit toujours matcher l'URL complète. Vérifié au regex : `https://arnaudraulet.com/services/japan-tech-radar/` matche bien. ✅
2. Un futur CTA implémenté comme `<button>` (et non `<a href>`) serait **silencieusement manqué**. À garder en tête lors d'ajouts.
3. Liens ouverts en middle-click / Cmd+clic : le browser ouvre dans un nouvel onglet, l'event `click` se déclenche normalement → tracké. ✅
4. **Mode `?debug=tracking`** : la query string n'est PAS propagée aux clics suivants (clic sur "Réserver un appel" perd le `?debug`). Pour tester un parcours, il faut soit ajouter `?debug=tracking` à chaque URL manuellement, soit accepter que le mode debug ne marche que page par page.

### (c) `position` (hero / footer / service-page / inline) — bon classement ?

Code :
```js
function positionOf(el) {
  if (el.closest('.hero-banner, .hero-section, .quarto-title-banner')) return 'hero';
  if (el.closest('.contact-section, footer, .footer')) return 'footer';
  if (/^\/services\//.test(window.location.pathname)) return 'service-page';
  return 'inline';
}
```

**Vérifier sur preview** :
- Home FR : CTA hero (ligne 22) est-il bien dans `.hero-banner` ? Devrait retourner `hero`.
- Home FR : CTA bas (ligne 224) est-il dans `.contact-section` ? Oui d'après le source. Devrait retourner `footer`.
- Pages services : CTA hero n'est PAS dans `.hero-banner` (juste un `[texte](href){.btn ...}` sans wrapper) → fallback `service-page`. Acceptable ? Ou faut-il marquer comme `hero` la première CTA de la page ? **Décision à prendre quand on aura des données réelles.**

## 4. Intuitions / risques connus

1. **Pages EN/JA et hrefs réécrits** : `nav-i18n.html` réécrit certains hrefs après `DOMContentLoaded` pour conserver la langue (`/about` → `/about.en`). Le tracker, lancé en `defer` après le parsing, peut tomber sur des hrefs déjà réécrits OU pas, selon le timing. Comme la délégation capte au `click`, pas au DOMContentLoaded, c'est le href AU MOMENT DU CLIC qui compte → toujours dans la bonne langue. Pas de bug attendu mais c'est subtil.

2. **`outbound_click` peut être bruité** : tout lien externe est tracké, y compris des liens techniques (CDN, fonts) qui ne devraient jamais être cliqués. En pratique, seuls les liens visibles dans le DOM (GitHub, LinkedIn, papers, flagcdn pour les drapeaux) peuvent être cliqués → faible bruit attendu.

3. **`time_on_page` sur mobile** : `beforeunload` n'est pas fiable sur mobile (app background). Le double listener (`beforeunload` + `visibilitychange='hidden'`) avec flag `timeReported` couvre les deux cas. À vérifier qu'un visiteur mobile génère bien l'event (et un seul).

4. **`session_context.referrer_category`** : la regex liste hardcodée des moteurs et réseaux sociaux. Risque de mauvaise classification sur un referrer inattendu (`hackernews`, `news.ycombinator.com` → `other`). À enrichir si on voit du trafic récurrent classé `other` qu'on voudrait segmenter.

5. **`scroll_depth=100` sur pages très courtes** : le scroll peut atteindre 100 % sans scroll réel (page < viewport). La garde `if (docH <= 0) return` empêche un event si la page n'est pas scrollable, mais une page juste un peu plus haute que le viewport fera quand même 100 % en quelques pixels. Acceptable.

## 5. Reprise — première chose à faire

1. Push `feat/tracking-instrumentation` → preview Netlify se déploie.
2. Compléter ce fichier avec l'URL de preview (section "État au 2026-05-16").
3. Exécuter `docs/tracking-validation-2026-05.md` sur la preview, en commençant par la home FR. Cocher les ⏳ en ✅ ou ❌ dans la matrice section 1.
4. Si home FR passe, dupliquer le test sur `/index.en` et `/index.ja` (vérifier que `lang` du payload change bien).
5. Si tout passe sur les 3 langues de l'accueil, étendre aux 5 pages clés : services/index, japan-tech-radar, pricing-diag, portfolio, about (dans la langue courante d'Arnaud, suffit pour un sanity check).
6. **Pas de merge sur `master` tant que ce fichier n'est pas mis à jour avec au moins la home + 1 page service confirmées dans les 3 langues.**

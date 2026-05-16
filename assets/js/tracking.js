/*
 * arnaudraulet.com — plan de tracking Umami
 * ============================================
 * Spec complète : docs/tracking-plan.md
 *
 * Architecture
 * ------------
 * Vanilla JS, IIFE, ES2020. Aucune dépendance externe (~3 Ko minifié visé).
 * Chargé en `defer` après _includes/nav-i18n.html, qui expose window.siteLang
 * comme source de vérité de la langue courante (pas de duplication de logique).
 *
 * Gardes empilés
 * --------------
 * 1. ?debug=tracking → mode console.log (peut être combiné avec les autres gardes).
 * 2. navigator.doNotTrack === '1' → bail (sauf si debug).
 * 3. window.location.hostname !== 'arnaudraulet.com' → bail (sauf si debug).
 *    Cette garde complète `data-domains` côté Umami : selon les versions, le
 *    filtre `data-domains` ne s'applique qu'aux pageviews automatiques, pas aux
 *    events envoyés via window.umami.track(). Double-protection volontaire.
 *
 * Conventions
 * -----------
 * snake_case partout : noms d'events ET clés data.
 * Aucune PII envoyée (pas d'email, pas de nom, pas d'ID client).
 */

(function () {
  'use strict';

  // ---- Mode debug ----
  var urlParams = new URLSearchParams(window.location.search);
  var DEBUG = urlParams.get('debug') === 'tracking';

  // ---- Gardes ----
  var IS_PROD_HOST = window.location.hostname === 'arnaudraulet.com';
  var DNT = navigator.doNotTrack === '1';

  if (DEBUG) {
    console.info('[tracking] debug mode on — events seront loggés.',
      { hostname: window.location.hostname, dnt: DNT, prodHost: IS_PROD_HOST });
  }
  if (DNT && !DEBUG) return;
  if (!IS_PROD_HOST && !DEBUG) return;

  // ---- Helpers ----
  function lang() {
    // Source de vérité unique : exposée par _includes/nav-i18n.html
    return window.siteLang || 'fr';
  }

  function page() {
    // Pathname pour Umami : laisse le serveur recouper avec ses propres
    // dimensions URL. Pas de query string (PII potentielle, et bruit).
    return window.location.pathname;
  }

  function track(name, data) {
    if (DEBUG) console.log('[tracking]', name, data);
    // Seul l'host de prod envoie réellement à Umami. En debug local, on
    // log mais on n'envoie pas (évite de polluer les events de prod).
    if (IS_PROD_HOST && window.umami && typeof window.umami.track === 'function') {
      window.umami.track(name, data);
    }
  }

  // ---- A. Engagement de conversion ----
  // Délégation sur document, capture phase : récupère le clic avant que
  // Bootstrap/Quarto puisse appeler preventDefault sur certains liens.

  function positionOf(el) {
    // Classe les CTA pour distinguer entrée (hero) / fin de page (footer) /
    // page service. Permet de mesurer où dans la page le visiteur convertit.
    if (el.closest('.hero-banner, .hero-section, .quarto-title-banner')) return 'hero';
    if (el.closest('.contact-section, footer, .footer')) return 'footer';
    if (/^\/services\//.test(window.location.pathname)) return 'service-page';
    return 'inline';
  }

  function serviceSlugFromHref(href) {
    var m = href.match(/\/services\/(japan-tech-radar|pricing-diag)(?:\.|\/|$)/);
    if (!m) return null;
    return m[1] === 'japan-tech-radar' ? 'jtr' : 'pricing';
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href) return;

    // lang_switch : clic dans le dropdown #lang-switcher (injecté dynamiquement
    // par nav-i18n.html, d'où la délégation plutôt qu'un listener direct).
    if (a.closest('#lang-switcher') && a.classList.contains('dropdown-item')) {
      var img = a.querySelector('img[alt]');
      if (img) {
        var to = img.getAttribute('alt').toLowerCase(); // 'fr' | 'en' | 'ja'
        if (to === 'fr' || to === 'en' || to === 'ja') {
          track('lang_switch', { from: lang(), to: to, page: page() });
        }
      }
      return;
    }

    // cta_booking_click : tout lien vers calendar.proton.me/bookings
    if (href.indexOf('calendar.proton.me/bookings') !== -1) {
      track('cta_booking_click', {
        page: page(),
        position: positionOf(a),
        lang: lang()
      });
      return;
    }

    // cta_email_click : tout mailto:
    if (href.indexOf('mailto:') === 0) {
      track('cta_email_click', {
        page: page(),
        position: positionOf(a),
        lang: lang()
      });
      return;
    }

    // service_cta_click : lien interne vers une page service
    var svc = serviceSlugFromHref(href);
    if (svc) {
      track('service_cta_click', {
        service: svc,
        source_page: page(),
        lang: lang()
      });
      // pas de return : on continue pour ne pas court-circuiter outbound_click
      // (qui de toute façon ne se déclenchera pas sur un lien interne).
    }

    // outbound_click : lien externe (origine différente)
    if (/^https?:\/\//.test(href)) {
      try {
        var url = new URL(href);
        if (url.origin !== window.location.origin) {
          track('outbound_click', {
            target_domain: url.hostname,
            source_page: page(),
            lang: lang()
          });
        }
      } catch (e) { /* href malformée, on ignore */ }
    }
  }, true);

  // ---- B. Scroll depth ----
  var seenDepths = new Set();
  var blogReadFired = false;
  var ticking = false;

  function isBlogArticle(path) {
    // /blog/ ou /blog/index{.en|.ja}{.html}? → page d'index, pas un article
    if (!/^\/blog\//.test(path)) return false;
    if (/^\/blog\/(index)?(\.(en|ja))?(\.html)?\/?$/.test(path)) return false;
    return true;
  }

  function blogSlug(path) {
    // /blog/mon-article.html → mon-article
    // /blog/mon-article.en.html → mon-article
    // /blog/posts/2026-foo.html → 2026-foo
    var last = path.replace(/\/$/, '').split('/').filter(Boolean).pop() || '';
    return last.replace(/\.html$/, '').replace(/\.(en|ja)$/, '');
  }

  function checkScroll() {
    ticking = false;
    var doc = document.documentElement;
    var winH = window.innerHeight;
    var scrollY = window.scrollY || doc.scrollTop;
    var docH = Math.max(doc.scrollHeight, doc.offsetHeight) - winH;
    if (docH <= 0) return;
    var pct = Math.round((scrollY / docH) * 100);
    [25, 50, 75, 100].forEach(function (threshold) {
      if (pct >= threshold && !seenDepths.has(threshold)) {
        seenDepths.add(threshold);
        track('scroll_depth', { depth: threshold, page: page(), lang: lang() });
        // À 75 % d'un article de blog, on enrichit avec un event dédié :
        // "le visiteur a probablement lu l'article".
        if (threshold === 75 && !blogReadFired && isBlogArticle(page())) {
          blogReadFired = true;
          track('blog_article_read', { slug: blogSlug(page()), lang: lang() });
        }
      }
    });
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(checkScroll);
      ticking = true;
    }
  }, { passive: true });

  // ---- B. Time on page ----
  var pageStart = Date.now();

  function emitTimeOnPage() {
    var sec = Math.round((Date.now() - pageStart) / 1000);
    if (sec < 30) return;
    var bucket = sec < 60 ? '30-60' :
                 sec < 180 ? '60-180' :
                 sec < 600 ? '180-600' : '600+';
    track('time_on_page', { seconds: bucket, page: page(), lang: lang() });
  }

  // Sur mobile, beforeunload n'est pas fiable (navigation hors onglet, app
  // background). visibilitychange='hidden' couvre ces cas. Pour éviter le
  // double-firing, on utilise un flag.
  var timeReported = false;
  function reportTimeOnce() {
    if (timeReported) return;
    timeReported = true;
    emitTimeOnPage();
  }
  window.addEventListener('beforeunload', reportTimeOnce);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') reportTimeOnce();
  });

  // ---- D. Session context ----
  // 1× par session : enrichit les pageviews avec un référentiel maison
  // (catégorisation referrer, classe de device). Umami capture déjà device
  // et referrer brut — on ajoute juste la catégorisation pour pouvoir
  // segmenter facilement (ex: "tous les visiteurs venus de LinkedIn").
  try {
    if (!sessionStorage.getItem('session_context_sent')) {
      var ref = document.referrer;
      var refCat = 'direct';
      if (ref) {
        try {
          var refHost = new URL(ref).hostname;
          if (refHost === window.location.hostname) {
            refCat = 'internal'; // navigation interne, n'envoie rien
          } else if (/(^|\.)(google|bing|duckduckgo|yandex|baidu|ecosia|qwant)\./.test(refHost)) {
            refCat = 'search';
          } else if (/linkedin\./.test(refHost)) {
            refCat = 'linkedin';
          } else if (/github\./.test(refHost)) {
            refCat = 'github';
          } else if (/(^|\.)(x|twitter|facebook|reddit|mastodon|bsky)\./.test(refHost)) {
            refCat = 'social';
          } else {
            refCat = 'other';
          }
        } catch (e) { refCat = 'direct'; }
      }
      if (refCat !== 'internal') {
        var w = window.innerWidth;
        var device = w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
        track('session_context', {
          referrer_category: refCat,
          device_class: device,
          lang_detected: lang()
        });
        sessionStorage.setItem('session_context_sent', '1');
      }
    }
  } catch (e) {
    // sessionStorage peut throw en mode privé sur certains navigateurs ;
    // on n'émet pas et on n'échoue pas non plus.
  }
})();

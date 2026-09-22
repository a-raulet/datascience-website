#!/usr/bin/env python3
"""Post-render Quarto : balises SEO absentes du rendu standard.

Pour chaque page HTML de _site :
  1. <link rel="canonical"> vers l'URL extensionless servie par Netlify
     (pretty URLs : /about.html et /about repondent tous les deux en 200,
     le canonical designe la forme extensionless comme version de reference).
  2. <link rel="alternate" hreflang="..."> reliant les trois versions
     linguistiques (page.html = fr, page.en.html = en, page.ja.html = ja),
     avec x-default sur la version francaise. Sans ces balises, Google peut
     traiter les trois versions comme du contenu duplique.

Reecrit aussi les <loc> du sitemap.xml genere par Quarto vers les memes
URLs extensionless, pour que sitemap et canonical designent la meme forme.

Execute par `quarto render` via project.post-render (_quarto.yml), en local
comme sur Netlify. Idempotent : une page qui a deja un canonical est sautee.
"""

import os
import re
import sys
from pathlib import Path

SITE_URL = "https://arnaudraulet.com"
LANG_SUFFIXES = {"en": ".en", "ja": ".ja"}

# quarto render (sans babelquarto) suffixe chaque <title> avec le
# website.title francais, y compris sur les pages EN/JA. On le remplace
# par le titre de site de la langue concernee (title-en / title-ja de
# _quarto.yml, ignores par quarto render). A garder synchronises.
FR_SITE_TITLE = "Arnaud Raulet | Intelligence Stratégique Japon"
SITE_TITLES = {
    "en": "Arnaud Raulet | Japan Strategic Intelligence",
    "ja": "ローレ・アルノ | データサイエンス×日本戦略",
}

output_dir = Path(os.environ.get("QUARTO_PROJECT_OUTPUT_DIR", "_site"))


def url_path(rel: Path) -> str:
    """Chemin URL extensionless d'un fichier HTML relatif a _site."""
    s = rel.as_posix()
    if s == "index.html":
        return "/"
    if s.endswith("/index.html"):
        return "/" + s[: -len("index.html")]
    return "/" + s[: -len(".html")]


def lang_cluster(rel: Path):
    """(base_fr, variantes existantes) pour une page donnee.

    base : about.html ; variantes : about.en.html / about.ja.html.
    Retourne None si la page ne fait partie d'aucun cluster complet
    (au sens : la version fr n'existe pas).
    """
    s = rel.as_posix()
    m = re.match(r"^(.*?)(\.(en|ja))?\.html$", s)
    if not m:
        return None
    base = m.group(1)
    fr = Path(base + ".html")
    if not (output_dir / fr).is_file():
        return None
    variants = {"fr": fr}
    for lang, suffix in LANG_SUFFIXES.items():
        candidate = Path(base + suffix + ".html")
        if (output_dir / candidate).is_file():
            variants[lang] = candidate
    return variants


def head_links(rel: Path) -> str:
    links = [f'<link rel="canonical" href="{SITE_URL}{url_path(rel)}">']
    variants = lang_cluster(rel)
    if variants and len(variants) > 1:
        for lang, path in sorted(variants.items()):
            links.append(
                f'<link rel="alternate" hreflang="{lang}" '
                f'href="{SITE_URL}{url_path(path)}">'
            )
        links.append(
            f'<link rel="alternate" hreflang="x-default" '
            f'href="{SITE_URL}{url_path(variants["fr"])}">'
        )
    return "\n".join(links)


def process_html():
    count = 0
    for f in output_dir.rglob("*.html"):
        rel = f.relative_to(output_dir)
        if rel.parts and rel.parts[0] == "site_libs":
            continue
        html = f.read_text(encoding="utf-8")
        if 'rel="canonical"' in html or "</head>" not in html:
            continue
        html = html.replace("</head>", head_links(rel) + "\n</head>", 1)
        f.write_text(html, encoding="utf-8")
        count += 1
    print(f"[post-render-seo] canonical/hreflang ajoutes sur {count} pages")


def fix_lang_titles():
    count = 0
    for lang, site_title in SITE_TITLES.items():
        for f in output_dir.rglob(f"*{LANG_SUFFIXES[lang]}.html"):
            rel = f.relative_to(output_dir)
            if rel.parts and rel.parts[0] == "site_libs":
                continue
            html = f.read_text(encoding="utf-8")
            doubled = f"<title>{site_title} – {FR_SITE_TITLE}</title>"
            suffixed = f" – {FR_SITE_TITLE}</title>"
            if doubled in html:
                # la page (home EN/JA) porte deja le titre de site complet
                html = html.replace(doubled, f"<title>{site_title}</title>", 1)
            elif suffixed in html:
                html = html.replace(suffixed, f" – {site_title}</title>", 1)
            else:
                continue
            f.write_text(html, encoding="utf-8")
            count += 1
    print(f"[post-render-seo] titres EN/JA corriges sur {count} pages")


def rewrite_sitemap():
    """URLs extensionless + deduplication des <url>.

    Quarto emet une entree par cible de rendu ; les pages aussi referencees
    depuis la navbar (/, /about, /blog/, /services/, /index.ja) se retrouvent
    en double. Apres reecriture en extensionless, ces doublons deviennent des
    <loc> strictement identiques, que Search Console signale. On ne garde que
    la premiere occurrence de chaque URL.
    """
    sitemap = output_dir / "sitemap.xml"
    if not sitemap.is_file():
        print("[post-render-seo] pas de sitemap.xml (site-url manquant ?)")
        return

    def repl(m):
        loc = m.group(1)
        if loc.startswith(SITE_URL) and loc.endswith(".html"):
            rel = Path(loc[len(SITE_URL) + 1 :])
            return f"<loc>{SITE_URL}{url_path(rel)}</loc>"
        return m.group(0)

    xml = sitemap.read_text(encoding="utf-8")
    xml = re.sub(r"<loc>([^<]+)</loc>", repl, xml)

    seen = set()
    dropped = 0

    def dedupe(m):
        nonlocal dropped
        block = m.group(0)
        loc = re.search(r"<loc>([^<]+)</loc>", block)
        if not loc:
            return block
        if loc.group(1) in seen:
            dropped += 1
            return ""
        seen.add(loc.group(1))
        return block

    xml = re.sub(r"[ \t]*<url>.*?</url>\n?", dedupe, xml, flags=re.DOTALL)
    sitemap.write_text(xml, encoding="utf-8")
    print(
        f"[post-render-seo] sitemap.xml : {len(seen)} URLs extensionless, "
        f"{dropped} doublons retires"
    )


if __name__ == "__main__":
    if not output_dir.is_dir():
        sys.exit(f"[post-render-seo] introuvable : {output_dir}")
    process_html()
    fix_lang_titles()
    rewrite_sitemap()

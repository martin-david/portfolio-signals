#!/usr/bin/env python3
"""build_report.py - render reports\\<id>\\portfolio_report.html (one self-contained file, no network requests).

    python report\\analysis.py [ID]   then   python report\\build_report.py [ID]
"""
import json, shutil, sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from sec_a import holdings_section, verdict_section          # noqa: E402
from sec_b import decisions_section                          # noqa: E402
from sec_c import earnings_section, footer_html, method_section, targets_section, top5_section   # noqa: E402

CONTRACT = """<!--
THESIS: Answer "hold, watch or review?" before showing any evidence, and give every holding its weight so a verdict on a tiny position never looks like a decision about the largest one. Refuses the dark KPI-card fintech dashboard.
OWN-WORLD: Instrument-panel report. Cool paper grounds, blue-black ink, Bahnschrift (DIN) for headings and figures, hairline rules. Each signal is a range bar with a shaded supportive zone. Teal, amber and crimson mean hold, watch and review, always with a glyph and a word.
STORY: The reader learns that analysts back everything that matters, that the open questions are MSFT's size, NET's price and the earnings cluster, then verifies row by row.
FIRST VIEWPORT: Display-size answer sentence, left-aligned; below it an account-value strip split by verdict with a legend of amounts; sticky nav with Hide amounts and Print at top right.
FORM: Read-mode report: verdict, instrument panel, case files, charts, method. No concept tournament was run; one direction committed.
-->"""


def narrative_check(A):
    """The opening and the case files are written for the 2026-09-30 snapshot; say so loudly if the data no longer fits them."""
    R, bad = {r["symbol"]: r for r in A["rows"]}, []
    for s, v in {"MSFT": "HOLD · REVIEW SIZE", "NET": "WATCH", "IBM": "WATCH", "VOD": "WATCH"}.items():
        if s not in R or R[s]["verdict"] != v: bad.append(f"{s} expected {v}, got {R.get(s, {}).get('verdict')}")
    if not all(r["facts"].get("consensus") in ("Buy", "StrongBuy") for r in A["rows"] if r["material"] and r["asset_class"] == "stock"):
        bad.append("a holding above 1% no longer has a Buy or Strong Buy consensus")
    if bad: print("WARNING: narrative text in sec_a.py / sec_b.py no longer matches the data, rewrite it:\n  " + "\n  ".join(bad), file=sys.stderr)


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else sorted(p.name for p in (ROOT / "reports").iterdir() if p.is_dir())[-1]
    A = json.loads((ROOT / "reports" / sid / "analysis.json").read_text(encoding="utf-8"))
    narrative_check(A)
    D = json.loads((ROOT / "snapshots" / sid / "enriched_portfolio.json").read_text(encoding="utf-8"))
    T = {h["etoro"]["etoro_symbol"]: h["tipranks"] for h in D["holdings"]}
    F = A["fundamentals"]; Fd = {f["symbol"]: f for f in F}
    css, js = (HERE / "style.css").read_text(encoding="utf-8"), (HERE / "app.js").read_text(encoding="utf-8")
    links = "".join(f'<a href="#{i}">{t}</a>' for i, t in (("holdings", "Holdings"), ("decisions", "Decisions"), ("targets", "Targets"), ("earnings", "Earnings"), ("top5", "Top five"), ("method", "Method")))
    d = date.fromisoformat(A["as_of"][:10]).strftime("%d %b %Y").lstrip("0")
    page = f'''<!doctype html>
{CONTRACT}
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Portfolio signals, {d}</title><style>{css}</style></head>
<body><a class="skip" href="#verdict">Skip to content</a>
<header class="bar"><div class="bar-in"><span class="brand">Portfolio signals</span><nav aria-label="Sections">{links}</nav><button class="btn" id="btn-hide" type="button" aria-pressed="false">Hide amounts</button><button class="btn" id="btn-print" type="button">Print / PDF</button></div></header>
<main>{verdict_section(A)}{holdings_section(A, T)}{decisions_section(A, T, Fd)}{targets_section(A)}{earnings_section(A)}{top5_section(A, F)}{method_section(A)}</main>
{footer_html(A)}<script>{js}</script></body></html>'''
    out = ROOT / "reports" / sid / "portfolio_report.html"
    out.write_text(page, encoding="utf-8")
    (ROOT / "latest").mkdir(exist_ok=True); shutil.copyfile(out, ROOT / "latest" / "portfolio_report.html")
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()

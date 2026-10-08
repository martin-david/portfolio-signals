"""svgkit.py - dependency-free inline SVG charts for the portfolio report."""
import html
from datetime import date


def esc(s): return html.escape(str(s), quote=True)
def sgn(x, d=1): return f"{x:+.{d}f}%".replace("-", "−")
def dlabel(iso): return date.fromisoformat(iso).strftime("%a %d %b").replace(" 0", " ")


def rangebar(val, lo, hi, zone=None, tone="", ticks=(), zero=None, w=92, h=18, label=""):
    x = lambda v: round((min(max(v, lo), hi) - lo) / (hi - lo) * (w - 8) + 4, 1)
    cy = h / 2
    s = [f'<svg class="rb" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(label)}"><line class="rb-track" x1="4" x2="{w - 4}" y1="{cy}" y2="{cy}"/>']
    if zone: s.append(f'<rect class="rb-zone" x="{x(zone[0])}" y="{cy - 5}" width="{round(x(zone[1]) - x(zone[0]), 1)}" height="10" rx="1"/>')
    for t in ticks: s.append(f'<line class="rb-tick" x1="{x(t)}" x2="{x(t)}" y1="{cy - 3}" y2="{cy + 3}"/>')
    if zero is not None: s.append(f'<line class="rb-zero" x1="{x(zero)}" x2="{x(zero)}" y1="1" y2="{h - 1}"/>')
    if val is not None: s.append(f'<rect class="rb-mark {tone}" x="{round(x(val) - 1.5, 1)}" y="1" width="3" height="{h - 2}" rx="1"/>')
    return "".join(s) + "</svg>"


def targets_chart(items, lo=-60, hi=130, W=1000, left=150, right=330):
    rh, top = 38, 40
    H, cw = top + rh * len(items) + 8, W - left - right
    X = lambda v: left + (min(max(v, lo), hi) - lo) / (hi - lo) * cw
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="tg-t tg-d"><title id="tg-t">Analyst price targets and AI-model targets versus the current price</title>'
         f'<desc id="tg-d">For each stock: the range of analyst price targets, the median, the average Street target and the AI-model target, all as a percent above or below the current price.</desc>']
    for t in (-50, 0, 50, 100):
        o.append(f'<line class="{"c-zero" if t == 0 else "c-grid"}" x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{top - 10}" y2="{H - 6}"/>'
                 f'<text class="t-ax" x="{X(t):.1f}" y="{top - 16}" text-anchor="middle">{"price today" if t == 0 else sgn(t, 0)}</text>')
    for i, it in enumerate(items):
        y = top + i * rh + rh / 2
        o.append(f'<text class="t-lab" x="0" y="{y + 4}">{esc(it["symbol"])}</text><text class="t-sub" x="{left - 14}" y="{y + 4}" text-anchor="end">{it["weight_pct"]:.1f}%</text>'
                 f'<rect class="c-range" x="{X(it["min"]):.1f}" y="{y - 6}" width="{X(it["max"]) - X(it["min"]):.1f}" height="12" rx="2"/>'
                 f'<line class="c-med" x1="{X(it["med"]):.1f}" x2="{X(it["med"]):.1f}" y1="{y - 8}" y2="{y + 8}"/>'
                 f'<circle class="c-street" cx="{X(it["street"]):.1f}" cy="{y}" r="5.5"/>')
        if it.get("ai") is not None:
            o.append(f'<rect class="c-ai" x="{X(it["ai"]) - 5:.1f}" y="{y - 5}" width="10" height="10" transform="rotate(45 {X(it["ai"]):.1f} {y})"/>')
        o.append(f'<text class="t-val" x="{left + cw + 18}" y="{y + 4}">Street {sgn(it["street"])} · AI {sgn(it["ai"]) if it.get("ai") is not None else "n/a"} · {it["n"]} analysts</text>')
    return "".join(o) + "</svg>"


def earnings_chart(days, W=1000, left=130, right=300, max_pct=55):
    rh, top = 40, 8
    H, cw = top + rh * len(days) + 26, W - left - right
    X = lambda v: left + v / max_pct * cw
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="er-t er-d"><title id="er-t">Share of your account reporting earnings, by day</title>'
         f'<desc id="er-d">Horizontal bars, one per reporting date, segmented by holding and sized by its share of the account.</desc>']
    for t in (0, 25, 50):
        o.append(f'<line class="c-grid" x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{top}" y2="{H - 22}"/><text class="t-ax" x="{X(t):.1f}" y="{H - 6}" text-anchor="middle">{t}% of account</text>')
    for i, (d, items) in enumerate(days):
        y, x0 = top + i * rh, left
        o.append(f'<text class="t-lab" x="0" y="{y + 25}">{dlabel(d)}</text>')
        for sym, w in items:
            wd = w / max_pct * cw
            o.append(f'<rect class="c-seg" x="{x0:.1f}" y="{y + 8}" width="{max(wd, 1.6):.1f}" height="24"/>')
            if wd >= 40: o.append(f'<text class="t-seg" x="{x0 + 7:.1f}" y="{y + 25}">{esc(sym)}</text>')
            x0 += max(wd, 1.6) + 1.5
        o.append(f'<text class="t-val" x="{left + cw + 18}" y="{y + 25}">{sum(w for _, w in items):.1f}% · {esc(", ".join(s for s, _ in items))}</text>')
    return "".join(o) + "</svg>"


def capex_chart(items, W=1000, left=70, right=120, max_b=125):
    rh, top = 54, 6
    H, cw = top + rh * len(items) + 6, W - left - right
    X = lambda v: left + v / max_b * cw
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="cx-t cx-d"><title id="cx-t">Capital expenditure versus free cash flow, latest fiscal year</title>'
         f'<desc id="cx-d">Paired horizontal bars in billions of dollars for each of the five largest stocks.</desc><line class="c-zero" x1="{left}" x2="{left}" y1="0" y2="{H}"/>']
    for i, it in enumerate(items):
        y = top + i * rh
        o.append(f'<text class="t-lab" x="0" y="{y + 28}">{esc(it["symbol"])}</text>'
                 f'<rect class="c-ai" x="{left}" y="{y + 6}" width="{max(X(it["capex"] / 1e9) - left, 1):.1f}" height="16"/><text class="t-val" x="{X(it["capex"] / 1e9) + 8:.1f}" y="{y + 19}">${it["capex"] / 1e9:.1f}B capex</text>'
                 f'<rect class="c-street" x="{left}" y="{y + 26}" width="{max(X(it["fcf"] / 1e9) - left, 1):.1f}" height="16"/><text class="t-val" x="{X(it["fcf"] / 1e9) + 8:.1f}" y="{y + 39}">${it["fcf"] / 1e9:.1f}B free cash flow</text>')
    return "".join(o) + "</svg>"


def reaction_chart(f, W=320, H=160, lim=25):
    qs = f["reactions"]; n = len(qs); bw = (W - 16) / n; mid = 78
    Y = lambda v: mid - max(min(v, lim), -lim) / lim * 58
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(f["symbol"])} share-price reaction after each of the last {n} earnings reports"><line class="c-zero" x1="8" x2="{W - 8}" y1="{mid}" y2="{mid}"/>']
    big = max(qs, key=lambda q: abs(q["price_reaction_pct"]))
    for i, q in enumerate(qs):
        v, x0 = q["price_reaction_pct"], 8 + i * bw
        y0, hh = (Y(v), mid - Y(v)) if v >= 0 else (mid, Y(v) - mid)
        o.append(f'<rect class="{"c-pos" if v >= 0 else "c-neg"}" x="{x0 + 3:.1f}" y="{y0:.1f}" width="{bw - 6:.1f}" height="{max(hh, 1):.1f}"><title>{esc(q["period"])}: {sgn(v)} ; EPS surprise {sgn(q["eps_surprise_pct"])}</title></rect>')
        if q["eps_surprise_pct"] < 0: o.append(f'<circle class="c-miss" cx="{x0 + bw / 2:.1f}" cy="{H - 26}" r="3.5"/>')
        if q is big: o.append(f'<text class="t-val" x="{x0 + bw / 2:.1f}" y="{(y0 - 5) if v >= 0 else (y0 + hh + 13):.1f}" text-anchor="middle">{sgn(v)}</text>')
    o.append(f'<text class="t-ax" x="8" y="{H - 6}">{esc(qs[0]["period"])}</text><text class="t-ax" x="{W - 8}" y="{H - 6}" text-anchor="end">{esc(qs[-1]["period"])}</text>')
    return "".join(o) + "</svg>"

"""sec_a.py - verdict opening and the holdings panel."""
import re
from datetime import date
from fmt import LABEL, SHORT, amt, chip, e, money, nice, sgn, sgnm, sid, tone, words
from svgkit import rangebar

GROUPS = [("size", "Hold, review size", lambda r: r["verdict"].startswith("HOLD ·")), ("hold", "Hold", lambda r: r["verdict"] == "HOLD"),
          ("watch", "Watch", lambda r: r["verdict"] == "WATCH"), ("review", "Review", lambda r: r["verdict"] == "REVIEW"),
          ("nodata", "No analyst data (crypto)", lambda r: r["verdict"] == "NO DATA")]
STRIP = {"size": "Hold, review size", "hold": "Hold", "watch": "Watch", "review": "Review", "nodata": "No data", "copy": "Copy"}


def verdict_section(A):
    K, R, total = A["kpis"], A["rows"], A["account"]["totalValue"]
    copied = sum(c["value"] for c in A["copied_traders"])
    segs, legend = [], []
    for k, name, pred in GROUPS + [("copy", "Copy-trading portfolios, not assessed", None)]:
        rs = [r for r in R if pred(r)] if pred else []
        v, names = (sum(r["value"] for r in rs), ", ".join(r["symbol"] for r in rs)) if pred else (copied, ", ".join(c["username"] for c in A["copied_traders"]))
        p = v / total * 100
        if not v: continue
        lab = f'<span class="lab">{STRIP[k]} {p:.0f}%</span>' if p >= 9 else ""
        segs.append(f'<div class="seg {k}{" big" if p >= 25 else ""}" style="flex:0 1 {p:.3f}%" title="{e(name)}: {e(names)}, {p:.1f}%">{lab}</div>')
        legend.append(f'<li><span class="sw {k}"></span><span><b>{e(name)}</b><br><span class="n">{e(names)}</span></span><span>{p:.1f}%<br>{amt(money(v))}</span></li>')
    cnt = K["rating_counts"]; n = sum(cnt.values()); d = K["small_positions"]
    win = sorted(r["facts"]["next_earnings"] for r in R if r["symbol"] in K["earnings_30d_symbols"])
    fmt_d = lambda s: date.fromisoformat(s).strftime("%b %d").replace(" 0", " ")
    msft = next(r for r in R if r["symbol"] == "MSFT")
    snap_d = date.fromisoformat(A["as_of"][:10]); snap_long, snap_short = snap_d.strftime("%d %b %Y").lstrip("0"), snap_d.strftime("%d %b").lstrip("0")
    finds = [("Quality is not the question.", f"Of {n} analyst opinions on your stocks, {cnt['buy']} say Buy, {cnt['hold']} Hold and {cnt['sell']} Sell. {K['consensus_share_of_stock_value'].get('Strong Buy', 0):.0f}% of your stock value sits in names TipRanks rates Strong Buy, and the value-weighted Smart Score is {K['wavg_smart_score']:.1f} out of 10."),
             ("Concentration is.", f"MSFT and NVDA are {K['top2_pct']:.1f}% of the account and the top five are {K['top5_pct']:.1f}%. Six businesses whose latest earnings calls centre on AI spending ({', '.join(A['ai_cluster'])}) add up to {K['ai_cluster_pct']:.1f}%. The account behaves like about {K['effective_positions']:.0f} equal-sized positions."),
             ("Timing is.", f"{words(len(win)).capitalize()} of your holdings report earnings between {fmt_d(win[0])} and {fmt_d(win[-1])}, together {K['earnings_30d_pct']:.1f}% of the account. MSFT alone reports on {fmt_d(msft['facts']['next_earnings'])} and is {msft['weight_pct']:.1f}% of it."),
             ("Housekeeping is cheap.", f"{words(d['count']).capitalize()} of your {K['positions']} positions are each under 1% of the account; together they are {d['pct']:.1f}% ({amt(money(d['value']))}). Whatever you decide about them, the outcome barely moves.")]
    return f'''<section id="verdict"><div class="wrap">
<h1>Analysts back every position that matters. What is left to decide is size and price.</h1>
<p class="lede">TipRanks' analyst consensus is Buy or Strong Buy on every position above 1% of your account. Two questions are open: how much MSFT should weigh, and whether NET has any upside left. IBM and VOD sit on watch.</p>
<p class="meta"><span>eToro real account, snapshot of {snap_long} at {e(A["as_of"][11:16])} UTC</span><span>TipRanks data as of the {snap_short} close</span><span>{amt(money(total))} in total, {amt(sgnm(A["account"]["unrealizedPnl"]))} unrealised</span></p>
<figure class="strip"><div class="strip-bar" role="img" aria-label="Account value split by verdict">{"".join(segs)}</div>
<ul class="legend">{"".join(legend)}</ul></figure>
<ul class="findings">{"".join(f"<li><b>{t}</b><p>{x}</p></li>" for t, x in finds)}</ul></div></section>'''


def _sig(r):
    f, c, a = r["facts"], r["comp"], r["facts"].get("analysts") or {}
    out = []
    ss = f.get("smart_score")
    out.append(f'<div class="sig">{rangebar(ss, 1, 10, (8, 10), tone(c.get("smart_score")), (5.5,), label=f"Smart Score {ss} of 10")}<span class="v">{ss}/10</span></div>' if ss else '<div class="sig"><span class="na">no score</span></div>')
    cons = f.get("consensus")
    out.append(f'<div class="sig">{rangebar(c["consensus"], -1, 1, (.5, 1), tone(c["consensus"]), (-1, -.5, 0, .5, 1), label=LABEL[cons])}<span class="v">{LABEL[cons]}</span></div>' if cons else '<div class="sig"><span class="na">no consensus</span></div>')
    up = f.get("street_upside_pct")
    out.append(f'<div class="sig">{rangebar(up, -20, 60, (10, 60), tone(c.get("upside")), zero=0, label=f"Target upside {up:+.1f} percent")}<span class="v">{sgn(up)}</span></div>' if up is not None and c.get("upside") is not None else '<div class="sig"><span class="na">' + ("no price target" if f.get("price_target") is None else "few targets") + '</span></div>')
    ai = f.get("ai_score")
    out.append(f'<div class="sig">{rangebar(ai, 30, 100, (65, 100), tone(c.get("ai_score")), (60,), label=f"AI score {ai:.0f} of 100")}<span class="v">{ai:.0f} · {e(f.get("ai_rating") or "")}</span></div>' if ai is not None else '<div class="sig"><span class="na">no AI score</span></div>')
    td, tw = f.get("tech_day"), f.get("tech_week")
    out.append(f'<div class="sig" title="Day: {LABEL.get(td, td)}; week: {LABEL.get(tw, tw)}">{rangebar(c["technicals"], -1, 1, (.25, 1), tone(c["technicals"]), zero=0, label="Technical trend")}<span class="v">{SHORT.get(td, "–")} / {SHORT.get(tw, "–")}</span></div>' if c.get("technicals") is not None else '<div class="sig"><span class="na">n/a</span></div>')
    n = a.get("analysts", 0)
    out.append(f'<div class="sig">{rangebar(c["breadth"], -1, 1, (.5, 1), tone(c["breadth"]), zero=0, label=f"{a.get("buy")} of {n} analysts say Buy")}<span class="v">{a.get("buy")}/{n} Buy</span></div>' if c.get("breadth") is not None else f'<div class="sig"><span class="na">{n} analyst{"" if n == 1 else "s"}</span></div>')
    return "".join(f'<td class="sigcol">{x}</td>' for x in out)


def _sigtext(r):
    f, c, a = r["facts"], r["comp"], r["facts"].get("analysts") or {}
    out = []
    if f.get("smart_score"): out.append(f'Smart Score {f["smart_score"]}/10')
    if f.get("consensus"): out.append(f'Consensus {LABEL[f["consensus"]]}')
    if f.get("street_upside_pct") is not None and c.get("upside") is not None: out.append(f'Target upside {sgn(f["street_upside_pct"])}')
    if f.get("ai_score") is not None: out.append(f'AI models {f["ai_score"]:.0f}/100')
    if c.get("technicals") is not None: out.append(f'Trend {LABEL.get(f["tech_day"], "n/a")} (day), {LABEL.get(f["tech_week"], "n/a")} (week)')
    if c.get("breadth") is not None: out.append(f'{a["buy"]} of {a["analysts"]} analysts say Buy')
    return out


def _detail(r, tb, ncol):
    kp = (tb.get("bull_bear") or {}).get("key_points") or []
    li = lambda k: f'<li><b>{e(k["topic"])}.</b> {e(k["point"])}</li>'
    bull, bear = [k for k in kp if k["sentiment"].lower().startswith("bull")], [k for k in kp if not k["sentiment"].lower().startswith("bull")]
    left = f'<h4>Bull case</h4><ul>{"".join(map(li, bull))}</ul><h4>Bear case</h4><ul>{"".join(map(li, bear))}</ul>' if kp else '<p class="small">TipRanks has no bull/bear summary for this instrument.</p>'
    a, right = r["facts"].get("analysts") or {}, []
    sig = _sigtext(r)
    right.append(f'<div class="only-m"><h4>Signals and result</h4><ul>{"".join(f"<li>{e(x)}</li>" for x in sig)}<li>{sgn(r["pnl_pct"])} against your cost ({amt(sgnm(r["pnl"]))})</li></ul></div>')
    if a:
        tg = f'<li>Targets {a["pt_min"]:,.2f} to {a["pt_max"]:,.2f}, median {a["pt_median"]:,.2f} {e(a["pt_currency"] or "")}</li>' if a.get("pt_median") else ""
        right.append(f'<h4>Analysts{" (via " + e(r["via"]) + ")" if r["via"] else ""}</h4><ul><li>{a["buy"]} Buy · {a["hold"]} Hold · {a["sell"]} Sell, {a["analysts"]} in the last 12 months</li>{tg}</ul>')
    if r["flags"]:
        right.append('<h4>Flags</h4><ul class="flags">' + "".join(f'<li><span class="fl {x["severity"]}">{x["severity"]}</span><b>{e(x["title"])}.</b> {e(x["detail"])}</li>' for x in r["flags"]) + "</ul>")
    cat = tb.get("catalyst")
    if cat:
        m = re.match(r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})", cat.get("updated") or "")
        when = f'{date.fromisoformat(m.group(1)).strftime("%b %d").replace(" 0", " ")}, {m.group(2)} UTC' if m else (cat.get("updated") or "")
        right.append(f'<h4>Latest catalyst</h4><ul><li>{e(cat["summary"])} <span class="small">({e(when)})</span></li></ul>')
    return f'<tr class="detail" id="d-{sid(r["symbol"])}" hidden><td colspan="{ncol}"><div class="dgrid"><div>{left}</div><div>{"".join(right) or "<p class=small>Nothing further to flag.</p>"}</div></div></td></tr>'


def _th(key, label):
    return f'<button class="screen-only" data-sort="{key}">{label}</button><span class="print-only">{label}</span>'


def holdings_section(A, T):
    wmax, rows = max(r["weight_pct"] for r in A["rows"]), []
    for r in A["rows"]:
        nm = nice(r["name"])
        sig = _sig(r) if r["asset_class"] == "stock" else '<td colspan="6" class="small sigcol">TipRanks publishes no ratings, Smart Score or AI score for crypto.</td>'
        sc = f'<b>{r["composite"]}</b><small>{r["tier"]}</small>' if r["composite"] is not None else f'<b>–</b><small>{r["tier"]}</small>'
        rows.append(f'''<tr class="row" data-symbol="{e(r["symbol"])}" data-material="{int(r["material"])}" data-verdict="{e(r["verdict"])}" data-weight="{r["weight_pct"]}" data-score="{r["composite"] if r["composite"] is not None else ""}" data-pnl="{r["pnl_pct"]}">
<th scope="row"><div class="hcell"><button class="exp" aria-expanded="false" aria-controls="d-{sid(r["symbol"])}"><b>{e(r["symbol"])}</b><span class="nm">{e(nm)}</span></button><span class="wbar"><i style="width:{max(r["weight_pct"] / wmax * 100, 1):.1f}%"></i>{r["weight_pct"]:.1f}% {amt(money(r["value"]))}</span></div></th>
<td>{chip(r["verdict"])}</td><td class="c-score">{sc}</td>{sig}<td class="c-pnl"><b>{sgn(r["pnl_pct"])}</b><small>{amt(sgnm(r["pnl"]))}</small></td></tr>
{_detail(r, T.get(r["symbol"], {}), 10)}''')
    nmat, natt = sum(1 for r in A["rows"] if r["material"]), sum(1 for r in A["rows"] if r["verdict"] in ("WATCH", "REVIEW"))
    return f'''<section id="holdings" class="sheet"><div class="wrap"><h2>Every holding, one row</h2>
<p class="sub">Each bar shows where a signal sits on its scale; the shaded stretch is the supportive zone and the marker turns teal inside it and crimson when it is clearly adverse. Score is the average of the six signals from −100 to +100. <span class="screen-only">Select a holding to see its bull and bear case, flags and latest catalyst. </span><span class="print-only">Each holding's bull and bear case, flags and latest catalyst are in the interactive HTML version of this report. </span><span class="note-m">On a narrow screen the bars are replaced by plain numbers inside each holding's details.</span></p>
<div class="tools" role="group" aria-label="Filter holdings"><button class="chip-btn" data-filter="all" aria-pressed="true">All {len(A["rows"])}</button><button class="chip-btn" data-filter="material" aria-pressed="false">Above 1% ({nmat})</button><button class="chip-btn" data-filter="attention" aria-pressed="false">Watch or review ({natt})</button></div>
<div class="scroll"><table class="panel" id="panel"><thead><tr><th scope="col">{_th("weight", "Holding, weight")}</th><th scope="col">{_th("verdict", "Verdict")}</th><th scope="col">{_th("score", "Score")}</th>
<th scope="col" class="sigcol">Smart Score</th><th scope="col" class="sigcol">Consensus</th><th scope="col" class="sigcol">Target upside</th><th scope="col" class="sigcol">AI models</th><th scope="col" class="sigcol">Trend (day / week)</th><th scope="col" class="sigcol">Analyst breadth</th><th scope="col" class="c-pnl">{_th("pnl", "vs your cost")}</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>
<p class="small key sigcol">Trend key: SB strong buy, B buy, N neutral, S sell, SS strong sell, shown for the day and the week. Analyst breadth is the number of analysts rating Buy out of all who rated in the last 12 months.</p></div></section>'''

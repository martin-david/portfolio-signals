"""sec_b.py - decision case files and the housekeeping table."""
from datetime import date
from fmt import LABEL, amt, big, chip, e, money, nice, pct, sgn, usd2, words


def ldate(iso): return date.fromisoformat(iso).strftime("%b %d").replace(" 0", " ")


def next_eps(T, r, F):
    if r["symbol"] in F: return F[r["symbol"]]["next_eps_estimate"]
    ne = r["facts"].get("next_earnings")
    return next((x["eps_estimate"] for x in (T.get(r["symbol"], {}).get("events") or []) if x["type"] == "earnings" and x.get("date") == ne and x.get("eps_estimate") is not None), None)


def case(r, dd):
    nm = nice(r["name"])
    name = f'<p class="nm">{e(nm)}</p>' if nm != r["symbol"] else ""
    return (f'<article class="case"><header>{chip(r["verdict"])}<h3>{e(r["symbol"])}</h3>{name}'
            f'<p class="pos"><b>{r["weight_pct"]:.1f}%</b> of the account</p><p class="pos">{amt(money(r["value"]))} · {sgn(r["pnl_pct"])} vs your cost</p></header><dl>'
            + "".join(f"<dt>{k}</dt><dd>{v}</dd>" for k, v in dd) + "</dl></article>")


def decisions_section(A, T, F):
    R = {r["symbol"]: r for r in A["rows"]}
    eps = lambda s: next_eps(T, R[s], F)
    # MSFT
    m = R["MSFT"]; f, a, fm = m["facts"], m["facts"]["analysts"], F["MSFT"]
    up = lambda s: sgn(R[s]["facts"]["street_upside_pct"])
    msft = [("What the data says", f"{a['buy']} of {a['analysts']} analysts say Buy and none say Sell. The average target of ${f['price_target']:,.2f} sits {sgn(f['street_upside_pct'])} above the ${f['last_price']:,.2f} price, modest next to NVDA ({up('NVDA')}), AMZN ({up('AMZN')}) and GOOG ({up('GOOG')}). Smart Score {f['smart_score']}/10, AI models {f['ai_score']:.0f}/100 ({e(f['ai_rating'])}), trend {LABEL[f['tech_day']]} on the day and {LABEL[f['tech_week']]} on the week. Fundamentals are strong but spending-heavy: FY{fm['fiscal_year']} revenue {big(fm['revenue'])} ({sgn(fm['revenue_growth_pct'])}) at a {pct(fm['net_margin_pct'], 0)} net margin, yet free cash flow moved {sgn(fm['fcf_change_pct'])} to {big(fm['fcf'])} because capex reached {big(fm['capex'])}, {fm['capex_pct_revenue']:.0f}% of revenue."),
            ("What it cannot see", f"How much one stock may move your net worth. At {m['weight_pct']:.1f}% of the account, a typical earnings-day swing of ±{f['avg_abs_earnings_move_pct']:.1f}% is roughly ±{amt(money(m['value'] * f['avg_abs_earnings_move_pct'] / 100))} before anything else moves. The data also knows nothing about your taxes, time horizon or other assets."),
            ("Next checkpoint", f"Earnings on {ldate(f['next_earnings'])} (consensus EPS {usd2(eps('MSFT'))}). NVDA ({R['NVDA']['weight_pct']:.1f}%, score {R['NVDA']['composite']}) is the only other position above 10%.")]
    # NET
    n = R["NET"]; f, a, fm = n["facts"], n["facts"]["analysts"], F["NET"]
    worst = min(fm["reactions"], key=lambda q: q["price_reaction_pct"])
    net = [("What the data says", f"Consensus is Strong Buy ({a['buy']} Buy, {a['hold']} Hold, {a['sell']} Sell), but the analysts TipRanks ranks best say {LABEL[f['best_consensus']]}. The average target of ${f['price_target']:,.2f} is {sgn(f['street_upside_pct'])} from the ${f['last_price']:,.2f} price (median ${a['pt_median']:,.0f}, range ${a['pt_min']:,.0f} to ${a['pt_max']:,.0f}), so the typical analyst sees little left. Smart Score {f['smart_score']}/10 and the AI models ({f['ai_score']:.0f}/100, target {sgn(f['ai_upside_pct'], 0)}) are neutral. FY{fm['fiscal_year']} revenue {big(fm['revenue'], 2)} ({sgn(fm['revenue_growth_pct'])}); still a GAAP loss ({pct(fm['net_margin_pct'])} net margin) but {big(fm['fcf'])} of free cash flow."),
           ("What it cannot see", f"Whether a {sgn(n['pnl_pct'], 0)} gain is something you want to protect, and what realising it would cost in tax. Earnings swings are large: ±{f['avg_abs_earnings_move_pct']:.1f}% on average and {sgn(worst['price_reaction_pct'])} after the {worst['period']} report."),
           ("Next checkpoint", f"Earnings on {ldate(f['next_earnings'])} (consensus EPS {usd2(eps('NET'))}).")]
    # IBM
    i = R["IBM"]; f, a = i["facts"], i["facts"]["analysts"]
    al = next(x["detail"] for x in i["flags"] if x["key"] == "tipranks_alert").rstrip(".")
    ibm = [("What the data says", f"Consensus is Buy ({a['buy']} Buy, {a['hold']} Hold, {a['sell']} Sell) and the average target of ${f['price_target']:,.0f} is {sgn(f['street_upside_pct'])} above the price. Against that, the trend is {LABEL[f['tech_day']]} on both the day and week view, TipRanks raised a price-drop alert ({e(al[0].lower() + al[1:])}), the stock is {sgn(f['ytd_pct'])} year to date, and the Smart Score ({f['smart_score']}/10) and AI models ({f['ai_score']:.0f}/100, {e(f['ai_rating'])}) are only middling."),
           ("What it cannot see", f"Why you hold it. The dividend yield is {f['div_yield_pct']:.1f}% and the position is {sgn(i['pnl_pct'])} against your cost; the data cannot tell you whether you would buy it today."),
           ("Next checkpoint", f"Earnings on {ldate(f['next_earnings'])}, the first of the cluster (consensus EPS {usd2(eps('IBM'))}).")]
    # VOD
    v = R["VOD"]; f, a = v["facts"], v["facts"]["analysts"]
    vod = [("What the data says", f"Consensus is Buy, but it rests on {a['analysts']} analysts in 12 months and there is no average price target. Smart Score {f['smart_score']}/10 and the AI models ({f['ai_score']:.0f}/100, {e(f['ai_rating'])}) are neutral; the trend is {LABEL[f['tech_day']]} on the day and {LABEL[f['tech_week']]} on the week. The dividend yield is {f['div_yield_pct']:.1f}%."),
           ("What it cannot see", f"Why you hold it, and whether its {sgn(v['pnl_pct'])} result against your cost changes that."),
           ("Next checkpoint", f"Earnings on {ldate(f['next_earnings'])}.")]
    cases = case(m, msft) + case(n, net) + case(i, ibm) + case(v, vod)
    # housekeeping
    small = sorted((r for r in A["rows"] if not r["material"]), key=lambda r: -r["weight_pct"])
    gaps = {r["symbol"]: r["facts"]["street_upside_pct"] - r["facts"]["ai_upside_pct"] for r in A["rows"] if r["comp"].get("upside") is not None and r["facts"].get("ai_upside_pct") is not None}
    widest, low_ai = max(gaps, key=gaps.get), min((r for r in A["rows"] if r["facts"].get("ai_score") is not None), key=lambda r: r["facts"]["ai_score"])["symbol"]
    def why(r):
        f, a, s = r["facts"], r["facts"].get("analysts") or {}, r["symbol"]
        if r["asset_class"] == "crypto": return f"Crypto: TipRanks publishes no ratings for it. {sgn(r['pnl_pct'], 0)} against your cost." + (" Its TipRanks symbol resolves to 'SubGame', so even the price match is unverified." if s == "SGB" else "")
        if s == "ABBV": return f"Strong Buy ({a['buy']} of {a['analysts']} analysts Buy) with a {sgn(f['street_upside_pct'])} target, but the AI models are neutral ({f['ai_score']:.0f}) and it is already {sgn(r['pnl_pct'], 0)} against your cost."
        if s == "BABA": return f"Street target {sgn(f['street_upside_pct'], 0)} against AI models {sgn(f['ai_upside_pct'], 0)}" + (", the widest gap in the portfolio" if s == widest else "") + f"; trend {LABEL[f['tech_day']]} on the day and {LABEL[f['tech_week']]} on the week, and {sgn(r['pnl_pct'], 0)} against your cost."
        if s == "SHL.DE": return f"Buy ({a['buy']} Buy, {a['hold']} Hold) with a {sgn(f['street_upside_pct'])} target in euros and Smart Score {f['smart_score']}/10. No flags."
        if s == "PYPL": return f"Consensus is Neutral: {a['buy']} Buy, {a['hold']} Hold, {a['sell']} Sell. AI models {f['ai_score']:.0f} (neutral); {sgn(r['pnl_pct'], 0)} against your cost."
        if s == "ETL.PA": return f"One analyst opinion in 12 months (Hold), no Smart Score, AI score {f['ai_score']:.0f}" + (" (the lowest of your stocks)" if s == low_ai else "") + f", a TipRanks price-drop alert and {sgn(r['pnl_pct'], 0)} against your cost."
        if s == "ATROB": return f"Fractional Class B shares. Analysts cover the Class A line (ATRO): Strong Buy from {a['analysts']} analysts, average target ${f['price_target']:,.2f}."
        return ""
    body = "".join(f'<tr><th scope="row">{e(r["symbol"])}</th><td>{r["weight_pct"]:.2f}%<br>{amt(money(r["value"]))}</td><td>{chip(r["verdict"])}</td><td>{why(r)}</td></tr>' for r in small)
    k = A["kpis"]["small_positions"]
    nn = sum(1 for r in A["rows"] if r["material"] and r["verdict"] != "HOLD")
    return f'''<section id="decisions"><div class="wrap"><h2>Decisions worth your time</h2>
<p class="sub">Each case separates what the data says from what it cannot see, because the second half is where your decision actually lives. These are the {words(nn)} positions above 1% that are not a plain hold.</p>
{cases}<h3 class="sub-h">Housekeeping: {k["count"]} positions, {k["pct"]:.1f}% of the account</h3>
<table class="mini"><tbody>{body}</tbody></table></div></section>'''

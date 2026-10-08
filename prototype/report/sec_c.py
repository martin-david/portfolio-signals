"""sec_c.py - targets, earnings concentration, top-five deep dive, method and footer."""
from datetime import date
from fmt import amt, big, e, money, pct, sgn
from sec_b import ldate
from svgkit import capex_chart, earnings_chart, reaction_chart, targets_chart


def targets_section(A):
    items = []
    for r in A["rows"]:
        f, a = r["facts"], r["facts"].get("analysts") or {}
        if r["comp"].get("upside") is None or not a.get("pt_median"): continue
        last = f["last_price"]
        items.append({"symbol": r["symbol"] + (" via ATRO" if r["via"] else ""), "weight_pct": r["weight_pct"], "min": (a["pt_min"] / last - 1) * 100,
                      "med": (a["pt_median"] / last - 1) * 100, "max": (a["pt_max"] / last - 1) * 100, "street": f["street_upside_pct"], "ai": f.get("ai_upside_pct"), "n": a["with_price_target"]})
    gap = sorted(((i["street"] - i["ai"], i["symbol"].split()[0]) for i in items if i["ai"] is not None), reverse=True)
    agree = [s for g, s in gap if abs(g) <= 5]
    return f'''<section id="targets" class="sheet"><div class="wrap"><h2>Where Wall Street and the AI models disagree</h2>
<p class="sub">Two views of the same question: what is each stock worth in a year? The AI figure comes from TipRanks' own language-model analysis; the Street figure is the average of human analyst targets. Where they split, treat the upside as less certain.</p>
<figure class="chart">{targets_chart(items)}
<div class="k-list"><span><i style="background:var(--blue)"></i>Average Street target</span><span><i style="background:var(--orange);border-radius:1px;transform:rotate(45deg) scale(.85)"></i>AI-model target</span><span><i style="background:var(--slate-bg);border-radius:1px;width:22px;height:8px"></i>Lowest to highest analyst target, tick = median</span></div>
<figcaption>All values are a percent above or below today's price. The widest splits are {", ".join(f"{s} ({g:+.0f} points)".replace("-", "−") for g, s in gap[:3])}, where the Street is far more optimistic than the models. They roughly agree (within 5 points) on {", ".join(agree)}. NET's blue dot sits on the price line: the average analyst sees no upside there.</figcaption></figure></div></section>'''


def earnings_section(A):
    snap, days = date.fromisoformat(A["as_of"][:10]), {}
    for r in A["rows"]:
        ne = r["facts"].get("next_earnings") if r["asset_class"] == "stock" else None
        if ne and (date.fromisoformat(ne) - snap).days <= 70: days.setdefault(ne, []).append((r["symbol"], r["weight_pct"]))
    days = sorted((d, sorted(v, key=lambda x: -x[1])) for d, v in days.items())
    tot = lambda d: sum(w for _, w in d[1])
    top, second = sorted(days, key=tot, reverse=True)[:2]
    mac = {}
    for ev in A["calendar"]:
        if ev["kind"] != "macro": continue
        lab = "Inflation (CPI)" if "Inflation" in ev["label"] else "Jobs report" if ev["label"] in ("Non Farm Payrolls", "Unemployment Rate") else ev["label"]
        mac.setdefault(ev["date"], [])
        if lab not in mac[ev["date"]]: mac[ev["date"]].append(lab)
    macro = " · ".join(f"<b>{ldate(d)}</b> {e(', '.join(v))}" for d, v in sorted(mac.items()))
    divs = " · ".join(f"<b>{ldate(ev['date'])}</b> {e(ev['label'])}" for ev in A["calendar"] if ev["kind"] == "dividend")
    head = f"{tot(top):.0f}% of the account reports on {ldate(top[0])}" if tot(top) >= 40 else "When your holdings report"
    return f'''<section id="earnings"><div class="wrap"><h2>{head}</h2>
<p class="sub">MSFT, GOOG and PYPL all report on {ldate(top[0])}. NVDA, your second-largest position, reports alone on {ldate(second[0])} ({tot(second):.1f}%). Earnings days are where analyst targets get tested, so they are the natural moments to re-read this report.</p>
<figure class="chart">{earnings_chart(days)}<figcaption>Bars are sized by each holding's share of your account. ETL.PA (Feb 12 2027) and the crypto positions are not shown.</figcaption></figure>
<p class="sub" style="margin-top:32px"><b>Macro calendar, high impact, United States:</b> {macro}.</p>
<p class="sub" style="margin-top:12px"><b>Dividends:</b> {divs}.</p></div></section>'''


def top5_section(A, F):
    rows = "".join(f'<tr><td><b>{e(f["symbol"])}</b> <span class="small">FY{f["fiscal_year"]}</span></td><td>{big(f["revenue"])}</td><td>{sgn(f["revenue_growth_pct"])}</td><td>{pct(f["net_margin_pct"])}</td><td>{big(f["fcf"])}</td><td>{sgn(f["fcf_change_pct"])}</td><td>{big(f["capex"])} ({f["capex_pct_revenue"]:.0f}%)</td><td>{f["eps_beats"]}/{f["quarters"]}</td><td>±{f["avg_abs_reaction_pct"]:.1f}%</td><td>{ldate(f["next_report"])}</td></tr>' for f in F)
    heavy = [f["symbol"] for f in F if f["capex"] > f["fcf"]]
    nv = next(f for f in F if f["symbol"] == "NVDA")
    react = "".join(f'<figure>{reaction_chart(f)}<figcaption><b>{e(f["symbol"])}</b> moves ±{f["avg_abs_reaction_pct"]:.1f}% on average · EPS beat {f["eps_beats"]} of {f["quarters"]}</figcaption></figure>' for f in F)
    tone = "".join(f'<div><h4>{e(f["symbol"])}</h4><p>Latest call (FY{f["call_fy"]} Q{f["call_q"]}): tone {e((f["call_tone"] or "n/a").lower())}. Watch-outs management raised:</p><ul>{"".join(f"<li>{e(x)}</li>" for x in f["call_lowlights"][:3])}</ul></div>' for f in F)
    return f'''<section id="top5" class="sheet"><div class="wrap"><h2>The five biggest stocks, in depth</h2>
<p class="sub">Annual financials, eight quarters of earnings history and the latest earnings-call summary from TipRanks, fetched for MSFT, NVDA, META, NET and GOOG only (together {sum(r["weight_pct"] for r in A["rows"] if r["symbol"] in [f["symbol"] for f in F]):.0f}% of the account).</p>
<div class="scroll"><table class="top5"><thead><tr><th scope="col">Stock</th><th scope="col">Revenue</th><th scope="col">Growth</th><th scope="col">Net margin</th><th scope="col">Free cash flow</th><th scope="col">vs prior year</th><th scope="col">Capex (% of revenue)</th><th scope="col">EPS beats</th><th scope="col">Avg earnings move</th><th scope="col">Next report</th></tr></thead><tbody>{rows}</tbody></table></div>
<div class="two" style="margin-top:56px"><div><h3>The AI build-out is squeezing free cash flow</h3><p class="sub">{", ".join(heavy)} each spent more on capex than they kept as free cash flow in their latest fiscal year. NVDA, whose revenue comes from that spending, kept {big(nv["fcf"])} of free cash flow on {big(nv["capex"])} of capex.</p></div>
<figure class="chart">{capex_chart(F)}<div class="k-list"><span><i style="background:var(--orange)"></i>Capital expenditure</span><span><i style="background:var(--blue)"></i>Free cash flow</span></div></figure></div>
<h3 class="pb" style="margin-top:64px">Earnings-day reactions, last eight quarters</h3>
<p class="sub">Each bar is the share-price move after one report; a hollow circle marks a quarter where EPS came in below the estimate. Big moves in both directions are normal for these names.</p>
<div class="react">{react}</div>
<div class="tone">{tone}</div></div></section>'''


SIGNALS = [("Analyst consensus", "TipRanks consensus label", "Strong Buy +1, Buy +0.5, Neutral 0, Sell −0.5, Strong Sell −1"),
           ("Target upside", "Average analyst target versus latest close", "±30% maps to ±1; used only when at least 3 analysts gave a target"),
           ("Smart Score", "TipRanks Smart Score, 1 to 10", "(score − 5.5) / 4.5"),
           ("AI models", "TipRanks AI stock analysis, 0 to 100", "(score − 60) / 25, clipped to ±1"),
           ("Technical trend", "TipRanks day and week summary signals", "Average of the two on the consensus scale"),
           ("Analyst breadth", "Latest rating of each analyst in 12 months", "(Buy − Sell) / analysts; used only with at least 5 analysts")]


def method_section(A):
    sig = "".join(f"<tr><th scope='row'>{a}</th><td>{b}</td><td>{c}</td></tr>" for a, b, c in SIGNALS)
    return f'''<section id="method"><div class="wrap"><h2>How the verdicts are built, and what they cannot tell you</h2>
<div class="method" style="margin-top:32px"><div><h3>Six signals, equal weight</h3>
<table class="sigtab"><thead><tr><th scope="col">Signal</th><th scope="col">Source</th><th scope="col">Scaled to −1 … +1</th></tr></thead><tbody>{sig}</tbody></table>
<p style="margin-top:16px">The score is the average of the signals that exist for a holding, times 100. Missing data is skipped, never counted as zero. The weights are equal by design and the score has not been tested for predictive power.</p></div>
<div><h3>From score to verdict</h3><ul><li><b>Strong</b> (60 and up): <b>Hold</b>. A holding above 25% of the account is marked <b>Hold · size</b>.</li><li><b>Supported</b> (35 to 59): <b>Hold</b>, or <b>Watch</b> with two or more warning flags or a price at its average target.</li><li><b>Mixed</b> (10 to 34): <b>Watch</b>, or <b>Review</b> with three or more warning flags.</li><li><b>Weak</b> (below 10): <b>Review</b>.</li><li>Crypto has no TipRanks coverage and is marked <b>No data</b>.</li></ul>
<p>Review means the data gives a reason to look again; it is not a sell signal.</p>
<h3 style="margin-top:28px">What is missing</h3><ul><li>Your tax position, time horizon, risk tolerance and other assets.</li><li>TipRanks data for the three copy-trading portfolios ({amt(money(sum(c["value"] for c in A["copied_traders"])))}, {sum(c["value"] for c in A["copied_traders"]) / A["account"]["totalValue"] * 100:.1f}% of the account), the demo account, watchlists and trade history.</li><li>Deep-dive fundamentals for holdings outside the top five; the TipRanks free plan allows 50 calls a month.</li></ul></div></div>
<p class="small" style="margin-top:40px;max-width:80ch">Sources: eToro real account snapshot {e(A["snapshot_id"])}; TipRanks tools get_assets_data, get_bulls_bears_summary, get_ai_stock_analysis, get_recent_analyst_ratings, get_technical_analysis, get_stock_quotes, get_financials, get_earnings_history, get_earnings_call_summary, get_assets_events and get_economic_calendar. Target upside uses the latest regular-session close; TipRanks' own upside figure uses the previous close. Amounts for DE:SHL and FR:ETL are in euros on the TipRanks side. This page makes no network requests.</p></div></section>'''


def footer_html(A):
    return f'''<footer><div class="wrap"><p>This report is informational and is not investment advice. Analyst ratings, Smart Scores and AI scores are opinions or model outputs and can be wrong, and past performance does not predict future results. Market prices move; figures are from the saved snapshot ({e(A["as_of"])}).</p><p>Generated by report\\build_report.py from the local portfolio database.</p></div></footer>'''

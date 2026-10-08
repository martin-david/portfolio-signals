#!/usr/bin/env python3
"""analysis.py - transparent signal scoring for the TipRanks-enriched portfolio.

    python report\\analysis.py [SNAPSHOT_ID]     ->  reports\\<id>\\analysis.json

Six signals, each scaled to -1..+1, are averaged over those that are available (missing data is skipped, never scored
as zero). Tiers and verdicts are rule-based and informational; they are not personalised investment advice.
"""
import json, statistics, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCALE = {"StrongBuy": 1.0, "Buy": 0.5, "Neutral": 0.0, "Sell": -0.5, "StrongSell": -1.0, "StongSell": -1.0}
LABEL = {"StrongBuy": "Strong Buy", "Buy": "Buy", "Neutral": "Neutral", "Sell": "Sell", "StrongSell": "Strong Sell", "StongSell": "Strong Sell"}
AI_CLUSTER = ["MSFT", "NVDA", "META", "GOOG", "AMZN", "NET"]   # businesses whose latest earnings calls centre on AI capex / cloud demand
SMALL_PCT = 1.0          # positions below this share of the account are housekeeping, not decisions


def clip(x, lo=-1.0, hi=1.0): return max(lo, min(hi, x))
def flag(key, sev, title, detail): return {"key": key, "severity": sev, "title": title, "detail": detail}
def tier_of(c): return None if c is None else "Strong" if c >= 60 else "Supported" if c >= 35 else "Mixed" if c >= 10 else "Weak"
def mdy(iso): return date.fromisoformat(iso[:10]).strftime("%b %d").replace(" 0", " ")


def verdict_of(row):
    if row["asset_class"] == "crypto": return "NO DATA"
    keys = {f["key"] for f in row["flags"]}
    warns = sum(1 for f in row["flags"] if f["severity"] in ("warn", "alert"))
    if row["tier"] == "Strong": return "HOLD · REVIEW SIZE" if row["weight_pct"] >= 25 else "HOLD"
    if row["tier"] == "Supported": return "WATCH" if warns >= 2 or "priced_at_target" in keys else "HOLD"
    if row["tier"] == "Mixed": return "REVIEW" if warns >= 3 else "WATCH"
    return "REVIEW"


def build_row(h, snap_day):
    et, b = h["etoro"], h["tipranks"]
    rel = (h.get("tipranks_related") or [None])[0]
    row = {"symbol": et["etoro_symbol"], "name": et["name"], "asset_class": et["asset_class"], "weight_pct": et["weight_pct"], "value": et["value"],
           "invested": et["invested"], "pnl": et["pnl"], "pnl_pct": et["pnl_pct"], "units": et["units"], "tipranks_ticker": b["ticker"],
           "material": et["weight_pct"] >= SMALL_PCT, "flags": [], "via": None}
    if et["asset_class"] == "crypto":
        q = b.get("quote") or {}
        row.update(comp={}, composite=None, tier="No data", verdict="NO DATA", facts={"price": q.get("price"), "change_pct": q.get("changePercentage")})
        row["flags"].append(flag("no_coverage", "info", "No analyst coverage", "TipRanks publishes no ratings, Smart Score or AI score for crypto."))
        if et["pnl_pct"] <= -40:
            row["flags"].append(flag("deep_loss", "info", f"Down {abs(et['pnl_pct']):.0f}% vs your cost", "Large in percent, tiny in dollars."))
        return row
    pick = lambda fn: next((v for v in (fn(b), fn(rel) if rel else None) if v is not None), None)
    s = b.get("summary") or {}
    cons = pick(lambda x: (x.get("summary") or {}).get("analystConsensus"))
    src = b if s.get("priceTarget") is not None else (rel or b)
    pt, last = (src.get("summary") or {}).get("priceTarget"), (src.get("quote") or {}).get("price")
    stats = pick(lambda x: (x.get("analyst_ratings") or {}).get("stats"))
    if stats is not None and not b.get("analyst_ratings") and rel: row["via"] = rel["ticker"]
    n_ana, n_pt = (stats or {}).get("analysts", 0), (stats or {}).get("with_price_target", 0)
    ai, ss = b.get("ai_analysis") or {}, s.get("smartScore")
    up = (pt / last - 1) if pt and last else None
    tech = b.get("technicals") or {}
    tsig = {tf: (((tech.get(tf) or {}).get("scores") or {}).get("summaryScore") or {}).get("scoreScale") for tf in ("day", "week")}
    tvals = [SCALE[v] for v in tsig.values() if v in SCALE]
    comp = {"consensus": SCALE.get(cons), "upside": clip(up / 0.30) if up is not None and n_pt >= 3 else None,
            "smart_score": clip((ss - 5.5) / 4.5) if ss else None,
            "ai_score": clip((ai["ai_score"] - 60) / 25) if ai.get("ai_score") is not None else None,
            "technicals": statistics.fmean(tvals) if tvals else None,
            "breadth": (stats["buy"] - stats["sell"]) / n_ana if stats and n_ana >= 5 else None}
    vals = [v for v in comp.values() if v is not None]
    composite = round(statistics.fmean(vals) * 100) if vals else None
    ne = s.get("nextEarningsDate") or ((rel or {}).get("summary") or {}).get("nextEarningsDate")
    days = (date.fromisoformat(ne) - snap_day).days if ne else None
    move = (b.get("earnings_history") or {}).get("avg_abs_price_reaction_pct")
    ai_up, w, fl = ai.get("upside_pct"), et["weight_pct"], row["flags"]
    if w >= 25: fl.append(flag("concentration", "alert", f"{w:.1f}% of the account in one stock", "Single-name risk outweighs any analyst signal."))
    elif w >= 10: fl.append(flag("concentration", "warn", f"{w:.1f}% of the account in one stock", "A large single-name position."))
    if up is not None and n_pt >= 3 and up < 0.03: fl.append(flag("priced_at_target", "warn", "Trades at its average analyst target", f"Target {pt:,.2f} vs price {last:,.2f} ({up * 100:+.1f}%)."))
    if up is not None and n_pt >= 3 and ai_up is not None and up * 100 - ai_up >= 25: fl.append(flag("dispersion", "warn", "Street and AI targets disagree", f"Street target implies {up * 100:+.0f}%, TipRanks' AI models {ai_up:+.0f}%."))
    if cons in ("Neutral", "Sell", "StrongSell", "StongSell"): fl.append(flag("weak_consensus", "warn", f"Analyst consensus is {LABEL[cons]}", "Analysts are not bullish on this name."))
    if n_ana < 5: fl.append(flag("thin_coverage", "warn", f"Thin coverage: {n_ana} analyst{'s' if n_ana != 1 else ''} in 12 months", "Consensus and targets rest on very few opinions."))
    if tvals and statistics.fmean(tvals) < 0: fl.append(flag("weak_trend", "warn", "Technical trend is negative", "Day and week summaries lean Sell."))
    for wr in b.get("warnings", []):
        pv = f"{float((wr.get('fieldsDict') or {}).get('percentage', 0)):.1f}".replace("-", "−")
        fl.append(flag("tipranks_alert", "warn", "TipRanks price-drop alert", f"One-day move of {pv}% on {mdy(wr['date'])}."))
    if days is not None and 0 <= days <= 30: fl.append(flag("earnings_soon", "info", f"Earnings in {days} days ({mdy(ne)})", f"Typical earnings-day move ±{move:.1f}% over the last 8 quarters." if move else "Event risk inside 30 days."))
    if row["pnl_pct"] <= -40: fl.append(flag("deep_loss", "warn" if composite is not None and composite < 35 else "info", f"Down {abs(row['pnl_pct']):.0f}% vs your cost", "Weigh against how much you would rebuy today."))
    if (s.get("yearlyGainPct") or 0) <= -25: fl.append(flag("year_decline", "info", f"Down {abs(s['yearlyGainPct']):.0f}% over 12 months", "Price momentum has been weak."))
    a = stats or {}
    row.update(comp={k: (None if v is None else round(v, 3)) for k, v in comp.items()}, composite=composite, tier=tier_of(composite), facts={
        "smart_score": ss, "consensus": cons, "best_consensus": pick(lambda x: (x.get("summary") or {}).get("bestAnalystConsensus")), "price_target": pt,
        "last_price": last, "currency": (src.get("quote") or {}).get("currency"), "street_upside_pct": None if up is None else round(up * 100, 1),
        "ai_score": ai.get("ai_score"), "ai_rating": ai.get("rating"), "ai_price_target": ai.get("price_target"), "ai_upside_pct": ai_up,
        "tech_day": tsig["day"], "tech_week": tsig["week"], "next_earnings": ne, "days_to_earnings": days, "avg_abs_earnings_move_pct": move,
        "analysts": {k: a.get(k) for k in ("analysts", "buy", "hold", "sell", "with_price_target", "pt_min", "pt_median", "pt_max", "pt_currency")} if a else None,
        "ytd_pct": s.get("ytdGainPct"), "yearly_pct": s.get("yearlyGainPct"), "pe": s.get("peRatio"), "div_yield_pct": s.get("dividendYield"),
        "news_sentiment": s.get("newsSentiment"), "hedge_funds_score": s.get("hedgeFundsScore"), "insider_score": s.get("insiderScore"),
        "sector": s.get("sector"), "change_pct": (b.get("quote") or {}).get("change_percent")})
    row["verdict"] = verdict_of(row)
    return row


def portfolio_kpis(rows, acct):
    total, st = acct["totalValue"], [r for r in rows if r["asset_class"] == "stock"]
    wavg = lambda g: (lambda pts: round(sum(v * x for v, x in pts) / sum(v for v, _ in pts), 2) if pts else None)([(r["value"], g(r)) for r in st if g(r) is not None])
    cons_share, seen, tot = {}, set(), {"buy": 0, "hold": 0, "sell": 0}
    for r in st:
        k = LABEL.get(r["facts"]["consensus"], "No consensus"); cons_share[k] = cons_share.get(k, 0) + r["value"]
        key = r["via"] or r["tipranks_ticker"]
        if key not in seen and r["facts"].get("analysts"):
            seen.add(key)
            for k2 in tot: tot[k2] += r["facts"]["analysts"].get(k2) or 0
    dv = sum(r["value"] for r in rows); ws = sorted((r["value"] for r in rows), reverse=True)
    hhi = sum((r["value"] / dv) ** 2 for r in rows)
    win = [r for r in st if r["facts"].get("days_to_earnings") is not None and 0 <= r["facts"]["days_to_earnings"] <= 30]
    small = [r for r in rows if not r["material"]]
    return {"total_value": total, "direct_value": round(dv, 2), "unrealized_pnl": acct["unrealizedPnl"],
            "wavg_smart_score": wavg(lambda r: r["facts"].get("smart_score")), "wavg_street_upside_pct": wavg(lambda r: r["facts"].get("street_upside_pct") if r["comp"].get("upside") is not None else None),
            "wavg_ai_score": wavg(lambda r: r["facts"].get("ai_score")), "consensus_share_of_stock_value": {k: round(v / sum(r["value"] for r in st) * 100, 1) for k, v in cons_share.items()},
            "rating_counts": tot, "top1_pct": round(ws[0] / total * 100, 1), "top2_pct": round(sum(ws[:2]) / total * 100, 1), "top5_pct": round(sum(ws[:5]) / total * 100, 1),
            "effective_positions": round(1 / hhi, 1), "positions": len(rows), "ai_cluster_pct": round(sum(r["value"] for r in rows if r["symbol"] in AI_CLUSTER) / total * 100, 1),
            "earnings_30d_pct": round(sum(r["value"] for r in win) / total * 100, 1), "earnings_30d_symbols": [r["symbol"] for r in win],
            "small_positions": {"count": len(small), "value": round(sum(r["value"] for r in small), 2), "pct": round(sum(r["value"] for r in small) / total * 100, 2)},
            "verdict_counts": {v: sum(1 for r in rows if r["verdict"] == v) for v in ("HOLD", "HOLD · REVIEW SIZE", "WATCH", "REVIEW", "NO DATA")}}


def calendar(doc, rows, snap_day):
    ev = [{"date": r["facts"]["next_earnings"], "kind": "earnings", "label": f"{r['symbol']} earnings", "symbol": r["symbol"], "weight_pct": r["weight_pct"]}
          for r in rows if r["facts"].get("next_earnings")]
    for h in doc["holdings"]:
        for e in (h["tipranks"].get("events") or []):
            if e["type"] == "dividend" and e.get("ex_date") and e["ex_date"] >= snap_day.isoformat():
                cur = "" if ":" in h["tipranks"]["ticker"] else "$"
                amt = f"{e['amount']:.2f}" if round(e["amount"], 2) == e["amount"] else f"{e['amount']:.3f}"
                ev.append({"date": e["ex_date"], "kind": "dividend", "label": f"{h['etoro']['etoro_symbol']} ex-dividend, {cur}{amt} a share", "symbol": h["etoro"]["etoro_symbol"], "weight_pct": h["etoro"]["weight_pct"]})
    for x in ((doc["market_context"].get("economic_calendar") or {}).get("economicCalendar") or []):
        if x["country"] == "US": ev.append({"date": x["time"][:10], "kind": "macro", "label": x["event"], "symbol": None, "weight_pct": None})
    return sorted(ev, key=lambda e: (e["date"], e["kind"]))


def fundamentals(doc):
    out = []
    for h in doc["holdings"]:
        b = h["tipranks"]; fin = (b.get("financials_annual") or {}).get("periods"); eh = b.get("earnings_history"); call = b.get("earnings_call_summary")
        if not fin or not eh: continue
        cur, prev = fin[-1], fin[-2]; qs = eh["quarters"]
        out.append({"symbol": h["etoro"]["etoro_symbol"], "fiscal_year": cur["fiscal_year"], "revenue": cur["revenue"], "revenue_growth_pct": round((cur["revenue"] / prev["revenue"] - 1) * 100, 1),
                    "net_margin_pct": cur["net_margin_pct"], "operating_margin_pct": cur["operating_margin_pct"], "fcf": cur["free_cash_flow"], "fcf_prev": prev["free_cash_flow"],
                    "fcf_change_pct": round((cur["free_cash_flow"] / prev["free_cash_flow"] - 1) * 100, 1), "capex": -cur["capital_expenditure"], "capex_pct_revenue": round(-cur["capital_expenditure"] / cur["revenue"] * 100, 1),
                    "revenue_series": [p["revenue"] for p in fin], "fy_series": [p["fiscal_year"] for p in fin], "eps_beats": sum(1 for q in qs if q["eps_surprise_pct"] > 0), "rev_beats": sum(1 for q in qs if q["revenue_surprise_pct"] > 0),
                    "quarters": len(qs), "avg_abs_reaction_pct": eh["avg_abs_price_reaction_pct"], "reactions": [{"period": q["period"], "eps_surprise_pct": q["eps_surprise_pct"], "price_reaction_pct": q["price_reaction_pct"]} for q in qs],
                    "next_report": eh["next_quarter"]["report_date"], "next_eps_estimate": eh["next_quarter"]["estimate_eps"], "call_fy": call["fiscal_year"] if call else None, "call_q": call["fiscal_quarter"] if call else None,
                    "call_tone": call["sentiment"]["label"] if call else None, "call_highlights": [x["title"] for x in (call or {}).get("highlights", [])][:4], "call_lowlights": [x["title"] for x in (call or {}).get("lowlights", [])][:4]})
    return out


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else sorted(p.name for p in (ROOT / "snapshots").iterdir() if p.is_dir())[-1]
    doc = json.loads((ROOT / "snapshots" / sid / "enriched_portfolio.json").read_text(encoding="utf-8"))
    snap_day = date.fromisoformat(doc["taken_at_utc"][:10])
    rows = sorted((build_row(h, snap_day) for h in doc["holdings"]), key=lambda r: -r["weight_pct"])
    out = {"snapshot_id": sid, "as_of": doc["taken_at_utc"], "account": doc["account"], "allocation": doc["allocation"], "rows": rows, "kpis": portfolio_kpis(rows, doc["account"]),
           "calendar": calendar(doc, rows, snap_day), "fundamentals": fundamentals(doc), "copied_traders": doc["copied_traders"],
           "market": {"commentary": doc["market_context"].get("commentary"), "sectors": doc["market_context"].get("sectors")}, "ai_cluster": AI_CLUSTER}
    dest = ROOT / "reports" / sid; dest.mkdir(parents=True, exist_ok=True)
    (dest / "analysis.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{'sym':7s} {'w%':>5s} {'comp':>5s} {'tier':14s} {'verdict':19s} flags")
    for r in rows:
        print(f"{r['symbol']:7s} {r['weight_pct']:5.1f} {str(r['composite']):>5s} {r['tier']:14s} {r['verdict']:19s} {','.join(f['key'] for f in r['flags'])}")
    print(json.dumps({k: v for k, v in out["kpis"].items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()

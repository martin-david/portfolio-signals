#!/usr/bin/env python3
"""ingest.py - build/refresh portfolio.db + enriched JSON/CSV + manifest for ONE snapshot (stdlib only).

    python ingest.py [SNAPSHOT_ID]      # default: newest folder under .\\snapshots

Idempotent: re-running replaces that snapshot's rows. Raw API responses under snapshots\\<id>\\raw are never modified.
"""
import csv, hashlib, json, shutil, sqlite3, statistics, sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCHEMA_VERSION = 1
SNAP_TABLES = ["holdings", "positions", "copied_traders", "tr_summary", "tr_quotes", "tr_ai", "tr_key_points",
               "tr_ratings", "tr_technicals", "tr_news", "tr_catalysts", "tr_events", "tr_warnings", "tr_earnings",
               "tr_financials", "tr_call_summary", "tr_call_points", "tr_crypto", "tr_market_commentary",
               "tr_sectors", "tr_econ_calendar", "raw_responses", "snapshots"]
TOOLS = {"portfolio_summary": "get-my-portfolio-summary", "positions_and_orders": "get-my-positions-and-orders",
         "balances": "get-my-balances", "assets_data": "get_assets_data", "bulls_bears": "get_bulls_bears_summary",
         "ai_stock_analysis": "get_ai_stock_analysis", "stock_quotes": "get_stock_quotes",
         "technicals_day": "get_technical_analysis(day)", "technicals_week": "get_technical_analysis(week)",
         "assets_news": "get_assets_news", "stock_catalysts": "get_stock_catalyst", "assets_events": "get_assets_events",
         "assets_warnings": "get_assets_warnings", "crypto_quotes": "get_all_crypto_quotes",
         "market_commentary": "get_market_commentary", "sector_analysis": "get_sector_analysis",
         "economic_calendar": "get_economic_calendar", "analyst_ratings": "get_recent_analyst_ratings",
         "financials_annual": "get_financials(annual)", "earnings_history": "get_earnings_history",
         "earnings_call_summary": "get_earnings_call_summary"}
LAYOUT = {
    "portfolio.db": "SQLite, all snapshots. Start with view v_holdings_enriched; tables tr_* = TipRanks, raw_responses = every raw payload.",
    "symbol_map.json": "eToro symbol -> TipRanks ticker/asset class (editable).",
    "snapshots/<id>/raw/": "verbatim API responses: etoro/*.json, tipranks/*.json, tipranks/by_ticker/<TICKER>/*.json (':' -> '_').",
    "snapshots/<id>/enriched_portfolio.json": "each holding joined with all eToro + TipRanks data, allocation, market context.",
    "snapshots/<id>/holdings_enriched.csv": "flat one-row-per-holding table (UTF-8 with BOM for Excel).",
    "snapshots/<id>/manifest.json": "provenance, call ledger, checksums, integrity checks (this file).",
    "latest/": "copy of the newest enriched JSON + CSV."}


def jload(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def jopt(p): return jload(p) if Path(p).exists() else None
def jd(x): return json.dumps(x, ensure_ascii=False)
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def day(s): return s[:10] if s and not s.startswith("0001") else None
def mdy(s): return datetime.strptime(s, "%m/%d/%Y").date().isoformat() if s else None
def by_key(rows, k="ticker"): return {x[k]: x for x in rows}


def fl(x):
    try: return float(x)
    except (TypeError, ValueError): return None


def analyst_stats(rows):
    last_any, last_pt = {}, {}
    for x in rows:
        k, d = x.get("expertUID") or x.get("analystName"), mdy(x.get("recommendationDate")) or ""
        if k not in last_any or d > last_any[k][0]: last_any[k] = (d, x)
        if x.get("priceTarget") is not None and (k not in last_pt or d > last_pt[k][0]): last_pt[k] = (d, x)
    cnt = Counter(v[1].get("recommendation") for v in last_any.values())
    pts = sorted(v[1]["priceTarget"] for v in last_pt.values())
    return {"analysts": len(last_any), "buy": cnt.get("Buy", 0), "hold": cnt.get("Hold", 0), "sell": cnt.get("Sell", 0),
            "with_price_target": len(pts), "pt_min": pts[0] if pts else None,
            "pt_median": statistics.median(pts) if pts else None,
            "pt_mean": round(statistics.fmean(pts), 2) if pts else None, "pt_max": pts[-1] if pts else None,
            "pt_currency": next((v[1].get("priceTargetCurrencyCode") for v in last_pt.values()), None),
            "latest_rating_date": max((v[0] for v in last_any.values()), default=None),
            "basis": "each analyst's most recent rating (and most recent price target) in the trailing 12 months"}


def rating_row(x):
    return {"date": mdy(x.get("recommendationDate")), "analyst": x.get("analystName"),
            "firm": (x.get("firmName") or "").strip(), "rating": x.get("recommendation"),
            "action": x.get("analystAction"), "price_target": x.get("priceTarget"),
            "currency": x.get("priceTargetCurrencyCode"), "analyst_stars": x.get("numOfStars"),
            "analyst_rank": x.get("analystRank"), "analyst_success_rate": x.get("successRate"),
            "analyst_excess_return": x.get("excessReturn"), "article": x.get("articleTitle"), "url": x.get("url")}


def tech_parts(t):
    s, ind = t.get("scores") or {}, t.get("technicalIndicatorsAnalysis") or {}
    pick = lambda k: {"value": (ind.get(k) or {}).get("score"), "signal": (ind.get(k) or {}).get("indicator")}
    return s, pick("rsI_14"), pick("macD_12_26"), pick("adX_14")


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else sorted(p.name for p in (ROOT / "snapshots").iterdir() if p.is_dir())[-1]
    snap = ROOT / "snapshots" / sid
    raw, et, tr = snap / "raw", snap / "raw" / "etoro", snap / "raw" / "tipranks"
    smap, log = jload(ROOT / "symbol_map.json"), jopt(snap / "fetch_log.json") or {}
    S, P, B = jload(et / "portfolio_summary.json"), jload(et / "positions_and_orders.json"), jopt(et / "balances.json")

    def T(name, key=None):
        d = jopt(tr / name)
        return [] if d is None else (d[key] if key else d)

    assets, ai = by_key(T("assets_data.json", "assetsData")), by_key(T("ai_stock_analysis.json", "stocks"))
    bb, quotes = by_key(T("bulls_bears.json", "data")), by_key(T("stock_quotes.json", "quotes"))
    tech = {"day": by_key(T("technicals_day.json")), "week": by_key(T("technicals_week.json"))}
    news, cats = T("assets_news.json", "assetNewsArticles"), by_key(T("stock_catalysts.json"))
    ev, warns = jopt(tr / "assets_events.json") or {}, T("assets_warnings.json", "assetWarnings")
    crypto, comm = T("crypto_quotes.json", "quotes"), jopt(tr / "market_commentary.json")
    sectors, econ = T("sector_analysis.json"), jopt(tr / "economic_calendar.json")
    per, bt = {}, tr / "by_ticker"
    for d in sorted(bt.iterdir()) if bt.exists() else []:
        for f, kind in (("analyst_ratings.json", "ratings"), ("financials_annual.json", "fin"),
                        ("earnings_history.json", "earn"), ("earnings_call_summary.json", "call")):
            if (d / f).exists(): per.setdefault(d.name.replace("_", ":", 1), {})[kind] = jload(d / f)

    con = sqlite3.connect(ROOT / "portfolio.db")
    con.executescript((ROOT / "schema.sql").read_text(encoding="utf-8"))

    def put(table, row):
        con.execute(f"INSERT OR REPLACE INTO {table} ({','.join(row)}) VALUES ({','.join('?' * len(row))})", tuple(row.values()))

    def events_for(tk):
        out = []
        for g in ev.get("assetsDividends", []):
            if g["ticker"] == tk:
                out += [{"type": "dividend", "ex_date": day(e.get("dividendExDate")), "pay_date": day(e.get("dividendPayDate")),
                         "amount": e.get("dividendAmount"), "yield_pct": e.get("dividendYield")} for e in g["events"]]
        for g in ev.get("assetsEarnings", []):
            if g["ticker"] == tk:
                out += [{"type": "earnings", "date": day(e.get("earningDate")), "period_ending": e.get("earningPeriodEnding") or None,
                         "eps_estimate": fl(e.get("earningEps")), "eps_last_year": fl(e.get("earningLastEps"))} for e in g["events"]]
        return out

    total, tot = S["totals"]["totalValue"], S["totals"]
    holdings, pos_by_sym = [], {}
    with con:
        for t in SNAP_TABLES: con.execute(f"DELETE FROM {t} WHERE snapshot_id = ?", (sid,))
        for h in S["holdings"]:
            m = h["market"]; sym = m["symbol"]; mp = smap.get(sym, {})
            row = dict(snapshot_id=sid, instrument_id=m["instrumentId"], etoro_symbol=sym, name=m["name"],
                       asset_class=mp.get("asset_class") or ("crypto" if m["instrumentId"] >= 100000 else "stock"),
                       tipranks_ticker=mp.get("tipranks", sym), invested=h["invested"], value=h["value"], pnl=h["pnl"],
                       pnl_pct=h["pnlPercent"], units=h["units"], avg_open_rate=h["avgOpenRate"], current_rate=h["currentRate"],
                       avg_leverage=h["avgLeverage"], exposure=h["exposure"], position_count=h["positionCount"],
                       weight_pct=round(h["value"] / total * 100, 4))
            put("holdings", row); holdings.append(row)

        def add_pos(p, source, mirror):
            m = p["market"]
            row = dict(snapshot_id=sid, position_id=p["positionId"], source=source, mirror_id=mirror, instrument_id=m["instrumentId"],
                       symbol=m["symbol"], direction=p["direction"], leverage=p["leverage"], open_time=p["openTime"],
                       open_rate=p["openRate"], current_rate=p["currentRate"], units=p["units"], invested=p["invested"],
                       pnl=p["pnl"], pnl_pct=p["pnlPercent"], take_profit_rate=p.get("takeProfitRate"))
            put("positions", row)
            if source == "direct":
                pos_by_sym.setdefault(m["symbol"], []).append({k: v for k, v in row.items() if k not in ("snapshot_id", "source", "mirror_id", "symbol")})

        for p in P["direct"]["positions"]: add_pos(p, "direct", None)
        for mi in P["mirrors"]:
            for p in mi["positions"]: add_pos(p, "mirror", mi["mirrorId"])
        for c in S["copiedTraders"]:
            put("copied_traders", dict(snapshot_id=sid, mirror_id=c["mirrorId"], username=c["username"], cid=c["cid"], invested=c["invested"],
                                       value=c["value"], open_pnl=c["openPnl"], open_pnl_pct=c["openPnlPercent"], closed_pnl=c["closedPnl"],
                                       available_cash=c["availableCash"], value_pct=c["valuePercent"], stop_loss_pct=c["stopLossPercentage"]))
        direct_val, copied_val = sum(h["value"] for h in holdings), sum(c["value"] for c in S["copiedTraders"])
        put("snapshots", dict(snapshot_id=sid, taken_at_utc=S["timestamp"][:19] + "Z", etoro_account=S["account"], account_currency=S["accountCurrency"],
                              total_value=total, direct_value=round(direct_val, 2), copied_value=round(copied_val, 2), available_cash=tot["availableCash"],
                              unrealized_pnl=tot["unrealizedPnl"], used_margin=tot["usedMargin"],
                              tipranks_calls_used=(log.get("tipranks_quota") or {}).get("calls_used_after_run"),
                              schema_version=SCHEMA_VERSION, ingested_at_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")))

        for a in assets.values():
            put("tr_summary", dict(snapshot_id=sid, ticker=a["ticker"], company=a.get("companyName"), sector=a.get("sector"), stock_type=a.get("stockType"),
                                   prev_close=a.get("price"), market_cap=a.get("marketCap"), smart_score=a.get("smartScore"),
                                   analyst_consensus=a.get("analystConsensus"), best_analyst_consensus=a.get("bestAnalystConsensus"),
                                   price_target=a.get("priceTarget"), price_target_upside=a.get("priceTargetUpside"), pe_ratio=a.get("peRatio"),
                                   dividend_yield_pct=a.get("dividendYield"), news_sentiment=a.get("newsSentiment"), hedge_funds_score=a.get("hedgeFundsScore"),
                                   insider_score=a.get("insiderScore"), ytd_gain_pct=a.get("ytdGainPct"), yearly_gain_pct=a.get("yearlyGainPct"),
                                   next_earnings_date=a.get("nextEarningsDate"), days_until_earnings=a.get("daysUntilEarnings"), url=a.get("url")))
        for q in quotes.values():
            put("tr_quotes", dict(snapshot_id=sid, ticker=q["ticker"], price=q.get("price"), change_amount=q.get("change_amount"),
                                  change_percent=q.get("change_percent"), open=q.get("open"), high=q.get("high"), low=q.get("low"), volume=q.get("volume"),
                                  last_close=q.get("last_close"), market_cap=q.get("market_cap"), currency=q.get("currency"), exchange=q.get("exchange"),
                                  last_trade_utc=q.get("last_trade_date"), after_hours_price=(q.get("pre_post_market") or {}).get("price")))
        for a in ai.values():
            c = a.get("consensus") or {}; lo, hi = c.get("score_low") or {}, c.get("score_high") or {}
            put("tr_ai", dict(snapshot_id=sid, ticker=a["ticker"], ai_score=a.get("ai_score"), rating=a.get("rating"), headline_model=a.get("headline_model"),
                              price=a.get("price"), currency=a.get("currency"), price_target=a.get("price_target"), upside_pct=a.get("upside_pct"),
                              as_of=a.get("as_of"), models=c.get("models"), avg_score=c.get("avg_score"), score_low_provider=lo.get("provider"),
                              score_low=lo.get("score"), score_high_provider=hi.get("provider"), score_high=hi.get("score"),
                              avg_price_target=c.get("avg_price_target"), avg_upside_pct=c.get("avg_upside_pct"), ratings_split=jd(c.get("ratings_split"))))
        for b in bb.values():
            for i, kp in enumerate(b.get("key_points", [])):
                put("tr_key_points", dict(snapshot_id=sid, ticker=b["ticker"], seq=i, sentiment=kp.get("sentiment"), topic=kp.get("topic"),
                                          point=kp.get("point"), updated_on=b.get("updatedOn")))
        for tk, p in per.items():
            for x in p.get("ratings", []):
                put("tr_ratings", dict(snapshot_id=sid, ticker=tk, rating_date=mdy(x.get("recommendationDate")), analyst=x.get("analystName"),
                                       firm=(x.get("firmName") or "").strip(), rating=x.get("recommendation"), action=x.get("analystAction"),
                                       price_target=x.get("priceTarget"), pt_currency=x.get("priceTargetCurrencyCode"), analyst_stars=x.get("numOfStars"),
                                       analyst_rank=x.get("analystRank"), analyst_success_rate=x.get("successRate"), analyst_excess_return=x.get("excessReturn"),
                                       stock_success_rate=x.get("stockSuccessRate"), stock_avg_return=x.get("stockAvgReturn"), expert_uid=x.get("expertUID"),
                                       article_title=x.get("articleTitle"), url=x.get("url")))
            if "earn" in p:
                e = p["earn"]
                for nxt, q in [(0, q) for q in e["quarters"]] + ([(1, e["next_quarter"])] if e.get("next_quarter") else []):
                    put("tr_earnings", dict(snapshot_id=sid, ticker=tk, period=q["period"], is_next=nxt, report_date=q.get("report_date"), actual_eps=q.get("actual_eps"),
                                            estimate_eps=q.get("estimate_eps"), eps_surprise_pct=q.get("eps_surprise_pct"), actual_revenue=q.get("actual_revenue"),
                                            estimate_revenue=q.get("estimate_revenue"), revenue_surprise_pct=q.get("revenue_surprise_pct"), price_reaction_pct=q.get("price_reaction_pct")))
            if "fin" in p:
                for f in p["fin"]["periods"]:
                    put("tr_financials", dict(snapshot_id=sid, ticker=tk, period_type=p["fin"]["period_type"], period_end=f["period_end"], fiscal_year=f.get("fiscal_year"),
                                              currency=p["fin"].get("currency"), revenue=f.get("revenue"), gross_profit=f.get("gross_profit"), operating_income=f.get("operating_income"),
                                              ebitda=f.get("ebitda"), net_income=f.get("net_income"), eps_diluted=f.get("eps_diluted"), operating_cash_flow=f.get("operating_cash_flow"),
                                              free_cash_flow=f.get("free_cash_flow"), capital_expenditure=f.get("capital_expenditure"), total_assets=f.get("total_assets"),
                                              total_equity=f.get("total_equity"), total_debt=f.get("total_debt"), cash_and_st_investments=f.get("cash_and_short_term_investments"),
                                              net_debt=f.get("net_debt"), gross_margin_pct=f.get("gross_margin_pct"), operating_margin_pct=f.get("operating_margin_pct"),
                                              net_margin_pct=f.get("net_margin_pct"), research_and_development=f.get("research_and_development"),
                                              dividends_paid=f.get("dividends_paid"), buybacks=f.get("buybacks")))
            if "call" in p:
                c = p["call"]
                put("tr_call_summary", dict(snapshot_id=sid, ticker=tk, fiscal_year=c.get("fiscal_year"), fiscal_quarter=c.get("fiscal_quarter"),
                                            sentiment=(c.get("sentiment") or {}).get("label"), sentiment_summary=(c.get("sentiment") or {}).get("summary"), guidance=c.get("guidance")))
                for kind, key in (("highlight", "highlights"), ("lowlight", "lowlights")):
                    for i, pt in enumerate(c.get(key, [])):
                        put("tr_call_points", dict(snapshot_id=sid, ticker=tk, kind=kind, seq=i, title=pt.get("title"), content=pt.get("content")))
        for tf, m in tech.items():
            for t in m.values():
                s, rsi, macd, adx = tech_parts(t)
                put("tr_technicals", dict(snapshot_id=sid, ticker=t["ticker"], timeframe=tf, as_of=t.get("date"), summary_buy=(s.get("summaryScore") or {}).get("buy"),
                                          summary_neutral=(s.get("summaryScore") or {}).get("neutral"), summary_sell=(s.get("summaryScore") or {}).get("sell"),
                                          summary_signal=(s.get("summaryScore") or {}).get("scoreScale"), osc_signal=(s.get("oscillatorsScore") or {}).get("scoreScale"),
                                          ma_signal=(s.get("movingAveragesScore") or {}).get("scoreScale"), rsi14=rsi["value"], rsi14_signal=rsi["signal"], macd=macd["value"],
                                          macd_signal=macd["signal"], adx14=adx["value"], adx14_signal=adx["signal"], raw_json=jd(t)))
        for n in news:
            put("tr_news", dict(snapshot_id=sid, ticker=n["ticker"], published=n.get("publishTime"), title=n.get("title"), sentiment=n.get("sentiment"), site=n.get("siteName"), url=n.get("url")))
        for c in cats.values():
            put("tr_catalysts", dict(snapshot_id=sid, ticker=c["ticker"], summary=c.get("summary"), sentiment=c.get("sentiment"), updated=c.get("updated")))
        for tk in assets:
            for e in events_for(tk):
                put("tr_events", dict(snapshot_id=sid, ticker=tk, event_type=e["type"], event_date=e.get("ex_date") or e.get("date"), pay_date=e.get("pay_date"),
                                      amount=e.get("amount"), eps_estimate=e.get("eps_estimate"), eps_last_year=e.get("eps_last_year"), period_ending=e.get("period_ending")))
        for w in warns:
            put("tr_warnings", dict(snapshot_id=sid, ticker=w["ticker"], warning_date=day(w.get("date")), warning_type_id=w.get("warningTypeID"),
                                    warning_subtype_id=w.get("warningSubTypeID"), fields_json=jd(w.get("fieldsDict"))))
        inv = {v.get("tipranks"): k for k, v in smap.items() if isinstance(v, dict) and v.get("asset_class") == "crypto"}
        for c in crypto:
            put("tr_crypto", dict(snapshot_id=sid, symbol=c["symbol"], etoro_symbol=inv.get(c["symbol"]), name=c.get("name"), price=c.get("price"), change=c.get("change"),
                                  change_pct=c.get("changePercentage"), volume=c.get("volume")))
        if comm:
            put("tr_market_commentary", dict(snapshot_id=sid, overall_sentiment=comm.get("overallSentiment"), atmosphere=comm.get("atmosphere"), key_themes=jd(comm.get("keyThemes")),
                                             tailwinds=jd(comm.get("tailwinds")), headwinds=jd(comm.get("headwinds")), generated_at=comm.get("generatedAt")))
        for s in sectors:
            put("tr_sectors", dict(snapshot_id=sid, sector=s["sector"], avg_pe=s.get("avgPE"), avg_upside_pct=s.get("avgUpside"), stock_count=s.get("stockCount"),
                                   buy_ratings=s.get("buyRatings"), total_ratings=s.get("totalRatings"), buy_pct=s.get("buyPct"), avg_yield_pct=s.get("avgYield")))
        for x in (econ or {}).get("economicCalendar", []):
            put("tr_econ_calendar", dict(snapshot_id=sid, event_time=x.get("time"), country=x.get("country"), event=x.get("event"), impact=x.get("impact"),
                                         actual=x.get("actual"), estimate=x.get("estimate"), prev=x.get("prev"), unit=(x.get("unit") or "").strip() or None))
        parse_errors = 0
        for f in sorted(raw.rglob("*.json")):
            parts = f.relative_to(raw).parts; text = f.read_text(encoding="utf-8")
            try: json.loads(text)
            except ValueError: parse_errors += 1
            put("raw_responses", dict(snapshot_id=sid, rel_path=f.relative_to(snap).as_posix(), source=parts[0], tool=TOOLS.get(f.stem, f.stem),
                                      ticker=parts[2].replace("_", ":", 1) if len(parts) == 4 else None, bytes=f.stat().st_size, sha256=sha(f), payload=text))
    # ---- enriched JSON / CSV / manifest ----------------------------------------------------------------------------
    def tr_block(tk, klass):
        if klass == "crypto":
            c = next((x for x in crypto if x["symbol"] == tk), None)
            return {"ticker": tk, "quote": c} if c else {"ticker": tk}
        p, blk = per.get(tk, {}), {"ticker": tk}
        if tk in assets: blk["summary"] = assets[tk]
        if tk in quotes: blk["quote"] = quotes[tk]
        if tk in ai: blk["ai_analysis"] = ai[tk]
        if tk in bb: blk["bull_bear"] = {"updated_on": bb[tk]["updatedOn"], "bullish": bb[tk]["bullish"], "bearish": bb[tk]["bearish"], "key_points": bb[tk]["key_points"]}
        if "ratings" in p:
            rows = sorted(p["ratings"], key=lambda x: mdy(x.get("recommendationDate")) or "", reverse=True)
            blk["analyst_ratings"] = {"stats": analyst_stats(p["ratings"]), "rows": [rating_row(x) for x in rows]}
        tc = {}
        for tf, m in tech.items():
            if tk in m:
                s, rsi, macd, adx = tech_parts(m[tk]); tc[tf] = {"as_of": m[tk].get("date"), "scores": s, "rsi14": rsi, "macd": macd, "adx14": adx}
        if tc: blk["technicals"] = tc
        nw = [{"published": n.get("publishTime"), "title": n.get("title"), "sentiment": n.get("sentiment"), "site": n.get("siteName"), "url": n.get("url")} for n in news if n["ticker"] == tk]
        if nw: blk["news"] = nw
        if tk in cats: blk["catalyst"] = cats[tk]
        if events_for(tk): blk["events"] = events_for(tk)
        if [w for w in warns if w["ticker"] == tk]: blk["warnings"] = [w for w in warns if w["ticker"] == tk]
        for kind, name in (("earn", "earnings_history"), ("fin", "financials_annual"), ("call", "earnings_call_summary")):
            if kind in p: blk[name] = p[kind]
        return blk

    enriched = []
    for h in holdings:
        mp = smap.get(h["etoro_symbol"], {}); blk = tr_block(h["tipranks_ticker"], h["asset_class"])
        last, pt = (blk.get("quote") or {}).get("price"), (blk.get("summary") or {}).get("priceTarget")
        enriched.append({
            "etoro": {**{k: h[k] for k in ("etoro_symbol", "instrument_id", "name", "asset_class", "weight_pct", "invested", "value", "pnl", "pnl_pct",
                                          "units", "avg_open_rate", "current_rate", "position_count")}, "positions": pos_by_sym.get(h["etoro_symbol"], [])},
            "mapping": {"tipranks_ticker": h["tipranks_ticker"], **{k: v for k, v in mp.items() if k in ("confidence", "note", "related")}},
            "tipranks": blk, "tipranks_related": [tr_block(r, "stock") for r in mp.get("related", [])] or None,
            "derived": {"tipranks_last_price": last, "avg_price_target": pt, "avg_target_upside_pct": round((pt / last - 1) * 100, 2) if pt and last else None}})
    by_class, by_sector = Counter(), Counter()
    for h in holdings:
        by_class[h["asset_class"]] += h["value"]
        by_sector[(assets.get(h["tipranks_ticker"]) or {}).get("sector") or ("Crypto" if h["asset_class"] == "crypto" else "Unknown")] += h["value"]
    pct = lambda d: {k: {"usd": round(v, 2), "pct_of_account": round(v / total * 100, 2)} for k, v in sorted(d.items(), key=lambda kv: -kv[1])}
    alloc = {"by_asset_class": pct({**by_class, "copy_trading_portfolios": copied_val, "cash": tot["availableCash"]}), "by_sector_direct_holdings": pct(by_sector)}
    doc = {"schema_version": SCHEMA_VERSION, "snapshot_id": sid, "taken_at_utc": S["timestamp"][:19] + "Z",
           "account": {"type": S["account"], "currency": S["accountCurrency"], **tot, "direct_holdings_value": round(direct_val, 2), "copy_trading_value": round(copied_val, 2)},
           "allocation": alloc, "copied_traders": S["copiedTraders"], "pending_orders": S.get("pendingOrders", []), "holdings": enriched,
           "market_context": {"commentary": comm, "sectors": sectors, "economic_calendar": econ},
           "notes": ["TipRanks 'summary.price' and priceTargetUpside are based on the previous close; 'quote.price' is the latest regular-session close.",
                     "Non-USD tickers (DE:SHL, FR:ETL) are in EUR on the TipRanks side; eToro values are in USD."] + (log.get("known_gaps") or [])}
    (snap / "enriched_portfolio.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")

    def csv_row(e):
        et_, b = e["etoro"], e["tipranks"]; s, st = b.get("summary") or {}, (b.get("analyst_ratings") or {}).get("stats") or {}
        a, bbp, t = b.get("ai_analysis") or {}, b.get("bull_bear") or {}, b.get("technicals") or {}
        sig = lambda tf: (((t.get(tf) or {}).get("scores") or {}).get("summaryScore") or {}).get("scoreScale")
        return {"etoro_symbol": et_["etoro_symbol"], "name": et_["name"], "asset_class": et_["asset_class"], "weight_pct": round(et_["weight_pct"], 2),
                "value_usd": et_["value"], "invested_usd": et_["invested"], "pnl_usd": et_["pnl"], "pnl_pct": et_["pnl_pct"], "units": et_["units"],
                "avg_open_rate": et_["avg_open_rate"], "etoro_rate": et_["current_rate"], "tipranks_ticker": b["ticker"], "smart_score": s.get("smartScore"),
                "analyst_consensus": s.get("analystConsensus"), "best_analyst_consensus": s.get("bestAnalystConsensus"), "avg_price_target": e["derived"]["avg_price_target"],
                "tipranks_last_price": e["derived"]["tipranks_last_price"], "target_upside_pct": e["derived"]["avg_target_upside_pct"], "analysts_buy": st.get("buy"),
                "analysts_hold": st.get("hold"), "analysts_sell": st.get("sell"), "analyst_pt_median": st.get("pt_median"), "ai_score": a.get("ai_score"),
                "ai_rating": a.get("rating"), "news_sentiment": s.get("newsSentiment"), "hedge_funds_score": s.get("hedgeFundsScore"), "insider_score": s.get("insiderScore"),
                "pe_ratio": s.get("peRatio"), "dividend_yield_pct": s.get("dividendYield"), "ytd_gain_pct": s.get("ytdGainPct"), "yearly_gain_pct": s.get("yearlyGainPct"),
                "next_earnings_date": s.get("nextEarningsDate"), "tech_day": sig("day"), "tech_week": sig("week"),
                "bullish_points": " | ".join(bbp.get("bullish", [])), "bearish_points": " | ".join(bbp.get("bearish", []))}

    rows = [csv_row(e) for e in enriched]
    with open(snap / "holdings_enriched.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    agg = {}
    for p in P["direct"]["positions"]:
        a = agg.setdefault(p["market"]["symbol"], [0.0, 0.0, 0.0, 0]); a[0] += p["invested"]; a[1] += p["units"]; a[2] += p["pnl"]; a[3] += 1
    mism = [h["etoro_symbol"] for h in holdings if h["etoro_symbol"] not in agg or abs(agg[h["etoro_symbol"]][0] - h["invested"]) > 0.1
            or abs(agg[h["etoro_symbol"]][2] - h["pnl"]) > 0.1 or agg[h["etoro_symbol"]][3] != h["position_count"]]
    fin_quirks = [f"{tk} FY{f['fiscal_year']}: {k}" for tk, p in per.items() for f in (p.get("fin") or {}).get("periods", [])
                  for k, ok in (("gross_profit", f["gross_profit"] == f["revenue"] - f["cost_of_revenue"]), ("free_cash_flow", f["free_cash_flow"] == f["operating_cash_flow"] + f["capital_expenditure"]),
                                ("gross_margin_pct", abs(f["gross_margin_pct"] - f["gross_profit"] / f["revenue"] * 100) < 0.011),
                                ("debt_to_equity_ratio", abs(f["debt_to_equity_ratio"] - f["total_debt"] / f["total_equity"]) < 0.0021)) if not ok]
    chk = {"etoro_totals_reconcile": bool(abs(direct_val + copied_val + tot["availableCash"] - total) < 0.05
                                          and abs(sum(h["pnl"] for h in holdings) + sum(c["openPnl"] for c in S["copiedTraders"]) - tot["unrealizedPnl"]) < 0.05),
           "balances_total_matches_summary": bool(B and abs(B["balances"]["totalBalance"] - total) < 0.01),
           "summary_vs_positions_mismatches": mism, "tipranks_price_mismatches_assets_vs_ai_vs_quotes": [t for t in assets if t in ai and t in quotes and not (assets[t]["price"] == ai[t]["price"] == quotes[t]["last_close"])],
           "raw_json_parse_errors": parse_errors, "financials_identity_exceptions_in_source_data": fin_quirks}
    counts = {t: con.execute(f"SELECT COUNT(*) FROM {t} WHERE snapshot_id = ?", (sid,)).fetchone()[0] for t in SNAP_TABLES}
    files = [{"path": f.relative_to(snap).as_posix(), "bytes": f.stat().st_size, "sha256": sha(f)} for f in sorted(snap.rglob("*")) if f.is_file() and f.name != "manifest.json"]
    manifest = {"schema_version": SCHEMA_VERSION, "snapshot_id": sid, "taken_at_utc": doc["taken_at_utc"], "ingested_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "sources": {"etoro": "https://mcp.public-api.etoro.com (real account)", "tipranks": "https://mcp.tipranks.com/ (free tier)"}, "privacy": log.get("privacy"),
                "tipranks_quota": log.get("tipranks_quota"), "calls": log.get("calls"), "known_gaps": log.get("known_gaps"), "checks": chk, "row_counts": counts,
                "symbol_map": smap, "layout": LAYOUT, "files": files}
    (snap / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    (ROOT / "latest").mkdir(exist_ok=True)
    for n in ("enriched_portfolio.json", "holdings_enriched.csv"): shutil.copyfile(snap / n, ROOT / "latest" / n)
    (ROOT / "latest" / "SNAPSHOT_ID.txt").write_text(sid + "\n", encoding="utf-8")
    con.close()
    print(f"snapshot {sid}: {len(holdings)} holdings, {counts['positions']} positions, {counts['tr_ratings']} analyst ratings, {counts['raw_responses']} raw payloads")
    print("checks:", json.dumps({k: v for k, v in chk.items() if k != 'financials_identity_exceptions_in_source_data'}))
    print("source-data quirks (not errors):", chk["financials_identity_exceptions_in_source_data"])


if __name__ == "__main__":
    main()

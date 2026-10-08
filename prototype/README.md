# Python prototype

A working local prototype of Portfolio Signals, built before the planned .NET and React Native stack. It reads an eToro portfolio and TipRanks analyst data, joins them, scores every holding with transparent rules, and renders a one-file HTML report (plus a PDF) that answers "hold, watch or review?" for each position.

**This is reference material for the real build, not the product.** Nothing here is production code, and none of it is wired into the architecture described in the [root README](../README.md). It is single-user, runs locally and is written for Windows.

## Contents

| Path | Purpose |
| --- | --- |
| `ingest.py` | Turns one raw snapshot into `portfolio.db` (SQLite), `enriched_portfolio.json`, `holdings_enriched.csv` and a `manifest.json` with checksums and integrity checks. `TOOLS` lists the provider tools a snapshot was fetched with. |
| `schema.sql` | SQLite schema: `holdings`, `positions`, `copied_traders`, one `tr_*` table per TipRanks data set, `raw_responses`, and the `v_holdings_enriched` view. |
| `symbol_map.json` | eToro symbol to TipRanks ticker and asset class, with notes on edge cases. |
| `report/analysis.py` | The scoring: six signals, composite score, tier, verdict, flags, portfolio KPIs and an earnings calendar. Writes `reports/<id>/analysis.json`. |
| `report/build_report.py`, `sec_a.py`, `sec_b.py`, `sec_c.py`, `svgkit.py`, `fmt.py`, `style.css`, `app.js` | Build the self-contained HTML report: inline SVG charts, no network requests, sortable and filterable holdings table, a toggle that hides amounts, print styles. |
| `report/export_pdf.py` | Prints the HTML to an A4 landscape PDF with headless Edge or Chrome. |
| `PRODUCT.md` | Product and design record written while designing the report. It describes this prototype's single-owner report, not the planned multi-user app. |

## How a run works

1. Raw eToro and TipRanks responses are saved verbatim under `snapshots/<id>/raw/`. This was done interactively through the eToro and TipRanks MCP tools, so there is no fetch script here; the planned adapters replace this step.
2. `ingest.py` normalises them into SQLite, an enriched JSON and a CSV.
3. `report/analysis.py` scores each holding and writes `analysis.json`.
4. `report/build_report.py` renders `portfolio_report.html`, and `report/export_pdf.py` prints it to PDF.

## Running it

Requires Python 3.12 or newer for the f-string syntax used (developed on 3.14), standard library only. The PDF step needs Microsoft Edge or Google Chrome. A snapshot under `snapshots/<id>/raw/` is also needed; it is not in this repository (see below).

```powershell
python ingest.py <SNAPSHOT_ID>
python report\analysis.py <SNAPSHOT_ID>
python report\build_report.py <SNAPSHOT_ID>
python report\export_pdf.py <SNAPSHOT_ID>
```

`<SNAPSHOT_ID>` is the folder name under `snapshots/`, for example `20260930T203652Z`. It is optional; each script picks the newest folder when it is omitted. Output goes to `reports/<id>/` and is copied to `latest/`.

## Scoring in brief

`report/analysis.py` is the source of truth. Six signals are each scaled to -1..+1 and averaged over those that are available (missing data is skipped, never scored as zero), then multiplied by 100.

| Signal | Scaling |
| --- | --- |
| Analyst consensus | Strong Buy +1, Buy +0.5, Neutral 0, Sell -0.5, Strong Sell -1 |
| Target upside | Average analyst target against the latest close; ±30% maps to ±1; needs at least 3 targets |
| Smart Score | (score - 5.5) / 4.5 |
| AI models | (score - 60) / 25, clipped to ±1 |
| Technical trend | Average of the TipRanks day and week summary signals on the consensus scale |
| Analyst breadth | (Buy - Sell) / analysts over 12 months; needs at least 5 analysts |

Tiers: Strong (60 and up), Supported (35 to 59), Mixed (10 to 34), Weak (below 10).

Verdicts: Strong is Hold (marked "review size" above 25% of the account). Supported is Hold, or Watch with two or more warning flags or a price at its average target. Mixed is Watch, or Review with three or more warning flags. Weak is Review. Crypto has no TipRanks coverage and is No data. Review means look again, not sell.

The weights are equal by design and have not been tested for predictive power. Verdicts are informational and are not investment advice.

## Notes for the provider adapters

What the prototype learned about the two data sources:

- **eToro:** the portfolio came from the eToro MCP tools `get-my-portfolio-summary`, `get-my-positions-and-orders` and `get-my-balances`. The profile tool also returns personal data (name, date of birth); the prototype used it only to verify scopes and stored nothing from it.
- **TipRanks quota:** the free plan allows 50 tool calls a month and 10 a minute (above that you get HTTP 429, which is not counted). One snapshot of 18 holdings used 47 of the 50 calls: batch tools for assets data, bull/bear points, AI analysis, quotes, technicals (day and week), news, catalysts, events and warnings; per-ticker analyst ratings; and a deeper dive (financials, earnings history, earnings-call summary) for the five largest holdings only.
- **TipRanks portfolios could not be used:** the TipRanks MCP server only reads data, and its portfolio tools needed a scope the token did not have, so eToro holdings could not be loaded into a TipRanks portfolio. Relevant to the planned "TipRanks portfolio check".
- **Symbols:** non-US listings use `CC:TICKER` (`DE:SHL`, `FR:ETL`) and crypto uses `XXXUSD`. A share class without coverage can fall back to its sibling line (`ATROB` to `ATRO`). `SGBUSD` resolves to "SubGame" rather than Songbird, so crypto mappings need verification.
- **Crypto** has no TipRanks ratings, Smart Score or AI score.
- **Quirks:** `get_assets_news` `count` is a total across tickers, not per ticker. `get_economic_calendar` returns past events first by default, so pass explicit dates. Technical signals contain the misspelling `StongSell`. `get_assets_data` `price` is the previous close, while the quote price is the latest close.

## Known limitations

- The opening headline, the four case files (MSFT, NET, IBM, VOD) and the housekeeping notes are written by hand for the 2026-09-30 snapshot and name specific tickers. `build_report.py` prints a warning when new data no longer fits that text. A product should generate this text from the rules.
- Equal-weight scoring is a starting point, not a validated model.
- Windows-oriented: browser paths in `export_pdf.py` and backslash paths in the examples.

## Data is not in this repository

`snapshots/`, `reports/`, `latest/` and `portfolio.db` are git-ignored on purpose. They hold the owner's real positions and balances and third-party TipRanks content that should not be redistributed from a public repository. Keep them local or in a private location. The code uses no credentials: the MCP connections carry their own, and, as the root README requires, secrets are never committed.

## Possible mapping to the planned stack

Suggestions for the later build, not commitments.

| Prototype | Planned counterpart |
| --- | --- |
| `ingest.py`, `schema.sql` | Shape of the portfolio and signal documents; contracts for the eToro and TipRanks adapters |
| `symbol_map.json` | Symbol-resolution rules, ideally a verified mapping per instrument |
| `report/analysis.py` | A domain service in C#; the `analysis.json` of a fixed snapshot can seed golden-file tests |
| `report/` HTML, CSS and charts | Visual and copy reference for the React Native screens: verdict strip, range-bar signal cells, per-holding detail |

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inferred from the root README and `prototype/PRODUCT.md`; no interview was held for this record.

Private investors who hold an eToro portfolio and want to know whether each holding deserves to be held, watched or reviewed. They read alone and carefully, mostly in a desktop browser, and open the same account on an Android phone. Each user brings their own eToro and TipRanks API credentials. Sharing with others and presenting live were offered and declined in the prototype.

## Product Purpose

Portfolio Signals joins a user's eToro portfolio to TipRanks analyst data and scores every holding with transparent, documented rules, so that in a few minutes the user sees what the data supports, what it does not cover and which positions deserve attention. The backend synchronises on a schedule set by the user's plan and the app shows the last successful sync, delays, rate limits and unavailable provider data plainly. Users stay in control of every investment decision.

## Positioning

Not a market-data terminal and not advice. A verdict sheet for the user's own positions: weights and cost come from eToro, signals from TipRanks, and the verdict from rules the user can read in the Method page.

## Operating Context

- Backend: .NET REST API under `/api/v1` (OpenAPI at `/openapi/v1.json`) with JWT sign-in from an OpenID Connect provider; background sync with per-plan intervals; manual sync at most once per connection every 15 minutes.
- Providers: eToro public API and the TipRanks MCP server, both called with the user's own keys. Credentials are write-only: they are never returned, logged or shown again.
- TipRanks free plans allow about 50 tool calls a month and 10 a minute, which is why data can lag and why syncs can be rate limited.

## Capabilities and Constraints

- One React Native (Expo) codebase for web and Android now, iOS later; Material 3 through React Native Paper, themed with this product's tokens.
- Verdicts are Hold, Hold with review of size, Watch, Review and No data. Review means look again, not sell. Crypto has no TipRanks coverage and is No data.
- Not available from the API yet and not to be faked: bull and bear case, latest catalyst, deep fundamentals, macro calendar, dividends, rebalancing suggestions, trading.
- Plans control sync frequency; no plan guarantees real-time data. Plan changes and billing do not exist yet.
- Undecided: identity provider and tenant, brand name and logo beyond the working title, dark theme, iOS timing.

## Brand Commitments

Working name "Portfolio Signals". Plain, factual voice with no hype; every verdict is informational and never advice. The README's opening line is the product's answer: "Analysts back every position that matters. What is left to decide is size and price."

## Evidence on Hand

- `prototype/` is the design reference: `report/style.css` and `report/app.js` (wireframe and structure), `report/sec_a.py`, `sec_b.py`, `sec_c.py`, `svgkit.py` (markup, copy, charts), `PRODUCT.md`, `README.md`.
- `backend/` and its published OpenAPI document are the contract (`frontend/openapi/v1.json`).
- Absent and not to be fabricated: real positions and balances (git-ignored on purpose in the prototype), TipRanks content, a demo account, brand assets, an identity provider tenant. The in-app demo uses fictional companies and invented numbers and says so.

## Product Principles

1. Every number traces to saved data; say what is missing rather than fill it.
2. Keep what analysts say separate from the risks the data cannot see: position size, taxes, time horizon, other assets.
3. Lead with the answer (hold, watch, review), then let the reader verify it.
4. Weight matters: a verdict on a 0.03% position is housekeeping, not a decision.
5. Be plain about freshness: show when data was last synced and why it may be late.

## Accessibility & Inclusion

WCAG AA contrast, meaning never carried by colour alone (every verdict has a glyph and a word), keyboard-usable on the web, 48 dp touch targets on Android, text that follows the system font size, reduced motion respected. Established by the prototype as assumed defaults, not confirmed by the owner.

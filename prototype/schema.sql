-- portfolio.db schema v1. One row-set per snapshot_id; re-ingesting a snapshot replaces its rows.
CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_id TEXT PRIMARY KEY, taken_at_utc TEXT, etoro_account TEXT, account_currency TEXT,
  total_value REAL, direct_value REAL, copied_value REAL, available_cash REAL, unrealized_pnl REAL,
  used_margin REAL, tipranks_calls_used INTEGER, schema_version INTEGER, ingested_at_utc TEXT);
CREATE TABLE IF NOT EXISTS holdings (
  snapshot_id TEXT, instrument_id INTEGER, etoro_symbol TEXT, name TEXT, asset_class TEXT, tipranks_ticker TEXT,
  invested REAL, value REAL, pnl REAL, pnl_pct REAL, units REAL, avg_open_rate REAL, current_rate REAL,
  avg_leverage REAL, exposure REAL, position_count INTEGER, weight_pct REAL,
  PRIMARY KEY (snapshot_id, instrument_id));
CREATE TABLE IF NOT EXISTS positions (
  snapshot_id TEXT, position_id INTEGER, source TEXT, mirror_id INTEGER, instrument_id INTEGER, symbol TEXT,
  direction TEXT, leverage REAL, open_time TEXT, open_rate REAL, current_rate REAL, units REAL, invested REAL,
  pnl REAL, pnl_pct REAL, take_profit_rate REAL, PRIMARY KEY (snapshot_id, position_id));
CREATE TABLE IF NOT EXISTS copied_traders (
  snapshot_id TEXT, mirror_id INTEGER, username TEXT, cid INTEGER, invested REAL, value REAL, open_pnl REAL,
  open_pnl_pct REAL, closed_pnl REAL, available_cash REAL, value_pct REAL, stop_loss_pct REAL,
  PRIMARY KEY (snapshot_id, mirror_id));
CREATE TABLE IF NOT EXISTS tr_summary (
  snapshot_id TEXT, ticker TEXT, company TEXT, sector TEXT, stock_type TEXT, prev_close REAL, market_cap REAL,
  smart_score INTEGER, analyst_consensus TEXT, best_analyst_consensus TEXT, price_target REAL,
  price_target_upside REAL, pe_ratio REAL, dividend_yield_pct REAL, news_sentiment REAL, hedge_funds_score REAL,
  insider_score REAL, ytd_gain_pct REAL, yearly_gain_pct REAL, next_earnings_date TEXT, days_until_earnings INTEGER,
  url TEXT, PRIMARY KEY (snapshot_id, ticker));
CREATE TABLE IF NOT EXISTS tr_quotes (
  snapshot_id TEXT, ticker TEXT, price REAL, change_amount REAL, change_percent REAL, open REAL, high REAL, low REAL,
  volume REAL, last_close REAL, market_cap REAL, currency TEXT, exchange TEXT, last_trade_utc TEXT,
  after_hours_price REAL, PRIMARY KEY (snapshot_id, ticker));
CREATE TABLE IF NOT EXISTS tr_ai (
  snapshot_id TEXT, ticker TEXT, ai_score REAL, rating TEXT, headline_model TEXT, price REAL, currency TEXT,
  price_target REAL, upside_pct REAL, as_of TEXT, models INTEGER, avg_score REAL, score_low_provider TEXT,
  score_low REAL, score_high_provider TEXT, score_high REAL, avg_price_target REAL, avg_upside_pct REAL,
  ratings_split TEXT, PRIMARY KEY (snapshot_id, ticker));
CREATE TABLE IF NOT EXISTS tr_key_points (
  snapshot_id TEXT, ticker TEXT, seq INTEGER, sentiment TEXT, topic TEXT, point TEXT, updated_on TEXT,
  PRIMARY KEY (snapshot_id, ticker, seq));
CREATE TABLE IF NOT EXISTS tr_ratings (
  snapshot_id TEXT, ticker TEXT, rating_date TEXT, analyst TEXT, firm TEXT, rating TEXT, action TEXT,
  price_target REAL, pt_currency TEXT, analyst_stars REAL, analyst_rank INTEGER, analyst_success_rate REAL,
  analyst_excess_return REAL, stock_success_rate REAL, stock_avg_return REAL, expert_uid TEXT,
  article_title TEXT, url TEXT);
CREATE INDEX IF NOT EXISTS ix_tr_ratings ON tr_ratings (snapshot_id, ticker);
CREATE TABLE IF NOT EXISTS tr_technicals (
  snapshot_id TEXT, ticker TEXT, timeframe TEXT, as_of TEXT, summary_buy INTEGER, summary_neutral INTEGER,
  summary_sell INTEGER, summary_signal TEXT, osc_signal TEXT, ma_signal TEXT, rsi14 REAL, rsi14_signal TEXT,
  macd REAL, macd_signal TEXT, adx14 REAL, adx14_signal TEXT, raw_json TEXT,
  PRIMARY KEY (snapshot_id, ticker, timeframe));
CREATE TABLE IF NOT EXISTS tr_news (
  snapshot_id TEXT, ticker TEXT, published TEXT, title TEXT, sentiment TEXT, site TEXT, url TEXT);
CREATE INDEX IF NOT EXISTS ix_tr_news ON tr_news (snapshot_id, ticker);
CREATE TABLE IF NOT EXISTS tr_catalysts (
  snapshot_id TEXT, ticker TEXT, summary TEXT, sentiment TEXT, updated TEXT, PRIMARY KEY (snapshot_id, ticker));
CREATE TABLE IF NOT EXISTS tr_events (
  snapshot_id TEXT, ticker TEXT, event_type TEXT, event_date TEXT, pay_date TEXT, amount REAL, eps_estimate REAL,
  eps_last_year REAL, period_ending TEXT);
CREATE TABLE IF NOT EXISTS tr_warnings (
  snapshot_id TEXT, ticker TEXT, warning_date TEXT, warning_type_id INTEGER, warning_subtype_id INTEGER,
  fields_json TEXT);
CREATE TABLE IF NOT EXISTS tr_earnings (
  snapshot_id TEXT, ticker TEXT, period TEXT, is_next INTEGER, report_date TEXT, actual_eps REAL, estimate_eps REAL,
  eps_surprise_pct REAL, actual_revenue REAL, estimate_revenue REAL, revenue_surprise_pct REAL,
  price_reaction_pct REAL, PRIMARY KEY (snapshot_id, ticker, period));
CREATE TABLE IF NOT EXISTS tr_financials (
  snapshot_id TEXT, ticker TEXT, period_type TEXT, period_end TEXT, fiscal_year INTEGER, currency TEXT,
  revenue REAL, gross_profit REAL, operating_income REAL, ebitda REAL, net_income REAL, eps_diluted REAL,
  operating_cash_flow REAL, free_cash_flow REAL, capital_expenditure REAL, total_assets REAL, total_equity REAL,
  total_debt REAL, cash_and_st_investments REAL, net_debt REAL, gross_margin_pct REAL, operating_margin_pct REAL,
  net_margin_pct REAL, research_and_development REAL, dividends_paid REAL, buybacks REAL,
  PRIMARY KEY (snapshot_id, ticker, period_type, period_end));
CREATE TABLE IF NOT EXISTS tr_call_summary (
  snapshot_id TEXT, ticker TEXT, fiscal_year INTEGER, fiscal_quarter INTEGER, sentiment TEXT,
  sentiment_summary TEXT, guidance TEXT, PRIMARY KEY (snapshot_id, ticker));
CREATE TABLE IF NOT EXISTS tr_call_points (
  snapshot_id TEXT, ticker TEXT, kind TEXT, seq INTEGER, title TEXT, content TEXT,
  PRIMARY KEY (snapshot_id, ticker, kind, seq));
CREATE TABLE IF NOT EXISTS tr_crypto (
  snapshot_id TEXT, symbol TEXT, etoro_symbol TEXT, name TEXT, price REAL, change REAL, change_pct REAL,
  volume REAL, PRIMARY KEY (snapshot_id, symbol));
CREATE TABLE IF NOT EXISTS tr_market_commentary (
  snapshot_id TEXT PRIMARY KEY, overall_sentiment TEXT, atmosphere TEXT, key_themes TEXT, tailwinds TEXT,
  headwinds TEXT, generated_at TEXT);
CREATE TABLE IF NOT EXISTS tr_sectors (
  snapshot_id TEXT, sector TEXT, avg_pe REAL, avg_upside_pct REAL, stock_count INTEGER, buy_ratings INTEGER,
  total_ratings INTEGER, buy_pct REAL, avg_yield_pct REAL, PRIMARY KEY (snapshot_id, sector));
CREATE TABLE IF NOT EXISTS tr_econ_calendar (
  snapshot_id TEXT, event_time TEXT, country TEXT, event TEXT, impact TEXT, actual REAL, estimate REAL, prev REAL,
  unit TEXT);
CREATE TABLE IF NOT EXISTS raw_responses (
  snapshot_id TEXT, rel_path TEXT, source TEXT, tool TEXT, ticker TEXT, bytes INTEGER, sha256 TEXT, payload TEXT,
  PRIMARY KEY (snapshot_id, rel_path));
CREATE VIEW IF NOT EXISTS v_holdings_enriched AS
SELECT h.snapshot_id, h.etoro_symbol, h.name, h.asset_class, h.value, h.weight_pct, h.pnl, h.pnl_pct,
       s.smart_score, s.analyst_consensus, s.best_analyst_consensus, s.price_target,
       q.price AS last_price, ROUND((s.price_target / q.price - 1) * 100, 1) AS target_upside_pct,
       a.ai_score, a.rating AS ai_rating, s.next_earnings_date
FROM holdings h
LEFT JOIN tr_summary s ON s.snapshot_id = h.snapshot_id AND s.ticker = h.tipranks_ticker
LEFT JOIN tr_quotes  q ON q.snapshot_id = h.snapshot_id AND q.ticker = h.tipranks_ticker
LEFT JOIN tr_ai      a ON a.snapshot_id = h.snapshot_id AND a.ticker = h.tipranks_ticker;

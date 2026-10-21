# Backend architecture

This document records the architecture decisions for the .NET backend and the domain model behind them. The product direction lives in the [root README](../../README.md); the Python [prototype](../../prototype/README.md) is the reference for the scoring rules and provider behaviour.

## Style: a modular monolith with Clean Architecture

One deployable API plus one Azure Functions app, built from the same libraries. Modules are folders inside the layer projects (Users, Integrations, Sync, Portfolios, Signals, Analysis), not separate deployables, so a module can be split out later without rewriting its boundaries.

```text
Api ─────────┐
Functions ───┤──► Application ──► Domain
Infrastructure ─► Application ──► Domain
```

| Project | Responsibility | Depends on |
| --- | --- | --- |
| `PortfolioSignals.Domain` | Aggregates, value objects, domain services (scoring, symbol resolution). No packages, no I/O. | nothing |
| `PortfolioSignals.Application` | CQRS requests and handlers (FreeMediator), FluentValidation, ports (repositories, provider clients, credential store, queue). | Domain |
| `PortfolioSignals.Infrastructure` | Adapters: Cosmos DB, Key Vault, Storage Queue, eToro API client, TipRanks MCP client, HTTP resilience. | Application |
| `PortfolioSignals.Api` | Thin controllers, authentication, problem details, OpenAPI. | Application, Infrastructure (composition root) |
| `PortfolioSignals.Functions` | Timer and queue triggers for background sync. | Application, Infrastructure (composition root) |

Decisions:

- **CQRS with FreeMediator.** MediatR moved to a commercial licence, so the project uses [FreeMediator](https://github.com/steffenskov/FreeMediator) (MIT), which keeps MediatR's `IRequest`/`IRequestHandler`/`IPipelineBehavior` API. It is a re-implementation, not a fork. Moving to another mediator later means changing the `using` and one registration call.
- **Results over exceptions for expected outcomes.** Handlers return `Result<T>` with an `Error` type (not found, conflict, too many requests); controllers map it to RFC 9457 problem responses. Validation failures and broken domain invariants are exceptions, mapped centrally by `ApiExceptionHandler`.
- **Controllers stay small.** They resolve the current user, build a request, send it and map the result. Application handlers never see HTTP, so the Functions app runs the same handlers.
- **Domain classes are persistence-ignorant.** Cosmos documents are separate records with explicit mapping and a `schemaVersion`; aggregates expose a `Restore` factory that raises no events.
- **No EF Core.** The repositories use the Cosmos SDK directly (see below), which keeps queries partition-aware and avoids hiding Cosmos behaviour behind a relational abstraction.
- **Central package management.** Every dependency and version is declared once in `Directory.Packages.props`; shared compiler settings (nullable, analyzers, warnings as errors) are in `Directory.Build.props`.

## Domain model

Aggregates are small and each is loaded and saved as one document. Aggregates reference each other by identifier only.

| Aggregate root | Identity | Owns | Key behaviour |
| --- | --- | --- | --- |
| `UserAccount` | `UserId` (identity provider subject) | profile, `SubscriptionPlan` | `Register`, `UpdateProfile`, `ChangePlan`; exposes the plan's `SyncPolicy` |
| `ProviderConnection` | user + provider (eToro, TipRanks) | status, last attempt/success, failure, backoff, queue lease | `Connect`, `Reconnect`, `Disconnect`, `RecordSuccess`, `RecordFailure`, `Defer`, `IsDue` |
| `SyncRun` | run id (also the idempotency key) | status, trigger, timings, items, failure | `Request`, `Start`, `Succeed`, `Fail`, `Skip` |
| `PortfolioSnapshot` | timestamp of the eToro data | `AccountSummary`, `Holding`s, `CopiedTrader`s | `Capture` (immutable afterwards), `WeightPct` |
| `InstrumentSignals` | TipRanks ticker, per user | latest `SignalData` (consensus, price target, Smart Score, AI score, breadth, earnings date, ...) | `Create`, `Refresh` |

Domain services and value objects:

- `HoldingScorer` and `PortfolioAnalyzer` port `prototype/report/analysis.py`: six signals scaled to -1..+1, averaged over those available (missing data is skipped, never scored as zero), mapped to a tier (Strong, Supported, Mixed, Weak) and a verdict (Hold, Hold - review size, Watch, Review, No data) with flags such as concentration, priced at target, thin coverage and earnings soon. The analysis is computed on read from the latest snapshot and signals; it is not stored, so there is no stale verdict to invalidate. The weights are equal and untested for predictive power; verdicts are informational, not advice.
- `SymbolResolver` maps eToro symbols to TipRanks tickers (`SHL.DE` to `DE:SHL`, crypto to `LTCUSD`) with explicit overrides for edge cases found in the prototype (share-class fallback `ATROB` to `ATRO`, the unverified `SGB`). Overrides live in `Infrastructure/Providers/symbol-overrides.json`.
- `SyncPolicy` encodes the plan table from the root README (Free weekly, Essential daily, Pro every 6 hours, Premium hourly, subject to provider limits). No plan implies real-time data.

Domain events are recorded on the aggregates (`UserRegistered`, `ProviderConnected`, `PortfolioSnapshotCaptured`, ...) but nothing dispatches them yet; add a dispatcher in the repositories when the first subscriber exists.

## Cosmos DB for NoSQL data model

Two containers, both partitioned by `/userId`. Every user-facing query is a single-partition read, so cost and latency stay predictable and tenants cannot read each other's data by construction.

| Container | Documents (`type`) | Notes |
| --- | --- | --- |
| `accounts` | `user` (id = user id), `connection` (id = provider name) | The scheduler runs one cross-partition query for active connections (`type = 'connection' AND status = 'Active'`); fine at this scale, revisit with a change-feed driven schedule if it grows. |
| `portfolio` | `snapshot` (id = `yyyyMMddTHHmmssZ`), `signals` (id = `signals-<TICKER>`), `syncRun` (id = run id) | A user's snapshot and signals live in one partition, so the analysis needs two single-partition queries. `defaultTimeToLive = -1` enables per-item TTL: snapshots expire after `SnapshotRetentionDays` (365), sync runs after `SyncRunRetentionDays` (90). |

Snapshots embed holdings and copied traders: an eToro portfolio is tens of positions, far below the 2 MB item limit, and is always read whole. Snapshot ids derive from the provider timestamp, so a redelivered sync overwrites the same document (idempotent upsert).

Not done yet: optimistic concurrency with ETags (writers are effectively single per user because syncs are queued per run), and a composite index for `ORDER BY takenAt` (a single-property sort is served by the default index).

## Background synchronization

```text
timer (every 15 min)
  EnqueueDueSyncsFunction ──► EnqueueDueSyncsCommand
        │  for each active connection whose plan interval has elapsed
        ▼
   SyncRun (Queued) + queue message { userId, provider, runId }
        ▼
  ExecuteSyncFunction (queue trigger) ──► ExecuteSyncCommand
        │  load credentials from Key Vault, call the provider, save snapshot or signals
        ▼
   SyncRun (Succeeded | Failed | Skipped) + ProviderConnection health
```

- **Fan-out through a queue.** The timer only decides who is due. Each user's sync is its own message with its own retries, a poison queue after 3 dequeues, and a low concurrency cap (`batchSize` 2) to respect TipRanks' 10 calls a minute.
- **Idempotent and restart-safe.** A finished run is a no-op when its message is redelivered. A run found `Running` after a crash resumes.
- **Per-connection backoff.** Failures set `RetryNotBefore` (exponential, capped at 6 hours, or the provider's `Retry-After`). HTTP 429 is never retried inside the HTTP pipeline; it reaches the workflow so the connection backs off instead of burning quota. Rejected credentials move the connection to `CredentialsRejected` and stop scheduled syncs until the user reconnects.
- **Queue lease.** A connection with a queued sync is not enqueued again for 30 minutes.
- **Manual sync** (`POST /api/v1/sync`) goes through the same queue and is limited to one per connection every 15 minutes.
- **Ordering.** eToro and TipRanks are separate runs. A TipRanks run with no snapshot yet is skipped and retried later rather than failed.
- **Visible delays.** `GET /api/v1/integrations` returns the last successful sync, next due time and last failure; `GET /api/v1/sync/runs` is the history.

## Provider adapters

- **eToro** (`EtoroApiClient`): the public API, using the user's own `x-api-key` and `x-user-key`. It reads `GET /api/v1/trading/info/aggregate-portfolio` (per-instrument totals, account totals, copy-trading mirrors) and `GET /api/v1/market-data/instruments` for symbols and instrument types. Read-only; the trading endpoints are not referenced. `Providers:Etoro:UseDemoAccount` selects the demo endpoints.
- **TipRanks** (`TipRanksClient`): the official MCP server over streamable HTTP with the user's API key as a bearer token, using the `ModelContextProtocol` C# SDK. Calls are batched because the free plan allows 50 a month: one `get_assets_data` for all tickers, `get_ai_stock_analysis` in groups of 25. Per-ticker analyst ratings (`get_recent_analyst_ratings`, which feed analyst breadth and target spread) cost one call per ticker and are off by default (`Providers:TipRanks:IncludeAnalystRatings`). Technical signals are not fetched yet; the scorer skips that signal.
- Both adapters translate failures to `ProviderException` with a `SyncFailureKind` (unauthorized, rate limited, unavailable, invalid response), so the application never depends on the transport.

## Credentials and security

- Provider credentials are write-only through `PUT /api/v1/integrations/{provider}`. They are stored in Azure Key Vault, one secret per user and provider, named from a hash of the user id (no personal data in the name), and read only by the sync workflow. They are never stored in Cosmos DB, returned by the API, or logged (`ProviderCredentials.ToString` is redacted).
- Authentication is delegated to an OpenID Connect provider (for example Microsoft Entra External ID): the API validates JWT bearer tokens and uses the `oid`/`sub` claim as the user id. Every endpoint except `/health/live` and `/openapi/v1.json` requires an authenticated user; there is no way to address another user's data through the API.
- `Authentication:Mode=Development` trusts an `X-Dev-User` header for local work and is refused outside the Development environment.
- Azure resources are accessed with `DefaultAzureCredential` (managed identity in Azure), so the Cosmos DB account, Key Vault and Storage account need no keys in configuration. The identity needs Cosmos DB data contributor on the database, `get`/`set`/`delete`/`recover` on Key Vault secrets and queue data contributor on the sync queue.

## Not in scope yet

Subscription billing and plan changes (everyone starts on Free; `ChangePlan` exists on the aggregate), feature flags, health checks for dependencies, rate limiting beyond the manual-sync cooldown, infrastructure-as-code, a TypeScript client generated from `/openapi/v1.json`, and any trading capability.

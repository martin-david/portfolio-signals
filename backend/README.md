# Backend

.NET 10 / C# 14 backend for Portfolio Signals: a REST API plus an Azure Functions app that synchronizes eToro portfolios and TipRanks analyst data in the background. See [docs/architecture.md](docs/architecture.md) for the design, domain model and Cosmos DB layout.

## Solution layout

Open [PortfolioSignals.slnx](PortfolioSignals.slnx) (the XML solution format). Dependencies and versions are managed centrally in [Directory.Packages.props](Directory.Packages.props).

```text
src/
  PortfolioSignals.Domain          aggregates, value objects, scoring rules (no dependencies)
  PortfolioSignals.Application     CQRS handlers (FreeMediator), validation, ports
  PortfolioSignals.Infrastructure  Cosmos DB, Key Vault, Storage Queue, eToro and TipRanks adapters
  PortfolioSignals.Api             controller-based REST API, OpenAPI at /openapi/v1.json
  PortfolioSignals.Functions       timer + queue triggers for background sync (isolated worker)
tools/
  PortfolioSignals.DevSeed         fills a development account with a fictional portfolio (see "Seeding a demo account")
tests/
  PortfolioSignals.Domain.Tests          domain rules and scoring
  PortfolioSignals.Application.Tests     handlers against in-memory ports
  PortfolioSignals.Infrastructure.Tests  provider adapters, document mapping, secrets
  PortfolioSignals.Api.Tests             the real HTTP pipeline over in-memory ports
  PortfolioSignals.DevSeed.Tests         the seeder: its data, the sync it drives and its local-only guard
  PortfolioSignals.TestSupport           shared fakes and test data
```

## Build and test

```powershell
cd backend
dotnet build PortfolioSignals.slnx
dotnet test --solution PortfolioSignals.slnx
```

The tests need no Azure resources. The SDK version is pinned in [global.json](global.json), which also selects the Microsoft Testing Platform runner that xUnit v3 uses on .NET 10.

## API

All routes are under `/api/v1` and require authentication except `/health/live` and `/openapi/v1.json`.

| Route | Purpose |
| --- | --- |
| `GET`, `PUT /me` | Profile and entitlements; `PUT` registers the user on first call |
| `GET /integrations` | Connection state, last successful sync, next due, last failure per provider |
| `PUT`, `DELETE /integrations/{provider}` | Connect with the user's own credentials (`etoro`: `apiKey`, `userKey`; `tipranks`: `apiKey`) or disconnect. Credentials are write-only |
| `POST /sync` | Queue a manual sync (202); `GET /sync/runs` is the history |
| `GET /portfolio` | Latest synchronized eToro portfolio with weights |
| `GET /portfolio/snapshots` | Stored snapshots |
| `GET /portfolio/analysis` | Tier, hold/watch/review verdict, flags and KPIs per holding |
| `GET /portfolio/holdings/{symbol}` | One holding with the signals behind its verdict |

Errors are RFC 9457 problem responses; validation errors list the failing fields.

## Running locally

Prerequisites: the .NET 10 SDK, an Azure Cosmos DB account or the [Cosmos DB emulator](https://learn.microsoft.com/azure/cosmos-db/emulator), and [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) for the queue (only requesting a sync needs it). Running the Functions app also needs Azure Functions Core Tools.

Keep secrets out of the repository: use user secrets or environment variables. The Development settings already carry the emulator's well-known connection string, so against the emulator at its default address the first command can be skipped.

```powershell
cd backend\src\PortfolioSignals.Api
dotnet user-secrets set "Cosmos:ConnectionString" "<emulator or account connection string>"
dotnet run
```

In the Development environment the API trusts an `X-Dev-User` header instead of a real token, keeps credentials in memory (`CredentialStore:Mode=InMemory`) and creates the database and containers on startup:

```powershell
curl -H "X-Dev-User: me" -X PUT http://localhost:5196/api/v1/me -H "Content-Type: application/json" -d "{}"
```

The in-memory credential store is per process, so a sync run by the Functions app needs a real Key Vault (`CredentialStore:KeyVaultUri`) shared by both. Copy [local.settings.sample.json](src/PortfolioSignals.Functions/local.settings.sample.json) to `local.settings.json` (git-ignored) and fill in the values to run the Functions app.

### Seeding a demo account

A new database has no portfolio, and filling it the real way takes your own eToro and TipRanks keys, Azurite and the Functions app. The seeder fills a development user with a fictional portfolio instead, so the app has something to show:

```powershell
cd backend
dotnet run --project tools\PortfolioSignals.DevSeed                   # the user "demo"
dotnet run --project tools\PortfolioSignals.DevSeed -- --user alice   # the name typed on the sign-in screen
dotnet run --project tools\PortfolioSignals.DevSeed -- --reset        # delete that user's data first
```

- **It runs the real code.** It registers the profile (one that already exists is kept), connects both providers with placeholder credentials and runs the application's own sync handler, eToro then TipRanks, against fictional provider adapters. What gets stored is what two successful syncs would store: a snapshot of 15 holdings and 2 copied traders, signals for 14 tickers, two sync runs, and an analysis that has each of the five verdicts. The data mirrors the frontend's offline demo.
- **It only writes to a local emulator.** It reads the API's own settings and user secrets, so it reaches the same database; override the connection string with the `Cosmos__ConnectionString` environment variable. It refuses a connection string whose endpoint is not `localhost`, `127.0.0.1` or `[::1]`, and any account reached by `Cosmos:Endpoint`. The placeholder credentials stay in its own memory and nothing is queued. `--reset` deletes only the named user's documents.
- **Running it again** adds one more sync, a newer snapshot and a longer history, instead of failing.
- **What it cannot give you.** The placeholder credentials are kept nowhere the API or the Functions app can read, so a later sync cannot refresh the data, and manual syncs wait out their 15-minute cooldown after seeding. To sync real data, connect your own keys in the app and run Azurite, a shared Key Vault and the Functions app as described above.

### Using it from the frontend

The [frontend](../frontend/README.md) is written against the published OpenAPI document and runs against this API in development:

- **CORS.** Browsers may only call the API from origins listed in `Cors:AllowedOrigins`. The Development settings allow the frontend's dev server, `http://localhost:8082`; set `Cors__AllowedOrigins__0` (then `__1`, and so on) to allow others. With none configured no cross-origin browser request is allowed. Native apps are not subject to CORS.
- **http and https.** In Development the API answers on its http port (`http://localhost:5196`) even when it also listens on https, as Visual Studio's `https` launch profile makes it do, so the app's default address works with either profile. It does not redirect to https there: a browser refuses to follow a redirect on a CORS preflight, which showed up as "Can't reach the server", and the Android emulator cannot follow one to `https://localhost`. Everywhere else http is redirected to https.
- **Android emulator.** The emulator reaches the host's loopback at `10.0.2.2`, so the app is pointed at `http://10.0.2.2:5196`.
- **The OpenAPI document needs no database.** `GET /openapi/v1.json` is served without authentication. To refresh the frontend's snapshot (`npm run api:fetch` in `frontend/`) when the Cosmos DB emulator is not running, start the API with `Cosmos__CreateIfNotExists=false`. Every other endpoint needs the database.

## Configuration

| Setting | Purpose |
| --- | --- |
| `Authentication:Jwt:Authority`, `:Audience` | OpenID Connect issuer and audience for bearer tokens (required outside Development) |
| `Cors:AllowedOrigins` | Browser origins allowed to call the API (Development allows the frontend's `http://localhost:8082`; none by default) |
| `Cosmos:Endpoint` or `:ConnectionString` | Cosmos DB account (endpoint uses `DefaultAzureCredential`; the connection string is for the emulator) |
| `CredentialStore:KeyVaultUri` | Key Vault holding provider credentials |
| `SyncQueue:ServiceUri` or `:ConnectionString`, `:QueueName` | Storage queue that carries sync requests |
| `SyncScheduler:Schedule` | NCRONTAB schedule of the timer function (Functions app) |
| `Providers:Etoro:BaseUrl`, `:UseDemoAccount` | eToro API endpoint and demo switch |
| `Providers:TipRanks:Endpoint`, `:IncludeAnalystRatings` | TipRanks MCP endpoint; per-ticker ratings cost extra provider calls |

In Azure the Functions app uses the same settings as environment variables (`Cosmos__Endpoint`, `CredentialStore__KeyVaultUri`, `SyncQueue__ServiceUri`) plus `SyncQueueStorage__queueServiceUri` for the queue trigger.

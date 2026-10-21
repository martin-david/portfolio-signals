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
tests/
  PortfolioSignals.Domain.Tests          domain rules and scoring
  PortfolioSignals.Application.Tests     handlers against in-memory ports
  PortfolioSignals.Infrastructure.Tests  provider adapters, document mapping, secrets
  PortfolioSignals.Api.Tests             the real HTTP pipeline over in-memory ports
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

Prerequisites: the .NET 10 SDK, an Azure Cosmos DB account or the [Cosmos DB emulator](https://learn.microsoft.com/azure/cosmos-db/emulator), and [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) for the queue. Running the Functions app also needs Azure Functions Core Tools.

Keep secrets out of the repository: use user secrets or environment variables.

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

## Configuration

| Setting | Purpose |
| --- | --- |
| `Authentication:Jwt:Authority`, `:Audience` | OpenID Connect issuer and audience for bearer tokens (required outside Development) |
| `Cosmos:Endpoint` or `:ConnectionString` | Cosmos DB account (endpoint uses `DefaultAzureCredential`; the connection string is for the emulator) |
| `CredentialStore:KeyVaultUri` | Key Vault holding provider credentials |
| `SyncQueue:ServiceUri` or `:ConnectionString`, `:QueueName` | Storage queue that carries sync requests |
| `SyncScheduler:Schedule` | NCRONTAB schedule of the timer function (Functions app) |
| `Providers:Etoro:BaseUrl`, `:UseDemoAccount` | eToro API endpoint and demo switch |
| `Providers:TipRanks:Endpoint`, `:IncludeAnalystRatings` | TipRanks MCP endpoint; per-ticker ratings cost extra provider calls |

In Azure the Functions app uses the same settings as environment variables (`Cosmos__Endpoint`, `CredentialStore__KeyVaultUri`, `SyncQueue__ServiceUri`) plus `SyncQueueStorage__queueServiceUri` for the queue trigger.

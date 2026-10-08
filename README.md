# portfolio-signals

Analysts back every position that matters. What is left to decide is size and price.

> **Project direction:** This repository currently contains the project overview. The capabilities and architecture below describe the planned product; they are not claims about features already implemented.

## Product overview

Portfolio Signals will help investors understand and monitor their eToro portfolios:

1. A user registers, signs in, and provides the account details needed by the application.
2. The user connects eToro and TipRanks by supplying their own API credentials, when supported by those services.
3. The application retrieves the user's eToro portfolio through a supported API integration or an eToro MCP server and periodically synchronizes it.
4. Based on the portfolio, the application gathers analyst consensus, buy/hold/sell recommendations, hedge-fund or analyst signals, and other available TipRanks data.
5. It presents portfolio-level insights and possible rebalancing suggestions. Users remain in control of investment decisions.

Sync schedules will be configurable within each subscription plan and subject to provider API limits, permissions, and availability. Integrations must use the services' supported access methods and comply with their terms.

### Credential security

Third-party API credentials are sensitive secrets, not ordinary profile data. In the planned Azure deployment, credentials will be stored in Azure Key Vault, separated by user and integration, and accessed only by authorized application services using least-privilege identity. They must not be logged, returned in API responses, or committed to source control. Authentication and authorization will protect user data and integration operations.

## Illustrative subscription plans

These are starting points for product planning, not current offers. Final prices, entitlements, and sync intervals will depend on provider limits and operating costs.

| Plan | TipRanks portfolio check | eToro portfolio sync | Planned features |
| --- | --- | --- | --- |
| **Free** | Weekly | Manual or weekly | Portfolio overview, basic consensus and buy/hold/sell summaries |
| **Essential** | Daily | Daily | Position-level recommendations, portfolio alerts, and synchronization history |
| **Pro** | Every 6 hours | Every 6 hours | More frequent signals, analyst and hedge-fund insights where available, and rebalancing suggestions |
| **Premium** | Hourly, subject to provider limits | Hourly, subject to provider limits | Highest available sync frequency, expanded analysis, priority support, and advanced alerts |

Plans will control synchronization frequency and feature access. The application should display the last successful sync and clearly report delays, rate limits, or unavailable provider data. No plan guarantees real-time data.

## Technical direction

### Backend

- **Platform:** .NET 10 LTS and C# 14.
- **Architecture:** Clean Architecture and domain-driven design, with SOLID and DRY practices. Prefer a modular monolith initially; consider microservices only when deployment, scaling, or team boundaries justify their operational cost.
- **Application flow:** CQRS using an open-source MediatR fork. Keep controllers small: validate HTTP input, dispatch application requests, and map results to appropriate HTTP responses.
- **API:** Controller-based REST API using standard HTTP semantics, authentication, authorization, and documented error responses. Publish an OpenAPI specification and generate the TypeScript client with NSwag or a compatible alternative.
- **Validation and operations:** FluentValidation, dependency injection through `Microsoft.Extensions.DependencyInjection`, feature flags, structured observability (logs, metrics, and traces), and unit-testable application services.
- **Data:** Evaluate Azure Cosmos DB for NoSQL portfolio and application data. Use the EF Core Cosmos provider only where its capabilities fit; EF Core is not a universal abstraction for Cosmos DB or Azure Table Storage. Choose Table Storage only if its simpler query and data-model constraints meet the requirements.
- **Integrations:** Isolate eToro and TipRanks API/MCP access behind application-owned interfaces and adapters. Handle provider failures, quotas, retries, and synchronization idempotently.

### Frontend

- **Platform:** React Native with TypeScript, initially targeting web and Android, with iOS as a later target.
- **Tooling:** Prefer Expo and its React Native tooling for shared web/mobile development; Metro is the standard React Native bundler. Vite is primarily a web bundler and is not a replacement for the native Metro workflow.
- **State and UI:** Select a maintained component library with web and native support. Use local component state for local concerns and add a server-state/cache or global-state library only where the app needs it; Redux is an option, not a requirement.
- **API client:** Generate a typed TypeScript client from the backend OpenAPI document and keep it aligned with the published API.

### Hosting and libraries

Azure is the initial hosting target, including Azure Key Vault and managed identity for secrets access. Keep deployment components container-friendly and avoid unnecessary provider coupling so AWS or other container platforms remain possible. Prefer maintained open-source or free libraries whose licenses permit the intended commercial use; review licenses and security updates before adoption.

## Future direction

Automated trading through an eToro API or MCP server is a possible later version, not part of the initial portfolio-analysis scope. It would require supported provider capabilities, explicit user authorization, strong safeguards, auditability, and a separate review of regulatory and operational requirements.

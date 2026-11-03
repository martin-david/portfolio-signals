# Frontend

The Portfolio Signals app: one React Native (Expo) codebase in TypeScript that runs on the **web** and on **Android** (iOS is a later target). It shows an eToro portfolio with analyst signals from TipRanks, scored by rules the user can read, and it talks to the [.NET backend](../backend/README.md) through its OpenAPI contract. The [prototype](../prototype/README.md) is the design reference; [PRODUCT.md](PRODUCT.md) records who the app is for and the principles behind it.

## Try it without a backend

```powershell
cd frontend
npm install
npm run web:mock
```

Open <http://localhost:8082> and choose **Open the demo**. The demo runs a stateful copy of the API inside the app, with invented data (fictional companies, no real positions and no TipRanks content). Nothing leaves the device, and the demo starts over each time the app opens. Sync, connect, disconnect and profile edits all work against it.

`npm run web:mock:empty` starts as a first-time user (no profile, nothing connected). Other situations are one variable away:

| `EXPO_PUBLIC_MOCK_SCENARIO` | What it shows                                                             |
| --------------------------- | ------------------------------------------------------------------------- |
| `happy` (default)           | A synced portfolio of 15 holdings with every verdict, two hours old       |
| `empty`                     | A new user: sign in, set up the profile, connect, run the first sync      |
| `rate-limited`              | TipRanks signals three days old after a rate limit, with a retry planned  |
| `credentials-rejected`      | eToro refused the stored keys: syncing is paused and data is two days old |
| `failing`                   | Both providers connected, but every sync fails with "unavailable"         |

After changing a variable, restart with `npx expo start --web --port 8082 --clear`: Expo inlines `EXPO_PUBLIC_*` values when it bundles.

## Stack

| Concern         | Choice                                                                    | Why                                                                                                                 |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| App and tooling | Expo SDK 58 (React Native 0.88, React 19.3, React Compiler), Metro        | One codebase for web and Android with the standard React Native bundler                                             |
| Navigation      | Expo Router with typed routes                                             | File-based routes, and signed-out, first-sign-in and signed-in screens kept apart by route guards                   |
| Language        | TypeScript, strict                                                        | The generated API types make a contract change a compile error                                                      |
| Server state    | TanStack Query                                                            | Caching, retries and refetching for what the API owns; local state stays in components. No Redux                    |
| API client      | `openapi-typescript` and `openapi-fetch`                                  | Types and a small typed client generated from the checked-in OpenAPI document                                       |
| UI              | React Native Paper (Material 3), themed with the product's tokens         | A maintained component library for web and native; ink, paper and the verdict colours replace the Material defaults |
| Charts          | `react-native-svg`                                                        | The same drawing on web and Android                                                                                 |
| Sign-in         | `expo-auth-session` (OpenID Connect, code with PKCE), `expo-secure-store` | The backend validates JWTs from an OpenID Connect provider                                                          |
| Tests           | Jest (`jest-expo`) and React Native Testing Library                       | Screens are tested through the router, over the demo API                                                            |

All direct dependencies are MIT licensed except TypeScript (Apache-2.0) and the Barlow Semi Condensed font package (MIT for the code, SIL OFL 1.1 for the font).

## Screens

| Route                | Screen                                                                                          | API                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/sign-in`           | Demo, development or OpenID Connect sign-in                                                     |                                                                                              |
| `/profile`           | First sign-in: display name and e-mail                                                          | `PUT /me`                                                                                    |
| `/`                  | Overview: the answer first, the account split by verdict, what stands out, what needs a look    | `GET /portfolio/analysis`, `/portfolio`, `/integrations`, `/sync/runs`; `POST /sync`         |
| `/holdings`          | Every holding with verdict, score, six signals and result against cost, sortable and filterable | `GET /portfolio/analysis`, `/portfolio`                                                      |
| `/holdings/[symbol]` | One holding: position, flags, the six signals, analysts, AI analysis, technicals, earnings      | `GET /portfolio/holdings/{symbol}`                                                           |
| `/insights`          | Where Street and AI-model targets disagree, and who reports earnings in the next 70 days        | `GET /portfolio/analysis`                                                                    |
| `/connections`       | eToro and TipRanks: connect, replace or remove keys, sync now, sync history, snapshots          | `GET`, `PUT`, `DELETE /integrations`; `POST /sync`; `GET /sync/runs`, `/portfolio/snapshots` |
| `/method`            | How a verdict is reached (static)                                                               |                                                                                              |
| `/settings`          | Profile, plan, hide amounts on this device, sign out                                            | `GET`, `PUT /me`                                                                             |

The prototype's report maps onto these: its verdict strip, findings and "needs a look" list are the Overview; the instrument panel is Holdings; the targets and earnings charts are Insights; the method section is Method; and the top-five deep dive became a page for every holding, because the API serves one.

Every screen has loading, empty and error states, and says how old the data is and what is wrong with a provider (rejected credentials, rate limits, a failed or late sync) rather than showing old numbers silently. When the server is slow to answer at start-up (a backend that has been idle can take a while), the loading screen says so after six seconds instead of showing a bare spinner.

## Running against the backend

Start the backend as described in [backend/README.md](../backend/README.md) (it needs a Cosmos DB account or the emulator, and Azurite for the queue). Then:

```powershell
cd frontend
copy .env.example .env.local   # live mode with development sign-in is the default
npm run web
```

In the Development environment the API accepts the `X-Dev-User` header, which is what `EXPO_PUBLIC_AUTH_MODE=dev` sends, and its CORS policy allows `http://localhost:8082`. For the Android emulator use `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5196` (native apps need no CORS) and `npm run android`, which needs the Android SDK and an emulator or device. `android/` and `ios/` are generated and git-ignored.

The live path is covered by the generated contract types and by tests against the demo API, which implements the same contract. It has also been run in a browser against the real API started without a database: the CORS preflight from `http://localhost:8082` succeeds, development sign-in sends `X-Dev-User`, the API's `application/problem+json` error is turned into a message, and a profile request that keeps failing ends in an error screen with _Try again_ and _Sign out_. While the server is slow to answer, the loading screen says so after six seconds. Nothing past that point has run against the real API, because no Cosmos DB account or emulator was available.

### Configuration

Only `EXPO_PUBLIC_*` variables reach the app, and anyone with the bundle can read them: never put a secret here. The settings are validated on start, and a build with an invalid combination shows what to fix instead of running.

| Variable                     | Values                                                                  | Notes                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_MODE`       | `live` (default), `mock`                                                | `mock` serves the demo API from inside the app and forces mock sign-in                            |
| `EXPO_PUBLIC_API_BASE_URL`   | URL, default `http://localhost:5196` in development                     | Required in production builds, which also need `https` (loopback hosts and `10.0.2.2` excepted)   |
| `EXPO_PUBLIC_AUTH_MODE`      | `dev`, `oidc`, `mock`                                                   | Default `dev` in development builds and `oidc` otherwise. `dev` exists only in development builds |
| `EXPO_PUBLIC_OIDC_AUTHORITY` | Issuer URL                                                              | Needed for `oidc`: the address that serves `/.well-known/openid-configuration`                    |
| `EXPO_PUBLIC_OIDC_CLIENT_ID` | Client id                                                               | Needed for `oidc`                                                                                 |
| `EXPO_PUBLIC_OIDC_SCOPES`    | Space or comma separated, default `openid profile email offline_access` | Add the API's scope: the backend validates the audience                                           |
| `EXPO_PUBLIC_MOCK_SCENARIO`  | See the table above                                                     | Only used with `EXPO_PUBLIC_API_MODE=mock`                                                        |

### Signing in

- **dev**: a name sent as `X-Dev-User`, for development against a Development backend.
- **oidc**: authorization code with PKCE through the system browser (a popup on the web). The identity provider must allow the redirect URI `portfoliosignals://auth/callback` for the app, and `<web origin>/auth/callback` for the web build. Refresh uses `offline_access`. Tokens are kept in Android's Keystore through `expo-secure-store`, and in `sessionStorage` on the web, so a session survives a reload but not closing the tab. A `401` from the API causes one refresh attempt, then sign-out.
- **mock**: the offline demo.

The OpenID Connect flow is written to the specification and unit-tested with the browser round trip replaced. No identity provider exists yet, so it has not been run against a real one.

## The API client

`openapi/v1.json` is a snapshot of the backend's published document (`/openapi/v1.json`), and `src/api/schema.d.ts` is generated from it. Do not edit the generated file.

```powershell
npm run api:fetch      # download the snapshot from a running backend (--url https://host for another)
npm run api:generate   # regenerate src/api/schema.d.ts
npm run api:check      # fail when the generated file is out of date with the snapshot (for CI)
```

The document is served without authentication. When the Cosmos DB emulator is not running, start the API with `Cosmos__CreateIfNotExists=false` so that it does not try to create the database.

## Scripts

| Script                                                | What it does                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run web`, `web:mock`, `web:mock:empty`           | Start the web app on port 8082: against the backend, with the demo, or with the demo as a new user |
| `npm run android`, `android:mock`                     | Start on an Android emulator or device                                                             |
| `npm run lint`, `typecheck`, `format`, `format:check` | ESLint, `tsc --noEmit`, Prettier                                                                   |
| `npm test`, `test:ci`                                 | Jest, and Jest with coverage                                                                       |
| `npm run check`                                       | Lint, type check, tests and the API client check: what CI should run                               |
| `npm run build:web`, `build:android`                  | `expo export` for each platform (a static single-page web app in `dist/`)                          |

## Layout

```text
src/
  app/          Expo Router routes: (public) sign-in, (onboarding) profile, (app) the signed-in screens
  api/          Typed client, error mapping, query keys, the generated schema
  auth/         Sign-in strategies (dev, OpenID Connect, mock), session state, token storage
  config/       Validation of the EXPO_PUBLIC_* settings
  features/     One folder per area: overview, holdings, insights, integrations, method, portfolio, profile, settings, sync
  lib/          Formatting, preferences, small hooks
  mocks/        The demo API and its fictional data (a port of the backend's scorer lives here)
  shell/        The signed-in frame: navigation, skip link, route announcer, route guards
  test/         Test helpers: a router with the app's providers over the demo API, builders
  ui/           The design system: tokens, theme, text, buttons, panels, notices and the rest
openapi/        The OpenAPI snapshot
scripts/        fetch-openapi and generate-api-types
```

The demo API is required from one place, behind a check of `EXPO_PUBLIC_API_MODE`. Metro inlines that variable, so a production build that is not a demo build drops the demo data from the bundle.

## Testing

`npm test` runs about 700 tests: the pure logic (formatting, scoring helpers, chart geometry), the demo API against the backend's own scoring cases, and every screen rendered inside a real router over the demo API, including its loading, empty, error and provider-problem states. The Method page's wording is checked against the scorer's thresholds, so a rule cannot change in one place only.

Android is verified by bundling it (`npm run build:android`) and by these tests, not on a device or emulator. iOS has not been built.

## Accessibility

Keyboard use and screen-reader semantics were checked in a browser at 1280, 820 and 390 px. What is in place: a skip link, landmarks and one `h1` per screen, tables and lists with their roles and `aria-sort`, a polite announcement of the new screen after a link is followed, one visible focus ring on every control, switches and expandable rows that say their state, reduced motion honoured (including Paper's own animations), text that follows the system font size, and no meaning carried by colour alone (every verdict, status and severity has a glyph and a word; chart marks differ in shape). Contrast of the text and fill pairs is asserted in tests.

Not done: testing with screen readers (NVDA, VoiceOver, TalkBack) and on a physical Android device.

## Hosting the web build

`npm run build:web` writes a static single-page app to `dist/`. Serve it over HTTPS (OpenID Connect needs it) with every path falling back to `index.html`, and put the API's origin in `EXPO_PUBLIC_API_BASE_URL` at build time. If a Content-Security-Policy is used: `connect-src` must allow the API origin and the identity provider, and `style-src` must allow inline styles, because React Native Web and the focus ring inject them at run time. This is guidance, not something that has been deployed.

## Known gaps

- **From the API**: the prototype's bull and bear case, latest catalyst, deep fundamentals, macro calendar and dividend history have no endpoint, so the app does not show them (the dividend yield and P/E ratio are served and shown). TipRanks technical summaries are not fetched yet, and analyst breadth is off by default (one call per holding); the Method page says so. Copy-trading portfolios appear only as a share of the account, not assessed.
- **Not built**: changing plan or billing (the plan is shown read-only), alerts, rebalancing suggestions, trading, a dark theme, translations, an offline cache.
- **Placeholders**: the icons and splash are the Expo template's, and the app ids (`app.portfoliosignals`) and the OpenID Connect redirect scheme are working names to be replaced before a store listing.
- **Expo Go**: Expo Go runs only the SDK it was built for. When the store version does not support SDK 58 yet, use the web build, or a development build (`npx expo run:android`) on a device.
- **Dependencies**: `expo-doctor` passes and the Expo packages are at the patch releases SDK 58 expects. `npm audit` reports 50 advisories: one high (`zod`, reached only through the lint plugin `eslint-plugin-react-hooks`) and the rest moderate or low, in Expo's CLI and config-plugin chain and in Jest, ESLint and their `glob` and `minimatch` copies. `npm audit --omit=dev` reports nothing high or critical, and scanning the production web and Android bundles finds none of that code (the one match, `deepmerge`, is React Native Paper's own copy at 3.3.0, outside the affected range of 4.2.0 to 4.3.1, which only Jest uses). The fixes need major bumps (for example `zod` 3 to 4), so they are left for the next Expo patch release rather than forced.

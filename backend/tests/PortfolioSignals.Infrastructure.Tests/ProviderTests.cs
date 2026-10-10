using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Infrastructure.Providers.Etoro;
using PortfolioSignals.Infrastructure.Providers.TipRanks;

namespace PortfolioSignals.Infrastructure.Tests;

internal sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public List<HttpRequestMessage> Requests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        return Task.FromResult(respond(request));
    }
}

public class EtoroApiClientTests
{
    private const string AggregateJson = """
        {
          "cid": 4498,
          "timestamp": "2026-05-26T15:24:25.267Z",
          "accountCurrency": "USD",
          "accountTotals": { "accountAvailableCash": 4320.84, "accountCurrentPnl": -300.35, "accountTotalValue": 5154.48, "accountTotalUsedMargin": 1133.99 },
          "instrumentAggregates": [
            { "instrumentId": 100000, "totalMarginAccountCurrency": 849.86, "accountCurrencyReturn": -225.3, "accountCurrencyRoePercent": -26.51,
              "netUnits": 0.008076, "netCurrentExposureAccountCurrency": 624.57, "liquidationValueAccountCurrency": 624.56, "avgLeverage": 1, "avgOpenRate": 105233.5041183754 },
            { "instrumentId": 1001, "totalMarginAccountCurrency": 1000, "accountCurrencyReturn": 100, "accountCurrencyRoePercent": 10,
              "netUnits": 3, "netCurrentExposureAccountCurrency": 1100, "liquidationValueAccountCurrency": 1100, "avgLeverage": 1, "avgOpenRate": 333 }
          ],
          "mirrors": [
            { "mirrorId": 1869651, "mirrorAvailableCash": 0.04, "mirrorStopLossPercentage": 5, "mirrorClosedPositionsPnl": -0.26,
              "mirrorTotals": { "mirrorNetFunding": 290, "mirrorPositionsPnl": -75.05, "mirrorLiquidationValue": 209.08, "mirrorPositionsPnlPercent": -0.35, "mirrorValuePercent": 4.06 } }
          ]
        }
        """;

    private const string InstrumentsJson = """
        { "instrumentDisplayDatas": [
            { "instrumentID": 100000, "instrumentDisplayName": "Bitcoin", "instrumentTypeID": 10, "symbolFull": "BTC" },
            { "instrumentID": 1001, "instrumentDisplayName": "Microsoft", "instrumentTypeID": 5, "symbolFull": "MSFT" }
        ] }
        """;

    private static readonly ProviderCredentials Credentials = new(new Dictionary<string, string> { ["apiKey"] = "app-key", ["userKey"] = "user-key" });

    private static (EtoroApiClient Client, StubHandler Handler) Create(Func<HttpRequestMessage, HttpResponseMessage>? respond = null, bool demo = false)
    {
        var handler = new StubHandler(respond ?? (request => request.RequestUri!.AbsolutePath.Contains("aggregate-portfolio", StringComparison.Ordinal)
            ? Json(AggregateJson)
            : Json(InstrumentsJson)));
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://etoro.test") };
        return (new EtoroApiClient(http, Options.Create(new EtoroOptions { UseDemoAccount = demo })), handler);
    }

    private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    [Fact]
    public async Task The_portfolio_is_aggregated_with_symbols_and_asset_classes_resolved_from_instrument_data()
    {
        var (client, _) = Create();

        var portfolio = await client.GetPortfolioAsync(Credentials, default);

        portfolio.Account.TotalValue.Should().Be(5154.48m);
        portfolio.Account.CopiedValue.Should().Be(209.08m);
        portfolio.TakenAt.Should().Be(new DateTimeOffset(2026, 5, 26, 15, 24, 25, 267, TimeSpan.Zero));
        portfolio.Holdings.Should().HaveCount(2);
        portfolio.Holdings.Single(h => h.Symbol == "BTC").AssetClass.Should().Be(AssetClass.Crypto);
        var msft = portfolio.Holdings.Single(h => h.Symbol == "MSFT");
        msft.AssetClass.Should().Be(AssetClass.Stock);
        msft.Value.Should().Be(1100m);
        msft.PnlPct.Should().Be(10m);
        portfolio.CopiedTraders.Should().ContainSingle().Which.MirrorId.Should().Be(1869651);
    }

    [Fact]
    public async Task Requests_carry_the_users_own_keys_and_a_request_id_and_never_use_the_demo_path_by_default()
    {
        var (client, handler) = Create();

        await client.GetPortfolioAsync(Credentials, default);

        var first = handler.Requests[0];
        first.RequestUri!.AbsolutePath.Should().Be("/api/v1/trading/info/aggregate-portfolio");
        first.Headers.GetValues("x-api-key").Should().Equal("app-key");
        first.Headers.GetValues("x-user-key").Should().Equal("user-key");
        Guid.TryParse(first.Headers.GetValues("x-request-id").Single(), out _).Should().BeTrue();
        handler.Requests[1].RequestUri!.Query.Should().Contain("instrumentIds=100000,1001");
    }

    [Fact]
    public async Task The_demo_account_uses_the_demo_endpoint()
    {
        var (client, handler) = Create(demo: true);

        await client.GetPortfolioAsync(Credentials, default);

        handler.Requests[0].RequestUri!.AbsolutePath.Should().Be("/api/v1/trading/info/demo/aggregate-portfolio");
    }

    [Fact]
    public async Task An_unknown_instrument_still_yields_a_holding_with_a_placeholder_symbol()
    {
        var (client, _) = Create(request => request.RequestUri!.AbsolutePath.Contains("aggregate", StringComparison.Ordinal)
            ? Json(AggregateJson)
            : Json("""{ "instrumentDisplayDatas": [] }"""));

        var portfolio = await client.GetPortfolioAsync(Credentials, default);

        portfolio.Holdings.Select(h => h.Symbol).Should().Contain(["#100000", "#1001"]);
        portfolio.Holdings.Single(h => h.Symbol == "#100000").AssetClass.Should().Be(AssetClass.Crypto);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, SyncFailureKind.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden, SyncFailureKind.Unauthorized)]
    [InlineData(HttpStatusCode.TooManyRequests, SyncFailureKind.RateLimited)]
    [InlineData(HttpStatusCode.BadGateway, SyncFailureKind.Unavailable)]
    [InlineData(HttpStatusCode.NotFound, SyncFailureKind.InvalidResponse)]
    public async Task Provider_failures_are_classified(HttpStatusCode status, SyncFailureKind expected)
    {
        var (client, _) = Create(_ => new HttpResponseMessage(status));

        var act = () => client.GetPortfolioAsync(Credentials, default);

        (await act.Should().ThrowAsync<ProviderException>()).Which.Kind.Should().Be(expected);
    }

    [Fact]
    public async Task A_rate_limit_carries_the_retry_after_hint()
    {
        var (client, _) = Create(_ =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
            response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(60));
            return response;
        });

        var act = () => client.GetPortfolioAsync(Credentials, default);

        (await act.Should().ThrowAsync<ProviderException>()).Which.RetryAfter.Should().Be(TimeSpan.FromSeconds(60));
    }

    [Fact]
    public async Task Unreadable_json_is_an_invalid_response_not_a_crash()
    {
        var (client, _) = Create(_ => Json("not json"));

        var act = () => client.GetPortfolioAsync(Credentials, default);

        (await act.Should().ThrowAsync<ProviderException>()).Which.Kind.Should().Be(SyncFailureKind.InvalidResponse);
    }

    [Fact]
    public async Task Missing_credential_fields_surface_as_rejected_credentials()
    {
        var (client, _) = Create();

        var act = () => client.GetPortfolioAsync(new ProviderCredentials(new Dictionary<string, string> { ["apiKey"] = "only" }), default);

        (await act.Should().ThrowAsync<ProviderException>()).Which.Kind.Should().Be(SyncFailureKind.Unauthorized);
    }
}

public class TipRanksMapperTests
{
    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public void Assets_data_maps_headline_signals_and_tolerates_missing_fields()
    {
        var root = Parse("""
            { "assetsData": [
              { "ticker": "MSFT", "companyName": "Microsoft", "sector": "Technology", "price": 420.5, "smartScore": 9,
                "analystConsensus": "Strong Buy", "bestAnalystConsensus": "Moderate Buy", "priceTarget": 500, "dividendYield": 0.007,
                "ytdGainPct": 12.5, "nextEarningsDate": "2026-10-28T00:00:00" },
              { "ticker": "ETL" }
            ] }
            """);

        var result = TipRanksMapper.FromAssetsData(root);

        var msft = result["MSFT"];
        msft.Consensus.Should().Be(AnalystConsensus.StrongBuy);
        msft.BestAnalystConsensus.Should().Be(AnalystConsensus.Buy);
        msft.SmartScore.Should().Be(9);
        msft.PriceTarget.Should().Be(500m);
        msft.LastPrice.Should().Be(420.5m);
        msft.DividendYieldPct.Should().BeApproximately(0.7, 0.0001);
        msft.NextEarningsDate.Should().Be(new DateOnly(2026, 10, 28));
        result["ETL"].SmartScore.Should().BeNull();
        result["ETL"].Consensus.Should().BeNull();
    }

    [Fact]
    public void AI_analysis_maps_score_rating_and_upside()
    {
        var root = Parse("""{ "stocks": [ { "ticker": "NVDA", "ai_score": 82.5, "rating": "outperform", "price_target": 210, "upside_pct": 18.2, "as_of": "2026-09-29" } ], "not_covered": [] }""");

        var ai = TipRanksMapper.FromAiAnalysis(root)["NVDA"];

        ai.Score.Should().Be(82.5);
        ai.Rating.Should().Be("outperform");
        ai.UpsidePct.Should().Be(18.2);
        ai.AsOf.Should().Be(new DateOnly(2026, 9, 29));
    }

    [Fact]
    public void Analyst_breadth_counts_each_analysts_latest_rating_only()
    {
        var root = Parse("""
            [
              { "expertUID": "a", "recommendation": "Hold", "recommendationDate": "01/10/2026", "priceTarget": 100 },
              { "expertUID": "a", "recommendation": "Buy",  "recommendationDate": "06/20/2026", "priceTarget": 120 },
              { "expertUID": "b", "recommendation": "Sell", "recommendationDate": "05/01/2026", "priceTarget": 80 },
              { "expertUID": "c", "recommendation": "Buy",  "recommendationDate": "05/02/2026" }
            ]
            """);

        var breadth = TipRanksMapper.FromAnalystRatings(root)!;

        breadth.Analysts.Should().Be(3);
        (breadth.Buy, breadth.Hold, breadth.Sell).Should().Be((2, 0, 1));
        breadth.WithPriceTarget.Should().Be(2);
        (breadth.PriceTargetMin, breadth.PriceTargetMedian, breadth.PriceTargetMax).Should().Be((80m, 100m, 120m));
    }

    [Fact]
    public void An_empty_ratings_list_has_no_breadth()
        => TipRanksMapper.FromAnalystRatings(Parse("[]")).Should().BeNull();
}

public class TipRanksClientTests
{
    private sealed class FakeSession : ITipRanksSession
    {
        public List<(string Tool, IReadOnlyDictionary<string, object?> Args)> Calls { get; } = [];

        public Task<JsonElement> CallToolAsync(string tool, IReadOnlyDictionary<string, object?> arguments, CancellationToken cancellationToken)
        {
            Calls.Add((tool, arguments));
            var tickers = tool == "get_assets_data"
                ? ((IEnumerable<string>)arguments["tickers"]!).ToList()
                : tool == "get_ai_stock_analysis" ? ((string)arguments["tickers"]!).Split(',').ToList() : [];
            var json = tool switch
            {
                "get_assets_data" => $$"""{ "assetsData": [ {{string.Join(',', tickers.Select(t => $$"""{ "ticker": "{{t}}", "smartScore": 7, "analystConsensus": "Buy" }"""))}} ] }""",
                "get_ai_stock_analysis" => $$"""{ "stocks": [ {{string.Join(',', tickers.Select(t => $$"""{ "ticker": "{{t}}", "ai_score": 70 }"""))}} ] }""",
                _ => """[ { "expertUID": "a", "recommendation": "Buy", "recommendationDate": "06/20/2026", "priceTarget": 120 } ]""",
            };
            return Task.FromResult(JsonDocument.Parse(json).RootElement.Clone());
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    private sealed class FakeFactory(FakeSession session) : ITipRanksSessionFactory
    {
        public string? ApiKey { get; private set; }

        public Task<ITipRanksSession> OpenAsync(string apiKey, CancellationToken cancellationToken)
        {
            ApiKey = apiKey;
            return Task.FromResult<ITipRanksSession>(session);
        }
    }

    private static readonly ProviderCredentials Credentials = new(new Dictionary<string, string> { ["apiKey"] = "tr-key" });

    [Fact]
    public async Task Provider_calls_are_batched_to_protect_the_monthly_quota()
    {
        var session = new FakeSession();
        var factory = new FakeFactory(session);
        var client = new TipRanksClient(factory, Options.Create(new TipRanksOptions()));
        var tickers = Enumerable.Range(1, 30).Select(i => $"T{i}").ToList();

        var result = await client.GetSignalsAsync(Credentials, tickers, default);

        result.Should().HaveCount(30);
        session.Calls.Select(c => c.Tool).Should().Equal("get_assets_data", "get_ai_stock_analysis", "get_ai_stock_analysis");
        result["T1"].Ai!.Score.Should().Be(70);
        result["T1"].Breadth.Should().BeNull("analyst ratings cost one call per ticker and are off by default");
        factory.ApiKey.Should().Be("tr-key");
    }

    [Fact]
    public async Task Analyst_ratings_are_fetched_per_ticker_only_when_enabled()
    {
        var session = new FakeSession();
        var client = new TipRanksClient(new FakeFactory(session), Options.Create(new TipRanksOptions { IncludeAnalystRatings = true }));

        var result = await client.GetSignalsAsync(Credentials, ["MSFT", "NVDA"], default);

        session.Calls.Count(c => c.Tool == "get_recent_analyst_ratings").Should().Be(2);
        result["MSFT"].Breadth!.Analysts.Should().Be(1);
    }

    [Fact]
    public async Task No_tickers_means_no_provider_calls()
    {
        var session = new FakeSession();
        var client = new TipRanksClient(new FakeFactory(session), Options.Create(new TipRanksOptions()));

        var result = await client.GetSignalsAsync(Credentials, [], default);

        result.Should().BeEmpty();
        session.Calls.Should().BeEmpty();
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, SyncFailureKind.Unauthorized)]
    [InlineData(HttpStatusCode.TooManyRequests, SyncFailureKind.RateLimited)]
    [InlineData(HttpStatusCode.BadGateway, SyncFailureKind.Unavailable)]
    public void Transport_errors_are_classified(HttpStatusCode status, SyncFailureKind expected)
        => McpErrors.Translate(new HttpRequestException("boom", null, status)).Kind.Should().Be(expected);

    [Fact]
    public void A_tool_error_mentioning_the_quota_is_a_rate_limit()
        => McpErrors.FromToolMessage("Monthly quota exceeded").Kind.Should().Be(SyncFailureKind.RateLimited);
}

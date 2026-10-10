using PortfolioSignals.Domain.Analysis;
using PortfolioSignals.Domain.Common;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.TestSupport;

namespace PortfolioSignals.Domain.Tests;

public class SymbolResolverTests
{
    private readonly SymbolResolver _resolver = new(
    [
        new SymbolMapping("ATROB", "ATROB", AssetClass.Stock, ["ATRO"]),
    ]);

    [Theory]
    [InlineData("MSFT", AssetClass.Stock, "MSFT")]
    [InlineData("SHL.DE", AssetClass.Stock, "DE:SHL")]
    [InlineData("ETL.PA", AssetClass.Stock, "FR:ETL")]
    [InlineData("LTC", AssetClass.Crypto, "LTCUSD")]
    public void Conventions_map_eToro_symbols_to_TipRanks_tickers(string symbol, AssetClass assetClass, string expected)
        => _resolver.Resolve(symbol, assetClass).TipRanksTicker.Should().Be(expected);

    [Fact]
    public void Explicit_overrides_win_and_carry_related_tickers()
    {
        var mapping = _resolver.Resolve("atrob", AssetClass.Stock);

        mapping.RelatedTickers.Should().Equal("ATRO");
    }
}

public class PortfolioSnapshotTests
{
    private static readonly AccountSummary Account = new("USD", 10_000m, 9_000m, 0m, 1_000m, 0m, 0m);

    [Fact]
    public void Capture_orders_holdings_by_value_and_raises_an_event()
    {
        var snapshot = PortfolioSnapshot.Capture(
            TestData.Alice,
            TestData.Now,
            Account,
            [TestData.Holding("AAA", value: 1_000m), TestData.Holding("BBB", value: 4_000m)],
            [],
            TestData.Now);

        snapshot.Holdings.Select(h => h.Symbol).Should().Equal("BBB", "AAA");
        snapshot.DomainEvents.Should().ContainSingle(e => e is PortfolioSnapshotCaptured);
    }

    [Fact]
    public void A_snapshot_cannot_contain_the_same_instrument_twice()
    {
        var holding = TestData.Holding("AAA");

        var act = () => PortfolioSnapshot.Capture(TestData.Alice, TestData.Now, Account, [holding, holding], [], TestData.Now);

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Weight_is_the_share_of_the_whole_account()
    {
        var holding = TestData.Holding("AAA", value: 2_500m);
        var snapshot = PortfolioSnapshot.Capture(TestData.Alice, TestData.Now, Account, [holding], [], TestData.Now);

        snapshot.WeightPct(holding).Should().Be(25m);
    }

    [Fact]
    public void The_snapshot_id_is_derived_from_the_provider_timestamp_so_recapture_is_idempotent()
        => PortfolioSnapshot.IdFor(new DateTimeOffset(2026, 9, 30, 20, 36, 52, TimeSpan.Zero)).Should().Be("20260930T203652Z");

    [Fact]
    public void Only_stocks_are_looked_up_and_related_tickers_are_included()
    {
        var snapshot = PortfolioSnapshot.Capture(
            TestData.Alice,
            TestData.Now,
            Account,
            [
                TestData.Holding("ATROB", related: ["ATRO"]),
                TestData.Holding("LTC", AssetClass.Crypto, tipRanksTicker: "LTCUSD"),
            ],
            [],
            TestData.Now);

        snapshot.TipRanksTickers().Should().BeEquivalentTo(["ATROB", "ATRO"]);
    }
}

public class AnalystConsensusParserTests
{
    [Theory]
    [InlineData("Strong Buy", AnalystConsensus.StrongBuy)]
    [InlineData("Moderate Buy", AnalystConsensus.Buy)]
    [InlineData("Buy", AnalystConsensus.Buy)]
    [InlineData("Hold", AnalystConsensus.Neutral)]
    [InlineData("Moderate Sell", AnalystConsensus.Sell)]
    [InlineData("StrongSell", AnalystConsensus.StrongSell)]
    [InlineData("StongSell", AnalystConsensus.StrongSell)]
    public void Provider_labels_are_parsed_leniently(string label, AnalystConsensus expected)
        => AnalystConsensusParser.Parse(label).Should().Be(expected);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("N/A")]
    public void Unknown_labels_are_null_rather_than_guessed(string? label)
        => AnalystConsensusParser.Parse(label).Should().BeNull();
}

public class HoldingScorerTests
{
    private static readonly DateOnly Today = new(2026, 10, 10);

    private static HoldingAssessment Assess(Holding holding, decimal weight, SignalData? primary, SignalData? related = null, string? relatedTicker = null)
        => HoldingScorer.Assess(holding, weight, primary, related, relatedTicker, Today);

    [Fact]
    public void Strong_signals_give_a_strong_tier_and_a_hold_verdict()
    {
        var result = Assess(TestData.Holding(), 5m, TestData.StrongSignals());

        result.Tier.Should().Be(Tier.Strong);
        result.Verdict.Should().Be(Verdict.Hold);
        result.Composite.Should().BeGreaterThanOrEqualTo(60);
        result.Facts.StreetUpsidePct.Should().BeApproximately(19.0, 0.1);
    }

    [Fact]
    public void Missing_signals_are_skipped_not_scored_as_zero()
    {
        var onlyConsensus = new SignalData { Consensus = AnalystConsensus.StrongBuy };

        var result = Assess(TestData.Holding(), 5m, onlyConsensus);

        result.Composite.Should().Be(100);
        result.Components.Upside.Should().BeNull();
        result.Components.SmartScore.Should().BeNull();
    }

    [Fact]
    public void A_large_strong_position_is_flagged_to_review_size()
    {
        var result = Assess(TestData.Holding(value: 30_000m), 30m, TestData.StrongSignals());

        result.Verdict.Should().Be(Verdict.HoldReviewSize);
        result.Flags.Should().Contain(f => f.Key == "concentration" && f.Severity == FlagSeverity.Alert);
    }

    [Fact]
    public void A_supported_stock_trading_at_its_target_is_downgraded_to_watch()
    {
        var atTarget = new SignalData
        {
            Consensus = AnalystConsensus.StrongBuy,
            PriceTarget = 420m,
            LastPrice = 420m,
            SmartScore = 8,
            Ai = new AiAnalysis(60, "neutral", 420m, 0, null),
        };

        var result = Assess(TestData.Holding(), 5m, atTarget);

        result.Tier.Should().Be(Tier.Supported);
        result.Flags.Should().Contain(f => f.Key == "priced_at_target");
        result.Verdict.Should().Be(Verdict.Watch);
    }

    [Fact]
    public void A_strong_stock_trading_at_its_target_keeps_the_flag_but_stays_a_hold()
    {
        var atTarget = TestData.StrongSignals() with { PriceTarget = 421m };

        var result = Assess(TestData.Holding(), 5m, atTarget);

        result.Flags.Should().Contain(f => f.Key == "priced_at_target");
        result.Verdict.Should().Be(Verdict.Hold);
    }

    [Fact]
    public void Weak_signals_give_a_review_verdict()
    {
        var weak = new SignalData
        {
            Consensus = AnalystConsensus.StrongSell,
            SmartScore = 2,
            PriceTarget = 80m,
            LastPrice = 100m,
            Ai = new AiAnalysis(30, "underperform", 70m, -30, null),
        };

        var result = Assess(TestData.Holding(pnlPct: -50m), 5m, weak);

        result.Tier.Should().Be(Tier.Weak);
        result.Verdict.Should().Be(Verdict.Review);
        result.Flags.Select(f => f.Key).Should().Contain(["weak_consensus", "deep_loss"]);
    }

    [Fact]
    public void Crypto_has_no_data_and_says_why()
    {
        var result = Assess(TestData.Holding("LTC", AssetClass.Crypto), 0.5m, null);

        result.Verdict.Should().Be(Verdict.NoData);
        result.Tier.Should().Be(Tier.NoData);
        result.Flags.Should().ContainSingle(f => f.Key == "no_coverage");
    }

    [Fact]
    public void A_stock_without_synced_signals_asks_for_a_sync()
    {
        var result = Assess(TestData.Holding(), 5m, null);

        result.Verdict.Should().Be(Verdict.NoData);
        result.Flags.Should().ContainSingle(f => f.Key == "not_synced");
    }

    [Fact]
    public void A_sibling_listing_stands_in_when_the_primary_ticker_has_no_coverage()
    {
        var holding = TestData.Holding("ATROB", related: ["ATRO"]);
        var sibling = new SignalData { Consensus = AnalystConsensus.Buy, PriceTarget = 30m, LastPrice = 25m };

        var result = Assess(holding, 5m, new SignalData(), sibling, "ATRO");

        result.Facts.Consensus.Should().Be(AnalystConsensus.Buy);
        result.Facts.PriceTarget.Should().Be(30m);
    }

    [Fact]
    public void Thin_coverage_is_flagged_only_when_the_ratings_breakdown_is_known()
    {
        var withBreadth = TestData.StrongSignals() with { Breadth = new AnalystBreadth(3, 3, 0, 0, 3, 450m, 500m, 550m) };

        Assess(TestData.Holding(), 5m, TestData.StrongSignals()).Flags.Should().NotContain(f => f.Key == "thin_coverage");
        Assess(TestData.Holding(), 5m, withBreadth).Flags.Should().Contain(f => f.Key == "thin_coverage");
    }

    [Fact]
    public void Earnings_inside_thirty_days_are_flagged()
    {
        var result = Assess(TestData.Holding(), 5m, TestData.StrongSignals());

        result.Facts.DaysToEarnings.Should().Be(10);
        result.Flags.Should().Contain(f => f.Key == "earnings_soon");
    }

    [Theory]
    [InlineData(60, Tier.Strong)]
    [InlineData(59, Tier.Supported)]
    [InlineData(35, Tier.Supported)]
    [InlineData(34, Tier.Mixed)]
    [InlineData(10, Tier.Mixed)]
    [InlineData(9, Tier.Weak)]
    [InlineData(-40, Tier.Weak)]
    public void Tier_boundaries_match_the_prototype(int composite, Tier expected)
        => HoldingScorer.TierOf(composite).Should().Be(expected);
}

public class PortfolioAnalyzerTests
{
    [Fact]
    public void Analysis_scores_every_holding_and_computes_portfolio_kpis()
    {
        var holdings = new[]
        {
            TestData.Holding("MSFT", value: 5_000m),
            TestData.Holding("NVDA", value: 3_000m),
            TestData.Holding("LTC", AssetClass.Crypto, value: 50m, tipRanksTicker: "LTCUSD"),
        };
        var snapshot = PortfolioSnapshot.Capture(
            TestData.Alice,
            TestData.Now,
            new AccountSummary("USD", 10_000m, 8_050m, 0m, 1_950m, 0m, 0m),
            holdings,
            [],
            TestData.Now);
        var signals = new Dictionary<string, InstrumentSignals>
        {
            ["MSFT"] = InstrumentSignals.Create(TestData.Alice, "MSFT", TestData.StrongSignals(), TestData.Now),
        };

        var analysis = PortfolioAnalyzer.Analyze(snapshot, signals, new DateOnly(2026, 10, 10));

        analysis.Holdings.Select(h => h.Holding.Symbol).Should().Equal("MSFT", "NVDA", "LTC");
        analysis.Kpis.Positions.Should().Be(3);
        analysis.Kpis.Top1Pct.Should().Be(50m);
        analysis.Kpis.VerdictCounts[Verdict.HoldReviewSize].Should().Be(1);
        analysis.Kpis.VerdictCounts[Verdict.NoData].Should().Be(2);
        analysis.Kpis.SmallPositions.Count.Should().Be(1);
        analysis.Kpis.Earnings30DaysSymbols.Should().Equal("MSFT");
        analysis.Kpis.EffectivePositions.Should().BeInRange(1.0, 3.0);
    }
}

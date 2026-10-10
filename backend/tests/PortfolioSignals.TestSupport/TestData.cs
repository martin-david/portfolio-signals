using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.TestSupport;

public static class TestData
{
    public static readonly DateTimeOffset Now = new(2026, 10, 10, 12, 0, 0, TimeSpan.Zero);

    public static readonly UserId Alice = new("alice");

    public static EtoroPortfolio EtoroPortfolio(DateTimeOffset? takenAt = null) => new(
        takenAt ?? Now.AddMinutes(-5),
        new AccountSummary("USD", 10_000m, 9_000m, 500m, 500m, 250m, 4_000m),
        [
            new EtoroHolding(1001, "MSFT", "Microsoft", AssetClass.Stock, 4_000m, 5_000m, 1_000m, 25m, 12m, 350m, 1m, 5_000m),
            new EtoroHolding(1002, "ATROB", "Astronics B", AssetClass.Stock, 3_000m, 3_500m, 500m, 16m, 90m, 30m, 1m, 3_500m),
            new EtoroHolding(100000, "LTC", "Litecoin", AssetClass.Crypto, 700m, 500m, -200m, -28m, 6m, 120m, 1m, 500m),
        ],
        [new CopiedTrader(1869651, 290m, 500m, -75m, -0.35m, -0.26m, 0.04m, 4.06m, 5m)]);

    public static SignalData StrongSignals() => new()
    {
        CompanyName = "Microsoft",
        Consensus = AnalystConsensus.StrongBuy,
        PriceTarget = 500m,
        LastPrice = 420m,
        SmartScore = 9,
        Ai = new AiAnalysis(85, "outperform", 510m, 21, new DateOnly(2026, 9, 30)),
        NextEarningsDate = new DateOnly(2026, 10, 20),
    };

    public static Holding Holding(
        string symbol = "MSFT",
        AssetClass assetClass = AssetClass.Stock,
        decimal value = 5_000m,
        decimal pnlPct = 25m,
        string? tipRanksTicker = null,
        IReadOnlyList<string>? related = null) => new(
            Math.Abs(symbol.GetHashCode(StringComparison.Ordinal)),
            symbol,
            symbol,
            assetClass,
            tipRanksTicker ?? symbol,
            related ?? [],
            value * 0.8m,
            value,
            value * 0.2m,
            pnlPct,
            10m,
            100m,
            1m,
            value);
}

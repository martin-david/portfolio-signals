using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using static PortfolioSignals.Domain.Signals.AnalystConsensus;

namespace PortfolioSignals.DevSeed;

/// <summary>
/// A FICTIONAL portfolio for local development. The companies are made-up names (several borrowed from Microsoft's sample
/// companies), the numbers are invented and none of it is real market data, analyst content or anyone's positions.
/// It mirrors the frontend's offline demo (<c>frontend/src/mocks/fixtures/demoPortfolio.ts</c>), so the live and the offline
/// app tell the same story: one dominant holding, a few strong ones, a deep loser, a share class that borrows its sibling's
/// data, and an ETF and a crypto position that analysts do not cover.
/// </summary>
internal static class DemoPortfolio
{
    public const string Currency = "USD";

    private const decimal Cash = 5_300m;

    private sealed record Position(int InstrumentId, string Symbol, string Name, decimal Value, decimal PnlPct, decimal Price, AssetClass AssetClass = AssetClass.Stock);

    private static readonly Position[] Positions =
    [
        new(1001, "NWND", "Northwind Systems", 47_800m, 41m, 188.4m),
        new(1002, "CTSO", "Contoso Cloud", 21_600m, 18m, 301m),
        new(1003, "FBRK", "Fabrikam Foods", 14_900m, 6m, 95.2m),
        new(1004, "ADWK", "Adventure Works Outdoors", 11_250m, -8m, 104m),
        new(1005, "TLSP", "Tailspin Mobility", 9_300m, -46m, 17.2m),
        new(1006, "WGTP", "Woodgrove Financial", 8_100m, 22m, 66m),
        new(1007, "WWIM.DE", "Wide World Importers AG", 6_400m, 12m, 131m),
        new(1008, "ALPSB", "Alpine Ski House Class B", 4_700m, 9m, 36.5m),
        new(1009, "LTWR", "Litware Health", 3_900m, -15m, 51.3m),
        new(1010, "BYAL", "Blue Yonder Airlines", 2_800m, 27m, 29.5m),
        new(1011, "PRSW", "Proseware Robotics", 1_650m, 64m, 74.8m),
        new(1012, "COHO", "Coho Winery", 780m, 3m, 14.2m),
        new(1013, "TREY", "Trey Research Index Fund", 640m, 11m, 52m, AssetClass.Etf),
        new(1014, "FRTH", "Fourth Coffee", 410m, -12m, 8.9m),
        new(100001, "ORBT", "Orbit Coin", 520m, -31m, 0.42m, AssetClass.Crypto),
    ];

    private static readonly CopiedTrader[] CopiedTraders =
    [
        new(904211, 4_200m, 5_100m, 900m, 21.4m, 120m, 80m, 0m, 40m),
        new(904377, 4_000m, 4_300m, 300m, 7.5m, -45m, 60m, 0m, 35m),
    ];

    /// <summary>What the symbol resolver needs to know that its conventions do not already say: the share class that borrows its sibling's data.</summary>
    public static IReadOnlyList<SymbolMapping> SymbolMappings { get; } =
    [
        new("ALPSB", "ALPSB", AssetClass.Stock, ["ALPS"], "Fictional share class that borrows its sibling's analyst data."),
    ];

    public static EtoroPortfolio Portfolio(DateTimeOffset now)
    {
        var holdings = Positions.Select(ToHolding).ToList();
        var directValue = holdings.Sum(h => h.Value);
        var copiedValue = CopiedTraders.Sum(c => c.Value);
        var total = directValue + copiedValue + Cash;

        var account = new AccountSummary(
            Currency,
            total,
            directValue,
            copiedValue,
            Cash,
            holdings.Sum(h => h.Pnl) + CopiedTraders.Sum(c => c.OpenPnl),
            UsedMargin: 0m);

        var traders = CopiedTraders.Select(c => c with { ValuePct = Round(c.Value / total * 100, 2) }).ToList();
        return new EtoroPortfolio(now, account, holdings, traders);
    }

    /// <summary>
    /// The signals the fictional provider knows, by TipRanks ticker. Dates are relative to <paramref name="today"/>, so the
    /// earnings-proximity findings (within 30 days, within 70 days) hold whenever the data is seeded.
    /// </summary>
    public static IReadOnlyDictionary<string, SignalData> Signals(DateOnly today)
    {
        DateOnly Reports(int days) => ReportingDay(today, days);

        return new Dictionary<string, SignalData>(StringComparer.OrdinalIgnoreCase)
        {
            ["NWND"] = new()
            {
                CompanyName = "Northwind Systems",
                Sector = "Technology",
                Consensus = StrongBuy,
                BestAnalystConsensus = StrongBuy,
                PriceTarget = 212m,
                LastPrice = 188.4m,
                Currency = Currency,
                SmartScore = 9,
                PeRatio = 31.2,
                DividendYieldPct = 0.7,
                NewsSentiment = 0.62,
                HedgeFundsScore = 0.64,
                InsiderScore = 0.58,
                YtdGainPct = 28.4,
                YearlyGainPct = 44.1,
                NextEarningsDate = Reports(24),
                Ai = Ai(82, "outperform", 214m, 13.6, today),
                Breadth = Breadth(31, 24, 6, 1, 29, 160m, 210m, 250m),
                TechnicalDay = Buy,
                TechnicalWeek = StrongBuy,
            },
            ["CTSO"] = new()
            {
                CompanyName = "Contoso Cloud",
                Sector = "Technology",
                Consensus = StrongBuy,
                BestAnalystConsensus = Buy,
                PriceTarget = 330m,
                LastPrice = 301m,
                Currency = Currency,
                SmartScore = 8,
                PeRatio = 27.8,
                DividendYieldPct = 0,
                NewsSentiment = 0.41,
                HedgeFundsScore = 0.52,
                InsiderScore = 0.4,
                YtdGainPct = 14.2,
                YearlyGainPct = 22.5,
                NextEarningsDate = Reports(24),
                Ai = Ai(74, "outperform", 325m, 8, today),
                Breadth = Breadth(27, 20, 6, 1, 25, 270m, 328m, 380m),
                TechnicalDay = Neutral,
                TechnicalWeek = Buy,
            },
            ["FBRK"] = new()
            {
                CompanyName = "Fabrikam Foods",
                Sector = "Consumer Staples",
                Consensus = StrongBuy,
                BestAnalystConsensus = StrongBuy,
                PriceTarget = 96m,
                LastPrice = 95.2m,
                Currency = Currency,
                SmartScore = 8,
                PeRatio = 21.4,
                DividendYieldPct = 2.1,
                NewsSentiment = 0.22,
                HedgeFundsScore = 0.35,
                InsiderScore = 0.5,
                YtdGainPct = 9.8,
                YearlyGainPct = 12.7,
                NextEarningsDate = Reports(9),
                Ai = Ai(70, "outperform", 98m, 2.9, today),
                Breadth = Breadth(24, 20, 4, 0, 22, 85m, 96m, 108m),
                TechnicalDay = Buy,
                TechnicalWeek = Buy,
            },
            ["ADWK"] = new()
            {
                CompanyName = "Adventure Works Outdoors",
                Sector = "Consumer Discretionary",
                Consensus = Buy,
                BestAnalystConsensus = Neutral,
                PriceTarget = 120m,
                LastPrice = 104m,
                Currency = Currency,
                SmartScore = 6,
                PeRatio = 18.9,
                DividendYieldPct = 1.4,
                NewsSentiment = -0.12,
                HedgeFundsScore = 0.3,
                InsiderScore = 0.45,
                YtdGainPct = -6.1,
                YearlyGainPct = -9.4,
                NextEarningsDate = Reports(38),
                Ai = Ai(52, "neutral", 93.6m, -10, today),
                Breadth = Breadth(19, 11, 5, 3, 17, 80m, 118m, 150m),
                TechnicalDay = Sell,
                TechnicalWeek = Neutral,
            },
            ["TLSP"] = new()
            {
                CompanyName = "Tailspin Mobility",
                Sector = "Industrials",
                Consensus = Sell,
                BestAnalystConsensus = Sell,
                PriceTarget = 14m,
                LastPrice = 17.2m,
                Currency = Currency,
                SmartScore = 3,
                DividendYieldPct = 0,
                NewsSentiment = -0.48,
                HedgeFundsScore = 0.12,
                InsiderScore = 0.2,
                YtdGainPct = -33.5,
                YearlyGainPct = -52.3,
                NextEarningsDate = Reports(52),
                Ai = Ai(33, "underperform", 12m, -30, today),
                Breadth = Breadth(16, 3, 4, 9, 14, 8m, 14m, 22m),
                TechnicalDay = Sell,
                TechnicalWeek = Sell,
            },
            ["WGTP"] = new()
            {
                CompanyName = "Woodgrove Financial",
                Sector = "Financials",
                Consensus = StrongBuy,
                BestAnalystConsensus = StrongBuy,
                PriceTarget = 74m,
                LastPrice = 66m,
                Currency = Currency,
                SmartScore = 9,
                PeRatio = 12.6,
                DividendYieldPct = 3.2,
                NewsSentiment = 0.33,
                HedgeFundsScore = 0.4,
                InsiderScore = 0.7,
                YtdGainPct = 17.9,
                YearlyGainPct = 26.4,
                NextEarningsDate = Reports(24),
                Ai = Ai(80, "outperform", 75m, 13.6, today),
                Breadth = Breadth(18, 15, 3, 0, 16, 62m, 73m, 85m),
                TechnicalDay = Buy,
                TechnicalWeek = Buy,
            },
            ["DE:WWIM"] = new()
            {
                CompanyName = "Wide World Importers AG",
                Sector = "Industrials",
                Consensus = Buy,
                BestAnalystConsensus = Buy,
                PriceTarget = 142m,
                LastPrice = 131m,
                Currency = "EUR",
                SmartScore = 7,
                PeRatio = 16.3,
                DividendYieldPct = 2.6,
                NewsSentiment = 0.15,
                HedgeFundsScore = 0.3,
                InsiderScore = 0.4,
                YtdGainPct = 8.2,
                YearlyGainPct = 11.9,
                NextEarningsDate = Reports(61),
                Ai = Ai(66, "neutral", 140m, 6.9, today),
                Breadth = Breadth(12, 8, 3, 1, 10, 115m, 141m, 165m),
                TechnicalDay = Neutral,
                TechnicalWeek = Buy,
            },
            ["ALPSB"] = new(),
            ["ALPS"] = new()
            {
                CompanyName = "Alpine Ski House",
                Sector = "Consumer Discretionary",
                Consensus = StrongBuy,
                PriceTarget = 45m,
                LastPrice = 38m,
                Currency = Currency,
                NextEarningsDate = Reports(47),
                Breadth = Breadth(9, 7, 2, 0, 8, 38m, 45m, 54m),
            },
            ["LTWR"] = new()
            {
                CompanyName = "Litware Health",
                Sector = "Health Care",
                Consensus = Neutral,
                BestAnalystConsensus = Neutral,
                PriceTarget = 56m,
                LastPrice = 51.3m,
                Currency = Currency,
                SmartScore = 7,
                PeRatio = 24.1,
                DividendYieldPct = 0,
                NewsSentiment = -0.05,
                HedgeFundsScore = 0.25,
                InsiderScore = 0.3,
                YtdGainPct = -4.4,
                YearlyGainPct = -11.2,
                NextEarningsDate = Reports(33),
                Ai = Ai(66, "neutral", 55m, 7.2, today),
                Breadth = Breadth(3, 1, 2, 0, 3, 50m, 56m, 60m),
                TechnicalDay = Neutral,
                TechnicalWeek = Neutral,
            },
            ["BYAL"] = new()
            {
                CompanyName = "Blue Yonder Airlines",
                Sector = "Industrials",
                Consensus = Buy,
                BestAnalystConsensus = Buy,
                PriceTarget = 33m,
                LastPrice = 29.5m,
                Currency = Currency,
                SmartScore = 7,
                PeRatio = 9.7,
                DividendYieldPct = 0,
                NewsSentiment = 0.1,
                HedgeFundsScore = 0.35,
                InsiderScore = 0.25,
                YtdGainPct = 21.3,
                YearlyGainPct = 30.8,
                NextEarningsDate = Reports(6),
                Ai = Ai(63, "neutral", 32m, 8.5, today),
                Breadth = Breadth(14, 11, 2, 1, 12, 24m, 33m, 42m),
                TechnicalDay = Buy,
                TechnicalWeek = Neutral,
            },
            ["PRSW"] = new()
            {
                CompanyName = "Proseware Robotics",
                Sector = "Technology",
                Consensus = StrongBuy,
                BestAnalystConsensus = StrongBuy,
                PriceTarget = 92m,
                LastPrice = 74.8m,
                Currency = Currency,
                SmartScore = 8,
                PeRatio = 38.4,
                DividendYieldPct = 0,
                NewsSentiment = 0.5,
                HedgeFundsScore = 0.55,
                InsiderScore = 0.45,
                YtdGainPct = 52.7,
                YearlyGainPct = 71.9,
                NextEarningsDate = Reports(40),
                Ai = Ai(77, "outperform", 90m, 20.3, today),
                Breadth = Breadth(11, 9, 2, 0, 10, 70m, 90m, 110m),
                TechnicalDay = Buy,
                TechnicalWeek = StrongBuy,
            },
            ["COHO"] = new()
            {
                CompanyName = "Coho Winery",
                Sector = "Consumer Staples",
                Consensus = Buy,
                PriceTarget = 16.5m,
                LastPrice = 14.2m,
                Currency = Currency,
                SmartScore = 7,
                DividendYieldPct = 1.8,
                NextEarningsDate = Reports(66),
                Ai = Ai(64, "neutral", 16m, 12.7, today),
                Breadth = Breadth(8, 6, 2, 0, 7, 13m, 16.5m, 20m),
                TechnicalDay = Buy,
                TechnicalWeek = Buy,
            },
            ["FRTH"] = new()
            {
                CompanyName = "Fourth Coffee",
                Sector = "Consumer Discretionary",
                Consensus = Buy,
                PriceTarget = 11m,
                LastPrice = 8.9m,
                Currency = Currency,
                SmartScore = 6,
                NextEarningsDate = Reports(29),
                Breadth = Breadth(1, 1, 0, 0, 1, 11m, 11m, 11m),
            },
        };
    }

    /// <summary>Companies do not report at weekends, so a date that falls on one moves back to the Friday before.</summary>
    internal static DateOnly ReportingDay(DateOnly today, int days)
    {
        var day = today.AddDays(days);
        return day.DayOfWeek switch
        {
            DayOfWeek.Saturday => day.AddDays(-1),
            DayOfWeek.Sunday => day.AddDays(-2),
            _ => day,
        };
    }

    private static EtoroHolding ToHolding(Position position)
    {
        var invested = Round(position.Value / (1 + position.PnlPct / 100m), 0);
        var units = position.Value / position.Price;
        return new EtoroHolding(
            position.InstrumentId,
            position.Symbol,
            position.Name,
            position.AssetClass,
            invested,
            position.Value,
            position.Value - invested,
            Round((position.Value - invested) / invested * 100, 1),
            Round(units, 4),
            Round(invested / units, 2),
            AvgLeverage: 1m,
            Exposure: position.Value);
    }

    private static AiAnalysis Ai(double score, string rating, decimal target, double upsidePct, DateOnly today)
        => new(score, rating, target, upsidePct, today.AddDays(-3));

    private static AnalystBreadth Breadth(int analysts, int buy, int hold, int sell, int withTargets, decimal min, decimal median, decimal max)
        => new(analysts, buy, hold, sell, withTargets, min, median, max);

    private static decimal Round(decimal value, int decimals) => Math.Round(value, decimals, MidpointRounding.AwayFromZero);
}

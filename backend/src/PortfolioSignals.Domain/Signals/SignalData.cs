namespace PortfolioSignals.Domain.Signals;

/// <summary>Each analyst's most recent rating over the trailing 12 months, counted.</summary>
public sealed record AnalystBreadth(
    int Analysts,
    int Buy,
    int Hold,
    int Sell,
    int WithPriceTarget,
    decimal? PriceTargetMin,
    decimal? PriceTargetMedian,
    decimal? PriceTargetMax);

/// <summary>TipRanks' AI model analysis; separate from the Smart Score.</summary>
public sealed record AiAnalysis(double? Score, string? Rating, decimal? PriceTarget, double? UpsidePct, DateOnly? AsOf);

/// <summary>Everything TipRanks says about one ticker at one moment. Missing data stays null and is never scored as zero.</summary>
public sealed record SignalData
{
    public string? CompanyName { get; init; }

    public string? Sector { get; init; }

    public AnalystConsensus? Consensus { get; init; }

    public AnalystConsensus? BestAnalystConsensus { get; init; }

    public decimal? PriceTarget { get; init; }

    /// <summary>Latest close known to the provider, in <see cref="Currency"/>.</summary>
    public decimal? LastPrice { get; init; }

    public string? Currency { get; init; }

    /// <summary>TipRanks Smart Score, 1 to 10.</summary>
    public int? SmartScore { get; init; }

    public double? PeRatio { get; init; }

    public double? DividendYieldPct { get; init; }

    public double? NewsSentiment { get; init; }

    public double? HedgeFundsScore { get; init; }

    public double? InsiderScore { get; init; }

    public double? YtdGainPct { get; init; }

    public double? YearlyGainPct { get; init; }

    public DateOnly? NextEarningsDate { get; init; }

    public AiAnalysis? Ai { get; init; }

    public AnalystBreadth? Breadth { get; init; }

    public AnalystConsensus? TechnicalDay { get; init; }

    public AnalystConsensus? TechnicalWeek { get; init; }
}

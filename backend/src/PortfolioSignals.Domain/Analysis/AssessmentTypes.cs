using PortfolioSignals.Domain.Signals;

namespace PortfolioSignals.Domain.Analysis;

public enum Tier
{
    NoData,
    Weak,
    Mixed,
    Supported,
    Strong,
}

/// <summary>Review means "look again", not "sell". Verdicts are informational and are not investment advice.</summary>
public enum Verdict
{
    Hold,
    HoldReviewSize,
    Watch,
    Review,
    NoData,
}

public enum FlagSeverity
{
    Info,
    Warn,
    Alert,
}

public sealed record AssessmentFlag(string Key, FlagSeverity Severity, string Title, string Detail);

/// <summary>The six signals, each scaled to -1..+1. A null component had no data and is excluded from the composite.</summary>
public sealed record SignalComponents(
    double? Consensus,
    double? Upside,
    double? SmartScore,
    double? AiScore,
    double? Technicals,
    double? Breadth);

/// <summary>The raw facts behind an assessment, so every number can be traced to saved provider data.</summary>
public sealed record AssessmentFacts(
    AnalystConsensus? Consensus,
    decimal? PriceTarget,
    decimal? LastPrice,
    string? Currency,
    double? StreetUpsidePct,
    int? SmartScore,
    double? AiScore,
    double? AiUpsidePct,
    DateOnly? NextEarningsDate,
    int? DaysToEarnings,
    int? AnalystCount);

public sealed record HoldingAssessment(
    string Symbol,
    string TipRanksTicker,
    decimal WeightPct,
    bool Material,
    SignalComponents Components,
    int? Composite,
    Tier Tier,
    Verdict Verdict,
    AssessmentFacts Facts,
    IReadOnlyList<AssessmentFlag> Flags,
    string? ViaTicker);

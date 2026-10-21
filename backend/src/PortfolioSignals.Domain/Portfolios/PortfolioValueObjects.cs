namespace PortfolioSignals.Domain.Portfolios;

/// <summary>Account-level totals as reported by eToro at snapshot time, in the account currency.</summary>
public sealed record AccountSummary(
    string Currency,
    decimal TotalValue,
    decimal DirectValue,
    decimal CopiedValue,
    decimal AvailableCash,
    decimal UnrealizedPnl,
    decimal UsedMargin);

/// <summary>All the user's direct positions in one instrument, aggregated.</summary>
public sealed record Holding(
    int InstrumentId,
    string Symbol,
    string Name,
    AssetClass AssetClass,
    string TipRanksTicker,
    IReadOnlyList<string> RelatedTickers,
    decimal Invested,
    decimal Value,
    decimal Pnl,
    decimal PnlPct,
    decimal Units,
    decimal AvgOpenRate,
    decimal AvgLeverage,
    decimal Exposure);

/// <summary>A copy-trading relationship (eToro "mirror").</summary>
public sealed record CopiedTrader(
    long MirrorId,
    decimal Invested,
    decimal Value,
    decimal OpenPnl,
    decimal OpenPnlPct,
    decimal ClosedPnl,
    decimal AvailableCash,
    decimal ValuePct,
    decimal StopLossPct);

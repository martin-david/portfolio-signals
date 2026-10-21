using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;

namespace PortfolioSignals.Domain.Analysis;

/// <summary>
/// Transparent, rule-based scoring ported from the Python prototype (<c>prototype/report/analysis.py</c>).
/// Six signals are each scaled to -1..+1 and averaged over those available (missing data is skipped, never scored as
/// zero), then multiplied by 100. The equal weights are a starting point and have not been tested for predictive power.
/// </summary>
public static class HoldingScorer
{
    /// <summary>Positions below this share of the account are housekeeping, not decisions.</summary>
    public const decimal SmallPositionPct = 1m;

    private const int MinPriceTargets = 3;
    private const int MinAnalystsForBreadth = 5;

    public static HoldingAssessment Assess(Holding holding, decimal weightPct, SignalData? primary, SignalData? related, string? relatedTicker, DateOnly today)
    {
        var material = weightPct >= SmallPositionPct;

        if (holding.AssetClass != AssetClass.Stock || (primary is null && related is null))
        {
            return NoData(holding, weightPct, material);
        }

        var consensus = primary?.Consensus ?? related?.Consensus;
        var source = primary?.PriceTarget is not null ? primary : related ?? primary;
        var priceTarget = source?.PriceTarget;
        var lastPrice = source?.LastPrice;
        var breadth = primary?.Breadth ?? related?.Breadth;
        var via = primary?.Breadth is null && related?.Breadth is not null ? relatedTicker : null;
        var analysts = breadth?.Analysts ?? 0;
        var withTargets = breadth?.WithPriceTarget ?? 0;
        var ai = primary?.Ai;
        var smartScore = primary?.SmartScore;

        // Without the ratings breakdown the provider's own average target is used as is.
        var targetsTrusted = breadth is null || withTargets >= MinPriceTargets;
        double? upside = priceTarget is > 0 && lastPrice is > 0 ? (double)(priceTarget.Value / lastPrice.Value) - 1 : null;
        var technicals = new[] { primary?.TechnicalDay, primary?.TechnicalWeek }.Where(t => t.HasValue).Select(t => t!.Value.ToScale()).ToList();

        var components = new SignalComponents(
            Consensus: consensus?.ToScale(),
            Upside: upside is not null && targetsTrusted ? Clip(upside.Value / 0.30) : null,
            SmartScore: smartScore is > 0 ? Clip((smartScore.Value - 5.5) / 4.5) : null,
            AiScore: ai?.Score is { } aiScore ? Clip((aiScore - 60) / 25) : null,
            Technicals: technicals.Count > 0 ? technicals.Average() : null,
            Breadth: breadth is not null && analysts >= MinAnalystsForBreadth ? (double)(breadth.Buy - breadth.Sell) / analysts : null);

        var present = new[] { components.Consensus, components.Upside, components.SmartScore, components.AiScore, components.Technicals, components.Breadth }
            .Where(v => v.HasValue).Select(v => v!.Value).ToList();
        int? composite = present.Count > 0 ? (int)Math.Round(present.Average() * 100) : null;

        var nextEarnings = primary?.NextEarningsDate ?? related?.NextEarningsDate;
        int? daysToEarnings = nextEarnings is { } ne ? ne.DayNumber - today.DayNumber : null;
        var flags = BuildFlags(holding, weightPct, consensus, priceTarget, lastPrice, upside, targetsTrusted, ai, breadth, analysts, technicals, daysToEarnings, nextEarnings, composite, primary);

        var tier = TierOf(composite);
        var facts = new AssessmentFacts(
            consensus,
            priceTarget,
            lastPrice,
            source?.Currency,
            upside is null ? null : Math.Round(upside.Value * 100, 1),
            smartScore,
            ai?.Score,
            ai?.UpsidePct,
            nextEarnings,
            daysToEarnings,
            breadth?.Analysts);

        return new HoldingAssessment(holding.Symbol, holding.TipRanksTicker, weightPct, material, components, composite, tier, VerdictOf(tier, flags, weightPct), facts, flags, via);
    }

    public static Tier TierOf(int? composite) => composite switch
    {
        null => Tier.NoData,
        >= 60 => Tier.Strong,
        >= 35 => Tier.Supported,
        >= 10 => Tier.Mixed,
        _ => Tier.Weak,
    };

    public static Verdict VerdictOf(Tier tier, IReadOnlyList<AssessmentFlag> flags, decimal weightPct)
    {
        var warnings = flags.Count(f => f.Severity is FlagSeverity.Warn or FlagSeverity.Alert);
        return tier switch
        {
            Tier.NoData => Verdict.NoData,
            Tier.Strong => weightPct >= 25 ? Verdict.HoldReviewSize : Verdict.Hold,
            Tier.Supported => warnings >= 2 || flags.Any(f => f.Key == "priced_at_target") ? Verdict.Watch : Verdict.Hold,
            Tier.Mixed => warnings >= 3 ? Verdict.Review : Verdict.Watch,
            _ => Verdict.Review,
        };
    }

    private static List<AssessmentFlag> BuildFlags(
        Holding holding,
        decimal weightPct,
        AnalystConsensus? consensus,
        decimal? priceTarget,
        decimal? lastPrice,
        double? upside,
        bool targetsTrusted,
        AiAnalysis? ai,
        AnalystBreadth? breadth,
        int analysts,
        List<double> technicals,
        int? daysToEarnings,
        DateOnly? nextEarnings,
        int? composite,
        SignalData? primary)
    {
        var flags = new List<AssessmentFlag>();

        if (weightPct >= 25)
        {
            flags.Add(Flag("concentration", FlagSeverity.Alert, $"{weightPct:0.0}% of the account in one stock", "Single-name risk outweighs any analyst signal."));
        }
        else if (weightPct >= 10)
        {
            flags.Add(Flag("concentration", FlagSeverity.Warn, $"{weightPct:0.0}% of the account in one stock", "A large single-name position."));
        }

        if (upside is < 0.03 && targetsTrusted)
        {
            flags.Add(Flag("priced_at_target", FlagSeverity.Warn, "Trades at its average analyst target", $"Target {priceTarget:0.00} vs price {lastPrice:0.00} ({upside * 100:+0.0;-0.0}%)."));
        }

        if (upside is { } streetUpside && targetsTrusted && ai?.UpsidePct is { } aiUpside && (streetUpside * 100) - aiUpside >= 25)
        {
            flags.Add(Flag("dispersion", FlagSeverity.Warn, "Street and AI targets disagree", $"Street target implies {streetUpside * 100:+0;-0}%, TipRanks' AI models {aiUpside:+0;-0}%."));
        }

        if (consensus is AnalystConsensus.Neutral or AnalystConsensus.Sell or AnalystConsensus.StrongSell)
        {
            flags.Add(Flag("weak_consensus", FlagSeverity.Warn, $"Analyst consensus is {consensus}", "Analysts are not bullish on this name."));
        }

        if (breadth is not null && analysts < 5)
        {
            flags.Add(Flag("thin_coverage", FlagSeverity.Warn, $"Thin coverage: {analysts} analyst{(analysts == 1 ? string.Empty : "s")} in 12 months", "Consensus and targets rest on very few opinions."));
        }

        if (technicals.Count > 0 && technicals.Average() < 0)
        {
            flags.Add(Flag("weak_trend", FlagSeverity.Warn, "Technical trend is negative", "Day and week summaries lean Sell."));
        }

        if (daysToEarnings is >= 0 and <= 30 && nextEarnings is { } date)
        {
            flags.Add(Flag("earnings_soon", FlagSeverity.Info, $"Earnings in {daysToEarnings} days ({date:MMM d})", "Event risk inside 30 days."));
        }

        if (holding.PnlPct <= -40)
        {
            var severity = composite is < 35 ? FlagSeverity.Warn : FlagSeverity.Info;
            flags.Add(Flag("deep_loss", severity, $"Down {Math.Abs(holding.PnlPct):0}% vs your cost", "Weigh against how much you would rebuy today."));
        }

        if (primary?.YearlyGainPct is <= -25)
        {
            flags.Add(Flag("year_decline", FlagSeverity.Info, $"Down {Math.Abs(primary.YearlyGainPct.Value):0}% over 12 months", "Price momentum has been weak."));
        }

        return flags;
    }

    private static HoldingAssessment NoData(Holding holding, decimal weightPct, bool material)
    {
        var flags = new List<AssessmentFlag>();
        if (holding.AssetClass == AssetClass.Stock)
        {
            flags.Add(Flag("not_synced", FlagSeverity.Info, "No analyst data yet", "Connect TipRanks and run a sync to see analyst signals for this holding."));
        }
        else
        {
            var title = holding.AssetClass == AssetClass.Crypto ? "No analyst coverage" : "Not covered by this analysis";
            var detail = holding.AssetClass == AssetClass.Crypto
                ? "TipRanks publishes no ratings, Smart Score or AI score for crypto."
                : "Only single stocks are scored.";
            flags.Add(Flag("no_coverage", FlagSeverity.Info, title, detail));
        }

        if (holding.PnlPct <= -40)
        {
            flags.Add(Flag("deep_loss", FlagSeverity.Info, $"Down {Math.Abs(holding.PnlPct):0}% vs your cost", "Large in percent; check the amount before reading anything into it."));
        }

        return new HoldingAssessment(
            holding.Symbol,
            holding.TipRanksTicker,
            weightPct,
            material,
            new SignalComponents(null, null, null, null, null, null),
            null,
            Tier.NoData,
            Verdict.NoData,
            new AssessmentFacts(null, null, null, null, null, null, null, null, null, null, null),
            flags,
            null);
    }

    private static double Clip(double value) => Math.Max(-1.0, Math.Min(1.0, value));

    private static AssessmentFlag Flag(string key, FlagSeverity severity, string title, string detail)
        => new(key, severity, title, detail);
}

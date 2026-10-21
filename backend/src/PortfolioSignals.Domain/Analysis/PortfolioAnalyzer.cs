using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;

namespace PortfolioSignals.Domain.Analysis;

public sealed record SmallPositions(int Count, decimal Value, decimal Pct);

public sealed record PortfolioKpis(
    decimal TotalValue,
    decimal DirectValue,
    decimal UnrealizedPnl,
    int Positions,
    decimal Top1Pct,
    decimal Top5Pct,
    double EffectivePositions,
    double? WeightedSmartScore,
    double? WeightedStreetUpsidePct,
    decimal Earnings30DaysPct,
    IReadOnlyList<string> Earnings30DaysSymbols,
    SmallPositions SmallPositions,
    IReadOnlyDictionary<Verdict, int> VerdictCounts);

public sealed record AnalyzedHolding(Holding Holding, HoldingAssessment Assessment);

public sealed record PortfolioAnalysis(
    string SnapshotId,
    DateTimeOffset AsOf,
    IReadOnlyList<AnalyzedHolding> Holdings,
    PortfolioKpis Kpis);

/// <summary>Domain service: joins a portfolio snapshot with the analyst signals fetched for it and scores every holding.</summary>
public static class PortfolioAnalyzer
{
    public static PortfolioAnalysis Analyze(PortfolioSnapshot snapshot, IReadOnlyDictionary<string, InstrumentSignals> signalsByTicker, DateOnly today)
    {
        var rows = new List<AnalyzedHolding>();
        foreach (var holding in snapshot.Holdings.OrderByDescending(h => h.Value))
        {
            var primary = Lookup(signalsByTicker, holding.TipRanksTicker);
            var relatedTicker = holding.RelatedTickers.FirstOrDefault(t => Lookup(signalsByTicker, t) is not null);
            var related = relatedTicker is null ? null : Lookup(signalsByTicker, relatedTicker);
            var assessment = HoldingScorer.Assess(holding, snapshot.WeightPct(holding), primary, related, relatedTicker, today);
            rows.Add(new AnalyzedHolding(holding, assessment));
        }

        return new PortfolioAnalysis(snapshot.Id, snapshot.TakenAt, rows, BuildKpis(snapshot, rows));
    }

    private static SignalData? Lookup(IReadOnlyDictionary<string, InstrumentSignals> signals, string ticker)
        => signals.TryGetValue(InstrumentSignals.NormalizeTicker(ticker), out var found) ? found.Data : null;

    private static PortfolioKpis BuildKpis(PortfolioSnapshot snapshot, List<AnalyzedHolding> rows)
    {
        var total = snapshot.Account.TotalValue;
        var directValue = rows.Sum(r => r.Holding.Value);
        var values = rows.Select(r => r.Holding.Value).OrderByDescending(v => v).ToList();
        var hhi = directValue > 0 ? values.Sum(v => Math.Pow((double)(v / directValue), 2)) : 0;

        var stocks = rows.Where(r => r.Holding.AssetClass == AssetClass.Stock).ToList();
        var within30 = stocks.Where(r => r.Assessment.Facts.DaysToEarnings is >= 0 and <= 30).ToList();
        var small = rows.Where(r => !r.Assessment.Material).ToList();

        return new PortfolioKpis(
            total,
            directValue,
            snapshot.Account.UnrealizedPnl,
            rows.Count,
            Share(values.Take(1).Sum(), total),
            Share(values.Take(5).Sum(), total),
            hhi > 0 ? Math.Round(1 / hhi, 1) : 0,
            WeightedAverage(stocks, r => r.Assessment.Facts.SmartScore),
            WeightedAverage(stocks, r => r.Assessment.Components.Upside is null ? null : r.Assessment.Facts.StreetUpsidePct),
            Share(within30.Sum(r => r.Holding.Value), total),
            within30.Select(r => r.Holding.Symbol).ToList(),
            new SmallPositions(small.Count, small.Sum(r => r.Holding.Value), Share(small.Sum(r => r.Holding.Value), total)),
            Enum.GetValues<Verdict>().ToDictionary(v => v, v => rows.Count(r => r.Assessment.Verdict == v)));
    }

    private static decimal Share(decimal part, decimal total) => total > 0 ? Math.Round(part / total * 100, 1) : 0;

    private static double? WeightedAverage(IEnumerable<AnalyzedHolding> rows, Func<AnalyzedHolding, double?> selector)
    {
        var points = rows.Select(r => (Weight: (double)r.Holding.Value, Value: selector(r))).Where(p => p.Value.HasValue && p.Weight > 0).ToList();
        var weight = points.Sum(p => p.Weight);
        return weight > 0 ? Math.Round(points.Sum(p => p.Weight * p.Value!.Value) / weight, 2) : null;
    }
}

using System.Globalization;
using System.Text.Json;
using PortfolioSignals.Domain.Signals;

namespace PortfolioSignals.Infrastructure.Providers.TipRanks;

/// <summary>
/// Maps TipRanks tool responses (documented in the prototype notes) to <see cref="SignalData"/>. Parsing is tolerant:
/// a field the provider omits becomes null, never a guess.
/// </summary>
internal static class TipRanksMapper
{
    public static Dictionary<string, SignalData> FromAssetsData(JsonElement root)
    {
        var result = new Dictionary<string, SignalData>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in Items(root, "assetsData"))
        {
            var ticker = Str(item, "ticker");
            if (ticker is null)
            {
                continue;
            }

            result[ticker] = new SignalData
            {
                CompanyName = Str(item, "companyName"),
                Sector = Str(item, "sector"),
                Consensus = AnalystConsensusParser.Parse(Str(item, "analystConsensus")),
                BestAnalystConsensus = AnalystConsensusParser.Parse(Str(item, "bestAnalystConsensus")),
                PriceTarget = Dec(item, "priceTarget"),
                LastPrice = Dec(item, "price"),
                SmartScore = Int(item, "smartScore"),
                PeRatio = Num(item, "peRatio"),
                DividendYieldPct = Num(item, "dividendYield") is { } y ? y * 100 : null,
                NewsSentiment = Num(item, "newsSentiment"),
                HedgeFundsScore = Num(item, "hedgeFundsScore"),
                InsiderScore = Num(item, "insiderScore"),
                YtdGainPct = Num(item, "ytdGainPct"),
                YearlyGainPct = Num(item, "yearlyGainPct"),
                NextEarningsDate = Date(Str(item, "nextEarningsDate")),
            };
        }

        return result;
    }

    public static Dictionary<string, AiAnalysis> FromAiAnalysis(JsonElement root)
    {
        var result = new Dictionary<string, AiAnalysis>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in Items(root, "stocks"))
        {
            var ticker = Str(item, "ticker");
            if (ticker is null)
            {
                continue;
            }

            result[ticker] = new AiAnalysis(Num(item, "ai_score"), Str(item, "rating"), Dec(item, "price_target"), Num(item, "upside_pct"), Date(Str(item, "as_of")));
        }

        return result;
    }

    /// <summary>Counts each analyst's most recent rating (and most recent price target) over the trailing 12 months.</summary>
    public static AnalystBreadth? FromAnalystRatings(JsonElement root)
    {
        var rows = Items(root, "ratings").ToList();
        if (rows.Count == 0)
        {
            return null;
        }

        var latestRating = new Dictionary<string, (DateOnly Date, string? Rating)>();
        var latestTarget = new Dictionary<string, (DateOnly Date, decimal Target)>();
        foreach (var row in rows)
        {
            var key = Str(row, "expertUID") ?? Str(row, "analystName");
            if (key is null)
            {
                continue;
            }

            var date = UsDate(Str(row, "recommendationDate")) ?? DateOnly.MinValue;
            if (!latestRating.TryGetValue(key, out var seen) || date > seen.Date)
            {
                latestRating[key] = (date, Str(row, "recommendation"));
            }

            if (Dec(row, "priceTarget") is { } target && (!latestTarget.TryGetValue(key, out var seenTarget) || date > seenTarget.Date))
            {
                latestTarget[key] = (date, target);
            }
        }

        var targets = latestTarget.Values.Select(v => v.Target).Order().ToList();
        int Count(string label) => latestRating.Values.Count(v => string.Equals(v.Rating, label, StringComparison.OrdinalIgnoreCase));

        return new AnalystBreadth(
            latestRating.Count,
            Count("Buy"),
            Count("Hold"),
            Count("Sell"),
            targets.Count,
            targets.Count > 0 ? targets[0] : null,
            targets.Count > 0 ? Median(targets) : null,
            targets.Count > 0 ? targets[^1] : null);
    }

    private static decimal Median(List<decimal> sorted)
        => sorted.Count % 2 == 1 ? sorted[sorted.Count / 2] : (sorted[(sorted.Count / 2) - 1] + sorted[sorted.Count / 2]) / 2;

    private static IEnumerable<JsonElement> Items(JsonElement root, string property)
    {
        if (root.ValueKind == JsonValueKind.Array)
        {
            return root.EnumerateArray();
        }

        return root.ValueKind == JsonValueKind.Object && root.TryGetProperty(property, out var inner) && inner.ValueKind == JsonValueKind.Array
            ? inner.EnumerateArray()
            : [];
    }

    private static string? Str(JsonElement e, string name)
        => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static double? Num(JsonElement e, string name)
    {
        if (!e.TryGetProperty(name, out var v))
        {
            return null;
        }

        return v.ValueKind switch
        {
            JsonValueKind.Number => v.GetDouble(),
            JsonValueKind.String when double.TryParse(v.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null,
        };
    }

    private static decimal? Dec(JsonElement e, string name) => Num(e, name) is { } d ? (decimal)d : null;

    private static int? Int(JsonElement e, string name) => Num(e, name) is { } d ? (int)Math.Round(d) : null;

    private static DateOnly? Date(string? text)
        => text is { Length: >= 10 } && DateOnly.TryParseExact(text[..10], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? date : null;

    private static DateOnly? UsDate(string? text)
        => DateOnly.TryParseExact(text, "MM/dd/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? date : null;
}

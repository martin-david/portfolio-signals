namespace PortfolioSignals.Domain.Signals;

public enum AnalystConsensus
{
    StrongSell,
    Sell,
    Neutral,
    Buy,
    StrongBuy,
}

public static class AnalystConsensusParser
{
    /// <summary>Tolerant of provider labels such as "Strong Buy", "Moderate Buy", "Hold" and the provider's own "StongSell" typo.</summary>
    public static AnalystConsensus? Parse(string? label)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            return null;
        }

        var key = new string(label.Where(char.IsLetter).ToArray()).ToLowerInvariant();
        return key switch
        {
            "strongbuy" => AnalystConsensus.StrongBuy,
            "buy" or "moderatebuy" => AnalystConsensus.Buy,
            "hold" or "neutral" => AnalystConsensus.Neutral,
            "sell" or "moderatesell" => AnalystConsensus.Sell,
            "strongsell" or "stongsell" => AnalystConsensus.StrongSell,
            _ => null,
        };
    }

    /// <summary>Position on the -1..+1 scale used by the scoring rules.</summary>
    public static double ToScale(this AnalystConsensus consensus) => consensus switch
    {
        AnalystConsensus.StrongBuy => 1.0,
        AnalystConsensus.Buy => 0.5,
        AnalystConsensus.Neutral => 0.0,
        AnalystConsensus.Sell => -0.5,
        AnalystConsensus.StrongSell => -1.0,
        _ => throw new ArgumentOutOfRangeException(nameof(consensus), consensus, null),
    };
}

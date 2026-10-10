namespace PortfolioSignals.Domain.Portfolios;

public enum AssetClass
{
    Stock,
    Etf,
    Crypto,
    Other,
}

/// <summary>How an eToro instrument is looked up at TipRanks.</summary>
/// <param name="EtoroSymbol">Symbol as eToro reports it, for example <c>SHL.DE</c>.</param>
/// <param name="TipRanksTicker">TipRanks identifier: <c>CC:TICKER</c> for non-US listings, <c>XXXUSD</c> for crypto.</param>
/// <param name="AssetClass">Asset class of the instrument.</param>
/// <param name="RelatedTickers">Sibling listings whose analyst data stands in when the primary ticker has none (for example a share class).</param>
/// <param name="Note">Why the mapping is special.</param>
/// <param name="LowConfidence">The identity of the mapped asset is unverified; results are indicative only.</param>
public sealed record SymbolMapping(
    string EtoroSymbol,
    string TipRanksTicker,
    AssetClass AssetClass,
    IReadOnlyList<string> RelatedTickers,
    string? Note = null,
    bool LowConfidence = false);

/// <summary>
/// Resolves eToro symbols to TipRanks tickers: explicit overrides first, then conventions learned from the prototype
/// (<c>.DE</c> becomes <c>DE:</c>, <c>.PA</c> becomes <c>FR:</c>, crypto becomes <c>XXXUSD</c>).
/// </summary>
public sealed class SymbolResolver
{
    private static readonly Dictionary<string, string> ExchangeSuffixPrefixes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".DE"] = "DE:",
        [".PA"] = "FR:",
    };

    private readonly Dictionary<string, SymbolMapping> _overrides;

    public SymbolResolver(IEnumerable<SymbolMapping>? overrides = null)
    {
        _overrides = (overrides ?? []).ToDictionary(m => m.EtoroSymbol, StringComparer.OrdinalIgnoreCase);
    }

    public SymbolMapping Resolve(string etoroSymbol, AssetClass assetClass)
    {
        if (_overrides.TryGetValue(etoroSymbol, out var explicitMapping))
        {
            return explicitMapping;
        }

        var ticker = assetClass switch
        {
            AssetClass.Crypto => $"{etoroSymbol.ToUpperInvariant()}USD",
            _ => ApplyExchangeConvention(etoroSymbol),
        };

        return new SymbolMapping(etoroSymbol, ticker, assetClass, []);
    }

    private static string ApplyExchangeConvention(string symbol)
    {
        foreach (var (suffix, prefix) in ExchangeSuffixPrefixes)
        {
            if (symbol.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                return prefix + symbol[..^suffix.Length].ToUpperInvariant();
            }
        }

        return symbol.ToUpperInvariant();
    }
}

using System.ComponentModel.DataAnnotations;

namespace PortfolioSignals.Infrastructure.Providers.TipRanks;

public sealed class TipRanksOptions
{
    public const string SectionName = "Providers:TipRanks";

    [Required]
    [Url]
    public string Endpoint { get; set; } = "https://mcp.tipranks.com/mcp/";

    /// <summary>
    /// Also fetch per-ticker analyst ratings to compute analyst breadth and price-target spread. Costs one provider call per
    /// ticker, which matters on the free plan's monthly quota, so it is off by default.
    /// </summary>
    public bool IncludeAnalystRatings { get; set; }

    [Range(5, 300)]
    public int RequestTimeoutSeconds { get; set; } = 60;
}

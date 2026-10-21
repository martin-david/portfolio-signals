using System.ComponentModel.DataAnnotations;

namespace PortfolioSignals.Infrastructure.Providers.Etoro;

public sealed class EtoroOptions
{
    public const string SectionName = "Providers:Etoro";

    [Required]
    [Url]
    public string BaseUrl { get; set; } = "https://public-api.etoro.com";

    /// <summary>Selects the demo (virtual) portfolio endpoints instead of the real account. Requires a demo user key.</summary>
    public bool UseDemoAccount { get; set; }
}

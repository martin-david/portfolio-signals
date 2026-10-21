namespace PortfolioSignals.Domain.Integrations;

public enum IntegrationProvider
{
    Etoro,
    TipRanks,
}

public enum ConnectionStatus
{
    Active,

    /// <summary>The provider rejected the stored credentials; scheduled syncs stop until the user reconnects.</summary>
    CredentialsRejected,
    Disconnected,
}

public enum SyncFailureKind
{
    Unauthorized,
    RateLimited,
    Unavailable,
    InvalidResponse,
    Unknown,
}

public sealed record SyncFailure(SyncFailureKind Kind, string Message, DateTimeOffset At);

/// <summary>Describes the credential fields each provider needs. The values themselves are only ever held in the secret store.</summary>
public static class ProviderCatalog
{
    private static readonly IReadOnlyList<string> EtoroFields = ["apiKey", "userKey"];
    private static readonly IReadOnlyList<string> TipRanksFields = ["apiKey"];

    public static IReadOnlyList<string> RequiredCredentialFields(IntegrationProvider provider) => provider switch
    {
        IntegrationProvider.Etoro => EtoroFields,
        IntegrationProvider.TipRanks => TipRanksFields,
        _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, null),
    };
}

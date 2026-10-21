using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Abstractions;

/// <summary>A user's secrets for one provider. The values never appear in logs, <see cref="ToString"/> or API responses.</summary>
public sealed class ProviderCredentials
{
    private readonly IReadOnlyDictionary<string, string> _values;

    public ProviderCredentials(IReadOnlyDictionary<string, string> values)
    {
        _values = new Dictionary<string, string>(values, StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyDictionary<string, string> Values => _values;

    public string Require(string field)
        => _values.TryGetValue(field, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : throw new ProviderException(SyncFailureKind.Unauthorized, $"Credential field '{field}' is missing.");

    public override string ToString() => $"ProviderCredentials({_values.Count} fields, redacted)";
}

/// <summary>Where credentials live (Azure Key Vault in production). Addressed by user and provider; the secrets never enter the database.</summary>
public interface ICredentialStore
{
    Task SaveAsync(UserId userId, IntegrationProvider provider, ProviderCredentials credentials, CancellationToken cancellationToken);

    Task<ProviderCredentials?> GetAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken);

    Task DeleteAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken);
}

/// <summary>Thrown by provider adapters so the application can classify failures (quota, credentials, outage) without knowing the transport.</summary>
public sealed class ProviderException : Exception
{
    public ProviderException(SyncFailureKind kind, string message, TimeSpan? retryAfter = null, Exception? inner = null)
        : base(message, inner)
    {
        Kind = kind;
        RetryAfter = retryAfter;
    }

    public SyncFailureKind Kind { get; }

    public TimeSpan? RetryAfter { get; }
}

/// <summary>The eToro portfolio in the application's own terms; the adapter hides the provider's wire format.</summary>
public sealed record EtoroPortfolio(
    DateTimeOffset TakenAt,
    AccountSummary Account,
    IReadOnlyList<EtoroHolding> Holdings,
    IReadOnlyList<CopiedTrader> CopiedTraders);

public sealed record EtoroHolding(
    int InstrumentId,
    string Symbol,
    string Name,
    AssetClass AssetClass,
    decimal Invested,
    decimal Value,
    decimal Pnl,
    decimal PnlPct,
    decimal Units,
    decimal AvgOpenRate,
    decimal AvgLeverage,
    decimal Exposure);

public interface IEtoroPortfolioClient
{
    Task<EtoroPortfolio> GetPortfolioAsync(ProviderCredentials credentials, CancellationToken cancellationToken);
}

public interface ITipRanksClient
{
    /// <summary>Fetches signals for the given TipRanks tickers. Tickers without coverage are simply absent from the result.</summary>
    Task<IReadOnlyDictionary<string, SignalData>> GetSignalsAsync(ProviderCredentials credentials, IReadOnlyCollection<string> tickers, CancellationToken cancellationToken);
}

/// <summary>Message on the sync queue. The run identifier is the idempotency key.</summary>
public sealed record SyncRequestMessage(string UserId, IntegrationProvider Provider, string RunId);

public interface ISyncRequestPublisher
{
    Task PublishAsync(SyncRequestMessage message, CancellationToken cancellationToken);
}

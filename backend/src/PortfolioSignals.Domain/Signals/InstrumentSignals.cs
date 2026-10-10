using PortfolioSignals.Domain.Common;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Domain.Signals;

/// <summary>
/// The latest TipRanks signals for one ticker, as fetched with one user's credentials. Kept per user (not shared) because
/// the data is fetched under that user's licence and quota. Only the latest state is kept; refreshing replaces it.
/// </summary>
public sealed class InstrumentSignals : AggregateRoot<string>
{
    private InstrumentSignals(UserId userId, string ticker, SignalData data, DateTimeOffset fetchedAt)
        : base(NormalizeTicker(ticker))
    {
        UserId = userId;
        Data = data;
        FetchedAt = fetchedAt;
    }

    public UserId UserId { get; }

    public string Ticker => Id;

    public SignalData Data { get; private set; }

    public DateTimeOffset FetchedAt { get; private set; }

    public static string NormalizeTicker(string ticker) => Guard.NotBlank(ticker, nameof(ticker)).ToUpperInvariant();

    public static InstrumentSignals Create(UserId userId, string ticker, SignalData data, DateTimeOffset fetchedAt)
        => new(userId, ticker, data, fetchedAt);

    /// <summary>Rebuilds the aggregate from persisted state; raises no events.</summary>
    public static InstrumentSignals Restore(UserId userId, string ticker, SignalData data, DateTimeOffset fetchedAt)
        => new(userId, ticker, data, fetchedAt);

    public void Refresh(SignalData data, DateTimeOffset fetchedAt)
    {
        Data = data;
        FetchedAt = fetchedAt;
    }
}

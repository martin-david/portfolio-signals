using PortfolioSignals.Domain.Common;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Domain.Portfolios;

public sealed record PortfolioSnapshotCaptured(UserId UserId, string SnapshotId, DateTimeOffset OccurredAt) : IDomainEvent;

/// <summary>
/// An immutable, point-in-time copy of a user's eToro portfolio. Snapshots are never edited: a new sync captures a new
/// one, which gives the synchronization history and makes every number in an analysis traceable to saved data.
/// The identifier derives from the provider's timestamp, so re-capturing the same data is idempotent.
/// </summary>
public sealed class PortfolioSnapshot : AggregateRoot<string>
{
    private PortfolioSnapshot(
        string id,
        UserId userId,
        DateTimeOffset takenAt,
        AccountSummary account,
        IReadOnlyList<Holding> holdings,
        IReadOnlyList<CopiedTrader> copiedTraders)
        : base(id)
    {
        UserId = userId;
        TakenAt = takenAt;
        Account = account;
        Holdings = holdings;
        CopiedTraders = copiedTraders;
    }

    public UserId UserId { get; }

    public DateTimeOffset TakenAt { get; }

    public AccountSummary Account { get; }

    public IReadOnlyList<Holding> Holdings { get; }

    public IReadOnlyList<CopiedTrader> CopiedTraders { get; }

    public static string IdFor(DateTimeOffset takenAt) => takenAt.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", System.Globalization.CultureInfo.InvariantCulture);

    public static PortfolioSnapshot Capture(
        UserId userId,
        DateTimeOffset takenAt,
        AccountSummary account,
        IEnumerable<Holding> holdings,
        IEnumerable<CopiedTrader> copiedTraders,
        DateTimeOffset now)
    {
        var holdingList = holdings.OrderByDescending(h => h.Value).ToList();
        if (holdingList.GroupBy(h => h.InstrumentId).Any(g => g.Count() > 1))
        {
            throw new DomainException("A snapshot can hold each instrument only once.");
        }

        Guard.NotNegative(account.TotalValue, nameof(account.TotalValue));

        var snapshot = new PortfolioSnapshot(IdFor(takenAt), userId, takenAt, account, holdingList, copiedTraders.ToList());
        snapshot.Raise(new PortfolioSnapshotCaptured(userId, snapshot.Id, now));
        return snapshot;
    }

    /// <summary>Rebuilds the aggregate from persisted state; raises no events.</summary>
    public static PortfolioSnapshot Restore(
        string id,
        UserId userId,
        DateTimeOffset takenAt,
        AccountSummary account,
        IReadOnlyList<Holding> holdings,
        IReadOnlyList<CopiedTrader> copiedTraders)
        => new(id, userId, takenAt, account, holdings, copiedTraders);

    /// <summary>Share of the whole account (including copy trading and cash) in a holding, as a percentage.</summary>
    public decimal WeightPct(Holding holding)
        => Account.TotalValue > 0 ? Math.Round(holding.Value / Account.TotalValue * 100, 4) : 0;

    public IEnumerable<string> TipRanksTickers()
        => Holdings
            .Where(h => h.AssetClass == AssetClass.Stock)
            .SelectMany(h => h.RelatedTickers.Prepend(h.TipRanksTicker))
            .Distinct(StringComparer.OrdinalIgnoreCase);
}

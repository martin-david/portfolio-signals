using PortfolioSignals.Domain.Integrations;

namespace PortfolioSignals.Domain.Users;

public enum SubscriptionPlan
{
    Free,
    Essential,
    Pro,
    Premium,
}

/// <summary>
/// What a subscription plan entitles a user to. Intervals are the minimum time between scheduled syncs;
/// provider limits can still delay a sync, so no plan implies real-time data.
/// </summary>
public sealed record SyncPolicy(TimeSpan EtoroInterval, TimeSpan TipRanksInterval, bool AllowsManualSync)
{
    public static readonly TimeSpan ManualSyncCooldown = TimeSpan.FromMinutes(15);

    public TimeSpan IntervalFor(IntegrationProvider provider) => provider switch
    {
        IntegrationProvider.Etoro => EtoroInterval,
        IntegrationProvider.TipRanks => TipRanksInterval,
        _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, null),
    };

    public static SyncPolicy For(SubscriptionPlan plan) => plan switch
    {
        SubscriptionPlan.Free => new SyncPolicy(TimeSpan.FromDays(7), TimeSpan.FromDays(7), AllowsManualSync: true),
        SubscriptionPlan.Essential => new SyncPolicy(TimeSpan.FromDays(1), TimeSpan.FromDays(1), AllowsManualSync: true),
        SubscriptionPlan.Pro => new SyncPolicy(TimeSpan.FromHours(6), TimeSpan.FromHours(6), AllowsManualSync: true),
        SubscriptionPlan.Premium => new SyncPolicy(TimeSpan.FromHours(1), TimeSpan.FromHours(1), AllowsManualSync: true),
        _ => throw new ArgumentOutOfRangeException(nameof(plan), plan, null),
    };
}

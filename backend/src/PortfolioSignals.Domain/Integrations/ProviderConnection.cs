using PortfolioSignals.Domain.Common;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Domain.Integrations;

public sealed record ProviderConnected(UserId UserId, IntegrationProvider Provider, DateTimeOffset OccurredAt) : IDomainEvent;

public sealed record ProviderDisconnected(UserId UserId, IntegrationProvider Provider, DateTimeOffset OccurredAt) : IDomainEvent;

/// <summary>
/// A user's link to one provider (eToro or TipRanks) and the health of its synchronization.
/// It never holds credentials: those live in the secret store, addressed by user and provider.
/// </summary>
public sealed class ProviderConnection : AggregateRoot<string>
{
    public static readonly TimeSpan QueueLease = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan BaseBackoff = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromHours(6);

    private ProviderConnection(UserId userId, IntegrationProvider provider)
        : base(IdFor(userId, provider))
    {
        UserId = userId;
        Provider = provider;
    }

    public UserId UserId { get; }

    public IntegrationProvider Provider { get; }

    public ConnectionStatus Status { get; private set; }

    public DateTimeOffset ConnectedAt { get; private set; }

    public DateTimeOffset? SyncRequestedAt { get; private set; }

    public DateTimeOffset? LastAttemptAt { get; private set; }

    public DateTimeOffset? LastSuccessfulSyncAt { get; private set; }

    public SyncFailure? LastFailure { get; private set; }

    public int ConsecutiveFailures { get; private set; }

    public DateTimeOffset? RetryNotBefore { get; private set; }

    public static string IdFor(UserId userId, IntegrationProvider provider) => $"{userId.Value}:{provider}";

    public static ProviderConnection Connect(UserId userId, IntegrationProvider provider, DateTimeOffset now)
    {
        var connection = new ProviderConnection(userId, provider);
        connection.Activate(now);
        return connection;
    }

    /// <summary>Rebuilds the aggregate from persisted state; raises no events.</summary>
    public static ProviderConnection Restore(
        UserId userId,
        IntegrationProvider provider,
        ConnectionStatus status,
        DateTimeOffset connectedAt,
        DateTimeOffset? syncRequestedAt,
        DateTimeOffset? lastAttemptAt,
        DateTimeOffset? lastSuccessfulSyncAt,
        SyncFailure? lastFailure,
        int consecutiveFailures,
        DateTimeOffset? retryNotBefore)
        => new(userId, provider)
        {
            Status = status,
            ConnectedAt = connectedAt,
            SyncRequestedAt = syncRequestedAt,
            LastAttemptAt = lastAttemptAt,
            LastSuccessfulSyncAt = lastSuccessfulSyncAt,
            LastFailure = lastFailure,
            ConsecutiveFailures = consecutiveFailures,
            RetryNotBefore = retryNotBefore,
        };

    /// <summary>Called when the user supplies (new) credentials: clears failure state and makes the connection eligible for sync.</summary>
    public void Reconnect(DateTimeOffset now) => Activate(now);

    public void Disconnect(DateTimeOffset now)
    {
        if (Status == ConnectionStatus.Disconnected)
        {
            return;
        }

        Status = ConnectionStatus.Disconnected;
        SyncRequestedAt = null;
        Raise(new ProviderDisconnected(UserId, Provider, now));
    }

    public void MarkSyncRequested(DateTimeOffset now)
    {
        EnsureActive();
        SyncRequestedAt = now;
    }

    public void RecordSuccess(DateTimeOffset now)
    {
        EnsureActive();
        LastAttemptAt = now;
        LastSuccessfulSyncAt = now;
        LastFailure = null;
        ConsecutiveFailures = 0;
        RetryNotBefore = null;
        SyncRequestedAt = null;
    }

    /// <summary>A sync was skipped without failing (for example a prerequisite is missing): release the queue lease and try again later.</summary>
    public void Defer(DateTimeOffset now, TimeSpan delay)
    {
        EnsureActive();
        SyncRequestedAt = null;
        RetryNotBefore = now + delay;
    }

    public void RecordFailure(SyncFailureKind kind, string message, DateTimeOffset now, TimeSpan? retryAfter = null)
    {
        EnsureActive();
        LastAttemptAt = now;
        LastFailure = new SyncFailure(kind, message, now);
        ConsecutiveFailures++;
        SyncRequestedAt = null;

        if (kind == SyncFailureKind.Unauthorized)
        {
            Status = ConnectionStatus.CredentialsRejected;
            RetryNotBefore = null;
            return;
        }

        RetryNotBefore = now + (retryAfter ?? Backoff(ConsecutiveFailures));
    }

    /// <summary>True when a scheduled sync should be enqueued: active, not in backoff, not already queued, and the plan interval has elapsed.</summary>
    public bool IsDue(DateTimeOffset now, TimeSpan interval)
    {
        if (Status != ConnectionStatus.Active)
        {
            return false;
        }

        if (RetryNotBefore is { } retry && now < retry)
        {
            return false;
        }

        if (SyncRequestedAt is { } requested && now - requested < QueueLease)
        {
            return false;
        }

        return LastSuccessfulSyncAt is not { } last || now - last >= interval;
    }

    public DateTimeOffset? NextDueAt(TimeSpan interval)
    {
        if (Status != ConnectionStatus.Active)
        {
            return null;
        }

        var due = LastSuccessfulSyncAt is { } last ? last + interval : ConnectedAt;
        return RetryNotBefore is { } retry && retry > due ? retry : due;
    }

    private static TimeSpan Backoff(int consecutiveFailures)
    {
        var factor = Math.Pow(2, Math.Min(consecutiveFailures - 1, 10));
        var delay = TimeSpan.FromTicks((long)(BaseBackoff.Ticks * factor));
        return delay > MaxBackoff ? MaxBackoff : delay;
    }

    private void Activate(DateTimeOffset now)
    {
        Status = ConnectionStatus.Active;
        ConnectedAt = now;
        SyncRequestedAt = null;
        LastFailure = null;
        ConsecutiveFailures = 0;
        RetryNotBefore = null;
        Raise(new ProviderConnected(UserId, Provider, now));
    }

    private void EnsureActive()
    {
        if (Status == ConnectionStatus.Disconnected)
        {
            throw new DomainException($"The {Provider} connection is disconnected.");
        }
    }
}

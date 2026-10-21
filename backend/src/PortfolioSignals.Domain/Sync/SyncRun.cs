using PortfolioSignals.Domain.Common;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Domain.Sync;

public enum SyncTrigger
{
    Scheduled,
    Manual,
}

public enum SyncRunStatus
{
    Queued,
    Running,
    Succeeded,
    Failed,
    Skipped,
}

/// <summary>
/// One attempt to synchronize a provider for a user. Its identifier doubles as the idempotency key of the queued
/// message, so a redelivered message never calls the provider twice. Also the source of the user-visible sync history.
/// </summary>
public sealed class SyncRun : AggregateRoot<string>
{
    private SyncRun(string id, UserId userId, IntegrationProvider provider, SyncTrigger trigger, DateTimeOffset requestedAt)
        : base(id)
    {
        UserId = userId;
        Provider = provider;
        Trigger = trigger;
        RequestedAt = requestedAt;
    }

    public UserId UserId { get; }

    public IntegrationProvider Provider { get; }

    public SyncTrigger Trigger { get; }

    public SyncRunStatus Status { get; private set; } = SyncRunStatus.Queued;

    public DateTimeOffset RequestedAt { get; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public int ItemsProcessed { get; private set; }

    public SyncFailure? Failure { get; private set; }

    public string? SkipReason { get; private set; }

    public bool IsFinished => Status is SyncRunStatus.Succeeded or SyncRunStatus.Failed or SyncRunStatus.Skipped;

    public static SyncRun Request(UserId userId, IntegrationProvider provider, SyncTrigger trigger, DateTimeOffset now)
        => new(Guid.NewGuid().ToString("N"), userId, provider, trigger, now);

    /// <summary>Rebuilds the aggregate from persisted state; raises no events.</summary>
    public static SyncRun Restore(
        string id,
        UserId userId,
        IntegrationProvider provider,
        SyncTrigger trigger,
        SyncRunStatus status,
        DateTimeOffset requestedAt,
        DateTimeOffset? startedAt,
        DateTimeOffset? completedAt,
        int itemsProcessed,
        SyncFailure? failure,
        string? skipReason)
        => new(id, userId, provider, trigger, requestedAt)
        {
            Status = status,
            StartedAt = startedAt,
            CompletedAt = completedAt,
            ItemsProcessed = itemsProcessed,
            Failure = failure,
            SkipReason = skipReason,
        };

    /// <summary>Starting a run that is already running is allowed so a redelivered queue message can resume after a crash.</summary>
    public void Start(DateTimeOffset now)
    {
        if (Status is not (SyncRunStatus.Queued or SyncRunStatus.Running))
        {
            throw new DomainException($"A sync run in state {Status} cannot be started.");
        }

        Status = SyncRunStatus.Running;
        StartedAt = now;
    }

    public void Succeed(DateTimeOffset now, int itemsProcessed)
    {
        EnsureRunning();
        Status = SyncRunStatus.Succeeded;
        CompletedAt = now;
        ItemsProcessed = itemsProcessed;
    }

    public void Fail(DateTimeOffset now, SyncFailureKind kind, string message)
    {
        EnsureRunning();
        Status = SyncRunStatus.Failed;
        CompletedAt = now;
        Failure = new SyncFailure(kind, message, now);
    }

    public void Skip(DateTimeOffset now, string reason)
    {
        if (IsFinished)
        {
            throw new DomainException($"A sync run in state {Status} cannot be skipped.");
        }

        Status = SyncRunStatus.Skipped;
        CompletedAt = now;
        SkipReason = reason;
    }

    private void EnsureRunning()
    {
        if (Status != SyncRunStatus.Running)
        {
            throw new DomainException($"A sync run in state {Status} is not running.");
        }
    }
}

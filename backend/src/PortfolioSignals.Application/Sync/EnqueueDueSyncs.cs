using FreeMediator;
using Microsoft.Extensions.Logging;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Sync;

/// <summary>
/// Invoked by the timer function: finds connections whose plan interval has elapsed and queues one sync run each.
/// Work is fanned out to the queue so each user's sync is isolated, retried and rate-limited independently.
/// </summary>
public sealed record EnqueueDueSyncsCommand(int MaxRuns = 500) : IRequest<int>;

public sealed class EnqueueDueSyncsHandler(
    IConnectionRepository connections,
    IUserRepository users,
    ISyncRunRepository runs,
    ISyncRequestPublisher publisher,
    TimeProvider clock,
    ILogger<EnqueueDueSyncsHandler> logger) : IRequestHandler<EnqueueDueSyncsCommand, int>
{
    public async Task<int> Handle(EnqueueDueSyncsCommand request, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var enqueued = 0;
        var policies = new Dictionary<UserId, SyncPolicy?>();

        foreach (var connection in await connections.ListActiveAsync(cancellationToken))
        {
            if (enqueued >= request.MaxRuns)
            {
                logger.LogInformation("Sync batch limit of {Max} reached; remaining connections wait for the next tick.", request.MaxRuns);
                break;
            }

            if (!policies.TryGetValue(connection.UserId, out var policy))
            {
                policy = (await users.GetAsync(connection.UserId, cancellationToken))?.SyncPolicy;
                policies[connection.UserId] = policy;
            }

            if (policy is null || !connection.IsDue(now, policy.IntervalFor(connection.Provider)))
            {
                continue;
            }

            var run = SyncRun.Request(connection.UserId, connection.Provider, SyncTrigger.Scheduled, now);
            await runs.SaveAsync(run, cancellationToken);
            connection.MarkSyncRequested(now);
            await connections.SaveAsync(connection, cancellationToken);
            await publisher.PublishAsync(new SyncRequestMessage(connection.UserId.Value, connection.Provider, run.Id), cancellationToken);
            enqueued++;
        }

        logger.LogInformation("Enqueued {Count} scheduled sync run(s).", enqueued);
        return enqueued;
    }
}

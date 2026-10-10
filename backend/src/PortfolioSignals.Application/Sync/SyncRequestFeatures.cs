using FluentValidation;
using FreeMediator;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Sync;

public sealed record SyncRunDto(
    string Id,
    IntegrationProvider Provider,
    SyncTrigger Trigger,
    SyncRunStatus Status,
    DateTimeOffset RequestedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    int ItemsProcessed,
    SyncFailure? Failure,
    string? SkipReason)
{
    public static SyncRunDto From(SyncRun run) => new(
        run.Id,
        run.Provider,
        run.Trigger,
        run.Status,
        run.RequestedAt,
        run.StartedAt,
        run.CompletedAt,
        run.ItemsProcessed,
        run.Failure,
        run.SkipReason);
}

public sealed record ListSyncRunsQuery(UserId UserId, int Take = 20) : IRequest<Result<IReadOnlyList<SyncRunDto>>>;

public sealed class ListSyncRunsValidator : AbstractValidator<ListSyncRunsQuery>
{
    public ListSyncRunsValidator()
    {
        RuleFor(q => q.Take).InclusiveBetween(1, 100);
    }
}

public sealed class ListSyncRunsHandler(ISyncRunRepository runs) : IRequestHandler<ListSyncRunsQuery, Result<IReadOnlyList<SyncRunDto>>>
{
    public async Task<Result<IReadOnlyList<SyncRunDto>>> Handle(ListSyncRunsQuery request, CancellationToken cancellationToken)
    {
        var recent = await runs.ListRecentAsync(request.UserId, request.Take, cancellationToken);
        return Result<IReadOnlyList<SyncRunDto>>.Success(recent.Select(SyncRunDto.From).ToList());
    }
}

/// <summary>Queues a manual sync for one provider, or for every active connection when no provider is given.</summary>
public sealed record RequestSyncCommand(UserId UserId, IntegrationProvider? Provider) : IRequest<Result<IReadOnlyList<SyncRunDto>>>;

public sealed class RequestSyncHandler(
    IUserRepository users,
    IConnectionRepository connections,
    ISyncRunRepository runs,
    ISyncRequestPublisher publisher,
    TimeProvider clock) : IRequestHandler<RequestSyncCommand, Result<IReadOnlyList<SyncRunDto>>>
{
    public async Task<Result<IReadOnlyList<SyncRunDto>>> Handle(RequestSyncCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetAsync(request.UserId, cancellationToken);
        if (user is null)
        {
            return Error.NotFound("user.not_registered", "Register a profile first.");
        }

        if (!user.SyncPolicy.AllowsManualSync)
        {
            return Error.Conflict("sync.manual_not_allowed", "Manual sync is not included in the current plan.");
        }

        var targets = (await connections.ListForUserAsync(request.UserId, cancellationToken))
            .Where(c => c.Status == ConnectionStatus.Active && (request.Provider is null || c.Provider == request.Provider))
            .ToList();
        if (targets.Count == 0)
        {
            return Error.NotFound("sync.no_active_connection", "There is no active connection to synchronize.");
        }

        var now = clock.GetUtcNow();
        foreach (var connection in targets)
        {
            var last = new[] { connection.LastAttemptAt, connection.SyncRequestedAt }.Max();
            if (last is { } at && now - at < SyncPolicy.ManualSyncCooldown)
            {
                var wait = (int)Math.Ceiling((SyncPolicy.ManualSyncCooldown - (now - at)).TotalMinutes);
                return Error.TooManyRequests("sync.cooldown", $"{connection.Provider} was synchronized recently. Try again in about {wait} minute(s).");
            }
        }

        var created = new List<SyncRunDto>();
        foreach (var connection in targets)
        {
            var run = SyncRun.Request(request.UserId, connection.Provider, SyncTrigger.Manual, now);
            await runs.SaveAsync(run, cancellationToken);
            connection.MarkSyncRequested(now);
            await connections.SaveAsync(connection, cancellationToken);
            await publisher.PublishAsync(new SyncRequestMessage(request.UserId.Value, connection.Provider, run.Id), cancellationToken);
            created.Add(SyncRunDto.From(run));
        }

        return Result<IReadOnlyList<SyncRunDto>>.Success(created);
    }
}

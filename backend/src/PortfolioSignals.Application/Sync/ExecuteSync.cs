using FreeMediator;
using Microsoft.Extensions.Logging;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Sync;

/// <summary>Runs one queued sync. Safe to redeliver: finished runs are no-ops and snapshots are keyed by the provider's timestamp.</summary>
public sealed record ExecuteSyncCommand(UserId UserId, IntegrationProvider Provider, string RunId) : IRequest<Result>;

public sealed class ExecuteSyncHandler(
    IConnectionRepository connections,
    ISyncRunRepository runs,
    IPortfolioSnapshotRepository snapshots,
    ISignalsRepository signals,
    ICredentialStore credentialStore,
    IEtoroPortfolioClient etoro,
    ITipRanksClient tipRanks,
    SymbolResolver symbolResolver,
    TimeProvider clock,
    ILogger<ExecuteSyncHandler> logger) : IRequestHandler<ExecuteSyncCommand, Result>
{
    public async Task<Result> Handle(ExecuteSyncCommand request, CancellationToken cancellationToken)
    {
        var run = await runs.GetAsync(request.UserId, request.RunId, cancellationToken);
        if (run is null)
        {
            return Error.NotFound("sync.run_not_found", "The sync run does not exist.");
        }

        if (run.IsFinished)
        {
            return Result.Success();
        }

        var connection = await connections.GetAsync(request.UserId, request.Provider, cancellationToken);
        if (connection is null || connection.Status != ConnectionStatus.Active)
        {
            run.Skip(clock.GetUtcNow(), "The connection is not active.");
            await runs.SaveAsync(run, cancellationToken);
            return Result.Success();
        }

        run.Start(clock.GetUtcNow());
        await runs.SaveAsync(run, cancellationToken);

        try
        {
            var credentials = await credentialStore.GetAsync(request.UserId, request.Provider, cancellationToken)
                ?? throw new ProviderException(SyncFailureKind.Unauthorized, "No credentials are stored for this connection.");

            var outcome = request.Provider switch
            {
                IntegrationProvider.Etoro => await SyncEtoroAsync(request.UserId, credentials, cancellationToken),
                IntegrationProvider.TipRanks => await SyncTipRanksAsync(request.UserId, credentials, cancellationToken),
                _ => throw new ArgumentOutOfRangeException(nameof(request), request.Provider, null),
            };

            var now = clock.GetUtcNow();
            if (outcome.SkipReason is { } reason)
            {
                run.Skip(now, reason);
                connection.Defer(now, TimeSpan.FromMinutes(15));
            }
            else
            {
                run.Succeed(now, outcome.Items);
                connection.RecordSuccess(now);
            }
        }
        catch (ProviderException ex)
        {
            logger.LogWarning("Sync {RunId} for {Provider} failed: {Kind}", run.Id, request.Provider, ex.Kind);
            var now = clock.GetUtcNow();
            run.Fail(now, ex.Kind, ex.Message);
            connection.RecordFailure(ex.Kind, ex.Message, now, ex.RetryAfter);
        }

        await runs.SaveAsync(run, cancellationToken);
        await connections.SaveAsync(connection, cancellationToken);
        return Result.Success();
    }

    private async Task<SyncOutcome> SyncEtoroAsync(UserId userId, ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        var portfolio = await etoro.GetPortfolioAsync(credentials, cancellationToken);
        var holdings = portfolio.Holdings.Select(h =>
        {
            var mapping = symbolResolver.Resolve(h.Symbol, h.AssetClass);
            return new Holding(
                h.InstrumentId,
                h.Symbol,
                h.Name,
                mapping.AssetClass,
                mapping.TipRanksTicker,
                mapping.RelatedTickers,
                h.Invested,
                h.Value,
                h.Pnl,
                h.PnlPct,
                h.Units,
                h.AvgOpenRate,
                h.AvgLeverage,
                h.Exposure);
        });

        var snapshot = PortfolioSnapshot.Capture(userId, portfolio.TakenAt, portfolio.Account, holdings, portfolio.CopiedTraders, clock.GetUtcNow());
        await snapshots.SaveAsync(snapshot, cancellationToken);
        return new SyncOutcome(snapshot.Holdings.Count, null);
    }

    private async Task<SyncOutcome> SyncTipRanksAsync(UserId userId, ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        var snapshot = await snapshots.GetLatestAsync(userId, cancellationToken);
        if (snapshot is null)
        {
            return new SyncOutcome(0, "No portfolio snapshot yet; synchronize eToro first.");
        }

        var tickers = snapshot.TipRanksTickers().ToList();
        if (tickers.Count == 0)
        {
            return new SyncOutcome(0, null);
        }

        var fetched = await tipRanks.GetSignalsAsync(credentials, tickers, cancellationToken);
        var existing = (await signals.ListAsync(userId, cancellationToken)).ToDictionary(s => s.Ticker);
        var now = clock.GetUtcNow();

        var updated = new List<InstrumentSignals>();
        foreach (var (ticker, data) in fetched)
        {
            var key = InstrumentSignals.NormalizeTicker(ticker);
            if (existing.TryGetValue(key, out var current))
            {
                current.Refresh(data, now);
                updated.Add(current);
            }
            else
            {
                updated.Add(InstrumentSignals.Create(userId, key, data, now));
            }
        }

        await signals.SaveManyAsync(updated, cancellationToken);
        return new SyncOutcome(updated.Count, null);
    }

    private sealed record SyncOutcome(int Items, string? SkipReason);
}

using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Abstractions;

public interface IUserRepository
{
    Task<UserAccount?> GetAsync(UserId id, CancellationToken cancellationToken);

    Task SaveAsync(UserAccount user, CancellationToken cancellationToken);
}

public interface IConnectionRepository
{
    Task<ProviderConnection?> GetAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken);

    Task<IReadOnlyList<ProviderConnection>> ListForUserAsync(UserId userId, CancellationToken cancellationToken);

    /// <summary>Active connections across all users; used only by the scheduler, which runs on a timer.</summary>
    Task<IReadOnlyList<ProviderConnection>> ListActiveAsync(CancellationToken cancellationToken);

    Task SaveAsync(ProviderConnection connection, CancellationToken cancellationToken);
}

public interface IPortfolioSnapshotRepository
{
    Task<PortfolioSnapshot?> GetLatestAsync(UserId userId, CancellationToken cancellationToken);

    Task<IReadOnlyList<PortfolioSnapshot>> ListRecentAsync(UserId userId, int take, CancellationToken cancellationToken);

    Task SaveAsync(PortfolioSnapshot snapshot, CancellationToken cancellationToken);
}

public interface ISignalsRepository
{
    Task<IReadOnlyList<InstrumentSignals>> ListAsync(UserId userId, CancellationToken cancellationToken);

    Task SaveManyAsync(IReadOnlyCollection<InstrumentSignals> signals, CancellationToken cancellationToken);
}

public interface ISyncRunRepository
{
    Task<SyncRun?> GetAsync(UserId userId, string id, CancellationToken cancellationToken);

    Task<IReadOnlyList<SyncRun>> ListRecentAsync(UserId userId, int take, CancellationToken cancellationToken);

    Task SaveAsync(SyncRun run, CancellationToken cancellationToken);
}

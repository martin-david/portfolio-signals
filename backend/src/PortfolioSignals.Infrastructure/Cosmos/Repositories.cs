using Microsoft.Azure.Cosmos;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Infrastructure.Cosmos;

internal sealed class CosmosUserRepository(CosmosContext context) : IUserRepository
{
    public async Task<UserAccount?> GetAsync(UserId id, CancellationToken cancellationToken)
        => (await CosmosContext.TryReadAsync<UserDocument>(context.Accounts, id.Value, id.Value, cancellationToken))?.ToDomain();

    public async Task SaveAsync(UserAccount user, CancellationToken cancellationToken)
        => await context.Accounts.UpsertItemAsync(UserDocument.From(user), new PartitionKey(user.Id.Value), cancellationToken: cancellationToken);
}

internal sealed class CosmosConnectionRepository(CosmosContext context) : IConnectionRepository
{
    public async Task<ProviderConnection?> GetAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
        => (await CosmosContext.TryReadAsync<ConnectionDocument>(context.Accounts, provider.ToString(), userId.Value, cancellationToken))?.ToDomain();

    public async Task<IReadOnlyList<ProviderConnection>> ListForUserAsync(UserId userId, CancellationToken cancellationToken)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.type = @type").WithParameter("@type", DocumentTypes.Connection);
        var documents = await CosmosContext.QueryAsync<ConnectionDocument>(context.Accounts, query, userId.Value, cancellationToken);
        return documents.Select(d => d.ToDomain()).ToList();
    }

    public async Task<IReadOnlyList<ProviderConnection>> ListActiveAsync(CancellationToken cancellationToken)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.type = @type AND c.status = @status")
            .WithParameter("@type", DocumentTypes.Connection)
            .WithParameter("@status", nameof(ConnectionStatus.Active));
        var documents = await CosmosContext.QueryAsync<ConnectionDocument>(context.Accounts, query, partitionKey: null, cancellationToken);
        return documents.Select(d => d.ToDomain()).ToList();
    }

    public async Task SaveAsync(ProviderConnection connection, CancellationToken cancellationToken)
        => await context.Accounts.UpsertItemAsync(ConnectionDocument.From(connection), new PartitionKey(connection.UserId.Value), cancellationToken: cancellationToken);
}

internal sealed class CosmosPortfolioSnapshotRepository(CosmosContext context) : IPortfolioSnapshotRepository
{
    public async Task<PortfolioSnapshot?> GetLatestAsync(UserId userId, CancellationToken cancellationToken)
    {
        var latest = await ListRecentAsync(userId, 1, cancellationToken);
        return latest.Count > 0 ? latest[0] : null;
    }

    public async Task<IReadOnlyList<PortfolioSnapshot>> ListRecentAsync(UserId userId, int take, CancellationToken cancellationToken)
    {
        var query = new QueryDefinition("SELECT TOP @take * FROM c WHERE c.type = @type ORDER BY c.takenAt DESC")
            .WithParameter("@take", take)
            .WithParameter("@type", DocumentTypes.Snapshot);
        var documents = await CosmosContext.QueryAsync<SnapshotDocument>(context.Portfolio, query, userId.Value, cancellationToken);
        return documents.Select(d => d.ToDomain()).ToList();
    }

    public async Task SaveAsync(PortfolioSnapshot snapshot, CancellationToken cancellationToken)
        => await context.Portfolio.UpsertItemAsync(
            SnapshotDocument.From(snapshot, context.SnapshotRetentionDays),
            new PartitionKey(snapshot.UserId.Value),
            cancellationToken: cancellationToken);
}

internal sealed class CosmosSignalsRepository(CosmosContext context) : ISignalsRepository
{
    public async Task<IReadOnlyList<InstrumentSignals>> ListAsync(UserId userId, CancellationToken cancellationToken)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.type = @type").WithParameter("@type", DocumentTypes.Signals);
        var documents = await CosmosContext.QueryAsync<SignalsDocument>(context.Portfolio, query, userId.Value, cancellationToken);
        return documents.Select(d => d.ToDomain()).ToList();
    }

    public async Task SaveManyAsync(IReadOnlyCollection<InstrumentSignals> signals, CancellationToken cancellationToken)
    {
        foreach (var item in signals)
        {
            await context.Portfolio.UpsertItemAsync(SignalsDocument.From(item), new PartitionKey(item.UserId.Value), cancellationToken: cancellationToken);
        }
    }
}

internal sealed class CosmosSyncRunRepository(CosmosContext context) : ISyncRunRepository
{
    public async Task<SyncRun?> GetAsync(UserId userId, string id, CancellationToken cancellationToken)
        => (await CosmosContext.TryReadAsync<SyncRunDocument>(context.Portfolio, id, userId.Value, cancellationToken))?.ToDomain();

    public async Task<IReadOnlyList<SyncRun>> ListRecentAsync(UserId userId, int take, CancellationToken cancellationToken)
    {
        var query = new QueryDefinition("SELECT TOP @take * FROM c WHERE c.type = @type ORDER BY c.requestedAt DESC")
            .WithParameter("@take", take)
            .WithParameter("@type", DocumentTypes.SyncRun);
        var documents = await CosmosContext.QueryAsync<SyncRunDocument>(context.Portfolio, query, userId.Value, cancellationToken);
        return documents.Select(d => d.ToDomain()).ToList();
    }

    public async Task SaveAsync(SyncRun run, CancellationToken cancellationToken)
        => await context.Portfolio.UpsertItemAsync(
            SyncRunDocument.From(run, context.SyncRunRetentionDays),
            new PartitionKey(run.UserId.Value),
            cancellationToken: cancellationToken);
}

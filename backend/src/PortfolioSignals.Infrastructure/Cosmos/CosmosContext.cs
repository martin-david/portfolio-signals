using System.Net;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace PortfolioSignals.Infrastructure.Cosmos;

/// <summary>Holds the two containers the application uses; see <see cref="CosmosOptions"/> for what lives where.</summary>
public sealed class CosmosContext(CosmosClient client, IOptions<CosmosOptions> options)
{
    private readonly CosmosOptions _options = options.Value;

    public Container Accounts { get; } = client.GetContainer(options.Value.DatabaseName, options.Value.AccountsContainer);

    public Container Portfolio { get; } = client.GetContainer(options.Value.DatabaseName, options.Value.PortfolioContainer);

    public int SnapshotRetentionDays => _options.SnapshotRetentionDays;

    public int SyncRunRetentionDays => _options.SyncRunRetentionDays;

    public static async Task<T?> TryReadAsync<T>(Container container, string id, string partitionKey, CancellationToken cancellationToken)
        where T : class
    {
        try
        {
            var response = await container.ReadItemAsync<T>(id, new PartitionKey(partitionKey), cancellationToken: cancellationToken);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public static async Task<List<T>> QueryAsync<T>(Container container, QueryDefinition query, string? partitionKey, CancellationToken cancellationToken)
    {
        var requestOptions = partitionKey is null ? null : new QueryRequestOptions { PartitionKey = new PartitionKey(partitionKey) };
        var results = new List<T>();
        using var iterator = container.GetItemQueryIterator<T>(query, requestOptions: requestOptions);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            results.AddRange(page);
        }

        return results;
    }
}

/// <summary>Creates the database and containers when <see cref="CosmosOptions.CreateIfNotExists"/> is set (local development).</summary>
public sealed class CosmosInitializer(CosmosClient client, IOptions<CosmosOptions> options) : IHostedService
{
    private const string PartitionKeyPath = "/userId";

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (!settings.CreateIfNotExists)
        {
            return;
        }

        var database = (await client.CreateDatabaseIfNotExistsAsync(settings.DatabaseName, cancellationToken: cancellationToken)).Database;
        await database.CreateContainerIfNotExistsAsync(new ContainerProperties(settings.AccountsContainer, PartitionKeyPath), cancellationToken: cancellationToken);
        await database.CreateContainerIfNotExistsAsync(
            new ContainerProperties(settings.PortfolioContainer, PartitionKeyPath) { DefaultTimeToLive = -1 },
            cancellationToken: cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

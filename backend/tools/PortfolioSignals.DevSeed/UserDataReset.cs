using Microsoft.Azure.Cosmos;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.Infrastructure.Cosmos;

namespace PortfolioSignals.DevSeed;

/// <summary>Deletes everything stored for one user. Both containers are partitioned by user, so every query and delete stays in one partition.</summary>
internal sealed class UserDataReset(CosmosContext cosmos)
{
    private sealed record StoredId(string Id);

    public async Task<int> DeleteAllAsync(UserId userId, CancellationToken cancellationToken)
    {
        var deleted = 0;
        var partition = new PartitionKey(userId.Value);
        foreach (var container in new[] { cosmos.Accounts, cosmos.Portfolio })
        {
            var stored = await CosmosContext.QueryAsync<StoredId>(container, new QueryDefinition("SELECT c.id FROM c"), userId.Value, cancellationToken);
            foreach (var item in stored)
            {
                await container.DeleteItemAsync<StoredId>(item.Id, partition, cancellationToken: cancellationToken);
                deleted++;
            }
        }

        return deleted;
    }
}

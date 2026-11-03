using System.Net.Sockets;
using PortfolioSignals.Infrastructure.Cosmos;

namespace PortfolioSignals.DevSeed;

/// <summary>
/// The seeder writes fictional data and can delete a user's documents, so it only ever talks to an emulator on this machine:
/// whatever the configuration says, a remote account or one reached by endpoint and token is refused.
/// </summary>
internal static class LocalCosmos
{
    public static Uri RequireLocalEndpoint(CosmosOptions options)
    {
        var endpoint = EndpointOf(options.ConnectionString)
            ?? throw new SeedException("The seeder only writes to the local Cosmos DB emulator, which Cosmos:ConnectionString names; this configuration has no such connection string.");

        return endpoint.IsLoopback
            ? endpoint
            : throw new SeedException($"The seeder only writes to a Cosmos DB emulator on this machine, not to {endpoint.Host}.");
    }

    /// <summary>The emulator is easy to forget to start, and the Cosmos client would retry for the better part of a minute before saying so.</summary>
    public static async Task<bool> IsListeningAsync(Uri endpoint, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(3));
        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync(endpoint.Host, endpoint.Port, timeout.Token);
            return true;
        }
        catch (Exception ex) when ((ex is SocketException or OperationCanceledException) && !cancellationToken.IsCancellationRequested)
        {
            return false;
        }
    }

    private static Uri? EndpointOf(string? connectionString)
    {
        foreach (var part in (connectionString ?? string.Empty).Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var separator = part.IndexOf('=', StringComparison.Ordinal);
            if (separator > 0
                && part[..separator].Trim().Equals("AccountEndpoint", StringComparison.OrdinalIgnoreCase)
                && Uri.TryCreate(part[(separator + 1)..].Trim(), UriKind.Absolute, out var endpoint))
            {
                return endpoint;
            }
        }

        return null;
    }
}

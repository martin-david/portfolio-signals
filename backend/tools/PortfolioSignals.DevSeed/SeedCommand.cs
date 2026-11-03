using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PortfolioSignals.Application;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.Infrastructure;
using PortfolioSignals.Infrastructure.Cosmos;

namespace PortfolioSignals.DevSeed;

internal static class SeedCommand
{
    /// <summary>Returns the exit code: 0 when the account was seeded, 1 when it could not be, 2 for a mistake on the command line.</summary>
    public static async Task<int> RunAsync(IReadOnlyList<string> args, TextWriter output, TextWriter error, CancellationToken cancellationToken)
    {
        SeedOptions options;
        try
        {
            options = SeedOptions.Parse(args);
        }
        catch (UsageException ex)
        {
            await error.WriteLineAsync($"{ex.Message}{Environment.NewLine}");
            await error.WriteLineAsync(SeedOptions.Usage);
            return 2;
        }

        if (options.ShowHelp)
        {
            await output.WriteLineAsync(SeedOptions.Usage);
            return 0;
        }

        try
        {
            await SeedAsync(options, output, cancellationToken);
            return 0;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await error.WriteLineAsync("Cancelled.");
            return 1;
        }
        catch (SeedException ex)
        {
            await error.WriteLineAsync(ex.Message);
            return 1;
        }
        catch (Exception ex)
        {
            await error.WriteLineAsync($"Seeding failed: {ex.GetType().Name}: {ex.Message}");
            return 1;
        }
    }

    private static async Task SeedAsync(SeedOptions options, TextWriter output, CancellationToken cancellationToken)
    {
        using var host = BuildHost();
        LocalCosmos.RequireConnectionString(host.Services.GetRequiredService<IOptions<CosmosOptions>>().Value);

        // Creating the client contacts nothing; it only resolves the endpoint, which is what gets judged before anything is written.
        var endpoint = LocalCosmos.RequireLoopback(host.Services.GetRequiredService<CosmosClient>().Endpoint);
        if (!await LocalCosmos.IsListeningAsync(endpoint, cancellationToken))
        {
            throw new SeedException($"Nothing is listening on {endpoint.Host}:{endpoint.Port}. Start the Azure Cosmos DB Emulator and run the seeder again.");
        }

        // Starting the host creates the database and containers when the settings ask for it, exactly as the API does.
        await host.StartAsync(cancellationToken);
        try
        {
            await using var scope = host.Services.CreateAsyncScope();
            var userId = new UserId(options.User);

            if (options.Reset)
            {
                var deleted = await scope.ServiceProvider.GetRequiredService<UserDataReset>().DeleteAllAsync(userId, cancellationToken);
                await output.WriteLineAsync($"Deleted {deleted} stored document(s) for '{userId}'.");
            }

            var summary = await scope.ServiceProvider.GetRequiredService<DemoSeeder>().SeedAsync(userId, cancellationToken);
            var verdicts = string.Join(", ", summary.Verdicts.Where(v => v.Value > 0).Select(v => $"{v.Value} {v.Key}"));
            var profile = summary.ProfileCreated ? "new profile" : "existing profile kept";

            await output.WriteLineAsync($"Seeded '{userId}' ({summary.Email}, {profile}) in the Cosmos DB at {endpoint.Host}:{endpoint.Port}.");
            await output.WriteLineAsync($"  {summary.Holdings} holdings worth {summary.TotalValue:N0} {DemoPortfolio.Currency} in total, signals for {summary.Signals} tickers. All of it is fictional.");
            await output.WriteLineAsync($"  Verdicts: {verdicts}.");
            await output.WriteLineAsync($"Sign in to the app as '{userId}' to see it.");
        }
        finally
        {
            await host.StopAsync(CancellationToken.None);
        }
    }

    private static IHost BuildHost()
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            ContentRootPath = AppContext.BaseDirectory,
            EnvironmentName = Environments.Development,
        });

        // Whatever the API's settings say, the seeder keeps its placeholder credentials in memory and queues nothing.
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["CredentialStore:Mode"] = "InMemory",
            ["SyncQueue:Mode"] = "Disabled",
        });
        builder.Logging.AddFilter("Microsoft.Hosting.Lifetime", LogLevel.Warning);

        builder.Services.AddApplication();
        builder.Services.AddInfrastructure(builder.Configuration);
        builder.Services.AddDemoProviders();
        builder.Services.AddScoped<UserDataReset>();
        return builder.Build();
    }
}

using System.Text.Json;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;
using Polly;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Infrastructure.Cosmos;
using PortfolioSignals.Infrastructure.Messaging;
using PortfolioSignals.Infrastructure.Providers.Etoro;
using PortfolioSignals.Infrastructure.Providers.TipRanks;
using PortfolioSignals.Infrastructure.Secrets;

namespace PortfolioSignals.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<CosmosOptions>().Bind(configuration.GetSection(CosmosOptions.SectionName)).ValidateDataAnnotations().ValidateOnStart();
        services.AddOptions<CredentialStoreOptions>().Bind(configuration.GetSection(CredentialStoreOptions.SectionName));
        services.AddOptions<SyncQueueOptions>().Bind(configuration.GetSection(SyncQueueOptions.SectionName));
        services.AddOptions<EtoroOptions>().Bind(configuration.GetSection(EtoroOptions.SectionName)).ValidateDataAnnotations().ValidateOnStart();
        services.AddOptions<TipRanksOptions>().Bind(configuration.GetSection(TipRanksOptions.SectionName)).ValidateDataAnnotations().ValidateOnStart();

        AddCosmos(services);
        AddCredentialStore(services, configuration);
        AddSyncQueue(services, configuration);
        AddProviders(services);

        services.AddSingleton(_ => new SymbolResolver(SymbolOverrides.Load()));
        return services;
    }

    private static void AddCosmos(IServiceCollection services)
    {
        services.AddSingleton(sp =>
        {
            var options = sp.GetRequiredService<IOptions<CosmosOptions>>().Value;
            if (!options.IsConfigured)
            {
                throw new InvalidOperationException($"{CosmosOptions.SectionName}:Endpoint (or :ConnectionString for the emulator) must be configured.");
            }

            var clientOptions = new CosmosClientOptions
            {
                UseSystemTextJsonSerializerWithOptions = InfrastructureJson.Options,
                ApplicationName = "portfolio-signals",
            };

            return string.IsNullOrWhiteSpace(options.ConnectionString)
                ? new CosmosClient(options.Endpoint, new DefaultAzureCredential(), clientOptions)
                : new CosmosClient(options.ConnectionString, clientOptions);
        });
        services.AddSingleton<CosmosContext>();
        services.AddHostedService<CosmosInitializer>();

        services.AddSingleton<IUserRepository, CosmosUserRepository>();
        services.AddSingleton<IConnectionRepository, CosmosConnectionRepository>();
        services.AddSingleton<IPortfolioSnapshotRepository, CosmosPortfolioSnapshotRepository>();
        services.AddSingleton<ISignalsRepository, CosmosSignalsRepository>();
        services.AddSingleton<ISyncRunRepository, CosmosSyncRunRepository>();
    }

    private static void AddCredentialStore(IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(CredentialStoreOptions.SectionName).Get<CredentialStoreOptions>() ?? new CredentialStoreOptions();
        if (string.Equals(options.Mode, "InMemory", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<ICredentialStore, InMemoryCredentialStore>();
            return;
        }

        services.AddSingleton<ICredentialStore>(sp =>
        {
            var settings = sp.GetRequiredService<IOptions<CredentialStoreOptions>>().Value;
            if (string.IsNullOrWhiteSpace(settings.KeyVaultUri))
            {
                throw new InvalidOperationException($"{CredentialStoreOptions.SectionName}:KeyVaultUri must be configured.");
            }

            return new KeyVaultCredentialStore(new SecretClient(new Uri(settings.KeyVaultUri), new DefaultAzureCredential()));
        });
    }

    private static void AddSyncQueue(IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(SyncQueueOptions.SectionName).Get<SyncQueueOptions>() ?? new SyncQueueOptions();
        if (string.Equals(options.Mode, "Disabled", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<ISyncRequestPublisher, NullSyncRequestPublisher>();
        }
        else
        {
            services.AddSingleton<ISyncRequestPublisher, StorageQueueSyncRequestPublisher>();
        }
    }

    private static void AddProviders(IServiceCollection services)
    {
        services.AddHttpClient<IEtoroPortfolioClient, EtoroApiClient>((sp, client) =>
            {
                client.BaseAddress = new Uri(sp.GetRequiredService<IOptions<EtoroOptions>>().Value.BaseUrl);
            })
            .AddResilienceHandler("provider", ConfigureResilience);

        services.AddHttpClient<ITipRanksSessionFactory, McpTipRanksSessionFactory>()
            .AddResilienceHandler("provider", ConfigureResilience);
        services.AddSingleton<ITipRanksClient, TipRanksClient>();
    }

    // Retries transient failures but never HTTP 429: quota errors must reach the sync workflow, which backs off per connection.
    private static void ConfigureResilience(ResiliencePipelineBuilder<HttpResponseMessage> builder)
    {
        builder.AddRetry(new HttpRetryStrategyOptions
        {
            MaxRetryAttempts = 2,
            Delay = TimeSpan.FromSeconds(1),
            BackoffType = DelayBackoffType.Exponential,
            UseJitter = true,
            ShouldHandle = args => ValueTask.FromResult(
                HttpClientResiliencePredicates.IsTransient(args.Outcome) && args.Outcome.Result?.StatusCode != System.Net.HttpStatusCode.TooManyRequests),
        });
        builder.AddTimeout(TimeSpan.FromSeconds(90));
    }
}

internal static class SymbolOverrides
{
    public static IReadOnlyList<SymbolMapping> Load()
    {
        using var stream = typeof(SymbolOverrides).Assembly.GetManifestResourceStream("symbol-overrides.json")
            ?? throw new InvalidOperationException("The embedded symbol-overrides.json resource is missing.");
        return JsonSerializer.Deserialize<List<SymbolMapping>>(stream, InfrastructureJson.Options) ?? [];
    }
}

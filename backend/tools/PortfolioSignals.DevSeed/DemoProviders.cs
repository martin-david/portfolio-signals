using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;

namespace PortfolioSignals.DevSeed;

/// <summary>Stands in for eToro: hands back the fictional portfolio and never leaves the process.</summary>
internal sealed class DemoEtoroClient(TimeProvider clock) : IEtoroPortfolioClient
{
    public Task<EtoroPortfolio> GetPortfolioAsync(ProviderCredentials credentials, CancellationToken cancellationToken)
        => Task.FromResult(DemoPortfolio.Portfolio(clock.GetUtcNow()));
}

/// <summary>Stands in for TipRanks: answers for the tickers the fictional provider covers and leaves the rest out, as the real one does.</summary>
internal sealed class DemoTipRanksClient(TimeProvider clock) : ITipRanksClient
{
    public Task<IReadOnlyDictionary<string, SignalData>> GetSignalsAsync(
        ProviderCredentials credentials,
        IReadOnlyCollection<string> tickers,
        CancellationToken cancellationToken)
    {
        var known = DemoPortfolio.Signals(DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime));
        IReadOnlyDictionary<string, SignalData> covered = known
            .Where(entry => tickers.Contains(entry.Key, StringComparer.OrdinalIgnoreCase))
            .ToDictionary(entry => entry.Key, entry => entry.Value, StringComparer.OrdinalIgnoreCase);
        return Task.FromResult(covered);
    }
}

internal static class DemoServices
{
    /// <summary>Swaps the real provider adapters for the fictional ones and registers the seeder. Call it after the ports are registered.</summary>
    public static IServiceCollection AddDemoProviders(this IServiceCollection services)
    {
        services.Replace(ServiceDescriptor.Singleton(new SymbolResolver(DemoPortfolio.SymbolMappings)));
        services.Replace(ServiceDescriptor.Singleton<IEtoroPortfolioClient, DemoEtoroClient>());
        services.Replace(ServiceDescriptor.Singleton<ITipRanksClient, DemoTipRanksClient>());
        services.AddScoped<DemoSeeder>();
        return services;
    }
}

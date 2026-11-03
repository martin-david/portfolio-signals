using FreeMediator;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using PortfolioSignals.Application;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Analysis;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.TestSupport;

namespace PortfolioSignals.DevSeed.Tests;

/// <summary>The real application layer (mediator, validators, handlers) over in-memory ports, with the seeder's own composition on top.</summary>
internal sealed class SeedFixture : IDisposable
{
    public static readonly UserId Demo = new("demo");

    private readonly ServiceProvider _provider;

    public SeedFixture()
    {
        Clock = new FakeTimeProvider(TestData.Now);

        var services = new ServiceCollection();
        services.AddApplication();
        services.AddSingleton<TimeProvider>(Clock);
        services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));
        services.AddSingleton<IUserRepository>(Users);
        services.AddSingleton<IConnectionRepository>(Connections);
        services.AddSingleton<IPortfolioSnapshotRepository>(Snapshots);
        services.AddSingleton<ISignalsRepository>(Signals);
        services.AddSingleton<ISyncRunRepository>(Runs);
        services.AddSingleton<ICredentialStore>(Credentials);
        services.AddSingleton<ISyncRequestPublisher>(new RecordingSyncRequestPublisher());
        services.AddDemoProviders();

        // As in the host the tool runs in during development: a scoped service must not be reachable from the root.
        _provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    public FakeTimeProvider Clock { get; }

    public InMemoryUserRepository Users { get; } = new();

    public InMemoryConnectionRepository Connections { get; } = new();

    public InMemoryPortfolioSnapshotRepository Snapshots { get; } = new();

    public InMemorySignalsRepository Signals { get; } = new();

    public InMemorySyncRunRepository Runs { get; } = new();

    public InMemoryCredentialStore Credentials { get; } = new();

    public async Task<SeedSummary> SeedAsync(string user = "demo")
    {
        await using var scope = _provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<DemoSeeder>().SeedAsync(new UserId(user), CancellationToken.None);
    }

    public async Task<PortfolioAnalysisDto> AnalysisAsync(string user = "demo")
    {
        await using var scope = _provider.CreateAsyncScope();
        var result = await scope.ServiceProvider.GetRequiredService<ISender>().Send(new GetPortfolioAnalysisQuery(new UserId(user)), CancellationToken.None);
        return result.Value;
    }

    public void Dispose() => _provider.Dispose();
}

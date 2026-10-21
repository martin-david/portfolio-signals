using FluentValidation;
using FreeMediator;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using PortfolioSignals.Application;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.TestSupport;

namespace PortfolioSignals.Application.Tests;

/// <summary>Wires the real application layer (mediator, validators, handlers) to in-memory ports.</summary>
public sealed class AppFixture : IDisposable
{
    private readonly ServiceProvider _provider;

    public AppFixture()
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
        services.AddSingleton<ISyncRequestPublisher>(Publisher);
        services.AddSingleton<IEtoroPortfolioClient>(Etoro);
        services.AddSingleton<ITipRanksClient>(TipRanks);
        services.AddSingleton(new SymbolResolver([new SymbolMapping("ATROB", "ATROB", AssetClass.Stock, ["ATRO"])]));
        _provider = services.BuildServiceProvider();
    }

    public FakeTimeProvider Clock { get; }

    public InMemoryUserRepository Users { get; } = new();

    public InMemoryConnectionRepository Connections { get; } = new();

    public InMemoryPortfolioSnapshotRepository Snapshots { get; } = new();

    public InMemorySignalsRepository Signals { get; } = new();

    public InMemorySyncRunRepository Runs { get; } = new();

    public InMemoryCredentialStore Credentials { get; } = new();

    public RecordingSyncRequestPublisher Publisher { get; } = new();

    public FakeEtoroPortfolioClient Etoro { get; } = new();

    public FakeTipRanksClient TipRanks { get; } = new();

    public ISender Sender => _provider.GetRequiredService<ISender>();

    public async Task<UserAccount> RegisterAliceAsync(SubscriptionPlan plan = SubscriptionPlan.Free)
    {
        var user = UserAccount.Register(TestData.Alice, "alice@example.test", "Alice", Clock.GetUtcNow());
        user.ChangePlan(plan, Clock.GetUtcNow());
        await Users.SaveAsync(user, CancellationToken.None);
        return user;
    }

    public void Dispose() => _provider.Dispose();
}

public static class ValidationAssertions
{
    public static async Task<ValidationException> ShouldFailValidationAsync(this Task task)
    {
        try
        {
            await task;
        }
        catch (ValidationException ex)
        {
            return ex;
        }

        throw new InvalidOperationException("Expected a ValidationException.");
    }
}

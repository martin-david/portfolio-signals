using System.Collections.Concurrent;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.TestSupport;

public sealed class InMemoryUserRepository : IUserRepository
{
    private readonly ConcurrentDictionary<string, UserAccount> _items = new();

    public Task<UserAccount?> GetAsync(UserId id, CancellationToken cancellationToken)
        => Task.FromResult(_items.GetValueOrDefault(id.Value));

    public Task SaveAsync(UserAccount user, CancellationToken cancellationToken)
    {
        _items[user.Id.Value] = user;
        return Task.CompletedTask;
    }
}

public sealed class InMemoryConnectionRepository : IConnectionRepository
{
    private readonly ConcurrentDictionary<string, ProviderConnection> _items = new();

    public Task<ProviderConnection?> GetAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
        => Task.FromResult(_items.GetValueOrDefault(ProviderConnection.IdFor(userId, provider)));

    public Task<IReadOnlyList<ProviderConnection>> ListForUserAsync(UserId userId, CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<ProviderConnection>>(_items.Values.Where(c => c.UserId == userId).ToList());

    public Task<IReadOnlyList<ProviderConnection>> ListActiveAsync(CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<ProviderConnection>>(_items.Values.Where(c => c.Status == ConnectionStatus.Active).ToList());

    public Task SaveAsync(ProviderConnection connection, CancellationToken cancellationToken)
    {
        _items[connection.Id] = connection;
        return Task.CompletedTask;
    }
}

public sealed class InMemoryPortfolioSnapshotRepository : IPortfolioSnapshotRepository
{
    private readonly ConcurrentDictionary<string, PortfolioSnapshot> _items = new();

    public Task<PortfolioSnapshot?> GetLatestAsync(UserId userId, CancellationToken cancellationToken)
        => Task.FromResult(_items.Values.Where(s => s.UserId == userId).OrderByDescending(s => s.TakenAt).FirstOrDefault());

    public Task<IReadOnlyList<PortfolioSnapshot>> ListRecentAsync(UserId userId, int take, CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<PortfolioSnapshot>>(_items.Values.Where(s => s.UserId == userId).OrderByDescending(s => s.TakenAt).Take(take).ToList());

    public Task SaveAsync(PortfolioSnapshot snapshot, CancellationToken cancellationToken)
    {
        _items[$"{snapshot.UserId}/{snapshot.Id}"] = snapshot;
        return Task.CompletedTask;
    }
}

public sealed class InMemorySignalsRepository : ISignalsRepository
{
    private readonly ConcurrentDictionary<string, InstrumentSignals> _items = new();

    public Task<IReadOnlyList<InstrumentSignals>> ListAsync(UserId userId, CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<InstrumentSignals>>(_items.Values.Where(s => s.UserId == userId).ToList());

    public Task SaveManyAsync(IReadOnlyCollection<InstrumentSignals> signals, CancellationToken cancellationToken)
    {
        foreach (var item in signals)
        {
            _items[$"{item.UserId}/{item.Ticker}"] = item;
        }

        return Task.CompletedTask;
    }
}

public sealed class InMemorySyncRunRepository : ISyncRunRepository
{
    private readonly ConcurrentDictionary<string, SyncRun> _items = new();

    public Task<SyncRun?> GetAsync(UserId userId, string id, CancellationToken cancellationToken)
        => Task.FromResult(_items.GetValueOrDefault($"{userId}/{id}"));

    public Task<IReadOnlyList<SyncRun>> ListRecentAsync(UserId userId, int take, CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<SyncRun>>(_items.Values.Where(r => r.UserId == userId).OrderByDescending(r => r.RequestedAt).Take(take).ToList());

    public Task SaveAsync(SyncRun run, CancellationToken cancellationToken)
    {
        _items[$"{run.UserId}/{run.Id}"] = run;
        return Task.CompletedTask;
    }
}

public sealed class InMemoryCredentialStore : ICredentialStore
{
    private readonly ConcurrentDictionary<string, ProviderCredentials> _items = new();

    public int Count => _items.Count;

    public Task SaveAsync(UserId userId, IntegrationProvider provider, ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        _items[$"{userId}/{provider}"] = credentials;
        return Task.CompletedTask;
    }

    public Task<ProviderCredentials?> GetAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
        => Task.FromResult(_items.GetValueOrDefault($"{userId}/{provider}"));

    public Task DeleteAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
    {
        _items.TryRemove($"{userId}/{provider}", out _);
        return Task.CompletedTask;
    }
}

public sealed class RecordingSyncRequestPublisher : ISyncRequestPublisher
{
    private readonly ConcurrentQueue<SyncRequestMessage> _messages = new();

    public IReadOnlyCollection<SyncRequestMessage> Messages => _messages;

    public Task PublishAsync(SyncRequestMessage message, CancellationToken cancellationToken)
    {
        _messages.Enqueue(message);
        return Task.CompletedTask;
    }
}

/// <summary>Returns a canned portfolio, or throws the configured provider failure.</summary>
public sealed class FakeEtoroPortfolioClient : IEtoroPortfolioClient
{
    public EtoroPortfolio Portfolio { get; set; } = TestData.EtoroPortfolio();

    public ProviderException? Failure { get; set; }

    public int Calls { get; private set; }

    public Task<EtoroPortfolio> GetPortfolioAsync(ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        Calls++;
        return Failure is null ? Task.FromResult(Portfolio) : Task.FromException<EtoroPortfolio>(Failure);
    }
}

public sealed class FakeTipRanksClient : ITipRanksClient
{
    public Dictionary<string, SignalData> Signals { get; } = new(StringComparer.OrdinalIgnoreCase);

    public ProviderException? Failure { get; set; }

    public List<string> RequestedTickers { get; } = [];

    public Task<IReadOnlyDictionary<string, SignalData>> GetSignalsAsync(ProviderCredentials credentials, IReadOnlyCollection<string> tickers, CancellationToken cancellationToken)
    {
        if (Failure is not null)
        {
            return Task.FromException<IReadOnlyDictionary<string, SignalData>>(Failure);
        }

        RequestedTickers.AddRange(tickers);
        IReadOnlyDictionary<string, SignalData> found = Signals.Where(kv => tickers.Contains(kv.Key, StringComparer.OrdinalIgnoreCase)).ToDictionary(kv => kv.Key, kv => kv.Value);
        return Task.FromResult(found);
    }
}

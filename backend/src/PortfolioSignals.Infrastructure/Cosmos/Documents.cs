using System.Text.Json;
using System.Text.Json.Serialization;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Infrastructure.Cosmos;

public static class InfrastructureJson
{
    public static JsonSerializerOptions Options { get; } = Create();

    private static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}

public static class DocumentTypes
{
    public const string User = "user";
    public const string Connection = "connection";
    public const string Snapshot = "snapshot";
    public const string Signals = "signals";
    public const string SyncRun = "syncRun";
}

/// <summary>Persistence shape of an aggregate. Domain classes stay persistence-ignorant; mapping is explicit and versioned.</summary>
public abstract record DocumentBase
{
    public const int CurrentSchemaVersion = 1;

    [JsonPropertyName("id")]
    public required string Id { get; init; }

    public required string UserId { get; init; }

    public required string Type { get; init; }

    public int SchemaVersion { get; init; } = CurrentSchemaVersion;

    /// <summary>Cosmos DB per-item time to live, in seconds.</summary>
    [JsonPropertyName("ttl")]
    public int? Ttl { get; init; }
}

public sealed record UserDocument : DocumentBase
{
    public required string Email { get; init; }

    public required string DisplayName { get; init; }

    public required SubscriptionPlan Plan { get; init; }

    public required DateTimeOffset RegisteredAt { get; init; }

    public required DateTimeOffset UpdatedAt { get; init; }

    public static UserDocument From(UserAccount user) => new()
    {
        Id = user.Id.Value,
        UserId = user.Id.Value,
        Type = DocumentTypes.User,
        Email = user.Email,
        DisplayName = user.DisplayName,
        Plan = user.Plan,
        RegisteredAt = user.RegisteredAt,
        UpdatedAt = user.UpdatedAt,
    };

    public UserAccount ToDomain() => UserAccount.Restore(new UserId(UserId), Email, DisplayName, Plan, RegisteredAt, UpdatedAt);
}

public sealed record ConnectionDocument : DocumentBase
{
    public required IntegrationProvider Provider { get; init; }

    public required ConnectionStatus Status { get; init; }

    public required DateTimeOffset ConnectedAt { get; init; }

    public DateTimeOffset? SyncRequestedAt { get; init; }

    public DateTimeOffset? LastAttemptAt { get; init; }

    public DateTimeOffset? LastSuccessfulSyncAt { get; init; }

    public SyncFailure? LastFailure { get; init; }

    public int ConsecutiveFailures { get; init; }

    public DateTimeOffset? RetryNotBefore { get; init; }

    public static ConnectionDocument From(ProviderConnection connection) => new()
    {
        Id = connection.Provider.ToString(),
        UserId = connection.UserId.Value,
        Type = DocumentTypes.Connection,
        Provider = connection.Provider,
        Status = connection.Status,
        ConnectedAt = connection.ConnectedAt,
        SyncRequestedAt = connection.SyncRequestedAt,
        LastAttemptAt = connection.LastAttemptAt,
        LastSuccessfulSyncAt = connection.LastSuccessfulSyncAt,
        LastFailure = connection.LastFailure,
        ConsecutiveFailures = connection.ConsecutiveFailures,
        RetryNotBefore = connection.RetryNotBefore,
    };

    public ProviderConnection ToDomain() => ProviderConnection.Restore(
        new UserId(UserId),
        Provider,
        Status,
        ConnectedAt,
        SyncRequestedAt,
        LastAttemptAt,
        LastSuccessfulSyncAt,
        LastFailure,
        ConsecutiveFailures,
        RetryNotBefore);
}

public sealed record SnapshotDocument : DocumentBase
{
    public required DateTimeOffset TakenAt { get; init; }

    public required AccountSummary Account { get; init; }

    public required IReadOnlyList<Holding> Holdings { get; init; }

    public required IReadOnlyList<CopiedTrader> CopiedTraders { get; init; }

    public static SnapshotDocument From(PortfolioSnapshot snapshot, int retentionDays) => new()
    {
        Id = snapshot.Id,
        UserId = snapshot.UserId.Value,
        Type = DocumentTypes.Snapshot,
        Ttl = (int)TimeSpan.FromDays(retentionDays).TotalSeconds,
        TakenAt = snapshot.TakenAt.ToUniversalTime(),
        Account = snapshot.Account,
        Holdings = snapshot.Holdings,
        CopiedTraders = snapshot.CopiedTraders,
    };

    public PortfolioSnapshot ToDomain() => PortfolioSnapshot.Restore(Id, new UserId(UserId), TakenAt, Account, Holdings, CopiedTraders);
}

public sealed record SignalsDocument : DocumentBase
{
    public const string IdPrefix = "signals-";

    public required string Ticker { get; init; }

    public required SignalData Data { get; init; }

    public required DateTimeOffset FetchedAt { get; init; }

    public static SignalsDocument From(InstrumentSignals signals) => new()
    {
        Id = IdPrefix + signals.Ticker,
        UserId = signals.UserId.Value,
        Type = DocumentTypes.Signals,
        Ticker = signals.Ticker,
        Data = signals.Data,
        FetchedAt = signals.FetchedAt,
    };

    public InstrumentSignals ToDomain() => InstrumentSignals.Restore(new UserId(UserId), Ticker, Data, FetchedAt);
}

public sealed record SyncRunDocument : DocumentBase
{
    public required IntegrationProvider Provider { get; init; }

    public required SyncTrigger Trigger { get; init; }

    public required SyncRunStatus Status { get; init; }

    public required DateTimeOffset RequestedAt { get; init; }

    public DateTimeOffset? StartedAt { get; init; }

    public DateTimeOffset? CompletedAt { get; init; }

    public int ItemsProcessed { get; init; }

    public SyncFailure? Failure { get; init; }

    public string? SkipReason { get; init; }

    public static SyncRunDocument From(SyncRun run, int retentionDays) => new()
    {
        Id = run.Id,
        UserId = run.UserId.Value,
        Type = DocumentTypes.SyncRun,
        Ttl = (int)TimeSpan.FromDays(retentionDays).TotalSeconds,
        Provider = run.Provider,
        Trigger = run.Trigger,
        Status = run.Status,
        RequestedAt = run.RequestedAt,
        StartedAt = run.StartedAt,
        CompletedAt = run.CompletedAt,
        ItemsProcessed = run.ItemsProcessed,
        Failure = run.Failure,
        SkipReason = run.SkipReason,
    };

    public SyncRun ToDomain() => SyncRun.Restore(
        Id,
        new UserId(UserId),
        Provider,
        Trigger,
        Status,
        RequestedAt,
        StartedAt,
        CompletedAt,
        ItemsProcessed,
        Failure,
        SkipReason);
}

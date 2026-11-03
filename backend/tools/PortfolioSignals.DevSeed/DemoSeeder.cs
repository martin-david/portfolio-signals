using FreeMediator;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Analysis;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Application.Integrations;
using PortfolioSignals.Application.Sync;
using PortfolioSignals.Application.Users;
using PortfolioSignals.Domain.Analysis;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.DevSeed;

/// <summary>A problem the user can act on: reported as one line, without a stack trace.</summary>
internal sealed class SeedException(string message) : Exception(message);

internal sealed record SeedSummary(string Email, bool ProfileCreated, int Holdings, int Signals, decimal TotalValue, IReadOnlyDictionary<Verdict, int> Verdicts);

/// <summary>
/// Fills one development user's account the way two successful syncs would: registers the profile if there is none, connects
/// both providers with placeholder credentials and runs the real sync handler against the fictional provider adapters.
/// The application code does all the work, so what ends up stored is what the app itself would have stored.
/// </summary>
internal sealed class DemoSeeder(ISender sender, IConnectionRepository connections, ISyncRunRepository runs, TimeProvider clock)
{
    // The credentials never leave the process: the demo adapters ignore them and the in-memory store is gone when the tool exits.
    private const string PlaceholderSecret = "demo-not-a-real-key";

    public async Task<SeedSummary> SeedAsync(UserId userId, CancellationToken cancellationToken)
    {
        var (profile, created) = await EnsureProfileAsync(userId, cancellationToken);

        // eToro first: the TipRanks sync fetches signals for the tickers in the latest snapshot.
        var holdings = await ConnectAndSyncAsync(userId, IntegrationProvider.Etoro, cancellationToken);
        var signals = await ConnectAndSyncAsync(userId, IntegrationProvider.TipRanks, cancellationToken);

        var analysis = Unwrap(await sender.Send(new GetPortfolioAnalysisQuery(userId), cancellationToken), "analyze the seeded portfolio");
        return new SeedSummary(profile.Email, created, holdings, signals, analysis.Kpis.TotalValue, analysis.Kpis.VerdictCounts);
    }

    private async Task<(UserProfileDto Profile, bool Created)> EnsureProfileAsync(UserId userId, CancellationToken cancellationToken)
    {
        var existing = await sender.Send(new GetMeQuery(userId), cancellationToken);
        if (existing.IsSuccess)
        {
            return (existing.Value, false);
        }

        if (existing.Error!.Type != ErrorType.NotFound)
        {
            throw Failed("read the profile", existing.Error);
        }

        // The development sign-in names a user the same way, so this is what the app's own profile form would have offered.
        var registered = await sender.Send(new UpsertProfileCommand(userId, $"{userId}@example.test", userId.Value), cancellationToken);
        return (Unwrap(registered, "register the profile"), true);
    }

    private async Task<int> ConnectAndSyncAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
    {
        var credentials = ProviderCatalog.RequiredCredentialFields(provider).ToDictionary(field => field, _ => PlaceholderSecret);
        Unwrap(await sender.Send(new ConnectProviderCommand(userId, provider, credentials), cancellationToken), $"connect {provider}");

        // The three steps the scheduler takes for a connection that is due. The message it would queue is acted on right here.
        var now = clock.GetUtcNow();
        var connection = await connections.GetAsync(userId, provider, cancellationToken)
            ?? throw new SeedException($"The {provider} connection was not found right after it was saved.");
        var run = SyncRun.Request(userId, provider, SyncTrigger.Scheduled, now);
        await runs.SaveAsync(run, cancellationToken);
        connection.MarkSyncRequested(now);
        await connections.SaveAsync(connection, cancellationToken);

        var executed = await sender.Send(new ExecuteSyncCommand(userId, provider, run.Id), cancellationToken);
        if (!executed.IsSuccess)
        {
            throw Failed($"run the {provider} sync", executed.Error!);
        }

        var finished = await runs.GetAsync(userId, run.Id, cancellationToken);
        return finished is { Status: SyncRunStatus.Succeeded }
            ? finished.ItemsProcessed
            : throw new SeedException($"The {provider} sync did not succeed: {Describe(finished)}");
    }

    private static T Unwrap<T>(Result<T> result, string action)
        => result.IsSuccess ? result.Value : throw Failed(action, result.Error!);

    private static SeedException Failed(string action, Error error) => new($"Could not {action}: {error.Message} ({error.Code})");

    private static string Describe(SyncRun? run) => run switch
    {
        null => "the run was not found",
        { Failure: { } failure } => $"{failure.Kind}: {failure.Message}",
        { SkipReason: { } reason } => reason,
        _ => run.Status.ToString(),
    };
}

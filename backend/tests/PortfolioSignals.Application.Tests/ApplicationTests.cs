using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Analysis;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Application.Integrations;
using PortfolioSignals.Application.Portfolios;
using PortfolioSignals.Application.Sync;
using PortfolioSignals.Application.Users;
using PortfolioSignals.Domain.Analysis;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.TestSupport;

namespace PortfolioSignals.Application.Tests;

public sealed class UserAndIntegrationTests : IDisposable
{
    private readonly AppFixture _app = new();

    public void Dispose() => _app.Dispose();

    [Fact]
    public async Task Upserting_a_profile_registers_the_user_on_the_free_plan()
    {
        var result = await _app.Sender.Send(new UpsertProfileCommand(TestData.Alice, "alice@example.test", "Alice"));

        result.IsSuccess.Should().BeTrue();
        result.Value.Plan.Should().Be(SubscriptionPlan.Free);
        (await _app.Sender.Send(new GetMeQuery(TestData.Alice))).Value.DisplayName.Should().Be("Alice");
    }

    [Fact]
    public async Task An_invalid_profile_fails_validation_before_reaching_the_handler()
    {
        var failure = await _app.Sender.Send(new UpsertProfileCommand(TestData.Alice, "not-an-email", string.Empty)).ShouldFailValidationAsync();

        failure.Errors.Select(e => e.PropertyName).Should().Contain(["Email", "DisplayName"]);
    }

    [Fact]
    public async Task An_unregistered_user_gets_not_found()
    {
        var result = await _app.Sender.Send(new GetMeQuery(TestData.Alice));

        result.Error!.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Connecting_a_provider_stores_credentials_outside_the_database_and_never_returns_them()
    {
        await _app.RegisterAliceAsync();
        var credentials = new Dictionary<string, string> { ["apiKey"] = "key-123", ["userKey"] = "user-456" };

        var result = await _app.Sender.Send(new ConnectProviderCommand(TestData.Alice, IntegrationProvider.Etoro, credentials));

        result.IsSuccess.Should().BeTrue();
        result.Value.Status.Should().Be(ConnectionStatus.Active);
        result.Value.RequiredCredentialFields.Should().BeEquivalentTo(["apiKey", "userKey"]);
        var stored = await _app.Credentials.GetAsync(TestData.Alice, IntegrationProvider.Etoro, default);
        stored!.Require("apiKey").Should().Be("key-123");
        System.Text.Json.JsonSerializer.Serialize(result.Value).Should().NotContain("key-123").And.NotContain("user-456");
    }

    [Fact]
    public async Task Connecting_without_all_required_credential_fields_fails_validation()
    {
        await _app.RegisterAliceAsync();

        var failure = await _app.Sender
            .Send(new ConnectProviderCommand(TestData.Alice, IntegrationProvider.Etoro, new Dictionary<string, string> { ["apiKey"] = "only-one" }))
            .ShouldFailValidationAsync();

        failure.Errors.Should().ContainSingle().Which.ErrorMessage.Should().Contain("userKey");
    }

    [Fact]
    public async Task Disconnecting_deletes_the_credentials_and_the_connection_stops_syncing()
    {
        await _app.RegisterAliceAsync();
        await _app.Sender.Send(new ConnectProviderCommand(TestData.Alice, IntegrationProvider.TipRanks, new Dictionary<string, string> { ["apiKey"] = "k" }));

        var result = await _app.Sender.Send(new DisconnectProviderCommand(TestData.Alice, IntegrationProvider.TipRanks));

        result.IsSuccess.Should().BeTrue();
        _app.Credentials.Count.Should().Be(0);
        var connection = await _app.Connections.GetAsync(TestData.Alice, IntegrationProvider.TipRanks, default);
        connection!.Status.Should().Be(ConnectionStatus.Disconnected);
    }

    [Fact]
    public async Task Listing_integrations_shows_every_provider_including_unconnected_ones()
    {
        await _app.RegisterAliceAsync(SubscriptionPlan.Pro);
        await _app.Sender.Send(new ConnectProviderCommand(TestData.Alice, IntegrationProvider.TipRanks, new Dictionary<string, string> { ["apiKey"] = "k" }));

        var result = await _app.Sender.Send(new ListIntegrationsQuery(TestData.Alice));

        result.Value.Should().HaveCount(2);
        result.Value.Single(i => i.Provider == IntegrationProvider.Etoro).Status.Should().BeNull();
        result.Value.Single(i => i.Provider == IntegrationProvider.TipRanks).SyncIntervalMinutes.Should().Be(360);
    }
}

public sealed class SyncTests : IDisposable
{
    private readonly AppFixture _app = new();

    public SyncTests()
    {
        _app.Etoro.Portfolio = TestData.EtoroPortfolio(TestData.Now.AddMinutes(-1));
    }

    public void Dispose() => _app.Dispose();

    private async Task ConnectAsync(IntegrationProvider provider)
    {
        var fields = provider == IntegrationProvider.Etoro
            ? new Dictionary<string, string> { ["apiKey"] = "a", ["userKey"] = "u" }
            : new Dictionary<string, string> { ["apiKey"] = "a" };
        (await _app.Sender.Send(new ConnectProviderCommand(TestData.Alice, provider, fields))).IsSuccess.Should().BeTrue();
    }

    private async Task<SyncRunDto> RequestAndExecuteAsync(IntegrationProvider provider)
    {
        var requested = await _app.Sender.Send(new RequestSyncCommand(TestData.Alice, provider));
        requested.IsSuccess.Should().BeTrue(requested.Error?.Message);
        var run = requested.Value.Single();
        await _app.Sender.Send(new ExecuteSyncCommand(TestData.Alice, provider, run.Id));
        return (await _app.Sender.Send(new ListSyncRunsQuery(TestData.Alice))).Value.Single(r => r.Id == run.Id);
    }

    [Fact]
    public async Task A_manual_sync_queues_a_run_and_publishes_a_message_with_the_run_id()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.Etoro);

        var result = await _app.Sender.Send(new RequestSyncCommand(TestData.Alice, null));

        var run = result.Value.Should().ContainSingle().Subject;
        run.Status.Should().Be(SyncRunStatus.Queued);
        _app.Publisher.Messages.Should().ContainSingle(m => m.RunId == run.Id && m.Provider == IntegrationProvider.Etoro && m.UserId == "alice");
    }

    [Fact]
    public async Task Manual_syncs_are_rate_limited_per_connection()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.Etoro);
        (await _app.Sender.Send(new RequestSyncCommand(TestData.Alice, null))).IsSuccess.Should().BeTrue();
        _app.Clock.Advance(TimeSpan.FromMinutes(5));

        var second = await _app.Sender.Send(new RequestSyncCommand(TestData.Alice, null));

        second.Error!.Type.Should().Be(ErrorType.TooManyRequests);
        _app.Publisher.Messages.Should().HaveCount(1);
    }

    [Fact]
    public async Task Syncing_without_any_connection_is_not_found()
    {
        await _app.RegisterAliceAsync();

        var result = await _app.Sender.Send(new RequestSyncCommand(TestData.Alice, null));

        result.Error!.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task An_etoro_sync_captures_a_snapshot_resolves_tickers_and_records_success()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.Etoro);

        var run = await RequestAndExecuteAsync(IntegrationProvider.Etoro);

        run.Status.Should().Be(SyncRunStatus.Succeeded);
        run.ItemsProcessed.Should().Be(3);
        var snapshot = await _app.Snapshots.GetLatestAsync(TestData.Alice, default);
        snapshot!.Holdings.Single(h => h.Symbol == "ATROB").RelatedTickers.Should().Equal("ATRO");
        snapshot.Holdings.Single(h => h.Symbol == "LTC").TipRanksTicker.Should().Be("LTCUSD");
        var connection = await _app.Connections.GetAsync(TestData.Alice, IntegrationProvider.Etoro, default);
        connection!.LastSuccessfulSyncAt.Should().NotBeNull();
    }

    [Fact]
    public async Task A_redelivered_message_for_a_finished_run_does_not_call_the_provider_again()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.Etoro);
        var run = await RequestAndExecuteAsync(IntegrationProvider.Etoro);

        var again = await _app.Sender.Send(new ExecuteSyncCommand(TestData.Alice, IntegrationProvider.Etoro, run.Id));

        again.IsSuccess.Should().BeTrue();
        _app.Etoro.Calls.Should().Be(1);
    }

    [Fact]
    public async Task A_rate_limited_provider_fails_the_run_and_backs_off_by_its_retry_after()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.Etoro);
        _app.Etoro.Failure = new ProviderException(SyncFailureKind.RateLimited, "slow down", TimeSpan.FromMinutes(30));

        var run = await RequestAndExecuteAsync(IntegrationProvider.Etoro);

        run.Status.Should().Be(SyncRunStatus.Failed);
        run.Failure!.Kind.Should().Be(SyncFailureKind.RateLimited);
        var connection = await _app.Connections.GetAsync(TestData.Alice, IntegrationProvider.Etoro, default);
        connection!.RetryNotBefore.Should().Be(TestData.Now.AddMinutes(30));
        connection.Status.Should().Be(ConnectionStatus.Active);
    }

    [Fact]
    public async Task Rejected_credentials_mark_the_connection_so_the_user_must_reconnect()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.Etoro);
        _app.Etoro.Failure = new ProviderException(SyncFailureKind.Unauthorized, "bad key");

        await RequestAndExecuteAsync(IntegrationProvider.Etoro);

        var integrations = (await _app.Sender.Send(new ListIntegrationsQuery(TestData.Alice))).Value;
        integrations.Single(i => i.Provider == IntegrationProvider.Etoro).Status.Should().Be(ConnectionStatus.CredentialsRejected);
    }

    [Fact]
    public async Task A_tipranks_sync_before_any_portfolio_is_skipped_without_failing_the_connection()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.TipRanks);

        var run = await RequestAndExecuteAsync(IntegrationProvider.TipRanks);

        run.Status.Should().Be(SyncRunStatus.Skipped);
        run.SkipReason.Should().Contain("eToro");
        var connection = await _app.Connections.GetAsync(TestData.Alice, IntegrationProvider.TipRanks, default);
        connection!.ConsecutiveFailures.Should().Be(0);
        connection.RetryNotBefore.Should().NotBeNull();
    }

    [Fact]
    public async Task A_tipranks_sync_requests_only_stock_tickers_including_sibling_listings()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.Etoro);
        await ConnectAsync(IntegrationProvider.TipRanks);
        await RequestAndExecuteAsync(IntegrationProvider.Etoro);
        _app.Clock.Advance(TimeSpan.FromMinutes(20));
        _app.TipRanks.Signals["MSFT"] = TestData.StrongSignals();

        var run = await RequestAndExecuteAsync(IntegrationProvider.TipRanks);

        run.Status.Should().Be(SyncRunStatus.Succeeded);
        _app.TipRanks.RequestedTickers.Should().BeEquivalentTo(["MSFT", "ATROB", "ATRO"]);
        run.ItemsProcessed.Should().Be(1);
    }

    [Fact]
    public async Task The_scheduler_enqueues_only_connections_whose_plan_interval_has_elapsed()
    {
        await _app.RegisterAliceAsync(SubscriptionPlan.Pro);
        await ConnectAsync(IntegrationProvider.Etoro);
        await ConnectAsync(IntegrationProvider.TipRanks);
        var tipRanks = await _app.Connections.GetAsync(TestData.Alice, IntegrationProvider.TipRanks, default);
        tipRanks!.RecordSuccess(TestData.Now.AddHours(-1));
        await _app.Connections.SaveAsync(tipRanks, default);

        var enqueued = await _app.Sender.Send(new EnqueueDueSyncsCommand());

        enqueued.Should().Be(1);
        _app.Publisher.Messages.Should().ContainSingle(m => m.Provider == IntegrationProvider.Etoro);

        var again = await _app.Sender.Send(new EnqueueDueSyncsCommand());
        again.Should().Be(0, "a queued sync must not be enqueued twice");
    }

    [Fact]
    public async Task The_scheduler_respects_the_batch_limit()
    {
        await _app.RegisterAliceAsync();
        await ConnectAsync(IntegrationProvider.Etoro);
        await ConnectAsync(IntegrationProvider.TipRanks);

        var enqueued = await _app.Sender.Send(new EnqueueDueSyncsCommand(MaxRuns: 1));

        enqueued.Should().Be(1);
    }
}

public sealed class PortfolioAnalysisTests : IDisposable
{
    private readonly AppFixture _app = new();

    public void Dispose() => _app.Dispose();

    private async Task SeedAsync()
    {
        await _app.RegisterAliceAsync();
        foreach (var (provider, fields) in new[]
        {
            (IntegrationProvider.Etoro, new Dictionary<string, string> { ["apiKey"] = "a", ["userKey"] = "u" }),
            (IntegrationProvider.TipRanks, new Dictionary<string, string> { ["apiKey"] = "a" }),
        })
        {
            await _app.Sender.Send(new ConnectProviderCommand(TestData.Alice, provider, fields));
        }

        _app.Etoro.Portfolio = TestData.EtoroPortfolio();
        _app.TipRanks.Signals["MSFT"] = TestData.StrongSignals();
        foreach (var provider in new[] { IntegrationProvider.Etoro, IntegrationProvider.TipRanks })
        {
            var run = (await _app.Sender.Send(new RequestSyncCommand(TestData.Alice, provider))).Value.Single();
            await _app.Sender.Send(new ExecuteSyncCommand(TestData.Alice, provider, run.Id));
            _app.Clock.Advance(TimeSpan.FromMinutes(20));
        }
    }

    [Fact]
    public async Task Analysis_before_any_sync_is_not_found()
    {
        await _app.RegisterAliceAsync();

        var result = await _app.Sender.Send(new GetPortfolioAnalysisQuery(TestData.Alice));

        result.Error!.Code.Should().Be("portfolio.not_synced");
    }

    [Fact]
    public async Task Analysis_joins_the_snapshot_with_signals_and_scores_each_holding()
    {
        await SeedAsync();

        var result = await _app.Sender.Send(new GetPortfolioAnalysisQuery(TestData.Alice));

        var analysis = result.Value;
        analysis.Holdings.Select(h => h.Holding.Symbol).Should().Equal("MSFT", "ATROB", "LTC");
        analysis.Holdings[0].Assessment.Verdict.Should().Be(Verdict.HoldReviewSize, "MSFT is 50% of the account");
        analysis.Holdings[1].Assessment.Verdict.Should().Be(Verdict.NoData, "no signals were returned for ATROB or ATRO");
        analysis.Holdings[2].Assessment.Flags.Should().Contain(f => f.Key == "no_coverage");
        analysis.SignalsFetchedAt.Should().NotBeNull();
        analysis.Disclaimer.Should().Contain("not investment advice");
    }

    [Fact]
    public async Task Holding_detail_exposes_the_raw_signals_behind_the_verdict()
    {
        await SeedAsync();

        var result = await _app.Sender.Send(new GetHoldingDetailQuery(TestData.Alice, "msft"));

        result.Value.Signals!.SmartScore.Should().Be(9);
        result.Value.Analysis.Assessment.Facts.Consensus.Should().NotBeNull();
        (await _app.Sender.Send(new GetHoldingDetailQuery(TestData.Alice, "NOPE"))).Error!.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task The_latest_portfolio_reports_weights_and_the_last_successful_sync()
    {
        await SeedAsync();

        var result = await _app.Sender.Send(new GetLatestPortfolioQuery(TestData.Alice));

        result.Value.Holdings[0].WeightPct.Should().Be(50m);
        result.Value.LastSuccessfulSyncAt.Should().NotBeNull();
        (await _app.Sender.Send(new ListPortfolioSnapshotsQuery(TestData.Alice))).Value.Should().ContainSingle();
    }
}

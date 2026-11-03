using PortfolioSignals.Domain.Analysis;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.DevSeed.Tests;

public sealed class SeederTests : IDisposable
{
    private static readonly UserId Demo = SeedFixture.Demo;
    private readonly SeedFixture _fixture = new();

    public void Dispose() => _fixture.Dispose();

    [Fact]
    public async Task Seeding_an_empty_account_registers_the_user_and_stores_two_successful_syncs()
    {
        var summary = await _fixture.SeedAsync();

        summary.ProfileCreated.Should().BeTrue();
        summary.Email.Should().Be("demo@example.test");
        (await _fixture.Users.GetAsync(Demo, CancellationToken.None))!.DisplayName.Should().Be("demo");

        var connections = await _fixture.Connections.ListForUserAsync(Demo, CancellationToken.None);
        connections.Should().HaveCount(2).And.OnlyContain(c => c.Status == ConnectionStatus.Active && c.LastSuccessfulSyncAt != null);

        var runs = await _fixture.Runs.ListRecentAsync(Demo, 10, CancellationToken.None);
        runs.Should().HaveCount(2).And.OnlyContain(r => r.Status == SyncRunStatus.Succeeded && r.Trigger == SyncTrigger.Scheduled);

        var snapshot = await _fixture.Snapshots.GetLatestAsync(Demo, CancellationToken.None);
        snapshot!.Holdings.Should().HaveCount(15);
        snapshot.CopiedTraders.Should().HaveCount(2);
        snapshot.Account.Currency.Should().Be("USD");

        (await _fixture.Signals.ListAsync(Demo, CancellationToken.None)).Should().HaveCount(14);
        summary.Holdings.Should().Be(15);
        summary.Signals.Should().Be(14);
    }

    [Fact]
    public async Task The_seeded_portfolio_has_a_holding_for_every_verdict_so_no_state_of_the_app_is_empty()
    {
        await _fixture.SeedAsync();

        var analysis = await _fixture.AnalysisAsync();

        analysis.Kpis.VerdictCounts.Should().OnlyContain(count => count.Value > 0);
    }

    [Fact]
    public async Task A_share_class_without_data_borrows_its_siblings_and_an_etf_and_a_coin_have_no_data()
    {
        await _fixture.SeedAsync();

        var holdings = (await _fixture.AnalysisAsync()).Holdings.ToDictionary(h => h.Holding.Symbol);

        holdings["ALPSB"].Assessment.Verdict.Should().NotBe(Verdict.NoData);
        holdings["ALPSB"].Assessment.ViaTicker.Should().Be("ALPS");
        holdings["TREY"].Assessment.Verdict.Should().Be(Verdict.NoData);
        holdings["ORBT"].Assessment.Verdict.Should().Be(Verdict.NoData);
    }

    [Fact]
    public async Task A_profile_the_user_already_registered_is_kept()
    {
        await _fixture.Users.SaveAsync(UserAccount.Register(Demo, "dana@example.test", "Dana", _fixture.Clock.GetUtcNow()), CancellationToken.None);

        var summary = await _fixture.SeedAsync();

        summary.ProfileCreated.Should().BeFalse();
        summary.Email.Should().Be("dana@example.test");
        (await _fixture.Users.GetAsync(Demo, CancellationToken.None))!.DisplayName.Should().Be("Dana");
    }

    [Fact]
    public async Task Seeding_again_is_one_more_sync_not_a_failure_or_a_second_account()
    {
        await _fixture.SeedAsync();
        _fixture.Clock.Advance(TimeSpan.FromMinutes(1));

        var second = await _fixture.SeedAsync();

        second.ProfileCreated.Should().BeFalse();
        (await _fixture.Connections.ListForUserAsync(Demo, CancellationToken.None)).Should().HaveCount(2);
        (await _fixture.Snapshots.ListRecentAsync(Demo, 10, CancellationToken.None)).Should().HaveCount(2);
        (await _fixture.Runs.ListRecentAsync(Demo, 10, CancellationToken.None)).Should().HaveCount(4);
        (await _fixture.Signals.ListAsync(Demo, CancellationToken.None)).Should().HaveCount(14);
    }

    [Fact]
    public async Task Every_user_gets_a_separate_account()
    {
        await _fixture.SeedAsync("demo");
        await _fixture.SeedAsync("tester");

        (await _fixture.Snapshots.GetLatestAsync(new UserId("tester"), CancellationToken.None)).Should().NotBeNull();
        (await _fixture.Connections.ListForUserAsync(new UserId("tester"), CancellationToken.None)).Should().HaveCount(2);
        (await _fixture.Connections.ListForUserAsync(Demo, CancellationToken.None)).Should().HaveCount(2);
    }
}

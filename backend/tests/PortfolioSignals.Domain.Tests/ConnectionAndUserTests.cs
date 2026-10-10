using PortfolioSignals.Domain.Common;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.TestSupport;

namespace PortfolioSignals.Domain.Tests;

public class ProviderConnectionTests
{
    private static readonly TimeSpan Daily = TimeSpan.FromDays(1);
    private static readonly DateTimeOffset Now = TestData.Now;

    private static ProviderConnection NewConnection() => ProviderConnection.Connect(TestData.Alice, IntegrationProvider.Etoro, Now);

    [Fact]
    public void A_new_connection_is_due_immediately()
        => NewConnection().IsDue(Now, Daily).Should().BeTrue();

    [Fact]
    public void A_connection_is_not_due_until_the_plan_interval_has_elapsed()
    {
        var connection = NewConnection();
        connection.RecordSuccess(Now);

        connection.IsDue(Now.AddHours(23), Daily).Should().BeFalse();
        connection.IsDue(Now.AddHours(24), Daily).Should().BeTrue();
    }

    [Fact]
    public void A_queued_sync_blocks_a_duplicate_until_the_lease_expires()
    {
        var connection = NewConnection();
        connection.MarkSyncRequested(Now);

        connection.IsDue(Now.AddMinutes(10), Daily).Should().BeFalse();
        connection.IsDue(Now.Add(ProviderConnection.QueueLease), Daily).Should().BeTrue();
    }

    [Fact]
    public void Failures_back_off_exponentially_up_to_a_cap()
    {
        var connection = NewConnection();

        connection.RecordFailure(SyncFailureKind.Unavailable, "down", Now);
        connection.RetryNotBefore.Should().Be(Now.AddMinutes(5));

        connection.RecordFailure(SyncFailureKind.Unavailable, "down", Now);
        connection.RetryNotBefore.Should().Be(Now.AddMinutes(10));

        for (var i = 0; i < 20; i++)
        {
            connection.RecordFailure(SyncFailureKind.Unavailable, "down", Now);
        }

        connection.RetryNotBefore.Should().Be(Now.AddHours(6));
        connection.IsDue(Now.AddHours(1), Daily).Should().BeFalse();
    }

    [Fact]
    public void A_rate_limit_honours_the_provider_retry_after()
    {
        var connection = NewConnection();

        connection.RecordFailure(SyncFailureKind.RateLimited, "slow down", Now, TimeSpan.FromMinutes(42));

        connection.RetryNotBefore.Should().Be(Now.AddMinutes(42));
    }

    [Fact]
    public void Rejected_credentials_stop_scheduled_syncs_until_reconnected()
    {
        var connection = NewConnection();

        connection.RecordFailure(SyncFailureKind.Unauthorized, "bad key", Now);

        connection.Status.Should().Be(ConnectionStatus.CredentialsRejected);
        connection.IsDue(Now.AddDays(30), Daily).Should().BeFalse();

        connection.Reconnect(Now.AddDays(1));

        connection.Status.Should().Be(ConnectionStatus.Active);
        connection.LastFailure.Should().BeNull();
        connection.IsDue(Now.AddDays(1), Daily).Should().BeTrue();
    }

    [Fact]
    public void Success_clears_failure_state()
    {
        var connection = NewConnection();
        connection.RecordFailure(SyncFailureKind.Unavailable, "down", Now);

        connection.RecordSuccess(Now.AddMinutes(6));

        connection.ConsecutiveFailures.Should().Be(0);
        connection.RetryNotBefore.Should().BeNull();
        connection.LastFailure.Should().BeNull();
        connection.LastSuccessfulSyncAt.Should().Be(Now.AddMinutes(6));
    }

    [Fact]
    public void A_disconnected_connection_rejects_further_sync_activity()
    {
        var connection = NewConnection();
        connection.Disconnect(Now);

        var act = () => connection.MarkSyncRequested(Now);

        act.Should().Throw<DomainException>();
        connection.IsDue(Now.AddDays(10), Daily).Should().BeFalse();
        connection.NextDueAt(Daily).Should().BeNull();
    }
}

public class SyncRunTests
{
    private static SyncRun NewRun() => SyncRun.Request(TestData.Alice, IntegrationProvider.TipRanks, SyncTrigger.Manual, TestData.Now);

    [Fact]
    public void A_run_moves_from_queued_to_running_to_succeeded()
    {
        var run = NewRun();

        run.Start(TestData.Now);
        run.Succeed(TestData.Now.AddSeconds(3), 12);

        run.Status.Should().Be(SyncRunStatus.Succeeded);
        run.ItemsProcessed.Should().Be(12);
        run.IsFinished.Should().BeTrue();
    }

    [Fact]
    public void A_finished_run_cannot_be_started_again()
    {
        var run = NewRun();
        run.Start(TestData.Now);
        run.Succeed(TestData.Now, 1);

        var act = () => run.Start(TestData.Now);

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void A_running_run_can_be_restarted_so_a_redelivered_message_can_resume()
    {
        var run = NewRun();
        run.Start(TestData.Now);

        var act = () => run.Start(TestData.Now.AddMinutes(2));

        act.Should().NotThrow();
    }

    [Fact]
    public void A_queued_run_cannot_succeed_without_starting()
    {
        var act = () => NewRun().Succeed(TestData.Now, 1);

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void A_failed_run_records_the_failure()
    {
        var run = NewRun();
        run.Start(TestData.Now);

        run.Fail(TestData.Now, SyncFailureKind.RateLimited, "quota");

        run.Failure.Should().NotBeNull();
        run.Failure!.Kind.Should().Be(SyncFailureKind.RateLimited);
    }
}

public class UserAccountTests
{
    [Fact]
    public void Registration_starts_on_the_free_plan_and_raises_an_event()
    {
        var user = UserAccount.Register(TestData.Alice, "alice@example.test", "Alice", TestData.Now);

        user.Plan.Should().Be(SubscriptionPlan.Free);
        user.DomainEvents.Should().ContainSingle(e => e is UserRegistered);
    }

    [Fact]
    public void Registration_requires_an_email()
    {
        var act = () => UserAccount.Register(TestData.Alice, " ", "Alice", TestData.Now);

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Changing_plan_raises_an_event_only_when_the_plan_changes()
    {
        var user = UserAccount.Register(TestData.Alice, "alice@example.test", "Alice", TestData.Now);
        user.ClearDomainEvents();

        user.ChangePlan(SubscriptionPlan.Free, TestData.Now);
        user.DomainEvents.Should().BeEmpty();

        user.ChangePlan(SubscriptionPlan.Pro, TestData.Now);
        user.DomainEvents.Should().ContainSingle(e => e is SubscriptionPlanChanged);
        user.SyncPolicy.TipRanksInterval.Should().Be(TimeSpan.FromHours(6));
    }

    [Theory]
    [InlineData(SubscriptionPlan.Free, 7 * 24 * 60)]
    [InlineData(SubscriptionPlan.Essential, 24 * 60)]
    [InlineData(SubscriptionPlan.Pro, 6 * 60)]
    [InlineData(SubscriptionPlan.Premium, 60)]
    public void Sync_intervals_follow_the_plan_table(SubscriptionPlan plan, int expectedMinutes)
    {
        var policy = SyncPolicy.For(plan);

        policy.EtoroInterval.TotalMinutes.Should().Be(expectedMinutes);
        policy.TipRanksInterval.TotalMinutes.Should().Be(expectedMinutes);
    }
}

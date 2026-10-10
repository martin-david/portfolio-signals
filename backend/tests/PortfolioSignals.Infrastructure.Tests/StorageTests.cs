using System.Text.Json;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Sync;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.Infrastructure.Cosmos;
using PortfolioSignals.Infrastructure.Secrets;
using PortfolioSignals.TestSupport;

namespace PortfolioSignals.Infrastructure.Tests;

public class DocumentMappingTests
{
    private static T RoundTrip<T>(T document)
    {
        var json = JsonSerializer.Serialize(document, InfrastructureJson.Options);
        return JsonSerializer.Deserialize<T>(json, InfrastructureJson.Options)!;
    }

    [Fact]
    public void A_user_survives_a_json_round_trip()
    {
        var user = UserAccount.Register(TestData.Alice, "alice@example.test", "Alice", TestData.Now);
        user.ChangePlan(SubscriptionPlan.Premium, TestData.Now);

        var restored = RoundTrip(UserDocument.From(user)).ToDomain();

        restored.Plan.Should().Be(SubscriptionPlan.Premium);
        restored.Email.Should().Be("alice@example.test");
        restored.DomainEvents.Should().BeEmpty("rehydration must not replay events");
    }

    [Fact]
    public void A_connection_keeps_its_sync_health_and_uses_the_provider_as_document_id()
    {
        var connection = ProviderConnection.Connect(TestData.Alice, IntegrationProvider.TipRanks, TestData.Now);
        connection.RecordFailure(SyncFailureKind.RateLimited, "quota", TestData.Now, TimeSpan.FromMinutes(30));

        var document = ConnectionDocument.From(connection);
        var restored = RoundTrip(document).ToDomain();

        document.Id.Should().Be("TipRanks");
        document.UserId.Should().Be("alice");
        restored.LastFailure!.Kind.Should().Be(SyncFailureKind.RateLimited);
        restored.RetryNotBefore.Should().Be(TestData.Now.AddMinutes(30));
        restored.Id.Should().Be(connection.Id);
    }

    [Fact]
    public void A_snapshot_survives_a_round_trip_with_holdings_and_a_retention_ttl()
    {
        var snapshot = PortfolioSnapshot.Capture(
            TestData.Alice,
            TestData.Now,
            new AccountSummary("USD", 10_000m, 9_000m, 500m, 500m, 250m, 4_000m),
            [TestData.Holding("ATROB", related: ["ATRO"]), TestData.Holding("MSFT", value: 7_000m)],
            [new CopiedTrader(1, 290m, 500m, -75m, -0.35m, -0.26m, 0.04m, 4.06m, 5m)],
            TestData.Now);

        var document = SnapshotDocument.From(snapshot, retentionDays: 30);
        var restored = RoundTrip(document).ToDomain();

        document.Ttl.Should().Be(30 * 24 * 3600);
        restored.Id.Should().Be(snapshot.Id);
        restored.Holdings.Select(h => h.Symbol).Should().Equal("MSFT", "ATROB");
        restored.Holdings[1].RelatedTickers.Should().Equal("ATRO");
        restored.CopiedTraders.Should().ContainSingle();
    }

    [Fact]
    public void Signals_keep_nullable_fields_dates_and_enums()
    {
        var signals = InstrumentSignals.Create(TestData.Alice, "de:shl", TestData.StrongSignals(), TestData.Now);

        var document = SignalsDocument.From(signals);
        var restored = RoundTrip(document).ToDomain();

        document.Id.Should().Be("signals-DE:SHL");
        restored.Ticker.Should().Be("DE:SHL");
        restored.Data.Consensus.Should().Be(AnalystConsensus.StrongBuy);
        restored.Data.NextEarningsDate.Should().Be(new DateOnly(2026, 10, 20));
        restored.Data.Ai!.Score.Should().Be(85);
        restored.Data.Breadth.Should().BeNull();
    }

    [Fact]
    public void A_sync_run_survives_a_round_trip_and_expires_via_ttl()
    {
        var run = SyncRun.Request(TestData.Alice, IntegrationProvider.Etoro, SyncTrigger.Scheduled, TestData.Now);
        run.Start(TestData.Now);
        run.Fail(TestData.Now, SyncFailureKind.Unavailable, "down");

        var document = SyncRunDocument.From(run, retentionDays: 90);
        var restored = RoundTrip(document).ToDomain();

        document.Ttl.Should().Be(90 * 24 * 3600);
        restored.Status.Should().Be(SyncRunStatus.Failed);
        restored.Failure!.Message.Should().Be("down");
    }

    [Fact]
    public void Documents_serialize_the_cosmos_system_property_names_and_partition_key()
    {
        var json = JsonSerializer.Serialize(UserDocument.From(UserAccount.Register(TestData.Alice, "a@b.test", "A", TestData.Now)), InfrastructureJson.Options);

        using var doc = JsonDocument.Parse(json);
        doc.RootElement.GetProperty("id").GetString().Should().Be("alice");
        doc.RootElement.GetProperty("userId").GetString().Should().Be("alice");
        doc.RootElement.GetProperty("type").GetString().Should().Be("user");
        doc.RootElement.GetProperty("plan").GetString().Should().Be("Free");
    }
}

public class SecretsAndSymbolsTests
{
    [Fact]
    public void Secret_names_are_stable_valid_for_key_vault_and_free_of_personal_data()
    {
        var name = SecretNames.For(new UserId("alice@example.com"), IntegrationProvider.Etoro);

        name.Should().Be(SecretNames.For(new UserId("alice@example.com"), IntegrationProvider.Etoro));
        name.Should().MatchRegex("^[a-z0-9-]{1,127}$");
        name.Should().NotContain("alice").And.NotContain("example");
        name.Should().NotBe(SecretNames.For(new UserId("alice@example.com"), IntegrationProvider.TipRanks));
    }

    [Fact]
    public void Credentials_never_appear_in_their_string_form()
    {
        var credentials = new ProviderCredentials(new Dictionary<string, string> { ["apiKey"] = "super-secret" });

        credentials.ToString().Should().NotContain("super-secret");
    }

    [Fact]
    public void The_embedded_symbol_overrides_load_and_carry_the_known_edge_cases()
    {
        var overrides = SymbolOverrides.Load();

        overrides.Should().Contain(m => m.EtoroSymbol == "ATROB" && m.RelatedTickers.Contains("ATRO"));
        overrides.Should().Contain(m => m.EtoroSymbol == "SGB" && m.LowConfidence);
    }

    [Fact]
    public async Task The_in_memory_credential_store_round_trips_and_deletes()
    {
        var store = new PortfolioSignals.Infrastructure.Secrets.InMemoryCredentialStore();
        var user = new UserId("u1");

        await store.SaveAsync(user, IntegrationProvider.TipRanks, new ProviderCredentials(new Dictionary<string, string> { ["apiKey"] = "k" }), default);
        (await store.GetAsync(user, IntegrationProvider.TipRanks, default))!.Require("apiKey").Should().Be("k");

        await store.DeleteAsync(user, IntegrationProvider.TipRanks, default);
        (await store.GetAsync(user, IntegrationProvider.TipRanks, default)).Should().BeNull();
    }
}

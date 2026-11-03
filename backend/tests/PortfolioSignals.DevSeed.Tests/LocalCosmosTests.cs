using System.Net;
using System.Net.Sockets;
using Microsoft.Azure.Cosmos;
using PortfolioSignals.Infrastructure.Cosmos;

namespace PortfolioSignals.DevSeed.Tests;

public sealed class LocalCosmosTests
{
    private const string DummyKey = "bm90LWEtcmVhbC1rZXk=";
    private const string OtherAccount = "https://other-account.invalid:443/";

    /// <summary>The endpoint the Cosmos client resolves from a connection string. That is what the guard judges, so that is what these tests feed it.</summary>
    private static Uri ResolvedEndpoint(string connectionString)
    {
        using var client = new CosmosClient(connectionString);
        return client.Endpoint;
    }

    [Theory]
    [InlineData("https://localhost:8081/")]
    [InlineData("https://127.0.0.1:8081/")]
    [InlineData("https://[::1]:8081/")]
    [InlineData("http://localhost:8081/")]
    public void The_emulator_on_this_machine_is_accepted(string endpoint)
    {
        var resolved = ResolvedEndpoint($"AccountEndpoint={endpoint};AccountKey={DummyKey}");

        LocalCosmos.RequireLoopback(resolved).Should().Be(new Uri(endpoint));
    }

    [Theory]
    [InlineData(OtherAccount)]
    [InlineData("https://localhost.example.com:8081/")]
    [InlineData("https://example.com/localhost")]
    [InlineData("https://10.0.0.5:8081/")]
    public void Any_other_account_is_refused_by_name(string endpoint)
    {
        var resolved = ResolvedEndpoint($"AccountEndpoint={endpoint};AccountKey={DummyKey}");

        var check = () => LocalCosmos.RequireLoopback(resolved);

        check.Should().Throw<SeedException>().WithMessage("*on this machine*");
    }

    [Fact]
    public void When_the_endpoint_is_given_twice_the_one_the_client_uses_is_judged()
    {
        // The Cosmos client takes the last of two endpoints, so the first string reaches the other account although it starts with a local one.
        var localThenRemote = ResolvedEndpoint($"AccountEndpoint=https://localhost:8081/;AccountEndpoint={OtherAccount};AccountKey={DummyKey}");
        var remoteThenLocal = ResolvedEndpoint($"AccountEndpoint={OtherAccount};AccountEndpoint=https://localhost:8081/;AccountKey={DummyKey}");

        var first = () => LocalCosmos.RequireLoopback(localThenRemote);

        first.Should().Throw<SeedException>().WithMessage("*other-account.invalid*");
        LocalCosmos.RequireLoopback(remoteThenLocal).Host.Should().Be("localhost");
    }

    [Theory]
    [InlineData(" accountkey=" + DummyKey + " ; ACCOUNTENDPOINT = https://localhost:8081/ ;")]
    [InlineData("AccountEndpoint=\"https://localhost:8081/\";AccountKey=" + DummyKey)]
    public void The_endpoint_is_found_however_the_connection_string_is_spelled(string connectionString)
    {
        LocalCosmos.RequireLoopback(ResolvedEndpoint(connectionString)).Host.Should().Be("localhost");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_configuration_without_a_connection_string_is_refused(string? connectionString)
    {
        var check = () => LocalCosmos.RequireConnectionString(new CosmosOptions { ConnectionString = connectionString });

        check.Should().Throw<SeedException>().WithMessage("*Cosmos:ConnectionString*");
    }

    [Fact]
    public void An_account_reached_by_endpoint_and_token_is_refused_even_though_its_name_is_local()
    {
        var check = () => LocalCosmos.RequireConnectionString(new CosmosOptions { Endpoint = "https://localhost:8081/" });

        check.Should().Throw<SeedException>();
    }

    [Fact]
    public void A_connection_string_is_accepted()
    {
        var check = () => LocalCosmos.RequireConnectionString(new CosmosOptions { ConnectionString = $"AccountEndpoint=https://localhost:8081/;AccountKey={DummyKey}" });

        check.Should().NotThrow();
    }

    [Fact]
    public async Task A_port_that_is_listening_is_reported_and_one_that_is_not_is_too()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var endpoint = new Uri($"https://127.0.0.1:{port}/");

        try
        {
            (await LocalCosmos.IsListeningAsync(endpoint, CancellationToken.None)).Should().BeTrue();
        }
        finally
        {
            listener.Stop();
        }

        (await LocalCosmos.IsListeningAsync(endpoint, CancellationToken.None)).Should().BeFalse();
    }

    [Fact]
    public async Task Cancelling_the_seeder_is_not_mistaken_for_a_closed_port()
    {
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();

        var check = () => LocalCosmos.IsListeningAsync(new Uri("https://127.0.0.1:9/"), cancelled.Token);

        await check.Should().ThrowAsync<OperationCanceledException>();
    }
}

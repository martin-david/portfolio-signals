using System.Net;
using System.Net.Sockets;
using PortfolioSignals.Infrastructure.Cosmos;

namespace PortfolioSignals.DevSeed.Tests;

public sealed class LocalCosmosTests
{
    private const string DummyKey = "bm90LWEtcmVhbC1rZXk=";

    private static CosmosOptions WithConnectionString(string? connectionString) => new() { ConnectionString = connectionString };

    [Theory]
    [InlineData("https://localhost:8081/")]
    [InlineData("https://127.0.0.1:8081/")]
    [InlineData("https://[::1]:8081/")]
    [InlineData("http://localhost:8081/")]
    public void The_emulator_on_this_machine_is_accepted(string endpoint)
    {
        var options = WithConnectionString($"AccountEndpoint={endpoint};AccountKey={DummyKey}");

        LocalCosmos.RequireLocalEndpoint(options).Should().Be(new Uri(endpoint));
    }

    [Fact]
    public void The_endpoint_is_found_wherever_it_sits_in_the_connection_string_and_however_it_is_spelled()
    {
        var options = WithConnectionString($" accountkey={DummyKey} ; ACCOUNTENDPOINT = https://localhost:8081/ ;");

        LocalCosmos.RequireLocalEndpoint(options).Host.Should().Be("localhost");
    }

    [Theory]
    [InlineData("https://portfolio-signals.documents.azure.com:443/")]
    [InlineData("https://localhost.example.com:8081/")]
    [InlineData("https://example.com/localhost")]
    [InlineData("https://10.0.0.5:8081/")]
    public void Any_other_account_is_refused_by_name(string endpoint)
    {
        var options = WithConnectionString($"AccountEndpoint={endpoint};AccountKey={DummyKey}");

        var check = () => LocalCosmos.RequireLocalEndpoint(options);

        check.Should().Throw<SeedException>().WithMessage("*on this machine*");
    }

    [Fact]
    public void The_refusal_never_repeats_the_connection_string_or_its_key()
    {
        var options = WithConnectionString($"AccountEndpoint=https://portfolio-signals.documents.azure.com:443/;AccountKey={DummyKey}");

        var check = () => LocalCosmos.RequireLocalEndpoint(options);

        check.Should().Throw<SeedException>().Which.Message.Should().NotContain(DummyKey).And.NotContain("AccountKey");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("AccountKey=abc")]
    [InlineData("AccountEndpoint=not a uri;AccountKey=abc")]
    public void A_connection_string_without_a_usable_endpoint_is_refused(string? connectionString)
    {
        var check = () => LocalCosmos.RequireLocalEndpoint(WithConnectionString(connectionString));

        check.Should().Throw<SeedException>().WithMessage("*Cosmos:ConnectionString*");
    }

    [Fact]
    public void An_account_reached_by_endpoint_and_token_is_refused_even_though_its_name_is_local()
    {
        var options = new CosmosOptions { Endpoint = "https://localhost:8081/" };

        var check = () => LocalCosmos.RequireLocalEndpoint(options);

        check.Should().Throw<SeedException>();
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

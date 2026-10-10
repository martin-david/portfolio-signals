using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FreeMediator;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Sync;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.TestSupport;

namespace PortfolioSignals.Api.Tests;

/// <summary>Boots the real API pipeline (routing, auth, validation, problem details) over in-memory ports.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public InMemoryUserRepository Users { get; } = new();

    public InMemoryConnectionRepository Connections { get; } = new();

    public InMemoryPortfolioSnapshotRepository Snapshots { get; } = new();

    public InMemorySignalsRepository Signals { get; } = new();

    public InMemorySyncRunRepository Runs { get; } = new();

    public InMemoryCredentialStore Credentials { get; } = new();

    public RecordingSyncRequestPublisher Publisher { get; } = new();

    public FakeEtoroPortfolioClient Etoro { get; } = new();

    public FakeTipRanksClient TipRanks { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Authentication:Mode", "Development");
        builder.UseSetting("CredentialStore:Mode", "InMemory");
        builder.UseSetting("SyncQueue:Mode", "Disabled");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IHostedService>();
            services.Replace(ServiceDescriptor.Singleton<IUserRepository>(Users));
            services.Replace(ServiceDescriptor.Singleton<IConnectionRepository>(Connections));
            services.Replace(ServiceDescriptor.Singleton<IPortfolioSnapshotRepository>(Snapshots));
            services.Replace(ServiceDescriptor.Singleton<ISignalsRepository>(Signals));
            services.Replace(ServiceDescriptor.Singleton<ISyncRunRepository>(Runs));
            services.Replace(ServiceDescriptor.Singleton<ICredentialStore>(Credentials));
            services.Replace(ServiceDescriptor.Singleton<ISyncRequestPublisher>(Publisher));
            services.Replace(ServiceDescriptor.Singleton<IEtoroPortfolioClient>(Etoro));
            services.Replace(ServiceDescriptor.Singleton<ITipRanksClient>(TipRanks));
        });
    }

    public HttpClient ClientFor(string user)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("X-Dev-User", user);
        return client;
    }
}

public sealed class ApiTests : IClassFixture<ApiFactory>
{
    private static readonly Dictionary<string, string> EtoroKeys = new() { ["apiKey"] = "SECRET-APP-KEY", ["userKey"] = "SECRET-USER-KEY" };
    private readonly ApiFactory _factory;

    public ApiTests(ApiFactory factory) => _factory = factory;

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response)
        => JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private static async Task RegisterAsync(HttpClient client)
        => (await client.PutAsJsonAsync("/api/v1/me", new { })).StatusCode.Should().Be(HttpStatusCode.OK);

    [Fact]
    public async Task Requests_without_a_user_are_rejected()
    {
        var response = await _factory.CreateClient().GetAsync("/api/v1/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Health_and_the_openapi_document_are_public()
    {
        var client = _factory.CreateClient();

        (await client.GetAsync("/health/live")).StatusCode.Should().Be(HttpStatusCode.OK);

        var openApi = await client.GetAsync("/openapi/v1.json");
        openApi.StatusCode.Should().Be(HttpStatusCode.OK);
        var paths = (await JsonAsync(openApi)).GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();
        paths.Should().Contain(["/api/v1/me", "/api/v1/integrations/{provider}", "/api/v1/sync", "/api/v1/portfolio/analysis", "/api/v1/portfolio/holdings/{symbol}"]);
    }

    [Fact]
    public async Task An_unregistered_user_gets_a_problem_details_404()
    {
        var response = await _factory.ClientFor("nobody").GetAsync("/api/v1/me");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        (await JsonAsync(response)).GetProperty("code").GetString().Should().Be("user.not_registered");
    }

    [Fact]
    public async Task Putting_the_profile_registers_the_user_from_token_claims_and_serializes_enums_as_strings()
    {
        var client = _factory.ClientFor("carol");

        var response = await client.PutAsJsonAsync("/api/v1/me", new { displayName = "Carol" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await JsonAsync(response);
        body.GetProperty("email").GetString().Should().Be("carol@example.test");
        body.GetProperty("displayName").GetString().Should().Be("Carol");
        body.GetProperty("plan").GetString().Should().Be("Free");
    }

    [Fact]
    public async Task An_invalid_profile_returns_a_validation_problem()
    {
        var response = await _factory.ClientFor("dave").PutAsJsonAsync("/api/v1/me", new { email = "nope" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await JsonAsync(response)).GetProperty("errors").EnumerateObject().Select(e => e.Name).Should().Contain("Email");
    }

    [Fact]
    public async Task Connecting_a_provider_never_echoes_the_credentials()
    {
        var client = _factory.ClientFor("erin");
        await RegisterAsync(client);

        var response = await client.PutAsJsonAsync("/api/v1/integrations/etoro", new { credentials = EtoroKeys });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var text = await response.Content.ReadAsStringAsync();
        text.Should().NotContain("SECRET");
        (await _factory.Credentials.GetAsync(new UserId("erin"), IntegrationProvider.Etoro, default))!.Require("userKey").Should().Be("SECRET-USER-KEY");

        var list = await JsonAsync(await client.GetAsync("/api/v1/integrations"));
        list.EnumerateArray().Single(i => i.GetProperty("provider").GetString() == "Etoro").GetProperty("status").GetString().Should().Be("Active");
    }

    [Fact]
    public async Task Connecting_with_incomplete_credentials_is_a_400()
    {
        var client = _factory.ClientFor("frank");
        await RegisterAsync(client);

        var response = await client.PutAsJsonAsync("/api/v1/integrations/etoro", new { credentials = new Dictionary<string, string> { ["apiKey"] = "x" } });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Manual_sync_is_accepted_then_rate_limited_and_the_analysis_flows_end_to_end()
    {
        var client = _factory.ClientFor("grace");
        await RegisterAsync(client);
        await client.PutAsJsonAsync("/api/v1/integrations/etoro", new { credentials = EtoroKeys });
        await client.PutAsJsonAsync("/api/v1/integrations/tipranks", new { credentials = new Dictionary<string, string> { ["apiKey"] = "TR" } });
        _factory.TipRanks.Signals["MSFT"] = TestData.StrongSignals();

        (await client.GetAsync("/api/v1/portfolio/analysis")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        var accepted = await client.PostAsync("/api/v1/sync", content: null);
        accepted.StatusCode.Should().Be(HttpStatusCode.Accepted);
        var runs = (await JsonAsync(accepted)).EnumerateArray().ToList();
        runs.Should().HaveCount(2);

        (await client.PostAsync("/api/v1/sync", content: null)).StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        // The Azure Function would dequeue these messages; run them in order, eToro first.
        using (var scope = _factory.Services.CreateScope())
        {
            var sender = scope.ServiceProvider.GetRequiredService<ISender>();
            foreach (var message in _factory.Publisher.Messages.Where(m => m.UserId == "grace").OrderBy(m => m.Provider))
            {
                await sender.Send(new ExecuteSyncCommand(new UserId(message.UserId), message.Provider, message.RunId));
            }
        }

        var history = await JsonAsync(await client.GetAsync("/api/v1/sync/runs"));
        history.EnumerateArray().Select(r => r.GetProperty("status").GetString()).Should().OnlyContain(s => s == "Succeeded" || s == "Skipped");

        var analysisResponse = await client.GetAsync("/api/v1/portfolio/analysis");
        analysisResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var analysis = await JsonAsync(analysisResponse);
        analysis.GetProperty("holdings").GetArrayLength().Should().Be(3);
        analysis.GetProperty("disclaimer").GetString().Should().Contain("not investment advice");
        analysis.GetProperty("kpis").GetProperty("positions").GetInt32().Should().Be(3);

        var detail = await client.GetAsync("/api/v1/portfolio/holdings/MSFT");
        detail.StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAsync("/api/v1/portfolio")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Users_cannot_see_each_others_portfolios()
    {
        var owner = _factory.ClientFor("heidi");
        await RegisterAsync(owner);
        await owner.PutAsJsonAsync("/api/v1/integrations/etoro", new { credentials = EtoroKeys });
        await owner.PostAsync("/api/v1/sync", content: null);
        using (var scope = _factory.Services.CreateScope())
        {
            var message = _factory.Publisher.Messages.Single(m => m.UserId == "heidi");
            await scope.ServiceProvider.GetRequiredService<ISender>().Send(new ExecuteSyncCommand(new UserId("heidi"), message.Provider, message.RunId));
        }

        (await owner.GetAsync("/api/v1/portfolio")).StatusCode.Should().Be(HttpStatusCode.OK);

        var other = _factory.ClientFor("ivan");
        await RegisterAsync(other);
        (await other.GetAsync("/api/v1/portfolio")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Disconnecting_returns_204_and_a_second_attempt_is_404()
    {
        var client = _factory.ClientFor("judy");
        await RegisterAsync(client);
        await client.PutAsJsonAsync("/api/v1/integrations/etoro", new { credentials = EtoroKeys });

        (await client.DeleteAsync("/api/v1/integrations/etoro")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.DeleteAsync("/api/v1/integrations/etoro")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Paging_limits_are_validated()
    {
        var client = _factory.ClientFor("mallory");
        await RegisterAsync(client);

        (await client.GetAsync("/api/v1/sync/runs?take=0")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await client.GetAsync("/api/v1/portfolio/snapshots?take=1000")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}

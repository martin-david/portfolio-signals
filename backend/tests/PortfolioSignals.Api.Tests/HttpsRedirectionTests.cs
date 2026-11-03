using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace PortfolioSignals.Api.Tests;

/// <summary>
/// A browser refuses to follow a redirect on a CORS preflight and the Android emulator reaches the API over plain http,
/// so a Development API answers on its http port as it is; every other environment sends http to https.
/// The HTTPS port is known in all these hosts, as it is when Visual Studio starts the "https" launch profile.
/// </summary>
public sealed class HttpsRedirectionTests
{
    private const string FrontendOrigin = "http://localhost:8082";

    private sealed class HostFactory(string environment) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("Authentication:Jwt:Authority", "https://login.example.test");
            builder.UseSetting("Authentication:Jwt:Audience", "api://portfolio-signals-tests");
            builder.UseSetting("Cors:AllowedOrigins:0", FrontendOrigin);
            builder.UseSetting("CredentialStore:Mode", "InMemory");
            builder.UseSetting("SyncQueue:Mode", "Disabled");

            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IHostedService>();
                services.Configure<HttpsRedirectionOptions>(options => options.HttpsPort = 7184);
            });
        }
    }

    private static HttpClient ClientWithoutRedirects(HostFactory factory)
        => factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    [Fact]
    public async Task A_development_api_answers_a_browser_preflight_on_http_instead_of_redirecting_it()
    {
        await using var factory = new HostFactory("Development");
        using var client = ClientWithoutRedirects(factory);
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/v1/me");
        preflight.Headers.Add("Origin", FrontendOrigin);
        preflight.Headers.Add("Access-Control-Request-Method", "GET");
        preflight.Headers.Add("Access-Control-Request-Headers", "x-dev-user");

        using var response = await client.SendAsync(preflight);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        response.Headers.GetValues("Access-Control-Allow-Origin").Should().Equal(FrontendOrigin);
    }

    [Fact]
    public async Task A_development_api_serves_plain_http_requests_as_they_are()
    {
        await using var factory = new HostFactory("Development");
        using var client = ClientWithoutRedirects(factory);

        using var response = await client.GetAsync("/health/live");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Other_environments_redirect_http_to_https()
    {
        await using var factory = new HostFactory("Production");
        using var client = ClientWithoutRedirects(factory);

        using var response = await client.GetAsync("/health/live");

        response.StatusCode.Should().Be(HttpStatusCode.TemporaryRedirect);
        response.Headers.Location.Should().Be(new Uri("https://localhost:7184/health/live"));
    }
}

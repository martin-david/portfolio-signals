using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Api.Infrastructure;

public sealed class AuthenticationSettings
{
    public const string SectionName = "Authentication";

    /// <summary><c>Jwt</c> (default): validate bearer tokens from the identity provider. <c>Development</c>: trust an <c>X-Dev-User</c> header; only allowed in the Development environment.</summary>
    public string Mode { get; set; } = "Jwt";

    public JwtSettings Jwt { get; set; } = new();

    public sealed class JwtSettings
    {
        /// <summary>Issuer metadata address, for example a Microsoft Entra External ID tenant.</summary>
        public string? Authority { get; set; }

        public string? Audience { get; set; }
    }
}

public interface ICurrentUser
{
    UserId Id { get; }

    string? Email { get; }

    string? DisplayName { get; }
}

internal sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal Principal => accessor.HttpContext?.User ?? throw new InvalidOperationException("There is no current HTTP request.");

    public UserId Id => new(
        Principal.FindFirstValue("oid")
        ?? Principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? Principal.FindFirstValue("sub")
        ?? throw new InvalidOperationException("The token has no subject claim."));

    public string? Email => Principal.FindFirstValue(ClaimTypes.Email) ?? Principal.FindFirstValue("email") ?? Principal.FindFirstValue("preferred_username");

    public string? DisplayName => Principal.FindFirstValue("name") ?? Principal.FindFirstValue(ClaimTypes.Name);
}

/// <summary>Local-development stand-in for the identity provider: the caller names itself in <c>X-Dev-User</c>. Never enabled outside Development.</summary>
internal sealed class DevelopmentAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Development";
    public const string HeaderName = "X-Dev-User";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var header) || string.IsNullOrWhiteSpace(header))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var user = header.ToString().Trim();
        var identity = new ClaimsIdentity(
            [
                new Claim("sub", user),
                new Claim("email", $"{user}@example.test"),
                new Claim("name", user),
            ],
            SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}

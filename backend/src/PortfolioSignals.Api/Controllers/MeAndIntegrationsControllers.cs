using FreeMediator;
using Microsoft.AspNetCore.Mvc;
using PortfolioSignals.Api.Infrastructure;
using PortfolioSignals.Application.Integrations;
using PortfolioSignals.Application.Users;
using PortfolioSignals.Domain.Integrations;

namespace PortfolioSignals.Api.Controllers;

public sealed record UpdateProfileRequest(string? DisplayName, string? Email);

/// <summary>Credentials are write-only: they are accepted here, stored in the secret store and never returned.</summary>
public sealed record ConnectProviderRequest(Dictionary<string, string> Credentials);

[ApiController]
[Route("api/v1/me")]
public sealed class MeController(ISender sender, ICurrentUser currentUser) : ControllerBase
{
    /// <summary>Gets the signed-in user's profile and subscription entitlements.</summary>
    [HttpGet]
    [ProducesResponseType<UserProfileDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
        => this.ToResponse(await sender.Send(new GetMeQuery(currentUser.Id), cancellationToken));

    /// <summary>Registers the signed-in user on first call and updates the profile afterwards. Email defaults to the token's email claim.</summary>
    [HttpPut]
    [ProducesResponseType<UserProfileDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Put(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var command = new UpsertProfileCommand(
            currentUser.Id,
            request.Email ?? currentUser.Email ?? string.Empty,
            request.DisplayName ?? currentUser.DisplayName ?? string.Empty);
        return this.ToResponse(await sender.Send(command, cancellationToken));
    }
}

[ApiController]
[Route("api/v1/integrations")]
public sealed class IntegrationsController(ISender sender, ICurrentUser currentUser) : ControllerBase
{
    /// <summary>Lists every provider with its connection state, last successful sync and any recent failure.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<IntegrationDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
        => this.ToResponse(await sender.Send(new ListIntegrationsQuery(currentUser.Id), cancellationToken));

    /// <summary>Connects (or reconnects) a provider with the user's own credentials.</summary>
    [HttpPut("{provider}")]
    [ProducesResponseType<IntegrationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Connect(IntegrationProvider provider, ConnectProviderRequest request, CancellationToken cancellationToken)
        => this.ToResponse(await sender.Send(new ConnectProviderCommand(currentUser.Id, provider, request.Credentials), cancellationToken));

    /// <summary>Disconnects a provider and deletes the stored credentials.</summary>
    [HttpDelete("{provider}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Disconnect(IntegrationProvider provider, CancellationToken cancellationToken)
        => this.ToResponse(await sender.Send(new DisconnectProviderCommand(currentUser.Id, provider), cancellationToken));
}

using FluentValidation;
using FreeMediator;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Integrations;

/// <summary>Connection state as shown to the user. Never contains credentials.</summary>
public sealed record IntegrationDto(
    IntegrationProvider Provider,
    ConnectionStatus? Status,
    int SyncIntervalMinutes,
    DateTimeOffset? ConnectedAt,
    DateTimeOffset? LastAttemptAt,
    DateTimeOffset? LastSuccessfulSyncAt,
    DateTimeOffset? NextSyncDueAt,
    SyncFailure? LastFailure,
    IReadOnlyList<string> RequiredCredentialFields);

internal static class IntegrationMapping
{
    public static IntegrationDto ToDto(IntegrationProvider provider, ProviderConnection? connection, SyncPolicy policy)
    {
        var interval = policy.IntervalFor(provider);
        return new IntegrationDto(
            provider,
            connection?.Status,
            (int)interval.TotalMinutes,
            connection?.ConnectedAt,
            connection?.LastAttemptAt,
            connection?.LastSuccessfulSyncAt,
            connection?.NextDueAt(interval),
            connection?.LastFailure,
            ProviderCatalog.RequiredCredentialFields(provider));
    }
}

public sealed record ListIntegrationsQuery(UserId UserId) : IRequest<Result<IReadOnlyList<IntegrationDto>>>;

public sealed class ListIntegrationsHandler(IUserRepository users, IConnectionRepository connections)
    : IRequestHandler<ListIntegrationsQuery, Result<IReadOnlyList<IntegrationDto>>>
{
    public async Task<Result<IReadOnlyList<IntegrationDto>>> Handle(ListIntegrationsQuery request, CancellationToken cancellationToken)
    {
        var user = await users.GetAsync(request.UserId, cancellationToken);
        if (user is null)
        {
            return Error.NotFound("user.not_registered", "Register a profile first.");
        }

        var existing = (await connections.ListForUserAsync(request.UserId, cancellationToken)).ToDictionary(c => c.Provider);
        IReadOnlyList<IntegrationDto> dtos = Enum.GetValues<IntegrationProvider>()
            .Select(p => IntegrationMapping.ToDto(p, existing.GetValueOrDefault(p), user.SyncPolicy))
            .ToList();
        return Result<IReadOnlyList<IntegrationDto>>.Success(dtos);
    }
}

/// <summary>Stores the user's own provider credentials in the secret store and activates the connection.</summary>
public sealed record ConnectProviderCommand(UserId UserId, IntegrationProvider Provider, IReadOnlyDictionary<string, string> Credentials)
    : IRequest<Result<IntegrationDto>>;

public sealed class ConnectProviderValidator : AbstractValidator<ConnectProviderCommand>
{
    public ConnectProviderValidator()
    {
        RuleFor(c => c.Provider).IsInEnum();
        RuleFor(c => c.Credentials).NotNull();
        RuleFor(c => c.Credentials)
            .Must((command, values) => HasRequiredFields(command.Provider, values))
            .WithMessage(c => $"Credentials for {c.Provider} must include: {string.Join(", ", ProviderCatalog.RequiredCredentialFields(c.Provider))}.")
            .When(c => c.Credentials is not null && Enum.IsDefined(c.Provider));
        RuleFor(c => c.Credentials)
            .Must(values => values.Values.All(v => v is { Length: <= 2048 }))
            .WithMessage("Credential values must not exceed 2048 characters.")
            .When(c => c.Credentials is not null);
    }

    private static bool HasRequiredFields(IntegrationProvider provider, IReadOnlyDictionary<string, string> values)
        => ProviderCatalog.RequiredCredentialFields(provider)
            .All(field => values.Any(kv => string.Equals(kv.Key, field, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(kv.Value)));
}

public sealed class ConnectProviderHandler(
    IUserRepository users,
    IConnectionRepository connections,
    ICredentialStore credentialStore,
    TimeProvider clock) : IRequestHandler<ConnectProviderCommand, Result<IntegrationDto>>
{
    public async Task<Result<IntegrationDto>> Handle(ConnectProviderCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetAsync(request.UserId, cancellationToken);
        if (user is null)
        {
            return Error.NotFound("user.not_registered", "Register a profile first.");
        }

        var now = clock.GetUtcNow();
        await credentialStore.SaveAsync(request.UserId, request.Provider, new ProviderCredentials(request.Credentials), cancellationToken);

        var connection = await connections.GetAsync(request.UserId, request.Provider, cancellationToken);
        if (connection is null)
        {
            connection = ProviderConnection.Connect(request.UserId, request.Provider, now);
        }
        else
        {
            connection.Reconnect(now);
        }

        await connections.SaveAsync(connection, cancellationToken);
        return IntegrationMapping.ToDto(request.Provider, connection, user.SyncPolicy);
    }
}

public sealed record DisconnectProviderCommand(UserId UserId, IntegrationProvider Provider) : IRequest<Result>;

public sealed class DisconnectProviderHandler(
    IConnectionRepository connections,
    ICredentialStore credentialStore,
    TimeProvider clock) : IRequestHandler<DisconnectProviderCommand, Result>
{
    public async Task<Result> Handle(DisconnectProviderCommand request, CancellationToken cancellationToken)
    {
        var connection = await connections.GetAsync(request.UserId, request.Provider, cancellationToken);
        if (connection is null || connection.Status == ConnectionStatus.Disconnected)
        {
            return Error.NotFound("integration.not_connected", $"{request.Provider} is not connected.");
        }

        await credentialStore.DeleteAsync(request.UserId, request.Provider, cancellationToken);
        connection.Disconnect(clock.GetUtcNow());
        await connections.SaveAsync(connection, cancellationToken);
        return Result.Success();
    }
}

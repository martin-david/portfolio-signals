using FluentValidation;
using FreeMediator;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Users;

public sealed record UserProfileDto(
    string Id,
    string Email,
    string DisplayName,
    SubscriptionPlan Plan,
    int EtoroSyncIntervalMinutes,
    int TipRanksSyncIntervalMinutes,
    bool AllowsManualSync,
    DateTimeOffset RegisteredAt)
{
    public static UserProfileDto From(UserAccount user) => new(
        user.Id.Value,
        user.Email,
        user.DisplayName,
        user.Plan,
        (int)user.SyncPolicy.EtoroInterval.TotalMinutes,
        (int)user.SyncPolicy.TipRanksInterval.TotalMinutes,
        user.SyncPolicy.AllowsManualSync,
        user.RegisteredAt);
}

public sealed record GetMeQuery(UserId UserId) : IRequest<Result<UserProfileDto>>;

public sealed class GetMeHandler(IUserRepository users) : IRequestHandler<GetMeQuery, Result<UserProfileDto>>
{
    public async Task<Result<UserProfileDto>> Handle(GetMeQuery request, CancellationToken cancellationToken)
    {
        var user = await users.GetAsync(request.UserId, cancellationToken);
        return user is null
            ? Error.NotFound("user.not_registered", "The user has not registered a profile yet.")
            : UserProfileDto.From(user);
    }
}

/// <summary>Registers the signed-in user on first call and updates the profile afterwards. Idempotent, so it maps to PUT.</summary>
public sealed record UpsertProfileCommand(UserId UserId, string Email, string DisplayName) : IRequest<Result<UserProfileDto>>;

public sealed class UpsertProfileValidator : AbstractValidator<UpsertProfileCommand>
{
    public UpsertProfileValidator()
    {
        RuleFor(c => c.Email).NotEmpty().MaximumLength(320).EmailAddress();
        RuleFor(c => c.DisplayName).NotEmpty().MaximumLength(100);
    }
}

public sealed class UpsertProfileHandler(IUserRepository users, TimeProvider clock) : IRequestHandler<UpsertProfileCommand, Result<UserProfileDto>>
{
    public async Task<Result<UserProfileDto>> Handle(UpsertProfileCommand request, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var user = await users.GetAsync(request.UserId, cancellationToken);
        if (user is null)
        {
            user = UserAccount.Register(request.UserId, request.Email, request.DisplayName, now);
        }
        else
        {
            user.UpdateProfile(request.Email, request.DisplayName, now);
        }

        await users.SaveAsync(user, cancellationToken);
        return UserProfileDto.From(user);
    }
}

using PortfolioSignals.Domain.Common;

namespace PortfolioSignals.Domain.Users;

public sealed record UserRegistered(UserId UserId, DateTimeOffset OccurredAt) : IDomainEvent;

public sealed record SubscriptionPlanChanged(UserId UserId, SubscriptionPlan From, SubscriptionPlan To, DateTimeOffset OccurredAt) : IDomainEvent;

/// <summary>A registered user and their subscription. Authentication itself is delegated to the identity provider.</summary>
public sealed class UserAccount : AggregateRoot<UserId>
{
    private UserAccount(UserId id, string email, string displayName, SubscriptionPlan plan, DateTimeOffset registeredAt, DateTimeOffset updatedAt)
        : base(id)
    {
        Email = email;
        DisplayName = displayName;
        Plan = plan;
        RegisteredAt = registeredAt;
        UpdatedAt = updatedAt;
    }

    public string Email { get; private set; }

    public string DisplayName { get; private set; }

    public SubscriptionPlan Plan { get; private set; }

    public DateTimeOffset RegisteredAt { get; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public SyncPolicy SyncPolicy => SyncPolicy.For(Plan);

    public static UserAccount Register(UserId id, string email, string displayName, DateTimeOffset now)
    {
        var user = new UserAccount(id, Guard.NotBlank(email, nameof(email)), Guard.NotBlank(displayName, nameof(displayName)), SubscriptionPlan.Free, now, now);
        user.Raise(new UserRegistered(id, now));
        return user;
    }

    /// <summary>Rebuilds the aggregate from persisted state; raises no events.</summary>
    public static UserAccount Restore(UserId id, string email, string displayName, SubscriptionPlan plan, DateTimeOffset registeredAt, DateTimeOffset updatedAt)
        => new(id, email, displayName, plan, registeredAt, updatedAt);

    public void UpdateProfile(string email, string displayName, DateTimeOffset now)
    {
        Email = Guard.NotBlank(email, nameof(email));
        DisplayName = Guard.NotBlank(displayName, nameof(displayName));
        UpdatedAt = now;
    }

    public void ChangePlan(SubscriptionPlan plan, DateTimeOffset now)
    {
        if (plan == Plan)
        {
            return;
        }

        Raise(new SubscriptionPlanChanged(Id, Plan, plan, now));
        Plan = plan;
        UpdatedAt = now;
    }
}

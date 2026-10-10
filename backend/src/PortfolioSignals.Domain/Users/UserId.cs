using PortfolioSignals.Domain.Common;

namespace PortfolioSignals.Domain.Users;

/// <summary>Identifier of a user: the stable subject claim issued by the identity provider.</summary>
public readonly record struct UserId
{
    public UserId(string value)
    {
        Value = Guard.NotBlank(value, nameof(UserId));
    }

    public string Value { get; }

    public override string ToString() => Value;
}

namespace PortfolioSignals.Domain.Common;

internal static class Guard
{
    public static string NotBlank(string? value, string name)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException($"{name} must not be empty.");
        }

        return value.Trim();
    }

    public static decimal NotNegative(decimal value, string name)
    {
        if (value < 0)
        {
            throw new DomainException($"{name} must not be negative.");
        }

        return value;
    }
}

namespace PortfolioSignals.Domain.Common;

/// <summary>Raised when an aggregate invariant would be violated.</summary>
public sealed class DomainException : Exception
{
    public DomainException(string message)
        : base(message)
    {
    }
}

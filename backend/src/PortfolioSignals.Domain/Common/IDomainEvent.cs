namespace PortfolioSignals.Domain.Common;

public interface IDomainEvent
{
    DateTimeOffset OccurredAt { get; }
}

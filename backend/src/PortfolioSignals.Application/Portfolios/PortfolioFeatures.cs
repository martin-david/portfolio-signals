using FluentValidation;
using FreeMediator;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Portfolios;

public sealed record HoldingDto(
    int InstrumentId,
    string Symbol,
    string Name,
    AssetClass AssetClass,
    string TipRanksTicker,
    decimal Invested,
    decimal Value,
    decimal WeightPct,
    decimal Pnl,
    decimal PnlPct,
    decimal Units,
    decimal AvgOpenRate,
    decimal AvgLeverage)
{
    public static HoldingDto From(Holding holding, decimal weightPct) => new(
        holding.InstrumentId,
        holding.Symbol,
        holding.Name,
        holding.AssetClass,
        holding.TipRanksTicker,
        holding.Invested,
        holding.Value,
        weightPct,
        holding.Pnl,
        holding.PnlPct,
        holding.Units,
        holding.AvgOpenRate,
        holding.AvgLeverage);
}

public sealed record PortfolioDto(
    string SnapshotId,
    DateTimeOffset TakenAt,
    DateTimeOffset? LastSuccessfulSyncAt,
    AccountSummary Account,
    IReadOnlyList<HoldingDto> Holdings,
    IReadOnlyList<CopiedTrader> CopiedTraders);

public sealed record PortfolioSnapshotSummaryDto(string SnapshotId, DateTimeOffset TakenAt, decimal TotalValue, int Positions);

public sealed record GetLatestPortfolioQuery(UserId UserId) : IRequest<Result<PortfolioDto>>;

public sealed class GetLatestPortfolioHandler(IPortfolioSnapshotRepository snapshots, IConnectionRepository connections)
    : IRequestHandler<GetLatestPortfolioQuery, Result<PortfolioDto>>
{
    public async Task<Result<PortfolioDto>> Handle(GetLatestPortfolioQuery request, CancellationToken cancellationToken)
    {
        var snapshot = await snapshots.GetLatestAsync(request.UserId, cancellationToken);
        if (snapshot is null)
        {
            return Error.NotFound("portfolio.not_synced", "No portfolio has been synchronized yet.");
        }

        var etoro = await connections.GetAsync(request.UserId, IntegrationProvider.Etoro, cancellationToken);
        return new PortfolioDto(
            snapshot.Id,
            snapshot.TakenAt,
            etoro?.LastSuccessfulSyncAt,
            snapshot.Account,
            snapshot.Holdings.Select(h => HoldingDto.From(h, snapshot.WeightPct(h))).ToList(),
            snapshot.CopiedTraders);
    }
}

public sealed record ListPortfolioSnapshotsQuery(UserId UserId, int Take = 20) : IRequest<Result<IReadOnlyList<PortfolioSnapshotSummaryDto>>>;

public sealed class ListPortfolioSnapshotsValidator : AbstractValidator<ListPortfolioSnapshotsQuery>
{
    public ListPortfolioSnapshotsValidator()
    {
        RuleFor(q => q.Take).InclusiveBetween(1, 100);
    }
}

public sealed class ListPortfolioSnapshotsHandler(IPortfolioSnapshotRepository snapshots)
    : IRequestHandler<ListPortfolioSnapshotsQuery, Result<IReadOnlyList<PortfolioSnapshotSummaryDto>>>
{
    public async Task<Result<IReadOnlyList<PortfolioSnapshotSummaryDto>>> Handle(ListPortfolioSnapshotsQuery request, CancellationToken cancellationToken)
    {
        var recent = await snapshots.ListRecentAsync(request.UserId, request.Take, cancellationToken);
        return Result<IReadOnlyList<PortfolioSnapshotSummaryDto>>.Success(
            recent.Select(s => new PortfolioSnapshotSummaryDto(s.Id, s.TakenAt, s.Account.TotalValue, s.Holdings.Count)).ToList());
    }
}

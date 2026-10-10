using FreeMediator;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Application.Portfolios;
using PortfolioSignals.Domain.Analysis;
using PortfolioSignals.Domain.Signals;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Application.Analysis;

public sealed record AnalyzedHoldingDto(HoldingDto Holding, HoldingAssessment Assessment);

public sealed record PortfolioAnalysisDto(
    string SnapshotId,
    DateTimeOffset AsOf,
    DateTimeOffset? SignalsFetchedAt,
    PortfolioKpis Kpis,
    IReadOnlyList<AnalyzedHoldingDto> Holdings,
    string Disclaimer)
{
    public const string StandardDisclaimer =
        "Informational only, not investment advice. Verdicts come from documented rules over third-party analyst data; they do not see position size relative to your goals, taxes or time horizon.";
}

public sealed record HoldingDetailDto(AnalyzedHoldingDto Analysis, SignalData? Signals, DateTimeOffset? SignalsFetchedAt);

public sealed record LoadedAnalysis(PortfolioAnalysis Analysis, IReadOnlyDictionary<string, InstrumentSignals> Signals);

public sealed class AnalysisLoader(IPortfolioSnapshotRepository snapshots, ISignalsRepository signals, TimeProvider clock)
{
    public async Task<LoadedAnalysis?> LoadAsync(UserId userId, CancellationToken cancellationToken)
    {
        var snapshot = await snapshots.GetLatestAsync(userId, cancellationToken);
        if (snapshot is null)
        {
            return null;
        }

        var stored = await signals.ListAsync(userId, cancellationToken);
        var byTicker = stored.ToDictionary(s => s.Ticker);
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        return new LoadedAnalysis(PortfolioAnalyzer.Analyze(snapshot, byTicker, today), byTicker);
    }
}

public sealed record GetPortfolioAnalysisQuery(UserId UserId) : IRequest<Result<PortfolioAnalysisDto>>;

public sealed class GetPortfolioAnalysisHandler(AnalysisLoader loader) : IRequestHandler<GetPortfolioAnalysisQuery, Result<PortfolioAnalysisDto>>
{
    public async Task<Result<PortfolioAnalysisDto>> Handle(GetPortfolioAnalysisQuery request, CancellationToken cancellationToken)
    {
        var loaded = await loader.LoadAsync(request.UserId, cancellationToken);
        if (loaded is null)
        {
            return Error.NotFound("portfolio.not_synced", "No portfolio has been synchronized yet.");
        }

        var rows = loaded.Analysis.Holdings.Select(ToDto).ToList();
        var fetchedAt = loaded.Signals.Values.Select(s => (DateTimeOffset?)s.FetchedAt).Min();
        return new PortfolioAnalysisDto(loaded.Analysis.SnapshotId, loaded.Analysis.AsOf, fetchedAt, loaded.Analysis.Kpis, rows, PortfolioAnalysisDto.StandardDisclaimer);
    }

    internal static AnalyzedHoldingDto ToDto(AnalyzedHolding row)
        => new(HoldingDto.From(row.Holding, row.Assessment.WeightPct), row.Assessment);
}

public sealed record GetHoldingDetailQuery(UserId UserId, string Symbol) : IRequest<Result<HoldingDetailDto>>;

public sealed class GetHoldingDetailHandler(AnalysisLoader loader) : IRequestHandler<GetHoldingDetailQuery, Result<HoldingDetailDto>>
{
    public async Task<Result<HoldingDetailDto>> Handle(GetHoldingDetailQuery request, CancellationToken cancellationToken)
    {
        var loaded = await loader.LoadAsync(request.UserId, cancellationToken);
        if (loaded is null)
        {
            return Error.NotFound("portfolio.not_synced", "No portfolio has been synchronized yet.");
        }

        var row = loaded.Analysis.Holdings.FirstOrDefault(h => string.Equals(h.Holding.Symbol, request.Symbol, StringComparison.OrdinalIgnoreCase));
        if (row is null)
        {
            return Error.NotFound("holding.not_found", $"The latest snapshot has no holding '{request.Symbol}'.");
        }

        loaded.Signals.TryGetValue(InstrumentSignals.NormalizeTicker(row.Holding.TipRanksTicker), out var signals);
        return new HoldingDetailDto(GetPortfolioAnalysisHandler.ToDto(row), signals?.Data, signals?.FetchedAt);
    }
}

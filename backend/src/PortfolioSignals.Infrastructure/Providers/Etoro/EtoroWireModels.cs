using System.Text.Json.Serialization;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Portfolios;

namespace PortfolioSignals.Infrastructure.Providers.Etoro;

// Wire models for the parts of the eToro public API response this application reads. Unknown fields are ignored.
internal sealed record AggregatePortfolioResponse
{
    public DateTimeOffset Timestamp { get; init; }

    public string AccountCurrency { get; init; } = "USD";

    public AccountTotals AccountTotals { get; init; } = new();

    public List<InstrumentAggregate> InstrumentAggregates { get; init; } = [];

    public List<MirrorAggregate> Mirrors { get; init; } = [];
}

internal sealed record AccountTotals
{
    public decimal AccountAvailableCash { get; init; }

    public decimal AccountCurrentPnl { get; init; }

    public decimal AccountTotalValue { get; init; }

    public decimal AccountTotalUsedMargin { get; init; }
}

internal sealed record InstrumentAggregate
{
    public int InstrumentId { get; init; }

    public decimal TotalMarginAccountCurrency { get; init; }

    public decimal AccountCurrencyReturn { get; init; }

    public decimal AccountCurrencyRoePercent { get; init; }

    public decimal NetUnits { get; init; }

    public decimal NetCurrentExposureAccountCurrency { get; init; }

    public decimal LiquidationValueAccountCurrency { get; init; }

    public decimal AvgLeverage { get; init; }

    public decimal AvgOpenRate { get; init; }
}

internal sealed record MirrorAggregate
{
    public long MirrorId { get; init; }

    public decimal MirrorAvailableCash { get; init; }

    public decimal MirrorStopLossPercentage { get; init; }

    public decimal MirrorClosedPositionsPnl { get; init; }

    public MirrorTotals MirrorTotals { get; init; } = new();
}

internal sealed record MirrorTotals
{
    public decimal MirrorNetFunding { get; init; }

    public decimal MirrorPositionsPnl { get; init; }

    public decimal MirrorLiquidationValue { get; init; }

    public decimal MirrorPositionsPnlPercent { get; init; }

    public decimal MirrorValuePercent { get; init; }
}

internal sealed record InstrumentsResponse
{
    public List<InstrumentDisplay> InstrumentDisplayDatas { get; init; } = [];
}

internal sealed record InstrumentDisplay
{
    [JsonPropertyName("instrumentID")]
    public int InstrumentId { get; init; }

    public string? InstrumentDisplayName { get; init; }

    [JsonPropertyName("instrumentTypeID")]
    public int? InstrumentTypeId { get; init; }

    public string? SymbolFull { get; init; }
}

internal static class EtoroPortfolioMapper
{
    public static EtoroPortfolio Map(AggregatePortfolioResponse response, IReadOnlyDictionary<int, InstrumentDisplay> instruments)
    {
        var holdings = response.InstrumentAggregates
            .Where(a => a.NetUnits != 0 || a.LiquidationValueAccountCurrency != 0)
            .Select(a =>
            {
                instruments.TryGetValue(a.InstrumentId, out var display);
                return new EtoroHolding(
                    a.InstrumentId,
                    string.IsNullOrWhiteSpace(display?.SymbolFull) ? $"#{a.InstrumentId}" : display.SymbolFull,
                    display?.InstrumentDisplayName ?? $"Instrument {a.InstrumentId}",
                    EtoroApiClient.ClassOf(a.InstrumentId, display?.InstrumentTypeId),
                    a.TotalMarginAccountCurrency,
                    a.LiquidationValueAccountCurrency,
                    a.AccountCurrencyReturn,
                    a.AccountCurrencyRoePercent,
                    a.NetUnits,
                    a.AvgOpenRate,
                    a.AvgLeverage,
                    a.NetCurrentExposureAccountCurrency);
            })
            .ToList();

        var copied = response.Mirrors
            .Select(m => new CopiedTrader(
                m.MirrorId,
                m.MirrorTotals.MirrorNetFunding,
                m.MirrorTotals.MirrorLiquidationValue,
                m.MirrorTotals.MirrorPositionsPnl,
                m.MirrorTotals.MirrorPositionsPnlPercent,
                m.MirrorClosedPositionsPnl,
                m.MirrorAvailableCash,
                m.MirrorTotals.MirrorValuePercent,
                m.MirrorStopLossPercentage))
            .ToList();

        var totals = response.AccountTotals;
        var account = new AccountSummary(
            response.AccountCurrency,
            totals.AccountTotalValue,
            holdings.Sum(h => h.Value),
            copied.Sum(c => c.Value),
            totals.AccountAvailableCash,
            totals.AccountCurrentPnl,
            totals.AccountTotalUsedMargin);

        return new EtoroPortfolio(response.Timestamp, account, holdings, copied);
    }
}

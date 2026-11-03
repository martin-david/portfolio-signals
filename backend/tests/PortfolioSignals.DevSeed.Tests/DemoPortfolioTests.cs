using Microsoft.Extensions.Time.Testing;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Portfolios;
using PortfolioSignals.Domain.Signals;

namespace PortfolioSignals.DevSeed.Tests;

public sealed class DemoPortfolioTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 12, 9, 30, 0, TimeSpan.Zero);
    private static readonly ProviderCredentials Credentials = new(new Dictionary<string, string> { ["apiKey"] = "x" });

    [Fact]
    public void The_account_totals_add_up_to_the_positions_the_cash_and_the_copied_traders()
    {
        var portfolio = DemoPortfolio.Portfolio(Now);

        portfolio.Account.DirectValue.Should().Be(portfolio.Holdings.Sum(h => h.Value));
        portfolio.Account.CopiedValue.Should().Be(portfolio.CopiedTraders.Sum(c => c.Value));
        portfolio.Account.TotalValue.Should().Be(portfolio.Account.DirectValue + portfolio.Account.CopiedValue + portfolio.Account.AvailableCash);
        portfolio.Account.UnrealizedPnl.Should().Be(portfolio.Holdings.Sum(h => h.Pnl) + portfolio.CopiedTraders.Sum(c => c.OpenPnl));
        portfolio.CopiedTraders.Sum(c => c.ValuePct).Should().BeApproximately(portfolio.Account.CopiedValue / portfolio.Account.TotalValue * 100, 0.05m);
        portfolio.TakenAt.Should().Be(Now);
    }

    [Fact]
    public void Every_position_has_its_own_instrument_and_a_profit_that_matches_what_was_invested()
    {
        var holdings = DemoPortfolio.Portfolio(Now).Holdings;

        holdings.Select(h => h.InstrumentId).Should().OnlyHaveUniqueItems();
        holdings.Should().OnlyContain(h => h.Pnl == h.Value - h.Invested);
        holdings.Should().OnlyContain(h => h.Units > 0 && h.AvgOpenRate > 0);
    }

    [Fact]
    public void Reporting_days_never_fall_on_a_weekend_and_only_ever_move_back()
    {
        for (var start = 0; start < 14; start++)
        {
            var today = DateOnly.FromDateTime(Now.UtcDateTime).AddDays(start);
            for (var days = 0; days <= 70; days++)
            {
                var reporting = DemoPortfolio.ReportingDay(today, days);

                reporting.DayOfWeek.Should().NotBe(DayOfWeek.Saturday).And.NotBe(DayOfWeek.Sunday);
                reporting.Should().BeOnOrBefore(today.AddDays(days)).And.BeOnOrAfter(today.AddDays(days - 2));
            }
        }
    }

    [Fact]
    public async Task The_fictional_provider_answers_only_for_the_tickers_it_is_asked_about_whatever_their_case()
    {
        var client = new DemoTipRanksClient(TimeProvider.System);

        var covered = await client.GetSignalsAsync(Credentials, ["nwnd", "DE:WWIM", "NOT-COVERED"], CancellationToken.None);

        covered.Keys.Should().BeEquivalentTo("NWND", "DE:WWIM");
        covered["NWND"].Consensus.Should().Be(AnalystConsensus.StrongBuy);
    }

    [Fact]
    public async Task The_fictional_provider_leaves_the_etf_and_the_coin_out_and_hands_back_the_same_portfolio_every_time()
    {
        var etoro = new DemoEtoroClient(new FakeTimeProvider(Now));

        var first = await etoro.GetPortfolioAsync(Credentials, CancellationToken.None);
        var second = await etoro.GetPortfolioAsync(Credentials, CancellationToken.None);

        first.Should().BeEquivalentTo(second);
        first.Holdings.Where(h => h.AssetClass != AssetClass.Stock).Select(h => h.Symbol).Should().BeEquivalentTo("TREY", "ORBT");
        DemoPortfolio.Signals(DateOnly.FromDateTime(Now.UtcDateTime)).Keys.Should().NotContain(["TREY", "ORBT", "ORBTUSD"]);
    }
}

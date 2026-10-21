using FreeMediator;
using Microsoft.AspNetCore.Mvc;
using PortfolioSignals.Api.Infrastructure;
using PortfolioSignals.Application.Analysis;
using PortfolioSignals.Application.Portfolios;
using PortfolioSignals.Application.Sync;
using PortfolioSignals.Domain.Integrations;

namespace PortfolioSignals.Api.Controllers;

/// <param name="Provider">Provider to sync; omit to sync every active connection.</param>
public sealed record RequestSyncRequest(IntegrationProvider? Provider);

[ApiController]
[Route("api/v1/sync")]
public sealed class SyncController(ISender sender, ICurrentUser currentUser) : ControllerBase
{
    /// <summary>Queues a manual sync. Syncs run in the background, so this returns 202 with the queued runs to poll.</summary>
    [HttpPost]
    [ProducesResponseType<IReadOnlyList<SyncRunDto>>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> RequestSync(RequestSyncRequest? request, CancellationToken cancellationToken)
        => this.ToResponse(
            await sender.Send(new RequestSyncCommand(currentUser.Id, request?.Provider), cancellationToken),
            runs => Accepted(runs));

    /// <summary>Lists recent sync runs, newest first: the synchronization history, including delays, rate limits and failures.</summary>
    [HttpGet("runs")]
    [ProducesResponseType<IReadOnlyList<SyncRunDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Runs([FromQuery] int take = 20, CancellationToken cancellationToken = default)
        => this.ToResponse(await sender.Send(new ListSyncRunsQuery(currentUser.Id, take), cancellationToken));
}

[ApiController]
[Route("api/v1/portfolio")]
public sealed class PortfolioController(ISender sender, ICurrentUser currentUser) : ControllerBase
{
    /// <summary>Gets the latest synchronized eToro portfolio.</summary>
    [HttpGet]
    [ProducesResponseType<PortfolioDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Latest(CancellationToken cancellationToken)
        => this.ToResponse(await sender.Send(new GetLatestPortfolioQuery(currentUser.Id), cancellationToken));

    /// <summary>Lists stored portfolio snapshots, newest first.</summary>
    [HttpGet("snapshots")]
    [ProducesResponseType<IReadOnlyList<PortfolioSnapshotSummaryDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Snapshots([FromQuery] int take = 20, CancellationToken cancellationToken = default)
        => this.ToResponse(await sender.Send(new ListPortfolioSnapshotsQuery(currentUser.Id, take), cancellationToken));

    /// <summary>Scores every holding against the latest analyst signals: tier, hold/watch/review verdict, flags and portfolio KPIs.</summary>
    [HttpGet("analysis")]
    [ProducesResponseType<PortfolioAnalysisDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Analysis(CancellationToken cancellationToken)
        => this.ToResponse(await sender.Send(new GetPortfolioAnalysisQuery(currentUser.Id), cancellationToken));

    /// <summary>Gets one holding with its assessment and the underlying analyst signals.</summary>
    [HttpGet("holdings/{symbol}")]
    [ProducesResponseType<HoldingDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Holding(string symbol, CancellationToken cancellationToken)
        => this.ToResponse(await sender.Send(new GetHoldingDetailQuery(currentUser.Id, symbol), cancellationToken));
}

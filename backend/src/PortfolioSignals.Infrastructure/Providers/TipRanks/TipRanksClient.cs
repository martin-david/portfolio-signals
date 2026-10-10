using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ModelContextProtocol;
using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Signals;

namespace PortfolioSignals.Infrastructure.Providers.TipRanks;

/// <summary>One authenticated conversation with the provider's tool server.</summary>
internal interface ITipRanksSession : IAsyncDisposable
{
    Task<JsonElement> CallToolAsync(string tool, IReadOnlyDictionary<string, object?> arguments, CancellationToken cancellationToken);
}

internal interface ITipRanksSessionFactory
{
    Task<ITipRanksSession> OpenAsync(string apiKey, CancellationToken cancellationToken);
}

/// <summary>
/// Fetches TipRanks analyst data through its MCP server using the user's own API key. Calls are batched
/// (assets data for all tickers in one call, AI analysis in groups of 25) because the free plan allows only 50 calls a month.
/// </summary>
internal sealed class TipRanksClient(ITipRanksSessionFactory sessions, IOptions<TipRanksOptions> options) : ITipRanksClient
{
    private const int AiBatchSize = 25;

    public async Task<IReadOnlyDictionary<string, SignalData>> GetSignalsAsync(
        ProviderCredentials credentials,
        IReadOnlyCollection<string> tickers,
        CancellationToken cancellationToken)
    {
        var distinct = tickers.Select(t => t.Trim()).Where(t => t.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (distinct.Count == 0)
        {
            return new Dictionary<string, SignalData>();
        }

        await using var session = await sessions.OpenAsync(credentials.Require("apiKey"), cancellationToken);

        var assets = TipRanksMapper.FromAssetsData(
            await session.CallToolAsync("get_assets_data", new Dictionary<string, object?> { ["tickers"] = distinct }, cancellationToken));

        var ai = new Dictionary<string, AiAnalysis>(StringComparer.OrdinalIgnoreCase);
        foreach (var batch in distinct.Chunk(AiBatchSize))
        {
            var response = await session.CallToolAsync(
                "get_ai_stock_analysis",
                new Dictionary<string, object?> { ["tickers"] = string.Join(',', batch) },
                cancellationToken);
            foreach (var (ticker, analysis) in TipRanksMapper.FromAiAnalysis(response))
            {
                ai[ticker] = analysis;
            }
        }

        var result = new Dictionary<string, SignalData>(StringComparer.OrdinalIgnoreCase);
        foreach (var (ticker, data) in assets)
        {
            AnalystBreadth? breadth = null;
            if (options.Value.IncludeAnalystRatings)
            {
                var ratings = await session.CallToolAsync("get_recent_analyst_ratings", new Dictionary<string, object?> { ["ticker"] = ticker }, cancellationToken);
                breadth = TipRanksMapper.FromAnalystRatings(ratings);
            }

            result[ticker] = data with { Ai = ai.GetValueOrDefault(ticker), Breadth = breadth };
        }

        return result;
    }
}

internal sealed class McpTipRanksSessionFactory(HttpClient http, IOptions<TipRanksOptions> options) : ITipRanksSessionFactory
{
    public async Task<ITipRanksSession> OpenAsync(string apiKey, CancellationToken cancellationToken)
    {
        var transport = new HttpClientTransport(
            new HttpClientTransportOptions
            {
                Endpoint = new Uri(options.Value.Endpoint),
                TransportMode = HttpTransportMode.StreamableHttp,
                AdditionalHeaders = new Dictionary<string, string> { ["Authorization"] = $"Bearer {apiKey}" },
                ConnectionTimeout = TimeSpan.FromSeconds(options.Value.RequestTimeoutSeconds),
            },
            http,
            ownsHttpClient: false);

        try
        {
            var client = await McpClient.CreateAsync(transport, cancellationToken: cancellationToken);
            return new McpSession(client);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw McpErrors.Translate(ex);
        }
    }

    private sealed class McpSession(McpClient client) : ITipRanksSession
    {
        public async Task<JsonElement> CallToolAsync(string tool, IReadOnlyDictionary<string, object?> arguments, CancellationToken cancellationToken)
        {
            CallToolResult result;
            try
            {
                result = await client.CallToolAsync(tool, arguments, cancellationToken: cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                throw McpErrors.Translate(ex);
            }

            var text = string.Concat(result.Content.OfType<TextContentBlock>().Select(b => b.Text));
            if (result.IsError == true)
            {
                throw McpErrors.FromToolMessage(text);
            }

            try
            {
                using var document = JsonDocument.Parse(text);
                return document.RootElement.Clone();
            }
            catch (JsonException ex)
            {
                throw new ProviderException(SyncFailureKind.InvalidResponse, $"TipRanks returned unreadable data for {tool}.", inner: ex);
            }
        }

        public ValueTask DisposeAsync() => client.DisposeAsync();
    }
}

internal static class McpErrors
{
    public static ProviderException Translate(Exception ex) => ex switch
    {
        ProviderException provider => provider,
        HttpRequestException { StatusCode: HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden }
            => new ProviderException(SyncFailureKind.Unauthorized, "TipRanks rejected the stored API key.", inner: ex),
        HttpRequestException { StatusCode: HttpStatusCode.TooManyRequests }
            => new ProviderException(SyncFailureKind.RateLimited, "TipRanks rate limit reached.", inner: ex),
        McpException when ex.Message.Contains("429", StringComparison.Ordinal) || ex.Message.Contains("rate limit", StringComparison.OrdinalIgnoreCase)
            => new ProviderException(SyncFailureKind.RateLimited, "TipRanks rate limit reached.", inner: ex),
        McpException when ex.Message.Contains("401", StringComparison.Ordinal) || ex.Message.Contains("unauthorized", StringComparison.OrdinalIgnoreCase)
            => new ProviderException(SyncFailureKind.Unauthorized, "TipRanks rejected the stored API key.", inner: ex),
        _ => new ProviderException(SyncFailureKind.Unavailable, "TipRanks could not be reached.", inner: ex),
    };

    public static ProviderException FromToolMessage(string message)
    {
        if (message.Contains("quota", StringComparison.OrdinalIgnoreCase) || message.Contains("limit", StringComparison.OrdinalIgnoreCase))
        {
            return new ProviderException(SyncFailureKind.RateLimited, "TipRanks reported that the usage limit was reached.");
        }

        return new ProviderException(SyncFailureKind.InvalidResponse, "TipRanks reported an error for the request.");
    }
}

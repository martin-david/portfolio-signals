using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Portfolios;

namespace PortfolioSignals.Infrastructure.Providers.Etoro;

/// <summary>
/// Reads a portfolio through the eToro public API: the aggregated portfolio (per-instrument totals, account totals and
/// copy-trading mirrors) plus instrument display data to turn instrument ids into symbols and names.
/// Both calls need the user's own <c>x-api-key</c> and <c>x-user-key</c>; the API is read-only here.
/// </summary>
internal sealed class EtoroApiClient(HttpClient http, IOptions<EtoroOptions> options) : IEtoroPortfolioClient
{
    private const int StockTypeId = 5;
    private const int EtfTypeId = 6;
    private const int CryptoTypeId = 10;
    private const int FirstCryptoInstrumentId = 100000;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public async Task<EtoroPortfolio> GetPortfolioAsync(ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        var apiKey = credentials.Require("apiKey");
        var userKey = credentials.Require("userKey");
        var prefix = options.Value.UseDemoAccount ? "/api/v1/trading/info/demo" : "/api/v1/trading/info";

        var aggregate = await GetAsync<AggregatePortfolioResponse>($"{prefix}/aggregate-portfolio", apiKey, userKey, cancellationToken);
        var ids = aggregate.InstrumentAggregates.Select(a => a.InstrumentId).Distinct().ToList();
        var instruments = ids.Count == 0
            ? new Dictionary<int, InstrumentDisplay>()
            : await LoadInstrumentsAsync(ids, apiKey, userKey, cancellationToken);

        return EtoroPortfolioMapper.Map(aggregate, instruments);
    }

    private async Task<Dictionary<int, InstrumentDisplay>> LoadInstrumentsAsync(List<int> ids, string apiKey, string userKey, CancellationToken cancellationToken)
    {
        var result = new Dictionary<int, InstrumentDisplay>();
        foreach (var chunk in ids.Chunk(50))
        {
            var response = await GetAsync<InstrumentsResponse>(
                $"/api/v1/market-data/instruments?instrumentIds={string.Join(',', chunk)}",
                apiKey,
                userKey,
                cancellationToken);
            foreach (var instrument in response.InstrumentDisplayDatas)
            {
                result[instrument.InstrumentId] = instrument;
            }
        }

        return result;
    }

    private async Task<T> GetAsync<T>(string path, string apiKey, string userKey, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(path, UriKind.Relative));
        request.Headers.Add("x-api-key", apiKey);
        request.Headers.Add("x-user-key", userKey);
        request.Headers.Add("x-request-id", Guid.NewGuid().ToString());

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            throw new ProviderException(SyncFailureKind.Unavailable, "eToro could not be reached.", inner: ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ProviderException(SyncFailureKind.Unavailable, "eToro did not respond in time.", inner: ex);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                throw ProviderHttp.ToException("eToro", response);
            }

            try
            {
                return await response.Content.ReadFromJsonAsync<T>(Json, cancellationToken)
                    ?? throw new ProviderException(SyncFailureKind.InvalidResponse, "eToro returned an empty response.");
            }
            catch (JsonException ex)
            {
                throw new ProviderException(SyncFailureKind.InvalidResponse, "eToro returned a response that could not be read.", inner: ex);
            }
        }
    }

    internal static AssetClass ClassOf(int instrumentId, int? instrumentTypeId) => instrumentTypeId switch
    {
        StockTypeId => AssetClass.Stock,
        EtfTypeId => AssetClass.Etf,
        CryptoTypeId => AssetClass.Crypto,
        null when instrumentId >= FirstCryptoInstrumentId => AssetClass.Crypto,
        _ => AssetClass.Other,
    };
}

/// <summary>Maps HTTP failures to the failure classes the sync workflow understands.</summary>
internal static class ProviderHttp
{
    public static ProviderException ToException(string provider, HttpResponseMessage response)
    {
        var status = response.StatusCode;
        return status switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden
                => new ProviderException(SyncFailureKind.Unauthorized, $"{provider} rejected the stored credentials."),
            HttpStatusCode.TooManyRequests
                => new ProviderException(SyncFailureKind.RateLimited, $"{provider} rate limit reached.", RetryAfter(response.Headers.RetryAfter)),
            >= HttpStatusCode.InternalServerError or HttpStatusCode.RequestTimeout
                => new ProviderException(SyncFailureKind.Unavailable, $"{provider} is temporarily unavailable ({(int)status})."),
            _ => new ProviderException(SyncFailureKind.InvalidResponse, $"{provider} returned HTTP {(int)status}."),
        };
    }

    private static TimeSpan? RetryAfter(RetryConditionHeaderValue? header)
        => header?.Delta ?? (header?.Date is { } date ? date - DateTimeOffset.UtcNow : null);
}

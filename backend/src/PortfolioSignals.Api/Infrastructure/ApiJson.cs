using System.Text.Json;
using System.Text.Json.Serialization;

namespace PortfolioSignals.Api.Infrastructure;

/// <summary>
/// The single JSON configuration of the API. It is applied to the MVC options that write the responses and to the HTTP
/// options that the built-in OpenAPI generator reads, so the published document describes the real wire format.
/// </summary>
internal static class ApiJson
{
    public static void Configure(JsonSerializerOptions options)
    {
        // Enums travel as their names; without this the document would describe them as integers.
        options.Converters.Add(new JsonStringEnumConverter());

        // Numbers are always written as numbers; the web default would document every number as "integer or string".
        options.NumberHandling = JsonNumberHandling.Strict;

        // Null values are written, so a property the document lists as required and nullable is always present.
        options.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    }
}

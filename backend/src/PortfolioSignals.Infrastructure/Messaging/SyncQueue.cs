using System.Text.Json;
using Azure.Identity;
using Azure.Storage.Queues;
using Microsoft.Extensions.Options;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Infrastructure.Cosmos;

namespace PortfolioSignals.Infrastructure.Messaging;

public sealed class SyncQueueOptions
{
    public const string SectionName = "SyncQueue";

    public string QueueName { get; set; } = "sync-requests";

    /// <summary>Storage account queue endpoint, for example <c>https://account.queue.core.windows.net</c>; uses <c>DefaultAzureCredential</c>.</summary>
    public string? ServiceUri { get; set; }

    /// <summary>Connection string, intended for Azurite in local development.</summary>
    public string? ConnectionString { get; set; }

    /// <summary><c>Storage</c> (default) or <c>Disabled</c>, which accepts requests but publishes nothing (tests, API-only development).</summary>
    public string Mode { get; set; } = "Storage";
}

internal sealed class StorageQueueSyncRequestPublisher(IOptions<SyncQueueOptions> options) : ISyncRequestPublisher
{
    private readonly Lazy<QueueClient> _queue = new(() => CreateClient(options.Value));

    public async Task PublishAsync(SyncRequestMessage message, CancellationToken cancellationToken)
    {
        var queue = _queue.Value;
        await queue.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        await queue.SendMessageAsync(JsonSerializer.Serialize(message, InfrastructureJson.Options), cancellationToken);
    }

    private static QueueClient CreateClient(SyncQueueOptions settings)
    {
        // Base64 matches the default message encoding expected by the Functions queue trigger.
        var clientOptions = new QueueClientOptions { MessageEncoding = QueueMessageEncoding.Base64 };
        if (!string.IsNullOrWhiteSpace(settings.ConnectionString))
        {
            return new QueueClient(settings.ConnectionString, settings.QueueName, clientOptions);
        }

        if (string.IsNullOrWhiteSpace(settings.ServiceUri))
        {
            throw new InvalidOperationException($"{SyncQueueOptions.SectionName}:ServiceUri or :ConnectionString must be configured.");
        }

        return new QueueClient(new Uri($"{settings.ServiceUri.TrimEnd('/')}/{settings.QueueName}"), new DefaultAzureCredential(), clientOptions);
    }
}

internal sealed class NullSyncRequestPublisher : ISyncRequestPublisher
{
    public Task PublishAsync(SyncRequestMessage message, CancellationToken cancellationToken) => Task.CompletedTask;
}

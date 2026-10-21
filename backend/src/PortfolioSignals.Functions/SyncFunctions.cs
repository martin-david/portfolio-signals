using System.Text.Json;
using FreeMediator;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Application.Sync;
using PortfolioSignals.Domain.Users;
using PortfolioSignals.Infrastructure.Cosmos;

namespace PortfolioSignals.Functions;

/// <summary>
/// Fan-out half of the background sync: on a timer, queue one message per connection whose plan interval has elapsed.
/// The timer only decides who is due; the queue gives each user's sync its own retry, isolation and concurrency limit.
/// </summary>
public sealed class EnqueueDueSyncsFunction(ISender sender, ILogger<EnqueueDueSyncsFunction> logger)
{
    [Function(nameof(EnqueueDueSyncsFunction))]
    public async Task Run([TimerTrigger("%SyncScheduler:Schedule%")] TimerInfo timer, CancellationToken cancellationToken)
    {
        if (timer.IsPastDue)
        {
            logger.LogWarning("The sync scheduler is running late.");
        }

        await sender.Send(new EnqueueDueSyncsCommand(), cancellationToken);
    }
}

/// <summary>
/// Worker half of the background sync: runs one provider sync for one user. The run id in the message makes redelivery
/// harmless, and a message that keeps failing lands in the <c>-poison</c> queue after the host's dequeue limit.
/// </summary>
public sealed class ExecuteSyncFunction(ISender sender, ILogger<ExecuteSyncFunction> logger)
{
    [Function(nameof(ExecuteSyncFunction))]
    public async Task Run([QueueTrigger("%SyncQueue:QueueName%", Connection = "SyncQueueStorage")] string messageText, CancellationToken cancellationToken)
    {
        var message = JsonSerializer.Deserialize<SyncRequestMessage>(messageText, InfrastructureJson.Options)
            ?? throw new InvalidOperationException("The sync request message is empty.");

        var result = await sender.Send(new ExecuteSyncCommand(new UserId(message.UserId), message.Provider, message.RunId), cancellationToken);
        if (!result.IsSuccess)
        {
            logger.LogWarning("Sync run {RunId} was not executed: {Code}", message.RunId, result.Error!.Code);
        }
    }
}

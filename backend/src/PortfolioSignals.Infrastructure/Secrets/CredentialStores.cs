using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Azure;
using Azure.Security.KeyVault.Secrets;
using PortfolioSignals.Application.Abstractions;
using PortfolioSignals.Domain.Integrations;
using PortfolioSignals.Domain.Users;

namespace PortfolioSignals.Infrastructure.Secrets;

public sealed class CredentialStoreOptions
{
    public const string SectionName = "CredentialStore";

    /// <summary><c>KeyVault</c> (default, and the only mode suited to production) or <c>InMemory</c> (single-process development and tests).</summary>
    public string Mode { get; set; } = "KeyVault";

    public string? KeyVaultUri { get; set; }
}

/// <summary>
/// Stores each user's provider credentials as one Key Vault secret per user and provider. The secret name is derived
/// from a hash of the user id, so it holds no personal data, and the application identity needs only get/set/delete.
/// </summary>
internal sealed class KeyVaultCredentialStore(SecretClient client) : ICredentialStore
{
    public async Task SaveAsync(UserId userId, IntegrationProvider provider, ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        var name = SecretNames.For(userId, provider);
        var value = JsonSerializer.Serialize(credentials.Values);
        var secret = new KeyVaultSecret(name, value) { Properties = { ContentType = "application/json" } };

        try
        {
            await client.SetSecretAsync(secret, cancellationToken);
        }
        catch (RequestFailedException ex) when (ex.Status == 409)
        {
            // The secret is in the soft-deleted state after a previous disconnect: recover it, then write the new version.
            var recovery = await client.StartRecoverDeletedSecretAsync(name, cancellationToken);
            await recovery.WaitForCompletionAsync(cancellationToken);
            await client.SetSecretAsync(secret, cancellationToken);
        }
    }

    public async Task<ProviderCredentials?> GetAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
    {
        try
        {
            var secret = await client.GetSecretAsync(SecretNames.For(userId, provider), cancellationToken: cancellationToken);
            var values = JsonSerializer.Deserialize<Dictionary<string, string>>(secret.Value.Value);
            return values is null ? null : new ProviderCredentials(values);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task DeleteAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
    {
        try
        {
            var operation = await client.StartDeleteSecretAsync(SecretNames.For(userId, provider), cancellationToken);
            await operation.WaitForCompletionAsync(cancellationToken);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // Nothing to delete.
        }
    }
}

internal static class SecretNames
{
    public static string For(UserId userId, IntegrationProvider provider)
    {
        var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(userId.Value)))[..32];
        return $"cred-{provider.ToString().ToLowerInvariant()}-{hash}";
    }
}

/// <summary>Volatile store for local development and tests. Not shared between processes and lost on restart.</summary>
internal sealed class InMemoryCredentialStore : ICredentialStore
{
    private readonly ConcurrentDictionary<string, ProviderCredentials> _secrets = new();

    public Task SaveAsync(UserId userId, IntegrationProvider provider, ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        _secrets[SecretNames.For(userId, provider)] = credentials;
        return Task.CompletedTask;
    }

    public Task<ProviderCredentials?> GetAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
        => Task.FromResult(_secrets.GetValueOrDefault(SecretNames.For(userId, provider)));

    public Task DeleteAsync(UserId userId, IntegrationProvider provider, CancellationToken cancellationToken)
    {
        _secrets.TryRemove(SecretNames.For(userId, provider), out _);
        return Task.CompletedTask;
    }
}

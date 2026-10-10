using System.ComponentModel.DataAnnotations;

namespace PortfolioSignals.Infrastructure.Cosmos;

public sealed class CosmosOptions
{
    public const string SectionName = "Cosmos";

    /// <summary>Account endpoint, authenticated with <c>DefaultAzureCredential</c> (managed identity in Azure). Preferred.</summary>
    public string? Endpoint { get; set; }

    /// <summary>Connection string, intended for the local emulator only.</summary>
    public string? ConnectionString { get; set; }

    [Required]
    public string DatabaseName { get; set; } = "portfolio-signals";

    /// <summary>Users and provider connections. Partition key <c>/userId</c>.</summary>
    [Required]
    public string AccountsContainer { get; set; } = "accounts";

    /// <summary>Snapshots, signals and sync runs. Partition key <c>/userId</c>, so a user's whole analysis is a single-partition read.</summary>
    [Required]
    public string PortfolioContainer { get; set; } = "portfolio";

    /// <summary>Create the database and containers on startup. For development; production containers come from infrastructure-as-code.</summary>
    public bool CreateIfNotExists { get; set; }

    [Range(1, 3650)]
    public int SnapshotRetentionDays { get; set; } = 365;

    [Range(1, 3650)]
    public int SyncRunRetentionDays { get; set; } = 90;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Endpoint) || !string.IsNullOrWhiteSpace(ConnectionString);
}

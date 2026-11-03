namespace PortfolioSignals.DevSeed;

/// <summary>The command line was wrong: reported with the usage text and exit code 2.</summary>
internal sealed class UsageException(string message) : Exception(message);

internal sealed record SeedOptions(string User, bool Reset, bool ShowHelp)
{
    public const string DefaultUser = "demo";

    public const string Usage = """
        Seeds a fictional demo account into the local Cosmos DB emulator, so the app has a portfolio to show
        without a real eToro or TipRanks account.

        Usage: dotnet run --project backend/tools/PortfolioSignals.DevSeed -- [options]

          --user <name>   The development user to fill: the name typed on the app's sign-in screen. Default: demo
          --reset         Delete everything stored for that user first, then seed
          --help          Show this text

        It reads the API's own settings, so it uses the same Cosmos DB as the API. Override the connection string with the
        Cosmos__ConnectionString environment variable or with "dotnet user-secrets". It refuses to write anywhere but a
        Cosmos DB emulator on this machine.
        """;

    private const string UserPrefix = "--user=";

    public static SeedOptions Parse(IReadOnlyList<string> args)
    {
        var user = DefaultUser;
        var reset = false;
        var showHelp = false;

        for (var i = 0; i < args.Count; i++)
        {
            var arg = args[i];
            if (arg == "--reset")
            {
                reset = true;
            }
            else if (arg is "--help" or "-h" or "-?")
            {
                showHelp = true;
            }
            else if (arg == "--user")
            {
                user = i + 1 < args.Count ? args[++i] : throw new UsageException("--user needs a name.");
            }
            else if (arg.StartsWith(UserPrefix, StringComparison.Ordinal))
            {
                user = arg[UserPrefix.Length..];
            }
            else
            {
                throw new UsageException($"Unknown option '{arg}'.");
            }
        }

        // The name becomes a Cosmos DB id, a partition key and the local part of an email address.
        return IsValidUser(user)
            ? new SeedOptions(user, reset, showHelp)
            : throw new UsageException("The user name must start with a letter or digit, use only letters, digits, '.', '_' and '-', and have at most 64 characters.");
    }

    private static bool IsValidUser(string name)
        => name.Length is >= 1 and <= 64
            && char.IsAsciiLetterOrDigit(name[0])
            && name.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '_' or '-');
}

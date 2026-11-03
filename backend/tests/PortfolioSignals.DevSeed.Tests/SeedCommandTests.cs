namespace PortfolioSignals.DevSeed.Tests;

/// <summary>
/// The command as a whole. These tests set an environment variable, which is process-wide, so they live in one class (xunit runs
/// the tests of a class one after another) and put the old value back; nothing else in this assembly reads the environment.
/// </summary>
public sealed class SeedCommandTests
{
    private const string DummyKey = "bm90LWEtcmVhbC1rZXk=";

    private static async Task<(int ExitCode, string Output, string Error)> RunAsync(string? connectionString, params string[] args)
    {
        const string variable = "Cosmos__ConnectionString";
        var previous = Environment.GetEnvironmentVariable(variable);
        Environment.SetEnvironmentVariable(variable, connectionString);
        try
        {
            using var output = new StringWriter();
            using var error = new StringWriter();
            var exitCode = await SeedCommand.RunAsync(args, output, error, CancellationToken.None);
            return (exitCode, output.ToString(), error.ToString());
        }
        finally
        {
            Environment.SetEnvironmentVariable(variable, previous);
        }
    }

    [Fact]
    public async Task Help_is_printed_and_nothing_else_happens()
    {
        var (exitCode, output, error) = await RunAsync(null, "--help");

        exitCode.Should().Be(0);
        output.Should().Contain("Usage:");
        error.Should().BeEmpty();
    }

    [Fact]
    public async Task A_mistake_on_the_command_line_is_reported_with_the_usage_and_exit_code_2()
    {
        var (exitCode, output, error) = await RunAsync(null, "--nope");

        exitCode.Should().Be(2);
        error.Should().Contain("Unknown option '--nope'").And.Contain("Usage:");
        output.Should().BeEmpty();
    }

    // The second string reaches the other account although it starts with a local endpoint: the Cosmos client takes the last one.
    // The host is a reserved name that never resolves, so even a broken guard could not reach anyone's account.
    [Theory]
    [InlineData("AccountEndpoint=https://other-account.invalid:443/;AccountKey=" + DummyKey)]
    [InlineData("AccountEndpoint=https://localhost:8081/;AccountEndpoint=https://other-account.invalid:443/;AccountKey=" + DummyKey)]
    public async Task A_remote_account_is_refused_before_anything_is_contacted_even_for_a_reset(string connectionString)
    {
        var (exitCode, output, error) = await RunAsync(connectionString, "--reset");

        exitCode.Should().Be(1);
        error.Should().Contain("not to other-account.invalid");
        output.Should().BeEmpty("nothing was deleted or written");
    }
}

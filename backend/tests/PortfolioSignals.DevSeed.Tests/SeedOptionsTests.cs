namespace PortfolioSignals.DevSeed.Tests;

public sealed class SeedOptionsTests
{
    [Fact]
    public void With_no_arguments_it_seeds_the_demo_user_without_a_reset()
    {
        var options = SeedOptions.Parse([]);

        options.Should().Be(new SeedOptions("demo", Reset: false, ShowHelp: false));
    }

    [Theory]
    [InlineData("--user", "alice")]
    [InlineData("--user=alice")]
    public void The_user_is_the_name_given(params string[] args)
    {
        SeedOptions.Parse(args).User.Should().Be("alice");
    }

    [Fact]
    public void Reset_and_help_are_flags()
    {
        SeedOptions.Parse(["--reset", "--user", "bob"]).Should().Be(new SeedOptions("bob", Reset: true, ShowHelp: false));
        SeedOptions.Parse(["--help"]).ShowHelp.Should().BeTrue();
        SeedOptions.Parse(["-h"]).ShowHelp.Should().BeTrue();
    }

    [Theory]
    [InlineData("--nope")]
    [InlineData("demo")]
    [InlineData("--reset=true")]
    public void Anything_else_is_a_mistake(string arg)
    {
        var parse = () => SeedOptions.Parse([arg]);

        parse.Should().Throw<UsageException>().WithMessage($"*'{arg}'*");
    }

    [Fact]
    public void A_user_option_without_a_name_is_a_mistake()
    {
        var parse = () => SeedOptions.Parse(["--user"]);

        parse.Should().Throw<UsageException>().WithMessage("*needs a name*");
    }

    [Theory]
    [InlineData("")]
    [InlineData("--reset")]
    [InlineData("-x")]
    [InlineData(".hidden")]
    [InlineData("a b")]
    [InlineData("a/b")]
    [InlineData("a?b")]
    [InlineData("a#b")]
    [InlineData("zoë")]
    public void A_user_name_that_cannot_be_a_cosmos_id_or_the_start_of_an_email_address_is_refused(string name)
    {
        var parse = () => SeedOptions.Parse(["--user", name]);

        parse.Should().Throw<UsageException>().WithMessage("*user name*");
    }

    [Fact]
    public void A_user_name_longer_than_sixty_four_characters_is_refused()
    {
        SeedOptions.Parse(["--user", new string('a', 64)]).User.Should().HaveLength(64);

        var parse = () => SeedOptions.Parse(["--user", new string('a', 65)]);

        parse.Should().Throw<UsageException>();
    }

    [Theory]
    [InlineData("demo")]
    [InlineData("Alice.Smith")]
    [InlineData("a_b-c")]
    [InlineData("7")]
    public void Names_the_development_sign_in_accepts_in_practice_are_accepted(string name)
    {
        SeedOptions.Parse(["--user", name]).User.Should().Be(name);
    }
}

using CampusEvents.Backend;
using Xunit;

namespace CampusEvents.Backend.Tests;

/// <summary>
/// Guard-clause tests for the refactored service. These run without a database because
/// the input is rejected before any connection is opened. Query behavior against a real
/// database belongs in integration tests, not unit tests.
/// </summary>
public class RegistrationServiceTests
{
    // Points at a server that does not exist: if validation failed to stop the call,
    // the test would fail with a SqlException instead of ArgumentException.
    private const string UnreachableDb = "Server=127.0.0.1,1;Database=None;Integrated Security=true;Connect Timeout=1;TrustServerCertificate=true";

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_RejectsMissingConnectionString(string connStr)
    {
        Assert.Throws<ArgumentException>(() => new RegistrationService(connStr));
    }

    [Theory]
    [InlineData("' OR '1'='1")]
    [InlineData("x'; DROP TABLE Registrations;--")]
    [InlineData("someone@gmail.com")]
    public void GetUserRegistration_RejectsInjectionAndForeignEmails_BeforeOpeningConnection(string input)
    {
        var service = new RegistrationService(UnreachableDb);

        Assert.Throws<ArgumentException>(() => service.GetUserRegistration(input));
    }
}

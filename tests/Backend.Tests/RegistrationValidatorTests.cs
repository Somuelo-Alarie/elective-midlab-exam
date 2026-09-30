using CampusEvents.Backend;
using Moq;
using Xunit;

namespace CampusEvents.Backend.Tests;

/// <summary>
/// Unit tests for RegistrationValidator. The database is replaced by a Moq mock of
/// IEventRepository, so these tests run in milliseconds with no SQL Server installed.
/// Pattern: Arrange / Act / Assert.
/// </summary>
public class RegistrationValidatorTests
{
    private const int EventId = 7;
    private const string GoodEmail = "maria.santos@univ.edu.ph";

    private readonly Mock<IEventRepository> _repo = new(MockBehavior.Strict);

    private RegistrationValidator CreateSut() => new(_repo.Object);

    // ---------------- Email domain validation (pure logic, no mock needed) ----------------

    [Theory]
    [InlineData("maria.santos@univ.edu.ph")]
    [InlineData("JOSE.REYES@UNIV.EDU.PH")]          // domain check is case-insensitive
    [InlineData("  ana_cruz+events@univ.edu.ph  ")] // surrounding spaces are trimmed
    public void IsValidStudentEmail_AcceptsUniversityAddresses(string email)
    {
        Assert.True(RegistrationValidator.IsValidStudentEmail(email));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("maria@gmail.com")]
    [InlineData("maria@univ.edu.ph.evil.com")]   // suffix spoofing
    [InlineData("maria@fakeuniv.edu.ph")]         // look-alike domain
    [InlineData("maria@sub.univ.edu.ph")]         // subdomains not allowed
    [InlineData("@univ.edu.ph")]                  // empty local part
    [InlineData("maria univ.edu.ph")]             // missing @
    [InlineData("x' OR '1'='1@univ.edu.ph")]      // SQL-injection-style input
    public void IsValidStudentEmail_RejectsInvalidOrSpoofedAddresses(string? email)
    {
        Assert.False(RegistrationValidator.IsValidStudentEmail(email));
    }

    [Fact]
    public void IsValidStudentEmail_RejectsAddressesLongerThanColumnSize()
    {
        string tooLong = new string('a', 250) + "@univ.edu.ph"; // 262 chars > NVARCHAR(255)
        Assert.False(RegistrationValidator.IsValidStudentEmail(tooLong));
    }

    // ---------------- Seat availability (external dependency mocked) ----------------

    [Fact]
    public void Validate_ReturnsOk_WhenSeatsAreAvailable()
    {
        // Arrange
        _repo.Setup(r => r.GetEventCapacity(EventId)).Returns(40);
        _repo.Setup(r => r.IsAlreadyRegistered(GoodEmail, EventId)).Returns(false);
        _repo.Setup(r => r.GetConfirmedRegistrationCount(EventId)).Returns(39);

        // Act
        var result = CreateSut().Validate(GoodEmail, EventId);

        // Assert
        Assert.Equal(RegistrationCheck.Ok, result);
        _repo.VerifyAll();
    }

    [Theory]
    [InlineData(40, 40)] // exactly full
    [InlineData(40, 41)] // over-booked data must still be treated as full
    public void Validate_ReturnsEventFull_WhenNoSeatsLeft(int capacity, int taken)
    {
        _repo.Setup(r => r.GetEventCapacity(EventId)).Returns(capacity);
        _repo.Setup(r => r.IsAlreadyRegistered(GoodEmail, EventId)).Returns(false);
        _repo.Setup(r => r.GetConfirmedRegistrationCount(EventId)).Returns(taken);

        var result = CreateSut().Validate(GoodEmail, EventId);

        Assert.Equal(RegistrationCheck.EventFull, result);
    }

    [Fact]
    public void Validate_ReturnsEventNotFound_AndSkipsOtherQueries_WhenEventMissing()
    {
        _repo.Setup(r => r.GetEventCapacity(EventId)).Returns((int?)null);

        var result = CreateSut().Validate(GoodEmail, EventId);

        Assert.Equal(RegistrationCheck.EventNotFound, result);
        _repo.Verify(r => r.GetConfirmedRegistrationCount(It.IsAny<int>()), Times.Never);
        _repo.Verify(r => r.IsAlreadyRegistered(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public void Validate_ReturnsAlreadyRegistered_WhenDuplicate()
    {
        _repo.Setup(r => r.GetEventCapacity(EventId)).Returns(40);
        _repo.Setup(r => r.IsAlreadyRegistered(GoodEmail, EventId)).Returns(true);

        var result = CreateSut().Validate(GoodEmail, EventId);

        Assert.Equal(RegistrationCheck.AlreadyRegistered, result);
        _repo.Verify(r => r.GetConfirmedRegistrationCount(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public void Validate_NormalizesEmail_BeforeDuplicateLookup()
    {
        _repo.Setup(r => r.GetEventCapacity(EventId)).Returns(40);
        _repo.Setup(r => r.IsAlreadyRegistered(GoodEmail, EventId)).Returns(true);

        var result = CreateSut().Validate("  Maria.Santos@UNIV.edu.ph ", EventId);

        Assert.Equal(RegistrationCheck.AlreadyRegistered, result);
        _repo.Verify(r => r.IsAlreadyRegistered(GoodEmail, EventId), Times.Once);
    }

    [Fact]
    public void Validate_NeverTouchesRepository_WhenEmailInvalid()
    {
        // Strict mock with no setups: any repository call would throw MockException.
        var result = CreateSut().Validate("hacker@gmail.com", EventId);

        Assert.Equal(RegistrationCheck.InvalidEmail, result);
        _repo.VerifyNoOtherCalls();
    }

    [Fact]
    public void Constructor_Throws_WhenRepositoryIsNull()
    {
        Assert.Throws<ArgumentNullException>(() => new RegistrationValidator(null!));
    }
}

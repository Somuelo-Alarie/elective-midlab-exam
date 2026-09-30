using System.Text.RegularExpressions;

namespace CampusEvents.Backend;

public enum RegistrationCheck
{
    Ok,
    InvalidEmail,
    EventNotFound,
    EventFull,
    AlreadyRegistered
}

/// <summary>
/// Core validation routine under test: student email domain + seat availability.
/// </summary>
public class RegistrationValidator
{
    public const string AllowedDomain = "univ.edu.ph";

    // Anchored at both ends so look-alike domains such as
    // "x@univ.edu.ph.evil.com" or "x@fakeuniv.edu.ph" are rejected.
    private static readonly Regex StudentEmailPattern = new(
        @"^[A-Za-z0-9._%+-]+@univ\.edu\.ph$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled,
        TimeSpan.FromMilliseconds(100)); // guards against regex denial-of-service

    private readonly IEventRepository _repository;

    public RegistrationValidator(IEventRepository repository)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
    }

    public static bool IsValidStudentEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 255)
            return false;

        return StudentEmailPattern.IsMatch(email.Trim());
    }

    public RegistrationCheck Validate(string? email, int eventId)
    {
        // Cheap local check first: never touch the database for obviously bad input.
        if (!IsValidStudentEmail(email))
            return RegistrationCheck.InvalidEmail;

        int? capacity = _repository.GetEventCapacity(eventId);
        if (capacity is null)
            return RegistrationCheck.EventNotFound;

        string normalizedEmail = email!.Trim().ToLowerInvariant();
        if (_repository.IsAlreadyRegistered(normalizedEmail, eventId))
            return RegistrationCheck.AlreadyRegistered;

        int taken = _repository.GetConfirmedRegistrationCount(eventId);
        if (taken >= capacity.Value)
            return RegistrationCheck.EventFull;

        return RegistrationCheck.Ok;
    }
}

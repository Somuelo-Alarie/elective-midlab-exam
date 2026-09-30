namespace CampusEvents.Backend;

/// <summary>
/// Data-access abstraction. Production code talks to SQL Server through this interface;
/// unit tests replace it with a Moq mock so no database is needed (isolating the external dependency).
/// </summary>
public interface IEventRepository
{
    /// <summary>Returns the event's capacity, or null if the event does not exist.</summary>
    int? GetEventCapacity(int eventId);

    /// <summary>Number of confirmed registrations for the event.</summary>
    int GetConfirmedRegistrationCount(int eventId);

    /// <summary>True if this email already has a registration for the event.</summary>
    bool IsAlreadyRegistered(string email, int eventId);
}

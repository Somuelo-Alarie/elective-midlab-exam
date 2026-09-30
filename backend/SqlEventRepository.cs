using System.Data;
using Microsoft.Data.SqlClient;

namespace CampusEvents.Backend;

/// <summary>
/// Production implementation of IEventRepository. Same rules as RegistrationService:
/// parameterized SQL only, and every connection/command disposed with 'using'.
/// </summary>
public class SqlEventRepository : IEventRepository
{
    private readonly string _connectionString;

    public SqlEventRepository(string connectionString) =>
        _connectionString = connectionString ?? throw new ArgumentNullException(nameof(connectionString));

    public int? GetEventCapacity(int eventId)
    {
        const string sql = "SELECT Capacity FROM dbo.Events WHERE EventId = @EventId AND Status = 'Published';";
        using var conn = new SqlConnection(_connectionString);
        using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.Add("@EventId", SqlDbType.Int).Value = eventId;
        conn.Open();
        object? result = cmd.ExecuteScalar();
        return result is null || result is DBNull ? null : Convert.ToInt32(result);
    }

    public int GetConfirmedRegistrationCount(int eventId)
    {
        const string sql = "SELECT COUNT(*) FROM dbo.Registrations WHERE EventId = @EventId AND Status = 'Confirmed';";
        using var conn = new SqlConnection(_connectionString);
        using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.Add("@EventId", SqlDbType.Int).Value = eventId;
        conn.Open();
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    public bool IsAlreadyRegistered(string email, int eventId)
    {
        const string sql = @"
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM dbo.Registrations r
                JOIN dbo.Users u ON u.UserId = r.UserId
                WHERE u.Email = @Email AND r.EventId = @EventId AND r.Status <> 'Cancelled'
            ) THEN 1 ELSE 0 END;";
        using var conn = new SqlConnection(_connectionString);
        using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.Add("@Email", SqlDbType.NVarChar, 255).Value = email;
        cmd.Parameters.Add("@EventId", SqlDbType.Int).Value = eventId;
        conn.Open();
        return Convert.ToInt32(cmd.ExecuteScalar()) == 1;
    }
}

using System.Data;
using Microsoft.Data.SqlClient;

namespace CampusEvents.Backend;

/*
 * ORIGINAL (flawed) METHOD, kept here for reference only:
 *
 *   public string GetUserRegistration(string inputEmail) {
 *       string connStr = "Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;";
 *       SqlConnection conn = new SqlConnection(connStr);
 *       conn.Open(); // Connection is not closed or disposed
 *       SqlCommand cmd = new SqlCommand("SELECT * FROM Registrations WHERE Email = '" + inputEmail + "'", conn);
 *       return cmd.ExecuteScalar().ToString();
 *   }
 *
 * Problems found and fixed:
 *  1. SQL injection: user input was concatenated into the SQL text. Input such as
 *     ' OR '1'='1  changes the query's logic. FIX: parameterized query (@Email).
 *  2. Resource leak: SqlConnection and SqlCommand were never disposed, so pooled
 *     connections are held until garbage collection and the pool runs out under load.
 *     FIX: "using" declarations dispose both, even when an exception is thrown.
 *  3. Hard-coded credentials in source code (would end up in the Git repository).
 *     FIX: connection string is injected from configuration / environment variable.
 *  4. NullReferenceException: ExecuteScalar() returns null when no row matches,
 *     so .ToString() crashes. FIX: null / DBNull check, return type is string?.
 *  5. SELECT * with ExecuteScalar only ever reads column 1 of row 1. FIX: select the
 *     exact column needed with TOP (1) and a deterministic ORDER BY.
 *  6. Schema mismatch: in our 3NF schema the email is stored in Users, not
 *     Registrations. FIX: JOIN Users on UserId.
 */
public class RegistrationService
{
    private readonly string _connectionString;

    /// <param name="connectionString">
    /// Supplied from configuration (e.g. appsettings.json, user-secrets, or the
    /// CAMPUS_EVENTS_DB environment variable). Never hard-code credentials.
    /// </param>
    public RegistrationService(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new ArgumentException("A connection string is required.", nameof(connectionString));

        _connectionString = connectionString;
    }

    /// <summary>Convenience factory that reads the connection string from the environment.</summary>
    public static RegistrationService FromEnvironment() =>
        new(Environment.GetEnvironmentVariable("CAMPUS_EVENTS_DB")
            ?? throw new InvalidOperationException("Set the CAMPUS_EVENTS_DB environment variable."));

    /// <summary>
    /// Returns the most recent RegistrationId for the given email, or null if none exists.
    /// </summary>
    public string? GetUserRegistration(string inputEmail)
    {
        // Fail fast on bad input before opening a connection.
        if (!RegistrationValidator.IsValidStudentEmail(inputEmail))
            throw new ArgumentException("A valid @univ.edu.ph email is required.", nameof(inputEmail));

        const string sql = @"
            SELECT TOP (1) r.RegistrationId
            FROM dbo.Registrations AS r
            INNER JOIN dbo.Users AS u ON u.UserId = r.UserId
            WHERE u.Email = @Email
            ORDER BY r.RegisteredAt DESC;";

        // 'using' guarantees Dispose() (which closes the connection and returns it
        // to the pool) runs when the method exits, including on exceptions.
        using var conn = new SqlConnection(_connectionString);
        using var cmd = new SqlCommand(sql, conn);

        // Explicit type and length: avoids implicit conversions and plan-cache bloat
        // that AddWithValue can cause. The value is sent separately from the SQL text,
        // so it can never be executed as SQL.
        cmd.Parameters.Add("@Email", SqlDbType.NVarChar, 255).Value = inputEmail.Trim();

        conn.Open();
        object? result = cmd.ExecuteScalar();

        return result is null || result is DBNull ? null : result.ToString();
    }

    /// <summary>Async version for use in ASP.NET Core controllers.</summary>
    public async Task<string?> GetUserRegistrationAsync(string inputEmail, CancellationToken ct = default)
    {
        if (!RegistrationValidator.IsValidStudentEmail(inputEmail))
            throw new ArgumentException("A valid @univ.edu.ph email is required.", nameof(inputEmail));

        const string sql = @"
            SELECT TOP (1) r.RegistrationId
            FROM dbo.Registrations AS r
            INNER JOIN dbo.Users AS u ON u.UserId = r.UserId
            WHERE u.Email = @Email
            ORDER BY r.RegisteredAt DESC;";

        await using var conn = new SqlConnection(_connectionString);
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.Add("@Email", SqlDbType.NVarChar, 255).Value = inputEmail.Trim();

        await conn.OpenAsync(ct);
        object? result = await cmd.ExecuteScalarAsync(ct);

        return result is null || result is DBNull ? null : result.ToString();
    }
}

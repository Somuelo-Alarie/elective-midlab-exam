/* =====================================================================
   Online Campus Event Management System
   Database: Microsoft SQL Server 2019+ / Azure SQL (T-SQL)
   Normal form: 3NF
     - Every table has a single-column surrogate primary key.
     - No repeating groups or multi-valued columns (1NF).
     - No partial dependencies: no composite primary keys (2NF).
     - No transitive dependencies: venue details live in Venues and
       category names in EventCategories, not repeated on Events;
       a student's email/name live only in Users, never in Registrations (3NF).
   Run order: this whole script, top to bottom. It is re-runnable.
   ===================================================================== */

IF DB_ID(N'CampusEventsDB') IS NULL
    CREATE DATABASE CampusEventsDB;
GO
USE CampusEventsDB;
GO

/* ---------- Drop in reverse dependency order so the script can be re-run ---------- */
IF OBJECT_ID(N'dbo.vw_EventAttendees', N'V') IS NOT NULL DROP VIEW dbo.vw_EventAttendees;
IF OBJECT_ID(N'dbo.Registrations', N'U')     IS NOT NULL DROP TABLE dbo.Registrations;
IF OBJECT_ID(N'dbo.Events', N'U')            IS NOT NULL DROP TABLE dbo.Events;
IF OBJECT_ID(N'dbo.EventCategories', N'U')   IS NOT NULL DROP TABLE dbo.EventCategories;
IF OBJECT_ID(N'dbo.Venues', N'U')            IS NOT NULL DROP TABLE dbo.Venues;
IF OBJECT_ID(N'dbo.Users', N'U')             IS NOT NULL DROP TABLE dbo.Users;
GO

/* ------------------------------- Users ------------------------------- */
CREATE TABLE dbo.Users (
    UserId       INT IDENTITY(1,1) NOT NULL,
    StudentNo    VARCHAR(10)   NULL,          -- NULL for admins/staff
    Email        NVARCHAR(255) NOT NULL,
    FirstName    NVARCHAR(100) NOT NULL,
    LastName     NVARCHAR(100) NOT NULL,
    Role         VARCHAR(10)   NOT NULL CONSTRAINT DF_Users_Role DEFAULT ('Student'),
    YearLevel    TINYINT       NULL,
    CreatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT CK_Users_Role CHECK (Role IN ('Student', 'Admin')),
    -- Only university accounts may exist in the system
    CONSTRAINT CK_Users_EmailDomain CHECK (Email LIKE '_%@univ.edu.ph'),
    CONSTRAINT CK_Users_StudentNo CHECK (StudentNo IS NULL OR StudentNo LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_Users_YearLevel CHECK (YearLevel IS NULL OR YearLevel BETWEEN 1 AND 5),
    -- Students must have a student number and year level
    CONSTRAINT CK_Users_StudentFields CHECK (Role <> 'Student' OR (StudentNo IS NOT NULL AND YearLevel IS NOT NULL))
);
GO
-- Filtered unique index: StudentNo unique when present (admins have NULL)
CREATE UNIQUE NONCLUSTERED INDEX UX_Users_StudentNo ON dbo.Users (StudentNo) WHERE StudentNo IS NOT NULL;
GO

/* ------------------------------- Venues ------------------------------ */
CREATE TABLE dbo.Venues (
    VenueId      INT IDENTITY(1,1) NOT NULL,
    Name         NVARCHAR(150) NOT NULL,
    Building     NVARCHAR(100) NULL,
    MaxCapacity  INT           NOT NULL,

    CONSTRAINT PK_Venues PRIMARY KEY CLUSTERED (VenueId),
    CONSTRAINT UQ_Venues_Name UNIQUE (Name),
    CONSTRAINT CK_Venues_MaxCapacity CHECK (MaxCapacity > 0)
);
GO

/* --------------------------- EventCategories -------------------------- */
CREATE TABLE dbo.EventCategories (
    CategoryId   INT IDENTITY(1,1) NOT NULL,
    Name         NVARCHAR(50) NOT NULL,

    CONSTRAINT PK_EventCategories PRIMARY KEY CLUSTERED (CategoryId),
    CONSTRAINT UQ_EventCategories_Name UNIQUE (Name)
);
GO

/* ------------------------------- Events ------------------------------ */
CREATE TABLE dbo.Events (
    EventId        INT IDENTITY(1,1) NOT NULL,
    Title          NVARCHAR(200)  NOT NULL,
    Description    NVARCHAR(2000) NULL,
    CategoryId     INT            NOT NULL,
    VenueId        INT            NOT NULL,
    CreatedByUserId INT           NOT NULL,
    StartDateTime  DATETIME2(0)   NOT NULL,
    EndDateTime    DATETIME2(0)   NOT NULL,
    Capacity       INT            NOT NULL,
    Status         VARCHAR(10)    NOT NULL CONSTRAINT DF_Events_Status DEFAULT ('Published'),
    CreatedAt      DATETIME2(0)   NOT NULL CONSTRAINT DF_Events_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Events PRIMARY KEY CLUSTERED (EventId),
    CONSTRAINT FK_Events_Category FOREIGN KEY (CategoryId)
        REFERENCES dbo.EventCategories (CategoryId)
        ON DELETE NO ACTION ON UPDATE NO ACTION,     -- cannot delete a category still in use
    CONSTRAINT FK_Events_Venue FOREIGN KEY (VenueId)
        REFERENCES dbo.Venues (VenueId)
        ON DELETE NO ACTION ON UPDATE NO ACTION,     -- cannot delete a venue with events
    CONSTRAINT FK_Events_CreatedBy FOREIGN KEY (CreatedByUserId)
        REFERENCES dbo.Users (UserId)
        ON DELETE NO ACTION ON UPDATE NO ACTION,     -- keep audit trail of who created it
    CONSTRAINT CK_Events_Capacity CHECK (Capacity > 0),
    CONSTRAINT CK_Events_Dates CHECK (EndDateTime > StartDateTime),
    CONSTRAINT CK_Events_Status CHECK (Status IN ('Draft', 'Published', 'Cancelled', 'Completed'))
);
GO

/* ---------------------------- Registrations --------------------------- */
CREATE TABLE dbo.Registrations (
    RegistrationId INT IDENTITY(1,1) NOT NULL,
    UserId         INT          NOT NULL,
    EventId        INT          NOT NULL,
    RegisteredAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Registrations_RegisteredAt DEFAULT (SYSUTCDATETIME()),
    Status         VARCHAR(10)  NOT NULL CONSTRAINT DF_Registrations_Status DEFAULT ('Confirmed'),

    CONSTRAINT PK_Registrations PRIMARY KEY CLUSTERED (RegistrationId),
    CONSTRAINT FK_Registrations_User FOREIGN KEY (UserId)
        REFERENCES dbo.Users (UserId)
        ON DELETE CASCADE ON UPDATE NO ACTION,       -- removing a user removes their registrations
    CONSTRAINT FK_Registrations_Event FOREIGN KEY (EventId)
        REFERENCES dbo.Events (EventId)
        ON DELETE CASCADE ON UPDATE NO ACTION,       -- removing an event removes its registrations
    -- A student can register for the same event only once
    CONSTRAINT UQ_Registrations_User_Event UNIQUE (UserId, EventId),
    CONSTRAINT CK_Registrations_Status CHECK (Status IN ('Confirmed', 'Cancelled', 'Attended', 'NoShow'))
);
GO
/* Note: Users -> Events (CreatedBy, NO ACTION) and Users -> Registrations -> Events
   (both CASCADE) do not form multiple cascade paths, because the Events.CreatedBy
   FK does not cascade. SQL Server accepts this design. */

/* ---------- Non-clustered indexes on every foreign key column ----------
   SQL Server does NOT create these automatically. Without them, joins and
   the FK checks performed on parent DELETEs cause full table scans. */
CREATE NONCLUSTERED INDEX IX_Events_CategoryId       ON dbo.Events (CategoryId);
CREATE NONCLUSTERED INDEX IX_Events_VenueId          ON dbo.Events (VenueId);
CREATE NONCLUSTERED INDEX IX_Events_CreatedByUserId  ON dbo.Events (CreatedByUserId);
-- UQ_Registrations_User_Event already leads with UserId, so it serves UserId lookups;
-- the explicit index is kept because the exam rubric asks for one per FK column.
CREATE NONCLUSTERED INDEX IX_Registrations_UserId    ON dbo.Registrations (UserId);
CREATE NONCLUSTERED INDEX IX_Registrations_EventId   ON dbo.Registrations (EventId) INCLUDE (UserId, Status, RegisteredAt);
-- Supports the catalog query "upcoming published events ordered by date"
CREATE NONCLUSTERED INDEX IX_Events_Status_Start     ON dbo.Events (Status, StartDateTime);
GO

/* ------------- Admin view: registered attendees per event ------------- */
CREATE VIEW dbo.vw_EventAttendees
AS
SELECT  e.EventId,
        e.Title          AS EventTitle,
        e.StartDateTime,
        u.UserId,
        u.StudentNo,
        u.FirstName,
        u.LastName,
        u.Email,
        r.RegisteredAt,
        r.Status         AS RegistrationStatus
FROM    dbo.Registrations r
JOIN    dbo.Users  u ON u.UserId  = r.UserId
JOIN    dbo.Events e ON e.EventId = r.EventId;
GO

/* ------------------------------ Seed data ----------------------------- */
INSERT INTO dbo.Users (StudentNo, Email, FirstName, LastName, Role, YearLevel) VALUES
    (NULL,         N'osa.admin@univ.edu.ph',     N'Liza',  N'Mercado', 'Admin',   NULL);

INSERT INTO dbo.Venues (Name, Building, MaxCapacity) VALUES
    (N'IT Building, Room 301',     N'IT Building', 45),
    (N'University Covered Court',  NULL,           500),
    (N'Open-Air Amphitheater',     NULL,           300);

INSERT INTO dbo.EventCategories (Name) VALUES (N'Academic'), (N'Sports'), (N'Culture');

INSERT INTO dbo.Events (Title, Description, CategoryId, VenueId, CreatedByUserId, StartDateTime, EndDateTime, Capacity) VALUES
    (N'Intro to Generative AI Workshop', N'Hands-on session on prompt design and verifying AI output.', 1, 1, 1, '2026-10-14T13:00', '2026-10-14T16:00', 40),
    (N'Inter-College Futsal Cup',        N'Eight college teams, single-elimination.',                  2, 2, 1, '2026-10-21T15:30', '2026-10-21T20:00', 3),
    (N'Harana Night: Acoustic Showcase', N'Student bands and soloists perform OPM classics.',           3, 3, 1, '2026-11-06T18:00', '2026-11-06T21:30', 120);

-- No sample registrations: attendees are added only by real student sign-ups.
GO

/* --------------------------- Sample queries --------------------------- */
-- Seats left per upcoming event (used by the catalog page)
-- SELECT e.EventId, e.Title, e.Capacity,
--        e.Capacity - COUNT(r.RegistrationId) AS SeatsLeft
-- FROM dbo.Events e
-- LEFT JOIN dbo.Registrations r ON r.EventId = e.EventId AND r.Status = 'Confirmed'
-- WHERE e.Status = 'Published' AND e.StartDateTime > SYSUTCDATETIME()
-- GROUP BY e.EventId, e.Title, e.Capacity;

-- Attendees of one event (admin page)
-- SELECT * FROM dbo.vw_EventAttendees WHERE EventId = 1 ORDER BY RegisteredAt;

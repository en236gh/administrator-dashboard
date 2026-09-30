# Examination Dashboard Integration

These guides define the frontend contract for the scheduling backend after
`V38__administrator_owned_scheduling.sql` has been applied. The client must not
expose coordinator assignment, Scheduling Lead privileges, or a second-admin
approval step. Only Administrator manages examination scheduling; Lecturer,
Student, and Invigilator keep their existing responsibilities.

## Guides

- [Administrator: Exam Management](administrator-exam-management.md)
- [Lecturer Dashboard](lecturer-dashboard.md)
- [Student Dashboard](student-dashboard.md)
- [Invigilator Dashboard](invigilator-dashboard.md)
- [Shared Examination Inbox](shared-examination-inbox.md)

## Shared API Rules

- Send the existing bearer access token. Use the authenticated account; never send
  a staff ID or student number to choose whose data is being loaded.
- JSON responses use `{ "success": true, "message": "...", "data": ... }`.
  PDF downloads are binary responses. Preserve useful `data` when `success` is
  false, especially for timetable generation outcomes.
- Request properties use camelCase. Typed DTO responses also use camelCase;
  JDBC-backed scheduling records use snake_case. Use each endpoint's documented
  shape instead of globally renaming fields.
- Treat the server as the authorization and eligibility source. A hidden control is
  not a security check; handle `403` and clear data the account is no longer allowed
  to view.
- Display examination date/time in the period's configured timezone. These are
  institution-local examination times, not UTC timestamps.
- Clear account-specific data on logout/account switch. Include the account and
  selected exam/period IDs in any client cache keys.
- Keep loading, empty, stale/error, and success states distinct. On a `409`, refresh
  the relevant detail and show the server's current validation/revision message;
  do not retry with a guessed revision.

## Scheduling Invariants

- Draft generation never publishes. Publication is an explicit action and is blocked
  by any server validation problem, including student eligibility, venue capacity,
  booking conflicts, allocation mismatch, and invigilator staffing shortages.
- Published arrangements are read-only outside the amendment flow.
- A Lecturer change request is a review record only. An Administrator's approval
  does not change the timetable.
- For a published amendment, the Administrator proposes, explicitly approves or
  rejects, then separately applies. Apply performs fresh validation, enforces the
  existing future-exam/no-operational-record eligibility rules, increments the
  period revision, records before/after arrangements, and queues notifications.
- Retrying in-app notification delivery must never apply the amendment again.
- Student access remains limited to that student's eligible published exams and
  pass data. Invigilator access remains scoped to published duties and their exact
  assigned venues.

## Deployment Prerequisite

The application has Flyway disabled. Apply the versioned SQL migrations manually
in order on the target database, including V38, before deploying a UI that relies on
Administrator-only amendment authorization. Verify the migration on a backed-up,
disposable database first. Existing coordinator and lead rows may remain in the
schema; they no longer control the UI workflow or authorization.

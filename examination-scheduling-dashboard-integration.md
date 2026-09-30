# Examination Scheduling: Dashboard Integration Map

> Scheduling update: see [automatic academic year and required seats](scheduling-automatic-defaults-integration.md). Omit academicYear from period setup; display registration counts as required seats.

This companion guide is a quick overview of which existing screens consume scheduling
data and what should remain read-only. For final API-by-API implementation contracts,
use the [dashboard-specific integration guides](dashboard-integration/README.md).
The broader backend/API contract and amendment request schemas remain in the
[examination scheduling frontend guide](examination-scheduling-frontend-guide.md).
No frontend implementation is included here.

## Dashboard Map

| Dashboard or screen | Main endpoints | Scheduling integration |
| --- | --- | --- |
| Administrator overview and Exam Management | `/api/dashboard/admin`; `/api/admin/examination-periods/**` | Keep operational overview separate from period setup, review, staffing and publication. |
| Lecturer | `/api/dashboard/lecturer`; `/api/exams`; `/api/allocation/exam-session/{exam}` | Show published exams for assigned courses, allocation/attendance counts and requests for review. |
| Student | `/api/student/examinations`; `/api/student/examination-pass` | Show only the signed-in student's published, eligible examinations and pass details. |
| Invigilator | `/api/dashboard/invigilator`; `/api/invigilator/assignments`; `/api/invigilator/assignments/{exam}/{venue}/students` | Show published duties and only the roster for the signed-in invigilator's assigned venue. |
| Shared staff inbox | `/api/examination-notifications` | Show available timetable amendment notices for the signed-in staff member; reading a notice is account-scoped. |

Detailed integration guides: [Administrator](dashboard-integration/administrator-exam-management.md),
[Lecturer](dashboard-integration/lecturer-dashboard.md),
[Student](dashboard-integration/student-dashboard.md),
[Invigilator](dashboard-integration/invigilator-dashboard.md), and the
[shared examination inbox](dashboard-integration/shared-examination-inbox.md).

All API requests use the existing bearer token and response envelope unless an endpoint
downloads a PDF. Requests use camelCase; JDBC-backed scheduling records use snake_case.
Display exam local dates and times in the period's configured timezone. Do not treat
local exam times as UTC.

## Administrator

### Overview

`GET /api/dashboard/admin` is an existing day-of-operations summary, not a managed
period review API. It returns `todaysExaminations`, `todaysExaminationDetails`,
`presentStudents`, `absentStudents`, `attendancePercentage`, `totalIncidents`,
`incidentsToday`, `venueOccupancy`, and `generatedReports`.

Use the period API as the source of truth for period status, draft versus published
state, revision, course selection, bookings, allocations, invigilator assignments,
validation blockers and amendment history. In particular, `venueOccupancy` on the
existing overview is calculated using `venue.capacity` (classroom capacity), not
`venue.examination_capacity`; do not present it as examination seating utilization.

### Exam Management

Use `/api/admin/examination-periods` for period lifecycle and timetable operations.
Show the period's revision and publication status with the timetable.
Drafts are administrator-only and generation never publishes. Block publish while
validation reports problems; refresh period detail after staffing/capacity changes.
Published placement and staffing remain read-only in ordinary editing flows.

The same Administrator can complete the entire workflow:

- Period setup, course selection, scheduling settings, draft generation and review.
- Manual or automatic draft staffing, review of shortages, and atomic period publish.
- Lecturer change-request review. Recording `APPROVED` or `REJECTED` does not apply
  a timetable change.
- A separate published-amendment process: the Administrator proposes, explicitly
  approves or rejects, and applies. Approval does not change the timetable; apply is
  only available after fresh validation and increments the period revision.
- An audit history view for period changes and amendment before/after arrangements.
- Notification delivery review and retries that never reapply timetable changes.

See the main guide for endpoint payloads, approval rules, failure states and migration
requirements. Do not offer unpublish or direct post-publication placement controls.
The amendment flow is limited to eligible future scheduled exams without attendance,
incident or generated-report records.

## Lecturer

Use `GET /api/dashboard/lecturer` for assigned-course totals and per-exam statistics.
The overall response includes `courseCodes`, `totalExaminations`,
`registeredStudents`, `allocatedStudents`, `unallocatedStudents`,
`attendedStudents`, and an `examinations` array. Totals count student/exam
participations, not distinct students across multiple courses or exams. Surface
`invalidAllocationRecords` from per-exam allocation stats for administrator follow-up;
do not fold stale allocations into the visible eligible allocation count.

`GET /api/dashboard/lecturer?examSessionId={exam}` returns the selected exam's
allocation statistics under `data.allocation`, not the overall dashboard shape.
The caller must own the course. `GET /api/exams` likewise contains only published
exams for the lecturer's assigned courses and includes `periodId` and
`schedulePublished`. Use the returned exam-session ID for all detail requests.

For a selected exam, `GET /api/allocation/exam-session/{exam}` provides registered,
allocated, unallocated and attended counts, invalid allocation records, venue fills
and allocation rows. Lecturer views are read-only: do not show controls that assign
or move students between venues.

Lecturers can submit a post-publication review request through
`POST /api/examination-change-requests` with `periodId`, `courseCode`, optional
`examSessionId`, `proposedChange` and `reason`. `GET
/api/examination-change-requests?periodId={period}` returns only that lecturer's
requests for their published courses. A request does not change the timetable.
Show its status/decision from the returned record and provide a separate notification
inbox for amendment notices.

## Student

There is no dedicated `/api/dashboard/student` endpoint in this workflow. Use
`GET /api/student/examinations` as the student's examination list. The service
returns only the signed-in student's eligible, published examinations; drafts must
never appear in the list, examination pass or PDF.

Existing pass actions remain:

- `POST /api/student/examination-pass?academicYear={year}&semester={semester}` to
  generate a pass.
- `GET /api/student/examination-pass` to retrieve pass details.
- `GET /api/student/examination-pass/pdf` to download the pass PDF.

The academic year and semester filters are optional. Preserve existing account,
programme-enrolment and pass-generation requirements. Do not infer eligibility from
a timetable allocation alone. After a published amendment, students may receive an
in-app notification; refresh their examination list/pass details to show the current
arrangement.

## Invigilator

`GET /api/dashboard/invigilator` provides `assignedExaminations`, `assignedVenues`,
`checkedInStudents`, `absentStudents`, `scriptsCollected` and `incidents`. These are
based on the signed-in invigilator's published duties.

`GET /api/invigilator/assignments` supplies the invigilator's published assignments;
managed-period drafts and unpublished schedules are hidden. Use the assigned
exam/venue IDs for the roster:

`GET /api/invigilator/assignments/{exam}/{venue}/students`

The roster includes only students with a current matching course registration and
an allocation to that exact venue, plus `attendance_status`. The server rejects a
roster request unless the caller has a published duty for that published exam and
venue. Do not use an exam-wide roster that exposes students assigned to another
venue.

Existing session actions remain `POST /api/invigilator/assignments/{exam}/{venue}/start`
and `/end`. Attendance lookup, check-in and summary views must remain scoped to the
authorized examination/venue. The server rejects wrong-venue attendance rather than
recording it as a successful check-in. Draft assignments are not operational duties.

## Shared Staff Inbox

`GET /api/examination-notifications` lists available notifications for the signed-in
student or staff member. `POST /api/examination-notifications/{id}/read` marks only
that account's notification as read. A published amendment can notify affected
students, current and previous invigilators, and course lecturers.

This is an in-application inbox only. It is not email or push delivery. Administrators
can inspect amendment notification states and retry inbox delivery without applying
the amendment again. A retry must not duplicate or reapply timetable changes.

## Frontend Acceptance Checks

- Administrator: drafts are visibly distinct from published periods; venue fills use
  examination capacity; publication blockers, shortages and revision are visible;
  published arrangements cannot be edited outside amendment review.
- Lecturer: only assigned-course published exams appear; counts show registered,
  allocated, unallocated and attended values; stale allocation records are surfaced;
  change requests leave placements unchanged.
- Student: only the signed-in student's eligible published exams and pass data appear;
  refreshing after an amendment shows the latest date, time and venue details.
- Invigilator: only published duties appear; roster access is venue-specific; attendance
  actions cannot check in a student at a different venue.
- Staff inbox: messages are account-scoped, read state is respected, and retrying a
  failed notification does not reapply an amendment.

For lecturer ownership details see [lecturer frontend API changes](lecturer-frontend-api-changes.md).
For existing invigilator assignment flows see [invigilator assignment hierarchy](invigilator-assignment-hierarchy.md).

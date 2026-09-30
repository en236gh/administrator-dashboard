# Administrator Dashboard: Exam Management

This guide covers the complete examination scheduling workflow for one active
Administrator account. After V38, no coordinator assignment, Scheduling Lead
permission, or approval by another Administrator is required.

## Entry Points

All period operations require `ADMINISTRATOR` authority and use the existing bearer
token.

| UI area | Endpoint | Use |
| --- | --- | --- |
| Operations overview | `GET /api/dashboard/admin` | Today's operational summary. Not the period-management source of truth. |
| Period list | `GET /api/admin/examination-periods` | List period cycle, dates, status, revision, and publication timestamp. |
| Period detail | `GET /api/admin/examination-periods/{id}` | Load schedule settings, courses, exams, bookings, allocations, assignments and review details. |
| Course catalogue | `GET /api/admin/examination-periods/{id}/courses?schoolId={schoolId}` | Load active courses and matching registered-student counts; `schoolId` is optional. |
| Venues | `GET /api/admin/examination-periods/venues` | Load venue details and verified `examination_capacity`. |
| Venue availability | `GET /api/admin/examination-periods/venue-unavailability` | Load blocked intervals. |
| Historical allocation audit | `GET /api/admin/examination-periods/allocation-audit` | Show legacy allocation rows needing review. |

The dashboard overview's `venueOccupancy` uses classroom capacity, not examination
seating capacity. Use period detail and venue `examination_capacity` for exam seating.

## Draft Workflow

1. Create a period with `POST /api/admin/examination-periods`. The body contains
   `name`, `semester`, `examType`, `startDate`, `endDate`,
   `daysOfWeek`, and `slots`. Dates and times use institution-local scheduling time.
   The backend sets `academic_year` from the latest student-registration year,
   independently of semester and exam dates. Omit `academicYear` from create and
   update requests. Existing periods retain their saved year. Show creation HTTP
   409 messages when registrations are missing or the latest year is malformed.
2. Configure venue examination capacities with
   `PUT /api/admin/examination-periods/venues/{venue}/capacity` and record blocked
   intervals with `POST /api/admin/examination-periods/venues/{venue}/unavailability`.
3. Select courses/durations with
   `PUT /api/admin/examination-periods/{id}/courses` using the latest `revision`.
4. Generate a draft with
   `POST /api/admin/examination-periods/{id}/generate` and
   `{ "revision": n, "searchLimit": 100000 }`.
5. Review generated dates, times, venues, allocations, unallocated students,
   conflicts and capacity. Generation does not publish.
6. If needed, edit a draft placement using
   `PUT /api/admin/examination-periods/{id}/exams/{session}/placement` with
   `{ "revision": n, "examDate": "YYYY-MM-DD", "startTime": "HH:mm",
   "venueIds": [1] }`. The server recalculates allocations and validates the draft.
7. Assign invigilators manually with
   `POST /api/admin/examination-periods/{id}/invigilators`, or generate them with
   `POST /api/admin/examination-periods/{id}/auto-assign-invigilators`. Review
   shortages and assignments. The separate administrator assignment APIs may also
   be used for eligible legacy/unmanaged examinations.
8. Load `GET /api/admin/examination-periods/{id}/validation`. Keep Publish disabled
   while `valid` is false and show every `problems` entry.
9. Publish explicitly with
   `POST /api/admin/examination-periods/{id}/publish` and
   `{ "revision": n }`. The backend validates again and publishes the period,
   exams and staffing atomically.

To replace a generated draft, use the explicit
`POST /api/admin/examination-periods/{id}/reset-draft` operation with the current
revision, then select courses or regenerate. Explain which draft data will be cleared
before the user confirms. Do not offer unpublish or ordinary post-publication edits.

## Change Requests

Use `GET /api/examination-change-requests?periodId={id}` to review all requests in a
period. Approve or reject with
`POST /api/examination-change-requests/{requestId}/decision` and
`{ "status": "APPROVED" | "REJECTED", "decision": "..." }`.
This only records a decision; it must not modify the timetable or imply that an
amendment has been applied.

Optional capacity-enquiry helpers are
`GET /api/examination-change-requests/capacity-lecturers?periodId={id}&courseCode={code}`
and `POST /api/examination-change-requests/capacity-draft`. The latter returns a
copyable draft only; it does not send email or change venue capacity.

## Published Amendments

The API base is `/api/admin/examination-periods/{period}/amendments`.

1. Propose an amendment with `POST` to the base path. Include `examSessionId`, the
   current `revision`, `examDate`, `startTime`, `reason`, and optionally `venueIds`
   and `duties` when changing the retained set.
2. Review the proposal and validation scope. The exam must be published, future,
   scheduled, and have no attendance, incident or generated-report records.
3. Explicitly approve or reject with `POST /{id}/decision` and
   `{ "status": "APPROVED" | "REJECTED", "reason": "..." }`. The same
   Administrator may approve their own proposal. Approval leaves the published
   timetable unchanged.
4. After approval, explicitly apply with `POST /{id}/apply`. Apply revalidates
   current slots, venue capacity, bookings, allocations, eligibility and staffing.
   On success, the period revision increments, before/after snapshots are stored,
   and notifications are queued.
5. Inspect delivery using `GET /{id}/notifications`. Retry failed inbox delivery
   with `POST /{id}/retry-notifications`. A retry does not apply the timetable change
   again and must not increment revision.

The API also exposes `GET /api/admin/examination-periods/{id}/history` for audit
history. Render amendment snapshots as before/after arrangements, not as a mutable
published timetable editor.

## Response and State Handling

- Period and JDBC-backed scheduling rows use snake_case field names. Requests use
  camelCase. Do not expect a `coordinator_staff_id` or coordinator capability flag
  in the period response.
- Use the returned latest `revision` after setup, selection, generation, placement,
  reset, publication, and applied amendments. Refresh detail after staffing or
  capacity changes before publishing.
- Generation outcomes include `COMPLETE`, `INVALID_INPUT`,
  `NO_FEASIBLE_ARRANGEMENT`, and `SEARCH_LIMIT_REACHED`. The last three can have
  `success: false` and useful response data; preserve and display it.
- Show `400` validation errors, `403` access errors, and `409` stale revision,
  validation, or locked-state conflicts distinctly. Never hide the server's blocker.
- Keep amendment approval and apply as separate actions. Retry notification is a
  third, delivery-only action.

## Acceptance Checks

- An ordinary active Administrator can create a period, configure courses, generate
  and edit a draft, staff it, resolve validation blockers, and publish without a
  period-owner assignment.
- Publication cannot proceed with validation problems; generation alone never
  publishes.
- The same Administrator can decide a Lecturer request and separately propose,
  approve, and apply a valid amendment.
- Applied amendments pass fresh validation, preserve eligibility restrictions,
  increment revision once, retain before/after records and notify affected users.
- Retrying notifications does not reapply the amendment or change revision.

## In-app Scheduling Guide

An eight-step popup opens automatically whenever an Administrator enters Exam
Management, covering setup, venues, courses, generation, allocation review,
staffing, validation and publication. No launch button is required. Closing the
popup or pressing Escape leaves the on-page guide active. Numbered steps and
Back / Next browse instructions; Open navigates to the relevant workflow tab.
The current step highlights that tab with a visible pointer. Previous step /
Next step on the instruction card let users continue while working.

Only explicitly choosing “I’m an expert” disables automatic guidance. This
preference is stored per Administrator email in this browser, persists across
logins, and can be reversed with Enable guided mode. Other browsers default to
guided mode. If browser storage is unavailable, guidance defaults on next visit.

Guide navigation never saves data or marks tasks complete. Publication still
requires successful validation and the explicit Publish timetable and staffing
action. Publication success is shown only from the period’s PUBLISHED status.
The native popup contains keyboard focus and supports Escape dismissal.

## Automatic Student Demand

Display course `eligible_students` and exam `registered_students` as “Registered
students / required seats”. These read-only counts include all registrations
matching course, saved academic year and semester for every exam type. Show
`allocated_students` separately and list `unallocatedStudents` for missing seats.
Course selection sends only the revision and course codes / durations.

Reload the catalogue after registration changes. Check status / reload also
refreshes a loaded catalogue. Generation and publication recheck registrations;
use the explicit draft reset / regeneration workflow when allocations no longer
match. Generation can split courses across rooms, but zero-student courses and
insufficient seating prevent a complete timetable. Venue examination capacity
remains an independently verified physical limit and is never set from demand.

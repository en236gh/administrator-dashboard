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

## Generate, Review and Publish

1. Load the academic-year default from
   `GET /api/admin/examination-periods/defaults` and display it as read-only. The administrator enters
   semester, exam type, dates, weekdays and daily slots.
2. **Generate schedule** calls `POST /api/admin/examination-periods` with
   `name`, `semester`, `examType`, `startDate`,
   `endDate`, `daysOfWeek`, and `slots`. The backend always uses the latest
   registration year and ignores client-supplied years. Always display the returned cycle.
3. One request discovers registered courses, schedules exams and venues, allocates
   students, and assigns available invigilators. Review timetable and staffing.
4. Show publication problems from `validation`; generation success alone does
   not authorize publication. Recheck with `GET /{id}/validation`.
5. Publish explicitly with `POST /{id}/publish` and `{"revision": n}`.
   Publication validates again and releases exams, allocations and duties together.

Creation and regeneration return `data.generation.result`,
`data.generation.period`, `data.staffing` and `data.validation`.
Preserve the returned period ID and revision even when generation fails.
Show generation diagnostics, validation problems and staffing
`understaffedVenueIds`. Disable mutations while a request is pending.
After a creation transport error, reload the list before retrying.

One schedule per academic year, semester and exam type can be created.
Open an existing schedule from the list to review or regenerate it; older
same-cycle records remain available.

## Corrections and Regeneration

Correct registrations, catalogue data, verified venue capacities or unavailable
intervals, then call `POST /{id}/generate` with
`{"revision": n, "searchLimit": 100000}`.
Successful regeneration replaces unpublished exams, allocations and staffing.
Failed searches preserve the existing timetable, course snapshot and revision.
Published or operational examinations cannot be regenerated.

Only empty setup records can be edited with `PUT /{id}?revision=n`.
Generated placements can be edited with `PUT /{id}/exams/{session}/placement`,
using `revision`, `examDate`, `startTime` and `venueIds`.
Staffing controls remain available to resolve shortages after staff data is fixed.
Automatic staffing is already part of generation.

The dashboard has no manual course-selection, exam-duration, draft-delete or
reset controls. Their obsolete mutation routes are not used.

Only active courses with registrations matching the exact academic year and
semester become exams. Counts are read-only; programme membership does not create
students or seats. The backend setting `app.scheduling.exam-duration-minutes`
controls duration (default 120, range 1–1440). Verified examination capacity
remains a physical venue limit. Generation never publishes.

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
- Use the returned latest `revision` after setup, generation, placement,
  publication, and applied amendments. Refresh detail after staffing or
  capacity changes before publishing.
- Generation outcomes include `COMPLETE`, `INVALID_INPUT`,
  `NO_FEASIBLE_ARRANGEMENT`, and `SEARCH_LIMIT_REACHED`. The last three can have
  `success: false` and useful response data; preserve and display it.
- Show `400` validation errors, `403` access errors, and `409` stale revision,
  validation, or locked-state conflicts distinctly. Never hide the server's blocker.
- Keep amendment approval and apply as separate actions. Retry notification is a
  third, delivery-only action.

## Acceptance Checks

- An ordinary active Administrator can generate a schedule, review
  and edit placements, resolve staffing shortages, resolve validation blockers, and publish without a
  period-owner assignment.
- Publication cannot proceed with validation problems; generation alone never
  publishes.
- The same Administrator can decide a Lecturer request and separately propose,
  approve, and apply a valid amendment.
- Applied amendments pass fresh validation, preserve eligibility restrictions,
  increment revision once, retain before/after records and notify affected users.
- Retrying notifications does not reapply the amendment or change revision.

## Workspace

The main workflow is Setup, Timetable, Staffing and Publish. Venues, Requests,
Amendments and Audit are supporting tools. Discovered courses and student
allocations are expandable read-only tables. There is no automatic guide popup.

Deploy this dashboard with the updated backend: creation/generation response
shapes and removed routes are breaking changes. This API update requires no new
schema migration; existing scheduling migrations and safeguards still apply.

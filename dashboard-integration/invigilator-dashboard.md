# Invigilator Dashboard

The Invigilator dashboard is limited to the signed-in invigilator's published duties.
Draft assignments are not operational duties. The bearer token determines the staff
account; the frontend must not select another invigilator's identity.

## Endpoints

| Endpoint | UI use |
| --- | --- |
| `GET /api/dashboard/invigilator` | Summary counts for published assigned examinations and venues. |
| `GET /api/invigilator/assignments` | This invigilator's published assignment list. |
| `GET /api/invigilator/assignments/{exam}/{venue}/students` | Venue-specific roster for an assigned published duty. |
| `POST /api/invigilator/assignments/{examSessionId}/{venueId}/start` | Start the assigned exam/venue session. |
| `POST /api/invigilator/assignments/{examSessionId}/{venueId}/end` | End the assigned exam/venue session. |
| `GET /api/exams/{examSessionId}/venues` | Read exam venues only where the authenticated role and exam access allow it. |
| `GET /api/examination-notifications` | Read available staff notices for this account. |
| `POST /api/examination-notifications/{id}/read` | Mark this account's available notice as read. |

JSON responses use the shared envelope. Assignment DTOs use camelCase and include
`examSessionId`, `courseCode`, `examDate`, `startTime`, `endTime`, `examStatus`,
`venueId`, `venueName`, `building`, `capacity`, and lecturer information where
available. Display dates and times as institution-local examination times.

## Roster and Attendance Scope

The roster endpoint returns only students who have both a current matching course
registration and an allocation to the exact requested venue. Rows include
`computerNumber`, `fullName`, `examSessionId`, `venueId`, and `attendanceStatus`.
The backend rejects roster access unless this invigilator has a published assignment
for that exact venue and the exam schedule is published.

Keep attendance lookup, check-in, summaries, and script collection scoped to the
assigned exam and venue using the existing attendance APIs. Never query an exam-wide
roster and filter it only in the browser. Wrong-venue attendance must remain rejected
by the backend; do not report it as a successful check-in. Preserve historical
attendance records as returned.

The dashboard summary fields are `assignedExaminations`, `assignedVenues`,
`checkedInStudents`, `absentStudents`, `scriptsCollected`, and `incidents`. Counts
reflect only the invigilator's published duty scope.

## UI Boundaries and States

- Do not show draft, unpublished or another invigilator's assignments.
- Only show a roster action for an assignment's exact exam and venue IDs.
- Treat `403` as an authorization boundary: clear the roster and any selected
  attendance state before displaying the error.
- Keep start/end actions tied to a specific assignment. Refresh assignment state
  after an action; do not optimistically mark unrelated venues started or ended.
- Clear account-specific roster and attendance data on logout/account change.
- Distinguish no assigned duties from a failed request.

## Acceptance Checks

- Only published duties for the signed-in invigilator are listed.
- A roster request for an unassigned venue is denied and no roster data remains shown.
- The roster excludes students without current matching registration or exact venue
  allocation.
- Attendance cannot be recorded as successful at a venue other than the assigned
  examination venue.

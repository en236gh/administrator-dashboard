# Shared Examination Inbox

The inbox displays in-application timetable amendment notices for the authenticated
account. It is not email or push delivery. The same endpoint is used by Administrator,
Lecturer, Student, and Invigilator dashboards; each account sees only its own messages.

## Endpoints

| Method and path | Behavior |
| --- | --- |
| `GET /api/examination-notifications` | List this account's available messages. |
| `POST /api/examination-notifications/{id}/read` | Mark this account's available message as read. |

Both use the existing bearer token and JSON response envelope. The list returns
`notification_id`, `message`, `available_at`, and `read_at`. The read route returns a
successful envelope with null data. A message that belongs to another account or is
not available is rejected; do not expose a global notification list or allow client
supplied recipient IDs.

Applied amendments may notify affected students, course lecturers, and current or
previous invigilators. Notification delivery states are `PENDING`, `AVAILABLE`, and
`FAILED`; retry attempts and delivery errors are visible only through Administrator
amendment management.

## UI Behavior

- Show only rows returned by the current authenticated session.
- Mark a row read using its notification ID, then refresh or update that row from the
  successful server response. Do not mark another account's notice optimistically.
- Keep unread/read state tied to `read_at`; do not treat delivery status as read state.
- After a timetable-change message, refresh the dashboard's authorized exam data.
  The notice itself is not the authoritative exam arrangement.
- Clear inbox rows on logout/account switch. Cache by account identity.
- Administrator retry is a separate management action. It retries inbox delivery for
  an already applied amendment and must never replay the timetable mutation.

## Acceptance Checks

- A user can list and mark read only their own available messages.
- An unread message becomes read after success; failed requests keep the previous
  server-confirmed state.
- Applying an amendment creates the expected affected-user notices, while retrying
  delivery does not apply it again or increment the period revision.

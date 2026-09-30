# Scheduling: automatic academic year and student demand

Backend changes only. No migration or database reset is required.

## Academic year

New periods use `max(student_registration.academic_year)` across all registrations,
independent of the selected semester. Years use `YYYY/YYYY`, so their lexical order
matches chronological order. This is the agreed source of the current year; future
year registrations will therefore make that year the default. The backend does not
infer the year from today's date or the examination dates.

- Remove the editable academic-year field and its required validation.
- Optionally call `GET /api/admin/examination-periods/defaults` to display the year
  before creation. It returns the standard envelope with `data.academicYear`.
- Omit `academicYear` from create and update bodies. Old clients may still send it;
  the backend ignores it, including a conflicting value.
- Read the authoritative saved year from `data.academic_year` in the period response.
  Creation reads registrations again, so the defaults response is only a preview.
- Editing an existing period preserves its saved year, including after registrations
  roll over. Existing periods are not migrated to another year.
- If registrations are empty or their latest year has an invalid format, defaults
  and creation return HTTP 409 with an explanatory message. Display that message;
  registrations must be loaded before scheduling.

Example `POST /api/admin/examination-periods` body (also used for
`PUT /api/admin/examination-periods/{id}?revision={revision}`):

```json
{
  "name": "Semester 1 final examinations",
  "semester": 1,
  "examType": "FINAL",
  "startDate": "2027-06-07",
  "endDate": "2027-06-18",
  "daysOfWeek": [1, 2, 3, 4, 5],
  "slots": [{"startTime": "09:00", "endTime": "12:00"}]
}
```

Semester, exam type, dates, weekdays, slots and course durations remain explicit
inputs. All these endpoints require the administrator role.

## Required examination seats

Do not ask administrators to enter an expected student count or a course/exam
capacity. Required seats are already calculated from **all** `student_registration`
rows matching the course, the period's saved academic year and selected semester.
No pass-generation or attendance requirement filters these students. The same
registration rule applies to FINAL, SUPPLEMENTARY and SPECIAL examinations.

Use the existing read-only response fields:

| View | Endpoint / response location | Required seats |
| --- | --- | --- |
| Course selection | `GET /api/admin/examination-periods/{id}/courses` | Each row's `eligible_students` |
| Selected courses | `GET /api/admin/examination-periods/{id}`, `data.courses` | `eligible_students` |
| Generated exams | Same detail endpoint, `data.exams` | `registered_students` |

Label these counts “Registered students / required seats”. Each generated exam also
returns `allocated_students`; show it separately and use `data.unallocatedStudents`
for missing allocations. Course selection still sends only `courseCode` and
`durationMinutes` per course, along with the current `revision`.

Generation automatically allocates every matching student and splits a large
course across rooms when necessary. Registration changes in a draft are checked
again on generation and publication. Refresh counts after changes and use the
existing draft regeneration workflow if allocations no longer match. Zero-student
courses and insufficient room capacity cannot produce a complete timetable.

A venue's `examination_capacity` is its physical examination seating limit. Keep
that separate from the number of students needing seats: never overwrite room
capacity with the course registration count. Existing venue setup and its capacity
endpoint remain available; unconfigured venues remain excluded from generation.

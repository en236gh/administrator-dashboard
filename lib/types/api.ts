export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
};

export type AdminDashboardStats = {
  todaysExaminations?: number;
  todaysExaminationDetails?: Examination[];
  presentStudents?: number;
  absentStudents?: number;
  attendancePercentage?: number;
  totalIncidents?: number;
  incidentsToday?: number;
  generatedReports?: number;
  venueOccupancy?: VenueOccupancy[];
};

export type VenueOccupancy = { examSessionId?: number; courseCode?: string; venueId?: number; venueName?: string; capacity?: number; allocatedStudents?: number; checkedInStudents?: number; occupancyPercentage?: number };
export type Examination = { examSessionId: number; courseCode: string; courseName?: string; examDate: string; startTime: string; endTime: string; academicYear?: string; semester?: string; examType?: string; status: string };
export type RegisteredStudent = { computerNumber: string; fullName: string; programme?: string; program?: string; yearOfStudy?: number | string; photoPath?: string | null; registrationStatus?: string };
export type ExamVenue = { venueId: number; venueName: string; building?: string; capacity?: number };
export type AllocationStatistics = { registeredStudents?: number; allocatedStudents?: number; totalVenueCapacity?: number; venueFills?: VenueOccupancy[]; allocations?: Array<{ computerNumber?: string; studentName?: string; venueName?: string; seatNumber?: string }> };
export type GeneratedReport = { reportId?: number; examSessionId?: number | { examSessionId?: number; courseCode?: string }; generatedBy?: unknown; title?: string; reportType?: string; filePath?: string; generatedAt?: string; summary?: string; [key: string]: unknown };
export type StaffAccountPayload = { fullName: string; email: string; phone: string; department: string; role: "LECTURER" | "INVIGILATOR" };
export type StaffAccount = StaffAccountPayload & { staffId?: number; accountStatus: "PENDING" | string; activationToken: string; expiresAt?: string };

export type InvigilatorAssignment = {
  examSessionId: number;
  venueId: number;
  staffId: number;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | string;
  notes?: string | null;
  staffName?: string;
  venueName?: string;
  courseCode?: string;
  assignedAt?: string;
};

export type VenueStaffing = {
  examSessionId: number;
  venueId: number;
  venueName?: string;
  allocatedStudentCount: number;
  requiredInvigilatorCount: number;
  assignedInvigilatorCount: number;
  draftInvigilatorCount: number;
  publishedInvigilatorCount: number;
  staffingStatus: "STAFFED" | "UNDERSTAFFED" | string;
  assignedInvigilators: Array<{
    staffId: number;
    staffName: string;
    assignmentStatus: "DRAFT" | "PUBLISHED" | string;
  }>;
  remainingInvigilators: Array<{
    staffId: number;
    staffName: string;
    assignmentStatus: "DRAFT" | "PUBLISHED" | null;
  }>;
  totalActiveInvigilatorCount: number;
  totalAssignedInvigilatorCount: number;
  totalRemainingInvigilatorCount: number;
};

export type AutoAssignResponse = {
  assignments?: InvigilatorAssignment[];
  createdDraftAssignments?: number;
  understaffedVenueIds?: number[];
};


export type AttendanceRecord = {
  computerNumber: string;
  studentName: string;
  venueName?: string;
  attendanceStatus: string;
  checkInTime?: string | null;
  seatNumber?: string | null;
  scriptsSubmitted?: boolean;
};

export type AttendanceSummary = {
  present?: number;
  absent?: number;
  wrongVenue?: number;
  scriptsCollected?: number;
  totalAllocated?: number;
  [key: string]: number | undefined;
};

export type IncidentType =
  | "CHEATING"
  | "PHONE_FOUND"
  | "WRONG_VENUE"
  | "MEDICAL_EMERGENCY"
  | "DISTURBANCE"
  | "LATE_ARRIVAL"
  | "OTHER";

export type IncidentSeverity = "MINOR" | "MAJOR" | "CRITICAL";


export type Incident = {
  incidentId: number;
  examSessionId?: number;
  venueId?: number;
  venueName?: string;
  courseCode?: string;
  computerNumber?: string | null;
  incidentType: IncidentType;
  description: string;
  severity: IncidentSeverity;
  evidencePath?: string | null;
  reportedAt?: string;
  status?: string;
};


export type SessionUser = {
  email: string;
  name: string;
  role: string;
};

export type AcademicSelection = { schoolId: number; programmeId: number; yearOfStudy: number; courseCode: string };
export type AssignmentInput = { selection: AcademicSelection; examSessionId: number; venueId: number; staffId: number; notes?: string };
export type AcademicSchool = { school_id: number; school_name?: string };
export type AcademicProgramme = { programme_id: number; programme_name?: string };
export type AcademicYear = { year_of_study: number };
export type AcademicCourse = { course_code: string; course_name?: string; semester: number | string };
export type AcademicExam = { exam_session_id: number; course_code: string; academic_year: string; semester: number | string; exam_date: string; exam_type: string; start_time?: string; end_time?: string; status?: string };

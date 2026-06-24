export type Department =
  | 'CSE'
  | 'ECE'
  | 'Mechanical'
  | 'Civil'
  | 'AIML'
  | 'MBA'
  | 'Mathematics'
  | 'Physics'
  | 'Chemistry'
  | 'Humanities'
  | 'Others';

export type Session = 'Forenoon' | 'Afternoon' | 'Full Day';

export interface ExamAllocation {
  id: string;
  facultyName: string;
  department: Department;
  date: string; // YYYY-MM-DD
  session: Session;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  } | Date | number | null;
  isUnassigned?: boolean;
  unassignedReason?: string;
  checkedLog?: string[];
}

export interface Faculty {
  id: string;
  name: string;
  department: Department;
  phone?: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  } | Date | number | null;
}

export interface DashboardStats {
  totalFaculty: number;
  todayCount: number;
  totalAllocations: number;
  departmentsCount: number;
}

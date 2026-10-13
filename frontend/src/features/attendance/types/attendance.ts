export interface OfficeSetting {
  id?: number;
  office_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  work_start_time: string;
  work_end_time: string;
  late_tolerance_minutes: number;
  is_active?: boolean;
  can_edit?: boolean;
  headquarters_location_id?: number | null;
}

export interface AttendanceLocation {
  id: number;
  tenant_id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  type: 'headquarters' | 'school' | 'branch' | 'other';
  is_active: boolean;
  distance_meters?: number;
  employee_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SchoolUnitOption {
  name: string;
  employee_count: number;
  is_configured: boolean;
  location_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
}

export interface Shift {
  id: number;
  company: 'all' | 'rbs' | 'rimamandiri';
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
  work_hours: number;
  cross_day: boolean;
  description?: string | null;
  is_active: boolean;
  formatted_time?: string;
  users_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string;
  attendance_type?: 'masuk' | 'libur' | 'dinas_luar';
  location_id?: number | null;
  location_name?: string | null;
  location?: AttendanceLocation | null;
  shift_id?: number | null;
  shift?: Shift | null;
  check_in_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_distance_meters: number | null;
  check_in_status: 'on_time' | 'late';
  check_out_time: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_distance_meters: number | null;
  photo_url?: string | null;
  photo_full_url?: string | null;
  status: 'present' | 'late' | 'absent' | 'holiday' | 'permit';
  notes: string | null;
  work_duration_minutes?: number | null;
  work_duration_formatted?: string | null;
  is_eight_hours_met?: boolean | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    nik?: string;
    position?: string;
    school_unit?: string;
    role: string;
    shift_id?: number | null;
    shift?: Shift | null;
  };
}

export interface TodayAttendanceData {
  today: string;
  server_time: string;
  attendance: AttendanceRecord | null;
  assigned_location: AttendanceLocation | null;
  is_location_locked?: boolean;
  assigned_shift?: Shift | null;
  available_shifts?: Shift[];
  is_admin_user?: boolean;
  is_admin_headquarters_enforced?: boolean;
  headquarters_location?: AttendanceLocation | null;
  total_locations: number;
  locations: AttendanceLocation[];
  office_setting: OfficeSetting;
}

export interface AttendanceSummary {
  date: string;
  sp_period?: string | null;
  company?: string;
  total_employees: number;
  total_present: number;
  total_business_trip?: number;
  total_holiday: number;
  total_on_time: number;
  total_late: number;
  total_not_checked_in: number;
  total_eight_hours_met?: number;
  avg_distance_meters: number;
}

export interface EmployeeRecapItem {
  user_id: number;
  name: string;
  nik?: string | null;
  email: string;
  company?: string | null;
  position?: string | null;
  school_unit?: string | null;
  total_records: number;
  total_present: number;
  total_on_time: number;
  total_late: number;
  total_business_trip: number;
  total_holiday: number;
  eight_hours_met_count: number;
  total_work_minutes: number;
  total_work_formatted: string;
}



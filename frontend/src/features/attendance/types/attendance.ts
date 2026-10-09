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
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string;
  check_in_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_distance_meters: number | null;
  check_in_status: 'on_time' | 'late';
  check_out_time: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_distance_meters: number | null;
  status: 'present' | 'late' | 'absent' | 'holiday' | 'permit';
  notes: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    nik?: string;
    position?: string;
    role: string;
  };
}

export interface TodayAttendanceData {
  today: string;
  server_time: string;
  attendance: AttendanceRecord | null;
  office_setting: OfficeSetting;
}

export interface AttendanceSummary {
  date: string;
  total_employees: number;
  total_present: number;
  total_on_time: number;
  total_late: number;
  total_not_checked_in: number;
  avg_distance_meters: number;
}

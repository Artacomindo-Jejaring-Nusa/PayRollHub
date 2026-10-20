import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  MapPin,
  Calendar,
  Users,
  Search,
  Download,
  Upload,
  Settings,
  CheckCircle2,
  AlertCircle,
  Building,
  Save,
  Compass,
  Crosshair,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  SunMedium,
  Briefcase,
  X,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Check,
  Camera,
  Car,
  Eye,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { api } from '../../../lib/api';
import { SP_PERIOD_LIST } from '../../../lib/period';
import { getStorageUrl } from '../../../lib/utils';
import { attendanceService } from '../services/attendanceService';
import { Pagination } from '../../../components/shared/Pagination';
import {
  AttendanceRecord,
  AttendanceSummary,
  OfficeSetting,
  AttendanceLocation,
  SchoolUnitOption,
  EmployeeRecapItem,
  Shift,
} from '../types/attendance';

export const AdminAttendancePage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'recap' | 'locations' | 'shifts' | 'settings'>('recap');

  // Recap & Filter State
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [filterType, setFilterType] = useState<'sp' | 'daily'>('daily');
  const [selectedSp, setSelectedSp] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<string | null>(null);

  // Pagination State Presensi Detail (Log Detail)
  const [attendancePage, setAttendancePage] = useState<number>(1);
  const [attendancePerPage, setAttendancePerPage] = useState<number>(25);
  const [attendanceMeta, setAttendanceMeta] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  }>({
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
    from: 0,
    to: 0,
  });

  // Point 6: Rekapitulasi per Karyawan (SP 1-9)
  const [recapViewMode, setRecapViewMode] = useState<'detail' | 'employee_recap'>('detail');
  const [employeeRecapData, setEmployeeRecapData] = useState<EmployeeRecapItem[]>([]);
  const [employeeRecapLoading, setEmployeeRecapLoading] = useState<boolean>(false);
  const [employeeRecapPage, setEmployeeRecapPage] = useState<number>(1);
  const [employeeRecapPerPage, setEmployeeRecapPerPage] = useState<number>(25);

  // Point 13: Pemilihan Karyawan untuk Laporan Absensi Berdasarkan SP
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

  const handleToggleSelectEmployee = (userId: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleSelectAllRecap = () => {
    const allIds = employeeRecapData.map((e) => e.user_id);
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedEmployeeIds.includes(id));
    if (isAllSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleToggleSelectAllDetail = () => {
    const pageUserIds = Array.from(new Set(attendances.map((a) => a.user_id).filter(Boolean))) as number[];
    const isAllSelected = pageUserIds.length > 0 && pageUserIds.every((id) => selectedEmployeeIds.includes(id));
    if (isAllSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !pageUserIds.includes(id)));
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...pageUserIds])));
    }
  };

  const handleClearSelectedEmployees = () => {
    setSelectedEmployeeIds([]);
  };

  // Point 7: Edit Absensi Karyawan
  const [editAttendanceModalOpen, setEditAttendanceModalOpen] = useState<boolean>(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState<{
    date: string;
    attendance_type: 'masuk' | 'dinas_luar' | 'libur' | 'sakit' | 'izin';
    location_name: string;
    check_in_time: string;
    check_in_status: 'on_time' | 'late';
    check_out_time: string;
    status: 'present' | 'late' | 'holiday' | 'absent' | 'permit';
    notes: string;
  }>({
    date: '',
    attendance_type: 'masuk',
    location_name: '',
    check_in_time: '',
    check_in_status: 'on_time',
    check_out_time: '',
    status: 'present',
    notes: '',
  });
  const [editSaving, setEditSaving] = useState<boolean>(false);

  // Point 15: Verifikasi Pengajuan Sakit / Izin (Upload Surat Dokter / Izin)
  const [verifyModalOpen, setVerifyModalOpen] = useState<boolean>(false);
  const [verifyingAttendance, setVerifyingAttendance] = useState<AttendanceRecord | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);

  // Point 7: Input Presensi Manual Karyawan
  const [createAttendanceModalOpen, setCreateAttendanceModalOpen] = useState<boolean>(false);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState<{
    user_id: number | '';
    date: string;
    attendance_type: 'masuk' | 'dinas_luar' | 'libur' | 'sakit' | 'izin';
    location_name: string;
    check_in_time: string;
    check_in_status: 'on_time' | 'late';
    check_out_time: string;
    status: 'present' | 'late' | 'holiday' | 'absent' | 'permit';
    notes: string;
  }>({
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    attendance_type: 'masuk',
    location_name: '',
    check_in_time: '08:00',
    check_in_status: 'on_time',
    check_out_time: '17:00',
    status: 'present',
    notes: '',
  });
  const [createSaving, setCreateSaving] = useState<boolean>(false);

  // Point 7: Hapus Absensi
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState<boolean>(false);
  const [deletingAttendance, setDeletingAttendance] = useState<AttendanceRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // Locations State (100+ Titik Radius)
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [locationSearch, setLocationSearch] = useState<string>('');
  const [locationTypeFilter, setLocationTypeFilter] = useState<string>('all');
  const [locationsLoading, setLocationsLoading] = useState<boolean>(false);
  const [locationPage, setLocationPage] = useState<number>(1);
  const [locationPerPage, setLocationPerPage] = useState<number>(25);
  const [locationMeta, setLocationMeta] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  }>({
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
    from: 0,
    to: 0,
  });
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<Partial<AttendanceLocation> | null>(null);
  const [modalSaving, setModalSaving] = useState<boolean>(false);

  // School Units & Auto Sync State
  const [schoolUnitOptions, setSchoolUnitOptions] = useState<SchoolUnitOption[]>([]);
  const [syncingSchools, setSyncingSchools] = useState<boolean>(false);

  // Manual Assign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [selectedLocationForAssign, setSelectedLocationForAssign] = useState<AttendanceLocation | null>(null);
  const [assignEmployeesData, setAssignEmployeesData] = useState<{
    location: AttendanceLocation;
    assigned_employees: any[];
    all_employees: any[];
  } | null>(null);
  const [assignLoading, setAssignLoading] = useState<boolean>(false);
  const [assignSaving, setAssignSaving] = useState<boolean>(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [assignSearch, setAssignSearch] = useState<string>('');

  // Import / Export & Clear All State
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [clearLoading, setClearLoading] = useState<boolean>(false);
  const [templateDownloading, setTemplateDownloading] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [exportingAttendanceType, setExportingAttendanceType] = useState<'xlsx' | 'csv' | null>(null);

  // Point 9: Shift Management State (Multi-tenant Riama & Rimbun)
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false);
  const [shiftFilterCompany, setShiftFilterCompany] = useState<string>('all');

  // Daftar Karyawan & Filter Shift
  const [shiftEmployees, setShiftEmployees] = useState<any[]>([]);
  const [shiftEmployeesLoading, setShiftEmployeesLoading] = useState<boolean>(false);
  const [shiftEmployeeSearch, setShiftEmployeeSearch] = useState<string>('');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [shiftEmployeePage, setShiftEmployeePage] = useState<number>(1);
  const [shiftEmployeePerPage, setShiftEmployeePerPage] = useState<number>(25);
  const [shiftEmployeeMeta, setShiftEmployeeMeta] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  }>({
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
    from: 0,
    to: 0,
  });

  // Checklist Karyawan untuk Penugasan Shift Massal
  const [selectedShiftUserIds, setSelectedShiftUserIds] = useState<number[]>([]);

  // Modal Master Shift (Tambah / Edit)
  const [shiftModalOpen, setShiftModalOpen] = useState<boolean>(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftModalSaving, setShiftModalSaving] = useState<boolean>(false);
  const [shiftForm, setShiftForm] = useState<{
    company: 'all' | 'rbs' | 'rimamandiri';
    name: string;
    code: string;
    start_time: string;
    end_time: string;
    late_tolerance_minutes: number;
    work_hours: number;
    cross_day: boolean;
    description: string;
    is_active: boolean;
  }>({
    company: 'all',
    name: '',
    code: '',
    start_time: '08:00',
    end_time: '17:00',
    late_tolerance_minutes: 15,
    work_hours: 8,
    cross_day: false,
    description: '',
    is_active: true,
  });

  // Modal Penugasan Shift
  const [assignShiftModalOpen, setAssignShiftModalOpen] = useState<boolean>(false);
  const [assignTargetShiftId, setAssignTargetShiftId] = useState<number | ''>('');
  const [assignShiftMode, setAssignShiftMode] = useState<'selected' | 'school_unit' | 'company'>('selected');
  const [assignTargetSchoolUnit, setAssignTargetSchoolUnit] = useState<string>('');
  const [assignTargetCompany, setAssignTargetCompany] = useState<string>('all');
  const [assignShiftSaving, setAssignShiftSaving] = useState<boolean>(false);

  // Modal Hapus Shift
  const [deleteShiftModalOpen, setDeleteShiftModalOpen] = useState<boolean>(false);
  const [deletingShift, setDeletingShift] = useState<Shift | null>(null);
  const [deleteShiftSaving, setDeleteShiftSaving] = useState<boolean>(false);

  // Settings State
  const [settings, setSettings] = useState<OfficeSetting | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [gpsDetecting, setGpsDetecting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch Attendance Records & Summary (Point 6: SP 1-9 & Harian)
  const fetchRecap = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        status: statusFilter,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        search: searchQuery || undefined,
        page: attendancePage,
        per_page: attendancePerPage,
      };
      if (filterType === 'sp') {
        params.sp_period = selectedSp;
      } else {
        params.date = selectedDate;
      }

      const [listRes, sumRes] = await Promise.allSettled([
        attendanceService.getAdminAttendances(params),
        attendanceService.getAdminSummary(
          filterType === 'daily' ? selectedDate : undefined,
          filterType === 'sp' ? selectedSp : undefined,
          roleFilter !== 'all' ? roleFilter : undefined
        ),
      ]);
      if (listRes.status === 'fulfilled') {
        const val = listRes.value;
        const items = Array.isArray(val) ? val : (val?.data || []);
        setAttendances(items);
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          setAttendanceMeta({
            current_page: val.current_page || attendancePage,
            last_page: val.last_page || 1,
            per_page: val.per_page || attendancePerPage,
            total: val.total ?? items.length,
            from: val.from ?? (items.length > 0 ? (attendancePage - 1) * attendancePerPage + 1 : 0),
            to: val.to ?? (items.length > 0 ? (attendancePage - 1) * attendancePerPage + items.length : 0),
          });
        } else {
          setAttendanceMeta({
            current_page: 1,
            last_page: 1,
            per_page: items.length || attendancePerPage,
            total: items.length,
            from: items.length > 0 ? 1 : 0,
            to: items.length,
          });
        }
      }
      if (sumRes.status === 'fulfilled') {
        setSummary(sumRes.value);
      }
    } catch (err: any) {
      console.error('Error fetching recap:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType, selectedSp, selectedDate, statusFilter, roleFilter, searchQuery, attendancePage, attendancePerPage]);

  // Reset page to 1 on filter changes
  useEffect(() => {
    setAttendancePage(1);
  }, [filterType, selectedSp, selectedDate, statusFilter, roleFilter, searchQuery]);

  useEffect(() => {
    setEmployeeRecapPage(1);
  }, [selectedSp, roleFilter, searchQuery]);

  // Point 6: Rekapitulasi Presensi per Karyawan
  const fetchEmployeeRecap = useCallback(async () => {
    try {
      setEmployeeRecapLoading(true);
      const res = await attendanceService.getRecapByEmployee({
        sp_period: selectedSp,
        search: searchQuery || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      });
      setEmployeeRecapData(res.items || []);
    } catch (err: any) {
      console.error('Error fetching employee recap:', err);
    } finally {
      setEmployeeRecapLoading(false);
    }
  }, [selectedSp, roleFilter, searchQuery]);

  const paginatedEmployeeRecap = useMemo(() => {
    const start = (employeeRecapPage - 1) * employeeRecapPerPage;
    return employeeRecapData.slice(start, start + employeeRecapPerPage);
  }, [employeeRecapData, employeeRecapPage, employeeRecapPerPage]);

  useEffect(() => {
    if (activeTab === 'recap') {
      fetchRecap();
      if (recapViewMode === 'employee_recap') {
        fetchEmployeeRecap();
      }
    }
  }, [activeTab, fetchRecap, recapViewMode, fetchEmployeeRecap]);

  // Point 7: Handlers untuk CRUD Presensi Manual & Edit
  const handleOpenCreateAttendance = async (defaultUserId?: number) => {
    setCreateForm({
      user_id: defaultUserId || '',
      date: filterType === 'daily' ? selectedDate : new Date().toISOString().split('T')[0],
      attendance_type: 'masuk',
      location_name: '',
      check_in_time: '08:00',
      check_in_status: 'on_time',
      check_out_time: '17:00',
      status: 'present',
      notes: '',
    });
    setCreateAttendanceModalOpen(true);

    if (allEmployees.length === 0) {
      try {
        const res = await api.get('/users', { params: { per_page: 500 } });
        const list = res.data?.data || [];
        setAllEmployees(list.filter((u: any) => u.role !== 'admin' && u.role !== 'super_admin'));
      } catch (err) {
        console.error('Failed to load employee list', err);
      }
    }
  };

  const handleSaveCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.user_id) {
      alert('Silakan pilih karyawan terlebih dahulu.');
      return;
    }
    try {
      setCreateSaving(true);
      await attendanceService.createAdminAttendance({
        user_id: Number(createForm.user_id),
        date: createForm.date,
        attendance_type: createForm.attendance_type,
        location_name: createForm.location_name || undefined,
        check_in_time: createForm.check_in_time ? `${createForm.check_in_time}:00` : null,
        check_in_status: createForm.check_in_status,
        check_out_time: createForm.check_out_time ? `${createForm.check_out_time}:00` : null,
        status: createForm.status,
        notes: createForm.notes || undefined,
      });
      setNotification({ text: 'Presensi manual karyawan berhasil disimpan!', type: 'success' });
      setCreateAttendanceModalOpen(false);
      fetchRecap();
      if (recapViewMode === 'employee_recap') fetchEmployeeRecap();
    } catch (err: any) {
      setNotification({ text: err.response?.data?.message || 'Gagal menambahkan presensi.', type: 'error' });
    } finally {
      setCreateSaving(false);
    }
  };

  const handleOpenEditAttendance = (att: AttendanceRecord) => {
    setEditingAttendance(att);
    setEditForm({
      date: att.date ? String(att.date).slice(0, 10) : '',
      attendance_type: att.attendance_type || 'masuk',
      location_name: att.location_name || att.location?.name || '',
      check_in_time: att.check_in_time ? att.check_in_time.slice(0, 5) : '',
      check_in_status: att.check_in_status || 'on_time',
      check_out_time: att.check_out_time ? att.check_out_time.slice(0, 5) : '',
      status: att.status || 'present',
      notes: att.notes || '',
    });
    setEditAttendanceModalOpen(true);
  };

  const handleSaveEditAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance) return;
    try {
      setEditSaving(true);
      await attendanceService.updateAdminAttendance(editingAttendance.id, {
        date: editForm.date,
        attendance_type: editForm.attendance_type,
        location_name: editForm.location_name || undefined,
        check_in_time: editForm.check_in_time ? `${editForm.check_in_time}:00` : null,
        check_in_status: editForm.check_in_status,
        check_out_time: editForm.check_out_time ? `${editForm.check_out_time}:00` : null,
        status: editForm.status,
        notes: editForm.notes || undefined,
      });
      setNotification({ text: `Data presensi untuk '${editingAttendance.user?.name || 'Karyawan'}' berhasil diperbarui!`, type: 'success' });
      setEditAttendanceModalOpen(false);
      setEditingAttendance(null);
      fetchRecap();
      if (recapViewMode === 'employee_recap') fetchEmployeeRecap();
    } catch (err: any) {
      setNotification({ text: err.response?.data?.message || 'Gagal menyimpan perubahan.', type: 'error' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenDeleteAttendance = (att: AttendanceRecord) => {
    setDeletingAttendance(att);
    setDeleteConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAttendance) return;
    try {
      setDeleteLoading(true);
      await attendanceService.deleteAdminAttendance(deletingAttendance.id);
      setNotification({ text: 'Data presensi berhasil dihapus.', type: 'success' });
      setDeleteConfirmModalOpen(false);
      setDeletingAttendance(null);
      fetchRecap();
      if (recapViewMode === 'employee_recap') fetchEmployeeRecap();
    } catch (err: any) {
      setNotification({ text: err.response?.data?.message || 'Gagal menghapus data.', type: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Point 15: Handlers Verifikasi Surat Sakit / Izin
  const handleOpenVerifyModal = (att: AttendanceRecord) => {
    setVerifyingAttendance(att);
    setRejectionReasonInput(att.rejection_reason || '');
    setVerifyModalOpen(true);
  };

  const handleExecuteVerification = async (action: 'approved' | 'rejected') => {
    if (!verifyingAttendance) return;
    if (action === 'rejected' && !rejectionReasonInput.trim()) {
      alert('Harap isi alasan penolakan surat keterangan ini.');
      return;
    }
    try {
      setVerifyLoading(true);
      const res = await attendanceService.verifyAttendance(verifyingAttendance.id, {
        approval_status: action,
        rejection_reason: action === 'rejected' ? rejectionReasonInput.trim() : undefined,
      });
      setNotification({
        text: res.message || (action === 'approved' ? 'Surat berhasil disetujui.' : 'Surat berhasil ditolak.'),
        type: 'success',
      });
      setVerifyModalOpen(false);
      setVerifyingAttendance(null);
      fetchRecap();
      if (recapViewMode === 'employee_recap') fetchEmployeeRecap();
    } catch (err: any) {
      setNotification({
        text: err.response?.data?.message || 'Gagal memproses verifikasi surat.',
        type: 'error',
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  // Fetch Locations (100+ Lokasi) with Pagination
  const fetchLocations = useCallback(async () => {
    try {
      setLocationsLoading(true);
      const res = await attendanceService.getAdminLocations({
        search: locationSearch || undefined,
        type: locationTypeFilter !== 'all' ? locationTypeFilter : undefined,
        page: locationPage,
        per_page: locationPerPage,
      });
      setLocations(res.data || []);
      if (res.meta) {
        setLocationMeta({
          current_page: res.meta.current_page || 1,
          last_page: res.meta.last_page || 1,
          per_page: res.meta.per_page || locationPerPage,
          total: res.meta.total ?? 0,
          from: res.meta.from ?? (res.data.length > 0 ? (res.meta.current_page - 1) * locationPerPage + 1 : 0),
          to: res.meta.to ?? (res.data.length > 0 ? (res.meta.current_page - 1) * locationPerPage + res.data.length : 0),
        });
      }
    } catch (err: any) {
      console.error('Error fetching locations:', err);
    } finally {
      setLocationsLoading(false);
    }
  }, [locationSearch, locationTypeFilter, locationPage, locationPerPage]);

  // Reset page to 1 when search query or type filter changes
  useEffect(() => {
    setLocationPage(1);
  }, [locationSearch, locationTypeFilter]);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const data = await attendanceService.getSettings();
      setSettings(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Fetch School Units (Daftar unit sekolah unik dari data gaji & users)
  const fetchSchoolUnits = useCallback(async () => {
    try {
      const data = await attendanceService.getSchoolUnits();
      setSchoolUnitOptions(data || []);
    } catch (err: any) {
      console.error('Error fetching school units:', err);
    }
  }, []);

  // ==========================================
  // SHIFT MANAGEMENT HANDLERS (POINT 9)
  // ==========================================
  const fetchShifts = useCallback(async () => {
    try {
      setShiftsLoading(true);
      const data = await attendanceService.getShifts(
        isSuperAdmin ? (shiftFilterCompany === 'all' ? undefined : shiftFilterCompany) : undefined
      );
      setShifts(data || []);
    } catch (err: any) {
      console.error('Error fetching shifts:', err);
    } finally {
      setShiftsLoading(false);
    }
  }, [isSuperAdmin, shiftFilterCompany]);

  const fetchShiftEmployees = useCallback(async () => {
    try {
      setShiftEmployeesLoading(true);
      const res = await attendanceService.getShiftEmployees({
        search: shiftEmployeeSearch || undefined,
        shift_id: selectedShiftFilter === 'all' ? undefined : selectedShiftFilter,
        school_unit: selectedUnitFilter === 'all' ? undefined : selectedUnitFilter,
        company: isSuperAdmin ? (shiftFilterCompany === 'all' ? undefined : shiftFilterCompany) : undefined,
        page: shiftEmployeePage,
        per_page: shiftEmployeePerPage,
      });
      setShiftEmployees(res.data || []);
      setShiftEmployeeMeta({
        current_page: res.current_page || 1,
        last_page: res.last_page || 1,
        per_page: shiftEmployeePerPage,
        total: res.total || 0,
        from: (res as any).from ?? 0,
        to: (res as any).to ?? 0,
      });
    } catch (err: any) {
      console.error('Error fetching shift employees:', err);
    } finally {
      setShiftEmployeesLoading(false);
    }
  }, [
    shiftEmployeeSearch,
    selectedShiftFilter,
    selectedUnitFilter,
    isSuperAdmin,
    shiftFilterCompany,
    shiftEmployeePage,
    shiftEmployeePerPage,
  ]);

  // Reset shift employee page on filter changes
  useEffect(() => {
    setShiftEmployeePage(1);
  }, [shiftEmployeeSearch, selectedShiftFilter, selectedUnitFilter, shiftFilterCompany]);

  // Handlers untuk Master Shift
  const handleOpenCreateShift = () => {
    setEditingShift(null);
    const userComp = (currentUser?.company || 'rbs').toLowerCase();
    const defaultComp = (userComp.includes('riama') || userComp.includes('rimamandiri')) ? 'rimamandiri' : 'rbs';
    setShiftForm({
      company: isSuperAdmin ? (shiftFilterCompany === 'all' ? defaultComp : (shiftFilterCompany as any)) : (defaultComp as any),
      name: '',
      code: '',
      start_time: '08:00',
      end_time: '17:00',
      late_tolerance_minutes: 15,
      work_hours: 8,
      cross_day: false,
      description: '',
      is_active: true,
    });
    setShiftModalOpen(true);
  };

  const handleOpenEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftForm({
      company: shift.company,
      name: shift.name,
      code: shift.code,
      start_time: shift.start_time.substring(0, 5),
      end_time: shift.end_time.substring(0, 5),
      late_tolerance_minutes: shift.late_tolerance_minutes,
      work_hours: shift.work_hours,
      cross_day: shift.cross_day,
      description: shift.description || '',
      is_active: shift.is_active,
    });
    setShiftModalOpen(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setShiftModalSaving(true);
      if (editingShift) {
        await attendanceService.updateShift(editingShift.id, shiftForm);
        setNotification({
          text: `Shift '${shiftForm.name}' berhasil diperbarui.`,
          type: 'success',
        });
      } else {
        await attendanceService.createShift(shiftForm);
        setNotification({
          text: `Master shift baru '${shiftForm.name}' (${shiftForm.code}) berhasil ditambahkan.`,
          type: 'success',
        });
      }
      setShiftModalOpen(false);
      fetchShifts();
      fetchShiftEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan shift.');
    } finally {
      setShiftModalSaving(false);
    }
  };

  const handleOpenDeleteShift = (shift: Shift) => {
    setDeletingShift(shift);
    setDeleteShiftModalOpen(true);
  };

  const handleConfirmDeleteShift = async () => {
    if (!deletingShift) return;
    try {
      setDeleteShiftSaving(true);
      const res = await attendanceService.deleteShift(deletingShift.id);
      setNotification({
        text: res.message || `Shift '${deletingShift.name}' berhasil diproses.`,
        type: 'success',
      });
      setDeleteShiftModalOpen(false);
      setDeletingShift(null);
      fetchShifts();
      fetchShiftEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus shift.');
    } finally {
      setDeleteShiftSaving(false);
    }
  };

  // Handlers Penugasan Shift
  const handleOpenAssignShiftModal = (userIds?: number[]) => {
    if (userIds && userIds.length > 0) {
      setSelectedShiftUserIds(userIds);
      setAssignShiftMode('selected');
    } else if (selectedShiftUserIds.length > 0) {
      setAssignShiftMode('selected');
    } else {
      setAssignShiftMode('school_unit');
    }
    setAssignTargetShiftId(shifts[0]?.id || '');
    setAssignShiftModalOpen(true);
  };

  const handleSaveAssignShift = async () => {
    if (!assignTargetShiftId) {
      alert('Silakan pilih Shift tujuan.');
      return;
    }
    try {
      setAssignShiftSaving(true);
      const payload: any = {
        shift_id: Number(assignTargetShiftId),
      };

      if (assignShiftMode === 'selected') {
        if (selectedShiftUserIds.length === 0) {
          alert('Pilih minimal satu karyawan untuk ditugaskan shift.');
          return;
        }
        payload.user_ids = selectedShiftUserIds;
      } else if (assignShiftMode === 'school_unit') {
        if (!assignTargetSchoolUnit) {
          alert('Pilih unit sekolah tujuan.');
          return;
        }
        payload.school_unit = assignTargetSchoolUnit;
        if (isSuperAdmin && assignTargetCompany !== 'all') {
          payload.company = assignTargetCompany;
        }
      } else if (assignShiftMode === 'company') {
        payload.company = assignTargetCompany;
      }

      const res = await attendanceService.assignShift(payload);
      setNotification({
        text: res.message || 'Penugasan shift berhasil diperbarui.',
        type: 'success',
      });
      setAssignShiftModalOpen(false);
      setSelectedShiftUserIds([]);
      fetchShifts();
      fetchShiftEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menerapkan penugasan shift.');
    } finally {
      setAssignShiftSaving(false);
    }
  };

  const handleQuickAssignSingle = async (userId: number, shiftId: number) => {
    try {
      await attendanceService.assignShift({
        shift_id: shiftId,
        user_ids: [userId],
      });
      setNotification({
        text: 'Shift karyawan berhasil diperbarui.',
        type: 'success',
      });
      fetchShifts();
      fetchShiftEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memperbarui shift karyawan.');
    }
  };

  const handleToggleSelectShiftEmployee = (userId: number) => {
    setSelectedShiftUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleSelectAllShiftEmployees = () => {
    const pageUserIds = shiftEmployees.map((e) => e.id);
    const isAllSelected = pageUserIds.length > 0 && pageUserIds.every((id) => selectedShiftUserIds.includes(id));
    if (isAllSelected) {
      setSelectedShiftUserIds((prev) => prev.filter((id) => !pageUserIds.includes(id)));
    } else {
      setSelectedShiftUserIds((prev) => Array.from(new Set([...prev, ...pageUserIds])));
    }
  };

  useEffect(() => {
    if (activeTab === 'recap') {
      fetchRecap();
    } else if (activeTab === 'locations') {
      fetchLocations();
      fetchSchoolUnits();
    } else if (activeTab === 'shifts') {
      fetchShifts();
      fetchShiftEmployees();
      fetchSchoolUnits();
    } else {
      fetchSettings();
    }
  }, [activeTab, fetchRecap, fetchLocations, fetchSchoolUnits, fetchShifts, fetchShiftEmployees, fetchSettings]);

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setSettingsSaving(true);
      setNotification(null);
      const res = await attendanceService.updateSettings(settings);
      setSettings(res);
      setNotification({
        text: 'Pengaturan lokasi kantor & batas radius absensi berhasil disimpan.',
        type: 'success',
      });
    } catch (err: any) {
      setNotification({
        text: err.response?.data?.message || 'Gagal menyimpan pengaturan absensi.',
        type: 'error',
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  // Use Current Admin GPS Position for Office Settings
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung geolokasi GPS.');
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsDetecting(false);
        if (settings) {
          setSettings({
            ...settings,
            latitude: Number(pos.coords.latitude.toFixed(7)),
            longitude: Number(pos.coords.longitude.toFixed(7)),
          });
        }
      },
      (err) => {
        setGpsDetecting(false);
        alert('Gagal mengambil lokasi GPS: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Handle Clear All Locations
  const handleClearAllLocations = async () => {
    if (
      !window.confirm(
        'PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA titik lokasi absensi untuk perusahaan ini? Tindakan ini akan mengosongkan tabel lokasi agar Anda dapat mengimpor data yang benar dari file Excel/CSV.'
      )
    ) {
      return;
    }

    try {
      setClearLoading(true);
      setNotification(null);
      const res = await attendanceService.clearAllLocations();
      setNotification({
        text: res.message || 'Semua data lokasi berhasil dibersihkan.',
        type: 'success',
      });
      fetchLocations();
    } catch (err: any) {
      setNotification({
        text: err.response?.data?.message || 'Gagal membersihkan data lokasi.',
        type: 'error',
      });
    } finally {
      setClearLoading(false);
    }
  };

  // Handle File Selection and Automatic Preview
  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setImportFile(null);
      setPreviewData(null);
      setImportResult(null);
      return;
    }

    setImportFile(file);
    setImportResult(null);
    setPreviewData(null);
    try {
      setPreviewLoading(true);
      const res = await attendanceService.previewImportLocations(file);
      setPreviewData(res);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal membaca pratinjau file. Pastikan format spreadsheet sesuai template.');
      setImportFile(null);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleResetImport = () => {
    setImportFile(null);
    setPreviewData(null);
    setImportResult(null);
  };

  // Handle Import Excel/CSV Submit
  const handleImportSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!importFile) {
      alert('Pilih file Excel (.xlsx) atau CSV (.csv) terlebih dahulu.');
      return;
    }

    try {
      setImportLoading(true);
      const res = await attendanceService.importLocations(importFile);
      setImportResult(res.data);
      setNotification({
        text: res.message || 'Import data lokasi selesai.',
        type: 'success',
      });
      fetchLocations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengimpor file lokasi.');
    } finally {
      setImportLoading(false);
    }
  };

  // Handle Download Location Template (.xlsx) via Authenticated Blob
  const handleDownloadLocationTemplate = async () => {
    try {
      setTemplateDownloading(true);
      await attendanceService.downloadLocationTemplate();
    } catch (err: any) {
      console.error('Error downloading template:', err);
      // Fallback: buka link template publik jika ada kendala
      window.open(attendanceService.downloadLocationTemplateUrl(), '_blank');
    } finally {
      setTemplateDownloading(false);
    }
  };

  // Handle Export Locations (.csv) via Authenticated Blob
  const handleExportLocations = async () => {
    try {
      setExportLoading(true);
      await attendanceService.exportLocations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengekspor data lokasi.');
    } finally {
      setExportLoading(false);
    }
  };

  // Handle Export Rekap Absensi (.xlsx / .csv) sesuai filter aktif via Authenticated Blob
  const handleExportAttendance = async (format: 'xlsx' | 'csv') => {
    try {
      setExportingAttendanceType(format);
      await attendanceService.downloadAttendanceExport({
        format,
        mode: recapViewMode,
        sp_period: filterType === 'sp' ? selectedSp : undefined,
        date: filterType === 'daily' ? selectedDate : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        search: searchQuery.trim() || undefined,
        user_ids: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : undefined,
      });
    } catch (err: any) {
      console.error('Error exporting attendance report:', err);
      alert(err.response?.data?.message || 'Gagal mengekspor laporan absensi.');
    } finally {
      setExportingAttendanceType(null);
    }
  };

  // Open Modal Tambah/Edit Lokasi Manual
  const handleOpenAddLocation = () => {
    setEditingLocation({
      name: '',
      code: '',
      address: '',
      latitude: -6.2088000,
      longitude: 106.8456000,
      radius_meters: 100,
      type: 'school',
      is_active: true,
    });
    setLocationModalOpen(true);
  };

  const handleOpenEditLocation = (loc: AttendanceLocation) => {
    if (loc.type === 'headquarters' && !isSuperAdmin) {
      alert('Lokasi Kantor Pusat hanya dapat diubah oleh Super Admin melalui tab Pengaturan atau Master Lokasi.');
      return;
    }
    setEditingLocation({ ...loc });
    setLocationModalOpen(true);
  };

  // Save Modal Location (Create/Update Manual)
  const handleSaveModalLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !editingLocation.name) return;

    if (editingLocation.type === 'headquarters' && !isSuperAdmin) {
      alert('Hanya Super Admin yang berhak membuat atau memperbarui titik lokasi Kantor Pusat.');
      return;
    }

    try {
      setModalSaving(true);
      if (editingLocation.id) {
        await attendanceService.updateLocation(editingLocation.id, editingLocation);
      } else {
        await attendanceService.createLocation(editingLocation);
      }
      setLocationModalOpen(false);
      setEditingLocation(null);
      fetchLocations();
      setNotification({
        text: `Lokasi '${editingLocation.name}' berhasil disimpan.`,
        type: 'success',
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan data lokasi.');
    } finally {
      setModalSaving(false);
    }
  };

  // Delete Location Single
  const handleDeleteLocation = async (loc: AttendanceLocation) => {
    if (loc.type === 'headquarters' && !isSuperAdmin) {
      alert('Hanya Super Admin yang memiliki wewenang untuk menghapus lokasi Kantor Pusat.');
      return;
    }
    if (!window.confirm(`Hapus titik lokasi '${loc.name}'?`)) return;
    try {
      await attendanceService.deleteLocation(loc.id);
      fetchLocations();
      setNotification({
        text: `Lokasi '${loc.name}' berhasil dihapus.`,
        type: 'success',
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus lokasi.');
    }
  };

  // Sinkronkan seluruh unit sekolah dari data impor penggajian menjadi titik lokasi
  const handleSyncFromSchoolUnits = async () => {
    if (
      !window.confirm(
        'Sinkronkan seluruh nama unit sekolah dari data impor gaji sebagai titik lokasi baru? Seluruh akun karyawan yang terdaftar di bawah unit sekolah tersebut akan otomatis terhubung ke lokasi sekolahnya masing-masing.'
      )
    )
      return;

    try {
      setSyncingSchools(true);
      const res = await attendanceService.syncFromSchoolUnits();
      fetchLocations();
      fetchSchoolUnits();
      setNotification({
        text: res.message || 'Sinkronisasi unit sekolah berhasil!',
        type: 'success',
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mensinkronkan data unit sekolah.');
    } finally {
      setSyncingSchools(false);
    }
  };

  // Buka Modal Atur Penugasan Karyawan Manual
  const handleOpenAssignEmployees = async (loc: AttendanceLocation) => {
    try {
      setSelectedLocationForAssign(loc);
      setAssignModalOpen(true);
      setAssignLoading(true);
      setAssignSearch('');
      const data = await attendanceService.getLocationEmployees(loc.id);
      setAssignEmployeesData(data);
      const currentlyAssignedIds = (data.assigned_employees || []).map((e: any) => e.id);
      setSelectedUserIds(currentlyAssignedIds);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memuat data karyawan untuk lokasi ini.');
      setAssignModalOpen(false);
    } finally {
      setAssignLoading(false);
    }
  };

  // Simpan Penugasan Karyawan Manual
  const handleSaveAssignEmployees = async () => {
    if (!selectedLocationForAssign) return;
    try {
      setAssignSaving(true);
      await attendanceService.assignLocationEmployees(selectedLocationForAssign.id, selectedUserIds);
      setAssignModalOpen(false);
      fetchLocations();
      setNotification({
        text: `Penugasan karyawan untuk lokasi '${selectedLocationForAssign.name}' berhasil diperbarui (${selectedUserIds.length} karyawan terhubung).`,
        type: 'success',
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan penugasan karyawan.');
    } finally {
      setAssignSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-primary" />
            <span>Manajemen Presensi & Radius Lokasi</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Rekapitulasi absensi harian, master titik lokasi kerja/sekolah via Excel/CSV, dan konfigurasi radius.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl border border-border-subtle self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'recap'
                ? 'bg-surface-panel text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Rekap Kehadiran</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('locations')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'locations'
                ? 'bg-surface-panel text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Master Lokasi ({locationMeta.total || locations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'shifts'
                ? 'bg-surface-panel text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pengaturan Shift ({shifts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-surface-panel text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Jam Kerja & Kebijakan</span>
          </button>
        </div>
      </div>

      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xs animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="text-xs font-medium leading-relaxed flex-1">{notification.text}</div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-text-muted hover:text-text-primary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: REKAP KEHADIRAN KARYAWAN (POINT 6 & POINT 7) */}
      {activeTab === 'recap' && (
        <div className="space-y-6">
          {/* POINT 10: Status Presensi Mandiri Admin di Kantor Pusat */}
          <div className="bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/80 border border-blue-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Presensi Mandiri Admin — Wajib Kantor Pusat
                  </span>
                </div>
                <p className="text-xs text-blue-900/80 mt-0.5">
                  Sesuai kebijakan sistem, seluruh akun Admin wajib absen masuk di radius Kantor Pusat yang ditentukan oleh Super Admin.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <a
                href="/my-attendance"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Buka Presensi Saya di Kantor Pusat &rarr;</span>
              </a>
            </div>
          </div>

          {/* ALERT PENDING VERIFIKASI SURAT SAKIT / IZIN */}
          {Number(summary?.total_pending_verification ?? 0) > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-amber-900 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-2">
                    <span>Pengajuan Surat Sakit / Izin Menunggu Verifikasi</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                      {summary?.total_pending_verification} Menunggu
                    </span>
                  </div>
                  <p className="text-[11.5px] text-amber-800/90 mt-0.5">
                    Terdapat {summary?.total_pending_verification} presensi dengan lampiran surat dokter/izin yang memerlukan persetujuan Admin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusFilter('pending_verification')}
                className="px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Lihat Pengajuan Pending ({summary?.total_pending_verification})</span>
              </button>
            </div>
          )}

          {/* Summary KPI Cards (Termasuk 8 Jam Kerja Terpenuhi & Sakit/Izin) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2.5">
            <div
              className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-2xs"
              title={`Karyawan Aktif: ${summary?.total_employees ?? 0} | Total Terdaftar: ${summary?.total_registered ?? summary?.total_employees ?? 0} | Off: ${summary?.total_off ?? 0}`}
            >
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
                <span>Karyawan</span>
                {summary?.total_registered && summary.total_registered > (summary.total_employees ?? 0) ? (
                  <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                    Aktif
                  </span>
                ) : null}
              </div>
              <div className="text-lg font-bold text-text-primary mt-1">
                {summary?.total_employees ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                Hadir Masuk
              </div>
              <div className="text-lg font-bold text-emerald-700 mt-1">
                {summary?.total_present ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wider">
                Dinas Luar
              </div>
              <div className="text-lg font-bold text-indigo-700 mt-1">
                {summary?.total_business_trip ?? 0}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">
                Libur / Off
              </div>
              <div className="text-lg font-bold text-amber-700 mt-1">
                {summary?.total_holiday ?? 0}
              </div>
            </div>

            <div className="bg-surface-panel border border-rose-200/80 bg-rose-50/20 rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-rose-800 uppercase tracking-wider">
                Sakit (Surat)
              </div>
              <div className="text-lg font-bold text-rose-700 mt-1">
                {summary?.total_sick ?? 0}
              </div>
            </div>

            <div className="bg-surface-panel border border-amber-200/80 bg-amber-50/20 rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-amber-900 uppercase tracking-wider">
                Izin Resmi
              </div>
              <div className="text-lg font-bold text-amber-800 mt-1">
                {summary?.total_permit ?? 0}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider">
                Tepat Waktu
              </div>
              <div className="text-lg font-bold text-blue-700 mt-1">
                {summary?.total_on_time ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-rose-800 uppercase tracking-wider">
                Terlambat
              </div>
              <div className="text-lg font-bold text-rose-700 mt-1">
                {summary?.total_late ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                Belum Absen
              </div>
              <div className="text-lg font-bold text-gray-700 mt-1">
                {summary?.total_not_checked_in ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-emerald-200/80 bg-emerald-50/30 rounded-xl p-3 shadow-2xs">
              <div className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>8 Jam OK</span>
              </div>
              <div className="text-lg font-bold text-emerald-800 mt-1">
                {summary?.total_eight_hours_met ?? 0}
              </div>
            </div>
          </div>

          {/* Filter Bar & Control Panel */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Filter Periode & Tanggal */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Switcher Filter Mode: SP 1-9 vs Harian */}
                <div className="flex items-center p-0.5 bg-surface-container rounded-lg border border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setFilterType('sp')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      filterType === 'sp'
                        ? 'bg-surface-panel text-primary shadow-2xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Periode SP (1-12)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('daily')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      filterType === 'daily'
                        ? 'bg-surface-panel text-primary shadow-2xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Tanggal Harian
                  </button>
                </div>

                {/* Dropdown SP 1 - 9 jika mode SP */}
                {filterType === 'sp' ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-muted font-medium">Surat Pesanan:</span>
                    <select
                      value={selectedSp}
                      onChange={(e) => setSelectedSp(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="all">Semua Periode SP (1-12)</option>
                      {SP_PERIOD_LIST.map((sp) => (
                        <option key={sp.code} value={sp.code}>
                          {sp.fullLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-muted font-medium">Tanggal:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    />
                  </div>
                )}

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted font-medium">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                  >
                    <option value="all">Semua Status</option>
                    <option value="pending_verification">⏳ Menunggu Verifikasi (Sakit/Izin)</option>
                    <option value="sakit">🏥 Sakit (Surat Dokter)</option>
                    <option value="izin">📋 Izin Resmi</option>
                    <option value="on_time">Tepat Waktu</option>
                    <option value="late">Terlambat</option>
                    <option value="dinas_luar">Perjalanan Dinas</option>
                    <option value="holiday">Libur / Off</option>
                  </select>
                </div>

                {/* Role / Tipe Staf Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted font-medium">Tipe Staf:</span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="all">Semua (Karyawan & Admin)</option>
                    <option value="admin">👤 Khusus Admin (Kantor Pusat)</option>
                    <option value="user">👥 Karyawan Lapangan (User)</option>
                  </select>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari Nama / NIK / Unit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Right: View Mode Toggle & Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center p-0.5 bg-surface-container rounded-lg border border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setRecapViewMode('detail')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      recapViewMode === 'detail'
                        ? 'bg-surface-panel text-primary shadow-2xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Log Detail
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecapViewMode('employee_recap');
                      fetchEmployeeRecap();
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      recapViewMode === 'employee_recap'
                        ? 'bg-surface-panel text-primary shadow-2xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Rekap per Karyawan (SP)
                  </button>
                </div>

                {/* Point 7: Button Tambah Presensi Manual */}
                <button
                  type="button"
                  onClick={() => handleOpenCreateAttendance()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Input Presensi Manual</span>
                </button>

                {/* Export Buttons: Excel (.xlsx) & CSV */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportAttendance('xlsx')}
                    disabled={exportingAttendanceType !== null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50 ${
                      selectedEmployeeIds.length > 0
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-500/30'
                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200'
                    }`}
                    title={`Export ${recapViewMode === 'employee_recap' ? 'Rekap Karyawan' : 'Log Detail'} ke format Excel (.xlsx)`}
                  >
                    <FileSpreadsheet className={`w-3.5 h-3.5 ${selectedEmployeeIds.length > 0 ? 'text-white' : 'text-emerald-600'}`} />
                    <span>
                      {exportingAttendanceType === 'xlsx'
                        ? 'Mengekspor...'
                        : selectedEmployeeIds.length > 0
                        ? `Export Excel (${selectedEmployeeIds.length} Terpilih)`
                        : 'Export Excel (.xlsx)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportAttendance('csv')}
                    disabled={exportingAttendanceType !== null}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-text-primary bg-surface-container hover:bg-surface-container/80 border border-border-subtle rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                    title={`Export ${recapViewMode === 'employee_recap' ? 'Rekap Karyawan' : 'Log Detail'} ke format CSV`}
                  >
                    <Download className="w-3.5 h-3.5 text-text-muted" />
                    <span>
                      {exportingAttendanceType === 'csv'
                        ? '...'
                        : selectedEmployeeIds.length > 0
                        ? `CSV (${selectedEmployeeIds.length})`
                        : 'CSV'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* VIEW 1: DETAIL LOG HARIAN (DENGAN ACTION EDIT & HAPUS) */}
          {recapViewMode === 'detail' && (
            <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[1100px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-container/40 text-text-muted font-semibold whitespace-nowrap">
                      <th className="py-3 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={
                            attendances.length > 0 &&
                            attendances.every((a) => a.user_id && selectedEmployeeIds.includes(a.user_id))
                          }
                          onChange={handleToggleSelectAllDetail}
                          className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                          title="Pilih Semua Karyawan pada Halaman Ini"
                        />
                      </th>
                      <th className="py-3 px-4">Karyawan</th>
                      <th className="py-3 px-3">Tanggal</th>
                      <th className="py-3 px-3">Foto Bukti</th>
                      <th className="py-3 px-3">Jenis Absen</th>
                      <th className="py-3 px-3">Shift</th>
                      <th className="py-3 px-3">Titik Lokasi / Unit</th>
                      <th className="py-3 px-3">Jam Masuk</th>
                      <th className="py-3 px-3">Jarak</th>
                      <th className="py-3 px-3">Jam Pulang</th>
                      <th className="py-3 px-3">Durasi Kerja</th>
                      <th className="py-3 px-3">Target 8 Jam</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Catatan</th>
                      <th className="py-3 px-3">GPS</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {loading ? (
                      <tr>
                        <td colSpan={16} className="py-10 text-center text-text-muted">
                          Memuat data absensi karyawan...
                        </td>
                      </tr>
                    ) : attendances.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="py-10 text-center text-text-muted">
                          Tidak ada data absensi untuk filter {filterType === 'sp' ? selectedSp : selectedDate}.
                        </td>
                      </tr>
                    ) : (
                      attendances.map((row) => {
                        const isLibur = row.attendance_type === 'libur' || row.status === 'holiday';
                        const isDinas = row.attendance_type === 'dinas_luar';
                        const isSakit = row.attendance_type === 'sakit';
                        const isIzin = row.attendance_type === 'izin';
                        const isPendingVerification = row.approval_status === 'pending';
                        const rawPhoto = row.photo_url || row.photo_full_url;
                        const photoSrc = rawPhoto ? getStorageUrl(rawPhoto) : null;
                        const isRowSelected = row.user_id ? selectedEmployeeIds.includes(row.user_id) : false;
                        return (
                          <tr key={row.id} className={`hover:bg-surface-container/20 transition-colors ${isRowSelected ? 'bg-primary/5' : ''}`}>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isRowSelected}
                                onChange={() => row.user_id && handleToggleSelectEmployee(row.user_id)}
                                className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                                title={`Pilih ${row.user?.name || 'Karyawan'} untuk laporan SP`}
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-text-primary">{row.user?.name || '-'}</span>
                                {(row.user?.role === 'admin' || row.user?.role === 'super_admin') && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    Admin Pusat
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-text-muted font-mono">
                                NIK: {row.user?.nik || '-'} {row.user?.school_unit ? `• Unit: ${row.user.school_unit}` : ''}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                              {row.date ? String(row.date).slice(0, 10) : '-'}
                            </td>
                            <td className="py-3 px-3">
                              {photoSrc ? (
                                <div
                                  onClick={() => setPreviewPhotoModal(photoSrc)}
                                  className="flex items-center gap-1.5 cursor-pointer group"
                                  title="Klik untuk memperbesar foto bukti"
                                >
                                  <img
                                    src={photoSrc}
                                    alt="Bukti Kehadiran"
                                    className="w-8 h-8 rounded-lg object-cover border border-border-subtle group-hover:scale-105 shadow-2xs transition-transform"
                                    onError={(e) => {
                                      const target = e.currentTarget as HTMLImageElement;
                                      if (!target.dataset.triedFallback && rawPhoto) {
                                        target.dataset.triedFallback = 'true';
                                        const clean = rawPhoto.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?(api\/storage|storage)\/?/, '');
                                        target.src = `/api/storage/${clean}`;
                                      }
                                    }}
                                  />
                                  <Eye className="w-3.5 h-3.5 text-text-muted group-hover:text-primary shrink-0" />
                                </div>
                              ) : (
                                <span className="text-text-muted text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  isSakit
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : isIzin
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : isLibur
                                    ? 'bg-amber-100 text-amber-800'
                                    : isDinas
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isSakit ? (
                                  <>
                                    <FileText className="w-3 h-3 text-rose-600" />
                                    <span>Sakit (Surat)</span>
                                  </>
                                ) : isIzin ? (
                                  <>
                                    <FileText className="w-3 h-3 text-amber-600" />
                                    <span>Izin Resmi</span>
                                  </>
                                ) : isLibur ? (
                                  <>
                                    <SunMedium className="w-3 h-3 text-amber-600" />
                                    <span>Libur / Off</span>
                                  </>
                                ) : isDinas ? (
                                  <>
                                    <Car className="w-3 h-3 text-indigo-600" />
                                    <span>Dinas Luar</span>
                                  </>
                                ) : (
                                  <>
                                    <Briefcase className="w-3 h-3 text-emerald-600" />
                                    <span>Masuk Kerja</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {row.shift ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800" title={row.shift.formatted_time || `${row.shift.start_time} - ${row.shift.end_time}`}>
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{row.shift.code || row.shift.name}</span>
                                </span>
                              ) : row.user?.shift ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700" title={row.user.shift.formatted_time}>
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{row.user.shift.code || row.user.shift.name}</span>
                                </span>
                              ) : (
                                <span className="text-text-muted text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-text-secondary font-medium">
                              {row.location_name || (row.location?.name ?? '-')}
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">
                              {row.check_in_time ? row.check_in_time.substring(0, 5) : '-'}
                            </td>
                            <td className="py-3 px-3 text-text-muted">
                              {row.check_in_distance_meters !== null ? `${row.check_in_distance_meters} m` : '-'}
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">
                              {row.check_out_time ? (
                                <span className="inline-flex items-center gap-1">
                                  <span>{row.check_out_time.substring(0, 5)}</span>
                                  {(row.shift?.cross_day || (row.check_in_time && row.check_out_time < row.check_in_time)) && (
                                    <span className="text-[9px] font-sans font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700" title="Pulang di hari berikutnya (+1 hari)">
                                      +1h
                                    </span>
                                  )}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] font-semibold text-text-primary">
                              {row.work_duration_formatted || '-'}
                            </td>
                            <td className="py-3 px-3">
                              {row.is_eight_hours_met === true ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3" /> 8 Jam OK
                                </span>
                              ) : row.is_eight_hours_met === false ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                                  &lt; 8 Jam
                                </span>
                              ) : (
                                <span className="text-text-muted text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isPendingVerification ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                  <span>⏳ Menunggu Verifikasi</span>
                                </span>
                              ) : row.approval_status === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title={row.rejection_reason ? `Ditolak: ${row.rejection_reason}` : 'Ditolak'}>
                                  <span>✕ Ditolak</span>
                                </span>
                              ) : (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isSakit
                                      ? 'bg-rose-100 text-rose-800'
                                      : isIzin
                                      ? 'bg-amber-100 text-amber-800'
                                      : isLibur
                                      ? 'bg-amber-100 text-amber-800'
                                      : isDinas
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : row.check_in_status === 'late'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {isSakit
                                    ? '✓ Sakit (Disetujui)'
                                    : isIzin
                                    ? '✓ Izin (Disetujui)'
                                    : isLibur
                                    ? 'Libur'
                                    : isDinas
                                    ? 'Dinas Luar'
                                    : row.check_in_status === 'late'
                                    ? 'Terlambat'
                                    : 'Tepat Waktu'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-text-muted max-w-[140px] truncate" title={row.notes || '-'}>
                              {row.notes || '-'}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-text-muted">
                              {row.check_in_lat && row.check_in_lng ? (
                                <a
                                  href={`https://www.google.com/maps?q=${row.check_in_lat},${row.check_in_lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                  title="Lihat titik di Google Maps"
                                >
                                  <span>{row.check_in_lat.toFixed(4)}, {row.check_in_lng.toFixed(4)}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              ) : (
                                '-'
                              )}
                            </td>
                            {/* Point 7 & 15: Kolom Aksi Verifikasi, Edit & Hapus */}
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {(isPendingVerification || isSakit || isIzin) && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenVerifyModal(row)}
                                    className={`px-2 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-2xs transition-all cursor-pointer ${
                                      isPendingVerification
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                                        : 'bg-surface-container hover:bg-surface-container/80 text-text-primary border border-border-subtle'
                                    }`}
                                    title={isPendingVerification ? 'Verifikasi Surat Sakit/Izin' : 'Tinjau / Ubah Status Verifikasi'}
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>{isPendingVerification ? 'Verifikasi' : 'Tinjau'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAttendance(row)}
                                  className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                                  title="Edit Presensi"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteAttendance(row)}
                                  className="p-1.5 text-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus Presensi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls Log Detail */}
              <Pagination
                meta={attendanceMeta as any}
                onPageChange={(page) => setAttendancePage(page)}
                perPage={attendancePerPage}
                onPerPageChange={(newPerPage) => {
                  setAttendancePerPage(newPerPage);
                  setAttendancePage(1);
                }}
                isLoading={loading}
              />
            </div>
          )}

          {/* VIEW 2: REKAPITULASI PER KARYAWAN (POINT 6: PERIODE SP 1-9) */}
          {recapViewMode === 'employee_recap' && (
            <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 bg-surface-container/30 border-b border-border-subtle flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    <span>Rekapitulasi Kehadiran per Karyawan — {selectedSp}</span>
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Total akumulasi kehadiran, keterlambatan, dan pencapaian 8 jam kerja selama periode {selectedSp}.
                  </p>
                </div>
                <div className="text-xs font-semibold text-text-secondary bg-surface-panel px-3 py-1.5 rounded-lg border border-border-subtle">
                  Total: {employeeRecapData.length} Karyawan
                </div>
              </div>

              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[1000px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-container/50 text-text-muted font-semibold whitespace-nowrap">
                      <th className="py-3 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={
                            employeeRecapData.length > 0 &&
                            employeeRecapData.every((e) => selectedEmployeeIds.includes(e.user_id))
                          }
                          onChange={handleToggleSelectAllRecap}
                          className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                          title="Pilih Semua Karyawan"
                        />
                      </th>
                      <th className="py-3 px-3 text-center w-12">No</th>
                      <th className="py-3 px-4">Nama & NIK</th>
                      <th className="py-3 px-3">Unit Sekolah / Lokasi</th>
                      <th className="py-3 px-3">Perusahaan</th>
                      <th className="py-3 px-3 text-center">Hadir Masuk</th>
                      <th className="py-3 px-3 text-center">Tepat Waktu</th>
                      <th className="py-3 px-3 text-center">Terlambat</th>
                      <th className="py-3 px-3 text-center">Dinas Luar</th>
                      <th className="py-3 px-3 text-center">Libur</th>
                      <th className="py-3 px-3 text-center">8 Jam OK</th>
                      <th className="py-3 px-3 text-center">Total Jam Kerja</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {employeeRecapLoading ? (
                      <tr>
                        <td colSpan={13} className="py-10 text-center text-text-muted">
                          Menghitung rekapitulasi data kehadiran per karyawan untuk {selectedSp}...
                        </td>
                      </tr>
                    ) : employeeRecapData.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-10 text-center text-text-muted">
                          Tidak ada data karyawan ditemukan.
                        </td>
                      </tr>
                    ) : (
                      paginatedEmployeeRecap.map((emp, idx) => {
                        const isRowSelected = selectedEmployeeIds.includes(emp.user_id);
                        const rowNumber = (employeeRecapPage - 1) * employeeRecapPerPage + idx + 1;
                        return (
                          <tr key={emp.user_id} className={`hover:bg-surface-container/20 transition-colors ${isRowSelected ? 'bg-primary/5' : ''}`}>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isRowSelected}
                                onChange={() => handleToggleSelectEmployee(emp.user_id)}
                                className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                                title={`Pilih ${emp.name} untuk laporan SP`}
                              />
                            </td>
                            <td className="py-3 px-3 text-center text-text-muted font-mono">{rowNumber}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-text-primary">{emp.name}</span>
                              {(emp.role === 'admin' || emp.role === 'super_admin') && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  Admin Pusat
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-muted font-mono">
                              NIK: {emp.nik || '-'} {emp.position ? `• ${emp.position}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-text-secondary font-medium">
                            {emp.school_unit || '-'}
                          </td>
                          <td className="py-3 px-3 uppercase font-mono text-[11px] font-semibold text-text-muted">
                            {emp.company || '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {emp.total_present}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                              {emp.total_on_time}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                              {emp.total_late}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                              {emp.total_business_trip}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                              {emp.total_holiday}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {emp.eight_hours_met_count} Hari
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-text-primary text-[11.5px]">
                            {emp.total_work_formatted}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenCreateAttendance(emp.user_id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition-all flex items-center gap-1 mx-auto cursor-pointer"
                              title="Tambah Presensi untuk Karyawan Ini"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Presensi</span>
                            </button>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls Rekap per Karyawan */}
              <Pagination
                meta={{
                  current_page: employeeRecapPage,
                  last_page: Math.ceil(employeeRecapData.length / employeeRecapPerPage) || 1,
                  per_page: employeeRecapPerPage,
                  total: employeeRecapData.length,
                  from: employeeRecapData.length > 0 ? (employeeRecapPage - 1) * employeeRecapPerPage + 1 : 0,
                  to: Math.min(employeeRecapPage * employeeRecapPerPage, employeeRecapData.length),
                } as any}
                onPageChange={(page) => setEmployeeRecapPage(page)}
                perPage={employeeRecapPerPage}
                onPerPageChange={(newPerPage) => {
                  setEmployeeRecapPerPage(newPerPage);
                  setEmployeeRecapPage(1);
                }}
                isLoading={employeeRecapLoading}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MASTER LOKASI (IMPORT / EXPORT EXCEL & MANUAL) */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          {/* Top Actions & Filters */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari Nama Sekolah / Kode / Alamat..."
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium">Tipe:</span>
                <select
                  value={locationTypeFilter}
                  onChange={(e) => setLocationTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="school">Sekolah Rakyat</option>
                  <option value="headquarters">Kantor Pusat</option>
                  <option value="branch">Cabang</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Download Template Excel */}
              <button
                type="button"
                onClick={handleDownloadLocationTemplate}
                disabled={templateDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                title="Unduh format file Excel untuk input lokasi"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>{templateDownloading ? 'Mengunduh...' : 'Unduh Template'}</span>
              </button>

              {/* Import Excel / CSV Button */}
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(true);
                  setImportResult(null);
                  setImportFile(null);
                  setPreviewData(null);
                  setShowGuide(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-all cursor-pointer"
                title="Unggah file Excel/CSV data lokasi"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Import Excel/CSV</span>
              </button>

              {/* Sinkronkan dari Data Sekolah Gaji Button */}
              <button
                type="button"
                onClick={handleSyncFromSchoolUnits}
                disabled={syncingSchools}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Otomatis ambil seluruh unit sekolah dari data impor gaji sebagai titik lokasi & kaitkan akun karyawan"
              >
                <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${syncingSchools ? 'animate-spin' : ''}`} />
                <span>{syncingSchools ? 'Menyinkronkan...' : 'Sinkronkan Data Sekolah Gaji'}</span>
              </button>

              {/* Export Data Button */}
              <button
                type="button"
                onClick={handleExportLocations}
                disabled={exportLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                title="Ekspor daftar lokasi aktif ke file CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportLoading ? 'Mengekspor...' : 'Export Data'}</span>
              </button>

              {/* Tambah Lokasi Manual Button */}
              <button
                type="button"
                onClick={handleOpenAddLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Manual</span>
              </button>

              {/* Clear All Locations Button */}
              <button
                type="button"
                onClick={handleClearAllLocations}
                disabled={clearLoading || locations.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                title="Hapus / Kosongkan semua lokasi untuk perusahaan ini"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>{clearLoading ? 'Menghapus...' : 'Bersihkan Semua'}</span>
              </button>
            </div>
          </div>

          {/* Table Master Lokasi */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-container/40 text-text-muted font-semibold whitespace-nowrap">
                    <th className="py-3 px-4">Nama Titik Lokasi</th>
                    <th className="py-3 px-3">Kode Unit</th>
                    <th className="py-3 px-3">Tipe</th>
                    <th className="py-3 px-3">Karyawan Terdaftar</th>
                    <th className="py-3 px-3">Radius (Meter)</th>
                    <th className="py-3 px-3">Alamat</th>
                    <th className="py-3 px-3">Koordinat GPS</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {locationsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-text-muted">
                        Memuat data lokasi absensi...
                      </td>
                    </tr>
                  ) : locations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-text-muted space-y-3">
                        <div className="text-sm font-semibold text-text-secondary">
                          Belum ada master lokasi yang terdaftar.
                        </div>
                        <p className="text-xs text-text-muted max-w-md mx-auto">
                          Anda dapat menyinkronkan langsung dari data gaji yang sudah diimpor, atau mengunduh template Excel.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={handleSyncFromSchoolUnits}
                            disabled={syncingSchools}
                            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>1. Sinkronkan dari Data Sekolah Gaji</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadLocationTemplate}
                            disabled={templateDownloading}
                            className="px-4 py-2 text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-300 rounded-xl hover:bg-sky-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-600" />
                            <span>2. {templateDownloading ? 'Mengunduh...' : 'Unduh Template Excel'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImportModalOpen(true);
                              setImportResult(null);
                              setImportFile(null);
                            }}
                            className="px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>3. Import Excel/CSV</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    locations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-surface-container/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-text-primary flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{loc.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-text-secondary">
                          {loc.code || '-'}
                        </td>
                        <td className="py-3 px-3">
                          {loc.type === 'headquarters' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              🏢 Kantor Pusat (Super Admin)
                            </span>
                          ) : (
                            <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container border border-border-subtle text-text-secondary">
                              {loc.type === 'school' ? 'Sekolah Rakyat' : loc.type === 'branch' ? 'Cabang' : loc.type}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => handleOpenAssignEmployees(loc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
                            title="Klik untuk melihat / mengatur karyawan manual"
                          >
                            <Users className="w-3 h-3" />
                            <span>{loc.employee_count ?? 0} Karyawan</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 font-semibold text-emerald-700">
                          {loc.radius_meters} Meter
                        </td>
                        <td className="py-3 px-3 text-text-muted max-w-[200px] truncate" title={loc.address || '-'}>
                          {loc.address || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <a
                            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <span>{Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              loc.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {loc.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenAssignEmployees(loc)}
                            className="p-1.5 text-text-muted hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-all cursor-pointer mr-1"
                            title="Atur Karyawan Manual"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditLocation(loc)}
                            disabled={loc.type === 'headquarters' && !isSuperAdmin}
                            className={`p-1.5 rounded-md transition-all mr-1 ${
                              loc.type === 'headquarters' && !isSuperAdmin
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-text-muted hover:text-primary hover:bg-surface-container cursor-pointer'
                            }`}
                            title={
                              loc.type === 'headquarters' && !isSuperAdmin
                                ? 'Hanya Super Admin yang dapat mengedit Kantor Pusat'
                                : 'Edit Lokasi'
                            }
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(loc)}
                            disabled={loc.type === 'headquarters' && !isSuperAdmin}
                            className={`p-1.5 rounded-md transition-all ${
                              loc.type === 'headquarters' && !isSuperAdmin
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-text-muted hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                            }`}
                            title={
                              loc.type === 'headquarters' && !isSuperAdmin
                                ? 'Kantor Pusat dikunci dan tidak dapat dihapus oleh Admin'
                                : 'Hapus Lokasi'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              meta={locationMeta as any}
              onPageChange={(page) => setLocationPage(page)}
              perPage={locationPerPage}
              onPerPageChange={(newPerPage) => {
                setLocationPerPage(newPerPage);
                setLocationPage(1);
              }}
              isLoading={locationsLoading}
            />
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL / CSV LOKASI DENGAN PANDUAN LENGKAP & PRATINJAU DATA */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col space-y-4 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-base">
                    Import Master Lokasi dari Excel / CSV
                  </h3>
                  <p className="text-xs text-text-muted">
                    Sinkronisasi ratusan titik lokasi radius absensi sekolah & unit kerja.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-container transition-all cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="overflow-y-auto pr-1 space-y-4 flex-1 scrollbar-thin">
              {/* TATA CARA & PANDUAN PENGISIAN DATA */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 overflow-hidden text-xs transition-all">
                <div className="p-3.5 flex items-center justify-between gap-3 bg-sky-100/60">
                  <div className="flex items-center gap-2 text-sky-950 font-bold">
                    <Info className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Tata Cara Pengisian Data & Penjelasan Tipe Lokasi:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadLocationTemplate}
                      disabled={templateDownloading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-white text-sky-800 border border-sky-300 rounded-lg shadow-2xs hover:bg-sky-50 transition-all cursor-pointer disabled:opacity-50"
                      title="Unduh file template resmi berformat .xlsx"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-600" />
                      <span>{templateDownloading ? 'Mengunduh...' : 'Unduh Template Excel'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-sky-800 hover:text-sky-950 cursor-pointer"
                    >
                      <span>{showGuide ? 'Sembunyikan' : 'Buka Detail Panduan'}</span>
                      {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Ringkasan Kolom Singkat */}
                <div className="px-3.5 py-2.5 border-t border-sky-200/60 text-sky-900 leading-relaxed">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-sky-950">Susunan Kolom:</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Nama Lokasi*</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200">Kode Unit</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Latitude*</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Longitude*</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Radius Meter*</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200">Alamat</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Tipe</span>
                  </div>
                </div>

                {/* Detail Panduan Expanded */}
                {showGuide && (
                  <div className="p-3.5 border-t border-sky-200/70 bg-white/90 space-y-3.5 text-text-secondary animate-in fade-in">
                    {/* Logika Bisnis Tipe Lokasi */}
                    <div>
                      <h4 className="font-bold text-text-primary text-[11px] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                        <Briefcase className="w-3.5 h-3.5 text-primary" />
                        <span>Logika Bisnis & Penjelasan Pilihan Kolom "Tipe":</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                          <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                            <span className="font-mono bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded text-[10px]">school</span>
                            <span>Sekolah Rakyat (SRP)</span>
                          </div>
                          <p className="text-[11px] text-emerald-900 mt-1">
                            Unit Sekolah Rakyat tempat guru, pengajar, dan staf sekolah bertugas. Terhubung langsung dengan unit penugasan karyawan untuk absensi harian.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50">
                          <div className="font-bold text-purple-950 flex items-center gap-1.5">
                            <span className="font-mono bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded text-[10px]">headquarters</span>
                            <span>Kantor Pusat</span>
                          </div>
                          <p className="text-[11px] text-purple-900 mt-1">
                            Kantor pusat operasional yayasan/manajemen utama, tempat manajemen pusat & tim operasional inti bekerja.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                          <div className="font-bold text-amber-950 flex items-center gap-1.5">
                            <span className="font-mono bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded text-[10px]">branch</span>
                            <span>Kantor Cabang / Wilayah</span>
                          </div>
                          <p className="text-[11px] text-amber-900 mt-1">
                            Kantor perwakilan cabang regional atau pos koordinasi distrik di daerah penugasan.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                          <div className="font-bold text-slate-950 flex items-center gap-1.5">
                            <span className="font-mono bg-slate-200 text-slate-900 px-1.5 py-0.2 rounded text-[10px]">other</span>
                            <span>Pos / Lokasi Tugas Lainnya</span>
                          </div>
                          <p className="text-[11px] text-slate-800 mt-1">
                            Fasilitas pendukung, asrama, pos penugasan luar kota, atau lokasi proyek lapangan khusus.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Panduan Format Data & Koordinat */}
                    <div className="border-t border-border-subtle pt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <strong className="text-text-primary block mb-0.5">Format Koordinat GPS (Latitude & Longitude):</strong>
                        <p className="text-text-muted">
                          Buka Google Maps, klik kanan pada gerbang/gedung lokasi, lalu salin angka koordinat. Sistem mendukung angka dengan tanda desimal titik (<span className="font-mono font-bold">-6.482711</span>) maupun koma (<span className="font-mono font-bold">-6,482711</span>) secara otomatis!
                        </p>
                      </div>
                      <div>
                        <strong className="text-text-primary block mb-0.5">Pencegahan Duplikasi (Smart Sync):</strong>
                        <p className="text-text-muted">
                          Sistem mendeteksi jika Kode Unit atau Nama Lokasi sudah terdaftar. Data tersebut akan otomatis <strong>DIPERBARUI (UPDATE)</strong> dan tidak akan membuat baris ganda di database.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AREA UNGGAH FILE / DROPZONE (JIKA BELUM ADA PREVIEW) */}
              {!previewData && !previewLoading && !importResult && (
                <div className="border-2 border-dashed border-border-subtle hover:border-primary/60 rounded-2xl p-7 text-center transition-all bg-surface-container/20 group">
                  <input
                    type="file"
                    id="excel_location_file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="excel_location_file"
                    className="cursor-pointer flex flex-col items-center justify-center gap-3"
                  >
                    <div className="p-3.5 bg-primary/10 group-hover:bg-primary/20 rounded-2xl transition-all">
                      <Upload className="w-8 h-8 text-primary animate-bounce" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">
                        Klik untuk Memilih File atau Drag & Drop File ke Sini
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Format didukung: File Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) atau <strong>.csv</strong> (Maks. 10 MB)
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-panel border border-border-subtle rounded-xl text-xs font-semibold text-text-secondary group-hover:border-primary transition-all shadow-2xs">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Pilih File dari Komputer</span>
                    </span>
                  </label>
                </div>
              )}

              {/* LOADING ANALISIS PREVIEW */}
              {previewLoading && (
                <div className="p-8 rounded-2xl border border-primary/20 bg-primary/5 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <div className="text-sm font-bold text-text-primary">
                    Menganalisis Spreadsheet & Menyiapkan Pratinjau Data...
                  </div>
                  <p className="text-xs text-text-muted max-w-md mx-auto">
                    Sistem sedang memvalidasi koordinat latitude, longitude, toleransi radius, serta mengecek duplikasi lokasi.
                  </p>
                </div>
              )}

              {/* PRATINJAU DATA (PREVIEW TABLE & SUMMARY) */}
              {previewData && !importResult && (
                <div className="space-y-3.5 animate-in fade-in">
                  {/* File Info Bar */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-border-subtle text-xs">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-text-primary">{previewData.summary.filename}</span>
                      <span className="text-text-muted">({(previewData.summary.file_size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetImport}
                      className="px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary bg-surface-panel border border-border-subtle rounded-lg hover:bg-surface-container transition-all cursor-pointer"
                    >
                      Ganti File
                    </button>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl border border-border-subtle bg-surface-container/40">
                      <div className="text-[11px] text-text-muted">Total Baris Terdeteksi</div>
                      <div className="text-base font-bold text-text-primary mt-0.5">
                        {previewData.summary.total_rows}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70">
                      <div className="text-[11px] text-emerald-800 font-semibold">Siap Tambah Baru</div>
                      <div className="text-base font-bold text-emerald-700 mt-0.5">
                        +{previewData.summary.create_count}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/70">
                      <div className="text-[11px] text-sky-800 font-semibold">Siap Update Eksisting</div>
                      <div className="text-base font-bold text-sky-700 mt-0.5">
                        ↻ {previewData.summary.update_count}
                      </div>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${previewData.summary.invalid_rows > 0 ? 'border-rose-200 bg-rose-50/80 text-rose-800' : 'border-emerald-200 bg-emerald-50/50 text-emerald-800'}`}>
                      <div className="text-[11px] font-semibold">
                        {previewData.summary.invalid_rows > 0 ? 'Data Bermasalah' : 'Status Validasi'}
                      </div>
                      <div className="text-base font-bold mt-0.5">
                        {previewData.summary.invalid_rows > 0 ? `${previewData.summary.invalid_rows} Baris Error` : 'Semua Valid ✓'}
                      </div>
                    </div>
                  </div>

                  {/* Peringatan Jika Ada Error */}
                  {previewData.summary.invalid_rows > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Perhatian:</strong> Terdapat {previewData.summary.invalid_rows} baris data yang memiliki catatan kesalahan koordinat/nama. Baris bertanda Error akan otomatis dilewati saat import.
                      </div>
                    </div>
                  )}

                  {/* Tabel Pratinjau Interaktif */}
                  <div className="border border-border-subtle rounded-xl overflow-hidden shadow-2xs bg-surface-panel">
                    <div className="px-3.5 py-2 bg-surface-container/30 border-b border-border-subtle flex items-center justify-between text-xs">
                      <span className="font-bold text-text-primary flex items-center gap-1.5">
                        <span>Pratinjau Baris Data Spreadsheet</span>
                        <span className="text-[11px] font-normal text-text-muted">({previewData.preview_rows.length} baris)</span>
                      </span>
                      <span className="text-[11px] text-text-muted">
                        Periksa kembali kesesuaian koordinat & tipe sebelum import
                      </span>
                    </div>

                    <div className="max-h-72 overflow-y-auto overflow-x-auto scrollbar-thin">
                      <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                        <thead className="bg-surface-container/60 sticky top-0 z-10 text-text-muted font-semibold border-b border-border-subtle">
                          <tr>
                            <th className="py-2.5 px-3 w-12 text-center">No</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Nama Lokasi</th>
                            <th className="py-2.5 px-3">Kode Unit</th>
                            <th className="py-2.5 px-3">Tipe</th>
                            <th className="py-2.5 px-3">Koordinat GPS</th>
                            <th className="py-2.5 px-3">Radius</th>
                            <th className="py-2.5 px-3">Alamat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle font-normal">
                          {previewData.preview_rows.map((row: any, idx: number) => {
                            const isErr = !row.is_valid;
                            return (
                              <tr
                                key={idx}
                                className={`transition-colors ${isErr ? 'bg-rose-50/70 hover:bg-rose-50' : 'hover:bg-surface-container/20'}`}
                              >
                                <td className="py-2.5 px-3 text-center text-text-muted font-mono text-[11px]">
                                  {row.row_index}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {isErr ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      <span>Error</span>
                                    </span>
                                  ) : row.action === 'update' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                                      <RefreshCw className="w-2.5 h-2.5 text-sky-600" />
                                      <span>Update</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      <Plus className="w-3 h-3 text-emerald-600" />
                                      <span>Baru</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-text-primary">{row.name}</div>
                                  {isErr && row.errors?.length > 0 && (
                                    <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                                      {row.errors.join(', ')}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-text-secondary">
                                  {row.code || '-'}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                      row.type === 'school'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : row.type === 'headquarters'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : row.type === 'branch'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {row.type_label}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                                  {row.latitude !== null && row.longitude !== null ? (
                                    <span className="text-text-secondary">
                                      {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 font-bold">Tidak Valid</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap font-medium text-text-secondary">
                                  {row.radius_meters} m
                                </td>
                                <td className="py-2.5 px-3 text-text-muted max-w-[180px] truncate" title={row.address}>
                                  {row.address}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* HASIL RINGKASAN SETELAH IMPORT SELESAI */}
              {importResult && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-3 animate-in zoom-in-95">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-950 text-sm">Proses Import Selesai Berhasil!</h4>
                      <p className="text-emerald-800 text-xs">Data master lokasi absensi telah berhasil disimpan dan disinkronisasi.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200 text-center">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 block">Lokasi Baru</span>
                      <strong className="text-emerald-900 text-sm">+{importResult.imported_count}</strong>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 block">Lokasi Diperbarui</span>
                      <strong className="text-emerald-900 text-sm">↻ {importResult.updated_count}</strong>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 block">Total Lokasi Aktif</span>
                      <strong className="text-emerald-900 text-sm">{importResult.total_current}</strong>
                    </div>
                  </div>

                  {importResult.errors?.length > 0 && (
                    <div className="pt-2 text-rose-800 text-[11px]">
                      <strong>Catatan Kesalahan yang Dilewati ({importResult.errors.length}):</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {importResult.errors.slice(0, 5).map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
              >
                {importResult ? 'Tutup Jendela' : 'Batal'}
              </button>

              <div className="flex items-center gap-2">
                {importResult ? (
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(false)}
                    className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Selesai</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleImportSubmit()}
                    disabled={importLoading || !importFile || !previewData || previewData?.summary?.valid_rows === 0}
                    className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {importLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sedang Mengimpor Data...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {previewData
                            ? `Mulai Import ${previewData.summary.valid_rows} Lokasi Valid`
                            : 'Mulai Import Lokasi'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT LOKASI MANUAL */}
      {locationModalOpen && editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span>{editingLocation.id ? 'Edit Titik Lokasi' : 'Tambah Titik Lokasi Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalLocation} className="space-y-4">
              {editingLocation.type === 'headquarters' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Titik Kantor Pusat (Point 10):</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {isSuperAdmin
                        ? 'Sebagai Super Admin, koordinat dan radius yang Anda simpan di sini akan otomatis disinkronkan ke Pengaturan Kantor Pusat Absensi Admin.'
                        : 'Hanya Super Admin yang berwenang mengubah atau mengatur koordinat Kantor Pusat.'}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text-primary block">
                    Nama Lokasi / Unit Sekolah*
                  </label>
                  {schoolUnitOptions.length > 0 && !editingLocation.id && (
                    <span className="text-[11px] text-primary font-medium">
                      Tersedia {schoolUnitOptions.length} unit data gaji
                    </span>
                  )}
                </div>

                {/* Dropdown Auto-Complete dari Data Unit Sekolah yang Diimpor */}
                {schoolUnitOptions.length > 0 && !editingLocation.id && (
                  <div className="mb-2">
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const opt = schoolUnitOptions.find((o) => o.name === val);
                        setEditingLocation((prev) => ({
                          ...prev,
                          name: val,
                          type: 'school',
                          address: prev?.address || `Unit ${val}`,
                          latitude: opt?.latitude ?? prev?.latitude ?? -6.2088,
                          longitude: opt?.longitude ?? prev?.longitude ?? 106.8456,
                          radius_meters: opt?.radius_meters ?? prev?.radius_meters ?? 100,
                        }));
                      }}
                      value={schoolUnitOptions.some((o) => o.name === editingLocation.name) ? editingLocation.name : ''}
                      className="w-full px-3 py-1.5 text-xs bg-primary/5 border border-primary/20 rounded-xl text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer mb-1.5"
                    >
                      <option value="">-- Pilih dari Unit Sekolah Terdaftar (Data Gaji) --</option>
                      {schoolUnitOptions.map((opt) => (
                        <option key={opt.name} value={opt.name}>
                          {opt.name} ({opt.employee_count} Karyawan) {opt.is_configured ? '✓ Lokasi sudah ada' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <input
                  type="text"
                  required
                  placeholder="Contoh: Sekolah Rakyat Jakarta 01"
                  value={editingLocation.name || ''}
                  onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {/* Info Otomatis Hubungkan Karyawan */}
                {(() => {
                  const matchedOpt = schoolUnitOptions.find(
                    (o) => o.name.toLowerCase() === (editingLocation.name || '').trim().toLowerCase()
                  );
                  if (matchedOpt && matchedOpt.employee_count > 0) {
                    return (
                      <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <span>
                          Ditemukan <strong>{matchedOpt.employee_count} karyawan</strong> di unit sekolah ini. Karyawan akan otomatis terhubung ke lokasi ini!
                        </span>
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Kode Unit</label>
                  <input
                    type="text"
                    placeholder="Contoh: SRP-001"
                    value={editingLocation.code || ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, code: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Tipe</label>
                  <select
                    value={editingLocation.type || 'school'}
                    onChange={(e) => setEditingLocation({ ...editingLocation, type: e.target.value as any })}
                    disabled={editingLocation.type === 'headquarters' && !isSuperAdmin}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="school">Sekolah Rakyat</option>
                    {isSuperAdmin ? (
                      <option value="headquarters">Kantor Pusat (Super Admin Only)</option>
                    ) : (
                      editingLocation.type === 'headquarters' && (
                        <option value="headquarters">Kantor Pusat (Terkunci)</option>
                      )
                    )}
                    <option value="branch">Cabang</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Latitude*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingLocation.latitude ?? ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Longitude*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingLocation.longitude ?? ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Radius Geofencing (Meter)*</label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  required
                  value={editingLocation.radius_meters ?? 100}
                  onChange={(e) => setEditingLocation({ ...editingLocation, radius_meters: parseInt(e.target.value) || 100 })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap lokasi..."
                  value={editingLocation.address || ''}
                  onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || (editingLocation.type === 'headquarters' && !isSuperAdmin)}
                  className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {modalSaving ? 'Menyimpan...' : 'Simpan Lokasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ATUR PENUGASAN KARYAWAN MANUAL */}
      {assignModalOpen && selectedLocationForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-xl max-w-xl w-full space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
              <div>
                <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Atur Penugasan Karyawan Manual</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Lokasi: <strong>{selectedLocationForAssign.name}</strong> ({selectedUserIds.length} Karyawan Terpilih)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-3.5 py-2.5 text-amber-900 text-xs shrink-0 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Karyawan yang terhubung ke lokasi ini <strong>tidak perlu lagi memilih lokasi</strong> saat melakukan absensi masuk.
              </span>
            </div>

            {/* Search Karyawan & Select All Bar */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama karyawan / NIK / unit..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const filtered = (assignEmployeesData?.all_employees || []).filter((emp: any) => {
                    const q = assignSearch.toLowerCase();
                    return (
                      emp.name?.toLowerCase().includes(q) ||
                      emp.nik?.toLowerCase().includes(q) ||
                      emp.school_unit?.toLowerCase().includes(q)
                    );
                  });
                  const allFilteredIds = filtered.map((e: any) => e.id);
                  const isAllSelected = allFilteredIds.every((id) => selectedUserIds.includes(id));
                  if (isAllSelected) {
                    setSelectedUserIds(selectedUserIds.filter((id) => !allFilteredIds.includes(id)));
                  } else {
                    setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...allFilteredIds])));
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-surface-container border border-border-subtle hover:bg-surface-container-high rounded-xl text-text-primary cursor-pointer shrink-0"
              >
                Pilih / Batal Semua
              </button>
            </div>

            {/* List Karyawan */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[200px] max-h-[350px] scrollbar-thin">
              {assignLoading ? (
                <div className="py-12 text-center text-xs text-text-muted">Memuat data karyawan...</div>
              ) : (assignEmployeesData?.all_employees || []).length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted">Tidak ada data karyawan ditemukan.</div>
              ) : (
                (assignEmployeesData?.all_employees || [])
                  .filter((emp: any) => {
                    const q = assignSearch.toLowerCase();
                    return (
                      emp.name?.toLowerCase().includes(q) ||
                      emp.nik?.toLowerCase().includes(q) ||
                      emp.school_unit?.toLowerCase().includes(q)
                    );
                  })
                  .map((emp: any) => {
                    const isChecked = selectedUserIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-primary/5 border-primary/40 text-text-primary'
                            : 'bg-surface-container/30 border-border-subtle hover:bg-surface-container text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds([...selectedUserIds, emp.id]);
                              } else {
                                setSelectedUserIds(selectedUserIds.filter((id) => id !== emp.id));
                              }
                            }}
                            className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <div className="font-semibold text-text-primary flex items-center gap-2">
                              <span>{emp.name}</span>
                              {emp.nik && (
                                <span className="font-mono text-[10px] text-text-muted">({emp.nik})</span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-muted mt-0.5">
                              Unit Sekolah: {emp.school_unit || '-'}
                            </div>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                            Terhubung
                          </span>
                        )}
                      </label>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2.5 shrink-0">
              <span className="text-xs text-text-muted">
                <strong>{selectedUserIds.length}</strong> karyawan dipilih
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignEmployees}
                  disabled={assignSaving}
                  className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {assignSaving ? 'Menyimpan...' : 'Simpan Penugasan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENGATURAN SHIFT KERJA KARYAWAN (POINT 9 MULTI-TENANT RIAMA & RIMBUN) */}
      {activeTab === 'shifts' && (
        <div className="space-y-6">
          {/* Header Controls & Multi-tenant Filter */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">Master Shift & Jam Kerja Operasional</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Konfigurasi jam masuk, toleransi keterlambatan, dan penugasan shift per individu atau unit sekolah.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isSuperAdmin && (
                <div className="flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs">
                  <Building className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="text-text-muted font-medium">Entitas:</span>
                  <select
                    value={shiftFilterCompany}
                    onChange={(e) => setShiftFilterCompany(e.target.value)}
                    className="bg-transparent font-semibold text-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Entitas</option>
                    <option value="rbs">PT RBS (Rimbun)</option>
                    <option value="rimamandiri">PT Riama Mandiri</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  fetchShifts();
                  fetchShiftEmployees();
                }}
                disabled={shiftsLoading || shiftEmployeesLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-text-secondary bg-surface-container hover:bg-surface-container/80 rounded-xl border border-border-subtle transition-all cursor-pointer disabled:opacity-50"
                title="Segarkan data shift"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${shiftsLoading ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAssignShiftModal()}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-text-primary bg-surface-container hover:bg-surface-container/80 border border-border-subtle rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Penugasan Massal / Unit</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateShift}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Shift Baru</span>
              </button>
            </div>
          </div>

          {/* Grid Master Shift Cards */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <span>Daftar Master Shift Aktif</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {shifts.length} Shift
                </span>
              </h3>
            </div>

            {shiftsLoading ? (
              <div className="p-8 text-center text-xs text-text-muted bg-surface-panel rounded-2xl border border-border-subtle">
                <RefreshCw className="w-5 h-5 text-primary animate-spin mx-auto mb-2" />
                <span>Memuat master shift...</span>
              </div>
            ) : shifts.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted bg-surface-panel rounded-2xl border border-border-subtle">
                Belum ada master shift untuk entitas ini. Klik &quot;Tambah Shift Baru&quot; di atas untuk membuat jadwal.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shifts.map((shift) => {
                  const companyLabel =
                    shift.company === 'all'
                      ? 'Semua Entitas'
                      : shift.company === 'rimamandiri'
                      ? 'PT Riama Mandiri'
                      : 'PT Rimbun Buana';

                  const companyColor =
                    shift.company === 'all'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : shift.company === 'rimamandiri'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                  return (
                    <div
                      key={shift.id}
                      className="bg-surface-panel border border-border-subtle hover:border-primary/40 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group"
                    >
                      <div>
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                              {shift.code}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${companyColor}`}>
                              {companyLabel}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              shift.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {shift.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>

                        {/* Title & Cross-day */}
                        <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                          {shift.name}
                        </h4>

                        {/* Hours Banner */}
                        <div className="mt-3 p-3 bg-surface-container rounded-xl border border-border-subtle flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <div className="font-mono text-xs font-bold text-text-primary">
                              {shift.formatted_time || `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`}
                            </div>
                          </div>
                          {shift.cross_day && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              +1 Hari (Malam)
                            </span>
                          )}
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                          <div className="p-2 bg-surface-container/60 rounded-lg">
                            <div className="text-[10px] text-text-muted">Toleransi</div>
                            <div className="text-xs font-bold text-text-primary font-mono mt-0.5">
                              {shift.late_tolerance_minutes}m
                            </div>
                          </div>
                          <div className="p-2 bg-surface-container/60 rounded-lg">
                            <div className="text-[10px] text-text-muted">Target Jam</div>
                            <div className="text-xs font-bold text-text-primary font-mono mt-0.5">
                              {shift.work_hours}j
                            </div>
                          </div>
                          <div className="p-2 bg-surface-container/60 rounded-lg">
                            <div className="text-[10px] text-text-muted">Terpasang</div>
                            <div className="text-xs font-bold text-primary font-mono mt-0.5">
                              {shift.users_count || 0} org
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {shift.description && (
                          <p className="text-[11px] text-text-muted mt-2.5 line-clamp-2 italic">
                            {shift.description}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignTargetShiftId(shift.id);
                            setAssignShiftMode('school_unit');
                            setAssignShiftModalOpen(true);
                          }}
                          className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          <span>Tugaskan Karyawan</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditShift(shift)}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            title="Edit Master Shift"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteShift(shift)}
                            className="p-1.5 text-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus / Nonaktifkan Shift"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel Penugasan Shift Karyawan (Tabel Karyawan) */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-xs space-y-4 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-border-subtle">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Daftar Shift Karyawan ({shiftEmployeeMeta.total || shiftEmployees.length})</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Tetapkan jadwal shift kerja per karyawan, atau pilih massal untuk diterapkan bersamaan.
                </p>
              </div>

              {selectedShiftUserIds.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                    {selectedShiftUserIds.length} Karyawan Terpilih
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenAssignShiftModal(selectedShiftUserIds)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Ubah Shift Terpilih</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedShiftUserIds([])}
                    className="p-1.5 text-text-muted hover:text-text-primary rounded-lg cursor-pointer"
                    title="Batalkan Pilihan"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={shiftEmployeeSearch}
                  onChange={(e) => setShiftEmployeeSearch(e.target.value)}
                  placeholder="Cari nama, NIK, atau unit..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <select
                  value={selectedShiftFilter}
                  onChange={(e) => setSelectedShiftFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="all">Semua Status Shift</option>
                  <option value="none">Belum Ditugaskan Shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      Shift: {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedUnitFilter}
                  onChange={(e) => setSelectedUnitFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="all">Semua Unit Sekolah</option>
                  {schoolUnitOptions.map((unit) => (
                    <option key={unit.name} value={unit.name}>
                      {unit.name} ({unit.employee_count} org)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[800px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-container/40 text-text-muted font-semibold whitespace-nowrap">
                    <th className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={
                          shiftEmployees.length > 0 &&
                          shiftEmployees.every((e) => selectedShiftUserIds.includes(e.id))
                        }
                        onChange={handleToggleSelectAllShiftEmployees}
                        className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                        title="Pilih Semua di Halaman Ini"
                      />
                    </th>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-3">Perusahaan</th>
                    <th className="py-3 px-3">Unit Sekolah</th>
                    <th className="py-3 px-3">Shift Aktif</th>
                    <th className="py-3 px-3">Ubah Shift Langsung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {shiftEmployeesLoading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-text-muted">
                        Memuat data karyawan shift...
                      </td>
                    </tr>
                  ) : shiftEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-text-muted">
                        Tidak ada karyawan yang cocok dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    shiftEmployees.map((emp) => {
                      const isSelected = selectedShiftUserIds.includes(emp.id);
                      return (
                        <tr
                          key={emp.id}
                          className={`hover:bg-surface-container/20 transition-colors ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectShiftEmployee(emp.id)}
                              className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-text-primary">{emp.name}</div>
                            <div className="text-[11px] text-text-muted font-mono">
                              NIK: {emp.nik || '-'} • {emp.email}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${
                                emp.company === 'rimamandiri'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {emp.company === 'rimamandiri' ? 'Riama Mandiri' : 'PT RBS'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-text-secondary font-medium">
                            {emp.school_unit || '-'}
                          </td>
                          <td className="py-3 px-3">
                            {emp.shift ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-100 text-sky-800"
                                title={emp.shift.formatted_time || `${emp.shift.start_time} - ${emp.shift.end_time}`}
                              >
                                <Clock className="w-3 h-3" />
                                <span>{emp.shift.name} ({emp.shift.code})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Default (Reguler)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={emp.shift_id || ''}
                              onChange={(e) => {
                                const newShiftId = Number(e.target.value);
                                if (newShiftId) {
                                  handleQuickAssignSingle(emp.id, newShiftId);
                                }
                              }}
                              className="px-2.5 py-1 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                              <option value="">Pilih Shift...</option>
                              {shifts.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.code} - {s.name} ({s.formatted_time || `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}`})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {shiftEmployeeMeta.total > shiftEmployeePerPage && (
              <div className="pt-2">
                <Pagination
                  meta={{
                    current_page: shiftEmployeePage,
                    last_page: shiftEmployeeMeta.last_page,
                    per_page: shiftEmployeePerPage,
                    total: shiftEmployeeMeta.total,
                    from: shiftEmployeeMeta.from ?? undefined,
                    to: shiftEmployeeMeta.to ?? undefined,
                  } as any}
                  onPageChange={(page) => setShiftEmployeePage(page)}
                  perPage={shiftEmployeePerPage}
                  onPerPageChange={(newPerPage) => {
                    setShiftEmployeePerPage(newPerPage);
                    setShiftEmployeePage(1);
                  }}
                  isLoading={shiftEmployeesLoading}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: TAMBAH / EDIT MASTER SHIFT */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-panel rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border-subtle space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-text-primary">
                  {editingShift ? 'Edit Master Shift' : 'Tambah Master Shift Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Nama Shift <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    placeholder="Misal: Shift 1 / Pagi (Sekolah)"
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Kode Shift (Unik) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shiftForm.code}
                    onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value.toUpperCase() })}
                    placeholder="Misal: PAGI-1"
                    className="w-full px-3 py-2 text-xs font-mono bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Entitas / Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={shiftForm.company}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setShiftForm({ ...shiftForm, company: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-75 disabled:bg-surface-container/60"
                  >
                    {isSuperAdmin && <option value="all">Semua Entitas (Bersama)</option>}
                    <option value="rbs">PT RBS (Rimbun Buana Sejahtera)</option>
                    <option value="rimamandiri">PT Riama Mandiri Pratama</option>
                  </select>
                  {!isSuperAdmin && (
                    <p className="text-[10px] text-text-muted mt-1">
                      Otomatis terkunci untuk entitas Anda ({shiftForm.company === 'rbs' ? 'Rimbun Buana Sejahtera' : 'Riama Mandiri Pratama'}).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Jam Mulai Masuk <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Jam Selesai Pulang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Toleransi Terlambat (Menit)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={shiftForm.late_tolerance_minutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, late_tolerance_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-mono bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Target Jam Kerja (Jam)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    min={1}
                    max={24}
                    value={shiftForm.work_hours}
                    onChange={(e) => setShiftForm({ ...shiftForm, work_hours: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-mono bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 p-3 bg-surface-container/60 rounded-xl border border-border-subtle cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shiftForm.cross_day}
                      onChange={(e) => setShiftForm({ ...shiftForm, cross_day: e.target.checked })}
                      className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                    />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">
                        Shift Melewati Tengah Malam (+1 Hari)
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Aktifkan untuk shift malam/satpam (misal 23:00 s.d 07:00 pagi keesokan harinya).
                      </div>
                    </div>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Deskripsi / Catatan Tambahan
                  </label>
                  <textarea
                    rows={2}
                    value={shiftForm.description}
                    onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
                    placeholder="Catatan peruntukan shift ini..."
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={shiftModalSaving}
                  className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {shiftModalSaving ? 'Menyimpan...' : editingShift ? 'Simpan Perubahan' : 'Tambahkan Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PENUGASAN SHIFT MASSAL / PER UNIT SEKOLAH */}
      {assignShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-panel rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border-subtle space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-text-primary">Penugasan Shift Kerja</h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignShiftModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Pilih Shift Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignTargetShiftId}
                  onChange={(e) => setAssignTargetShiftId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">Pilih Shift...</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) - {s.formatted_time || `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1.5">
                  Metode Penugasan <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 bg-surface-container/60 rounded-xl border border-border-subtle cursor-pointer">
                    <input
                      type="radio"
                      name="assignMode"
                      value="selected"
                      checked={assignShiftMode === 'selected'}
                      onChange={() => setAssignShiftMode('selected')}
                      className="text-primary accent-primary cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-text-primary">
                        Karyawan Terpilih ({selectedShiftUserIds.length} Orang)
                      </span>
                      <p className="text-[11px] text-text-muted">
                        Terapkan ke baris karyawan yang Anda centang pada tabel.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-surface-container/60 rounded-xl border border-border-subtle cursor-pointer">
                    <input
                      type="radio"
                      name="assignMode"
                      value="school_unit"
                      checked={assignShiftMode === 'school_unit'}
                      onChange={() => setAssignShiftMode('school_unit')}
                      className="text-primary accent-primary cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-text-primary">
                        Berdasarkan Unit Sekolah
                      </span>
                      <p className="text-[11px] text-text-muted">
                        Seluruh karyawan yang ditugaskan di unit sekolah tersebut akan mendapatkan shift ini.
                      </p>
                    </div>
                  </label>

                  {isSuperAdmin && (
                    <label className="flex items-center gap-2.5 p-2.5 bg-surface-container/60 rounded-xl border border-border-subtle cursor-pointer">
                      <input
                        type="radio"
                        name="assignMode"
                        value="company"
                        checked={assignShiftMode === 'company'}
                        onChange={() => setAssignShiftMode('company')}
                        className="text-primary accent-primary cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-text-primary">
                          Seluruh Karyawan Entitas Perusahaan
                        </span>
                        <p className="text-[11px] text-text-muted">
                          Terapkan ke semua karyawan di RBS atau Riama Mandiri.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {assignShiftMode === 'school_unit' && (
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Pilih Unit Sekolah Tujuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={assignTargetSchoolUnit}
                    onChange={(e) => setAssignTargetSchoolUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">Pilih Unit Sekolah...</option>
                    {schoolUnitOptions.map((unit) => (
                      <option key={unit.name} value={unit.name}>
                        {unit.name} ({unit.employee_count} Karyawan)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {assignShiftMode === 'company' && isSuperAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Pilih Entitas Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={assignTargetCompany}
                    onChange={(e) => setAssignTargetCompany(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="rbs">PT Rimbun Buana Sejahtera (RBS)</option>
                    <option value="rimamandiri">PT Riama Mandiri Pratama</option>
                  </select>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignShiftModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAssignShift}
                disabled={assignShiftSaving}
                className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {assignShiftSaving ? 'Menerapkan...' : 'Terapkan Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: KONFIRMASI HAPUS SHIFT */}
      {deleteShiftModalOpen && deletingShift && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-panel rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-border-subtle space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary">Hapus / Nonaktifkan Shift</h4>
                <p className="text-xs text-text-muted">Konfirmasi tindakan penghapusan</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Apakah Anda yakin ingin menghapus master shift <strong>{deletingShift.name} ({deletingShift.code})</strong>?
              Jika shift ini sudah pernah dipakai oleh riwayat presensi, sistem akan secara aman menonaktifkan shift ini agar integritas data presensi historis tetap terjaga.
            </p>

            <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteShiftModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteShift}
                disabled={deleteShiftSaving}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {deleteShiftSaving ? 'Memproses...' : 'Ya, Hapus Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENGATURAN RADIUS KANTOR PUSAT & JAM KERJA BAKU */}
      {activeTab === 'settings' && (
        <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-xs max-w-4xl mx-auto space-y-6">
          <div className="pb-4 border-b border-border-subtle">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary" />
                <span>Konfigurasi Jam Kerja Baku & Kebijakan Presensi</span>
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${
                isSuperAdmin
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {isSuperAdmin ? 'Akses Super Admin (Full Edit)' : 'Akses Admin (Edit Jam Kerja Baku)'}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Pengaturan jam masuk awal, jam pulang, toleransi keterlambatan untuk seluruh karyawan/admin, serta patokan Kantor Pusat.
            </p>
          </div>

          {/* Panduan Jelas Pengaturan Jam Masuk & Toleransi Karyawan */}
          <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/90 flex items-start gap-3 text-blue-900 text-xs">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="font-bold text-[13px] text-blue-950 flex items-center justify-between flex-wrap gap-2">
                <span>Panduan Letak Pengaturan Jam Masuk & Toleransi Karyawan / User</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('shifts')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-2xs transition-all cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Buka Tab Pengaturan Shift ({shifts.length})</span>
                </button>
              </div>
              <p className="leading-relaxed text-blue-900/90">
                <strong>1. Jam Kerja Baku (Form Bagian 1 di bawah):</strong> Mengatur jam masuk standar perusahaan ({settings?.work_start_time || '08:00'} - {settings?.work_end_time || '17:00'}) dan batas toleransi keterlambatan ({settings?.late_tolerance_minutes || 15} Menit). Pengaturan ini otomatis menjadi patokan standar bagi seluruh Karyawan, User, dan Admin yang menggunakan jadwal reguler.
              </p>
              <p className="leading-relaxed text-blue-900/90">
                <strong>2. Jam Kerja Fleksibel / Khusus Unit Sekolah:</strong> Jika karyawan di unit sekolah atau divisi tertentu memiliki jam masuk/shift yang berbeda-beda, silakan gunakan tab <strong>Pengaturan Shift</strong> untuk membuat shift baru (Shift Pagi, Shift Siang, Shift Malam, dll.) dan menugaskannya ke karyawan atau unit sekolah secara massal.
              </p>
            </div>
          </div>

          {settingsLoading || !settings ? (
            <div className="py-12 text-center text-text-muted text-xs">
              Memuat konfigurasi kantor...
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* SECTION 1: JAM KERJA BAKU & TOLERANSI KARYAWAN (BISA DIEDIT ADMIN & SUPER ADMIN) */}
              <div className="bg-surface-container/60 border border-border-subtle rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      1. Jam Awal Masuk Baku & Toleransi Keterlambatan Karyawan / User
                    </h3>
                    <p className="text-[11px] text-text-muted">
                      Berlaku untuk seluruh karyawan dan admin yang menggunakan jadwal standar perusahaan.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Jam Masuk Baku */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                      <span>Jam Masuk Baku</span>
                      <span className="text-[10px] text-primary font-bold">(Awal Masuk)</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={settings.work_start_time}
                      onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[10.5px] text-text-muted mt-1 block">
                      Waktu karyawan mulai jam kerja operasional.
                    </span>
                  </div>

                  {/* Jam Pulang Baku */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">
                      Jam Pulang Baku
                    </label>
                    <input
                      type="time"
                      required
                      value={settings.work_end_time}
                      onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[10.5px] text-text-muted mt-1 block">
                      Batas akhir jam operasional harian.
                    </span>
                  </div>

                  {/* Toleransi Menit Terlambat */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                      <span>Toleransi Keterlambatan</span>
                      <span className="text-[10px] text-amber-600 font-bold">*Toleransi</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        required
                        value={settings.late_tolerance_minutes}
                        onChange={(e) => setSettings({ ...settings, late_tolerance_minutes: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-medium">
                        Menit
                      </span>
                    </div>
                    <span className="text-[10.5px] text-text-muted mt-1 block">
                      Batas menit lewat dari jam masuk sebelum status dicatat Terlambat.
                    </span>
                  </div>
                </div>

                <div className="text-[11.5px] text-emerald-800 bg-emerald-50/80 rounded-xl px-3.5 py-2.5 border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Jika karyawan masuk pada jam <strong>{settings.work_start_time}</strong> dengan toleransi <strong>{settings.late_tolerance_minutes} menit</strong>, karyawan yang absen lewat dari pukul <strong>{(() => {
                      try {
                        const [h, m] = (settings.work_start_time || '08:00').split(':').map(Number);
                        const total = h * 60 + m + (settings.late_tolerance_minutes || 0);
                        const endH = Math.floor(total / 60) % 24;
                        const endM = total % 60;
                        return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                      } catch {
                        return '08:15';
                      }
                    })()}</strong> akan otomatis berstatus <strong>Terlambat</strong>.
                  </span>
                </div>
              </div>

              {/* SECTION 2: TITIK KOORDINAT GPS & RADIUS KANTOR PUSAT (POINT 10: SUPER ADMIN ONLY) */}
              <div className="bg-surface-container/60 border border-border-subtle rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
                      <Building className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">
                        2. Titik Patokan GPS Kantor Pusat (Wajib Presensi Admin - Point 10)
                      </h3>
                      <p className="text-[11px] text-text-muted">
                        Titik lokasi Kantor Pusat ini digunakan khusus untuk mengunci kehadiran akun Admin.
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isSuperAdmin
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {isSuperAdmin ? 'Super Admin Edit' : 'Dikelola Super Admin (Read-Only)'}
                  </span>
                </div>

                {!isSuperAdmin && (
                  <p className="text-[11.5px] text-amber-800 bg-amber-50/80 rounded-xl px-3 py-2 border border-amber-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Sesuai Point 10, titik koordinat GPS dan batas radius Kantor Pusat dikunci oleh <strong>Super Admin</strong> agar presensi akun Admin terjaga kepatuhannya.
                    </span>
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nama Kantor */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">
                      Nama Kantor Pusat / Default
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        disabled={!isSuperAdmin}
                        value={settings.office_name}
                        onChange={(e) => setSettings({ ...settings, office_name: e.target.value })}
                        placeholder="Contoh: Kantor Pusat RBS / Riama Mandiri"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Latitude */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">
                      Latitude Kantor Pusat
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      disabled={!isSuperAdmin}
                      value={settings.latitude}
                      onChange={(e) => setSettings({ ...settings, latitude: parseFloat(e.target.value) || 0 })}
                      placeholder="-6.2088000"
                      className="w-full px-3 py-2 text-xs font-mono bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Longitude */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">
                      Longitude Kantor Pusat
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      disabled={!isSuperAdmin}
                      value={settings.longitude}
                      onChange={(e) => setSettings({ ...settings, longitude: parseFloat(e.target.value) || 0 })}
                      placeholder="106.8456000"
                      className="w-full px-3 py-2 text-xs font-mono bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Tombol Ambil Lokasi Super Admin Saat Ini */}
                  {isSuperAdmin && (
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={gpsDetecting}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer"
                      >
                        <Crosshair className={`w-3.5 h-3.5 ${gpsDetecting ? 'animate-spin' : ''}`} />
                        <span>{gpsDetecting ? 'Mengambil GPS...' : 'Gunakan Koordinat GPS Super Admin Saat Ini'}</span>
                      </button>
                    </div>
                  )}

                  {/* Radius Meter */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">
                      Batas Radius Presensi Admin di Kantor Pusat (Meter)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={10}
                        max={10000}
                        required
                        disabled={!isSuperAdmin}
                        value={settings.radius_meters}
                        onChange={(e) => setSettings({ ...settings, radius_meters: parseInt(e.target.value) || 50 })}
                        className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-medium">
                        Meter
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button (Aktif untuk Admin dan Super Admin) */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                <span className="text-[11.5px] text-text-muted">
                  Perubahan jam masuk dan toleransi akan otomatis tersinkronisasi ke seluruh karyawan dan shift Reguler.
                </span>
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{settingsSaving ? 'Menyimpan...' : 'Simpan Pengaturan Jam Kerja & Kebijakan'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lightbox Modal Foto Bukti Kehadiran */}
      {previewPhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewPhotoModal(null)}
        >
          <div
            className="relative max-w-lg w-full bg-surface-panel rounded-2xl overflow-hidden shadow-2xl border border-border-subtle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-border-subtle bg-surface-container">
              <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-primary" />
                <span>Foto Bukti Kehadiran Karyawan</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 bg-black/90 flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={getStorageUrl(previewPhotoModal)}
                alt="Foto Bukti Kehadiran"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (!target.dataset.triedFallback && previewPhotoModal) {
                    target.dataset.triedFallback = 'true';
                    const clean = previewPhotoModal.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?(api\/storage|storage)\/?/, '');
                    target.src = `/api/storage/${clean}`;
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* POINT 7: MODAL EDIT PRESENSI KARYAWAN */}
      {editAttendanceModalOpen && editingAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-text-primary">Edit Data Presensi Karyawan</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditAttendanceModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Karyawan */}
            <div className="p-3 bg-surface-container rounded-xl border border-border-subtle flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-text-primary">{editingAttendance.user?.name || '-'}</div>
                <div className="text-xs text-text-muted font-mono mt-0.5">
                  NIK: {editingAttendance.user?.nik || '-'} • Unit: {editingAttendance.user?.school_unit || '-'}
                </div>
              </div>
              <span className="text-[10.5px] uppercase font-mono font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                ID #{editingAttendance.id}
              </span>
            </div>

            <form onSubmit={handleSaveEditAttendance} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Tanggal Presensi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Jenis Presensi */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Jenis Presensi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editForm.attendance_type}
                    onChange={(e) => setEditForm({ ...editForm, attendance_type: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                  >
                    <option value="masuk">Masuk Kerja (Kantor / Sekolah)</option>
                    <option value="dinas_luar">Perjalanan Dinas</option>
                    <option value="libur">Libur / Hari Off</option>
                    <option value="sakit">Sakit (Surat Dokter)</option>
                    <option value="izin">Izin Resmi</option>
                  </select>
                </div>
              </div>

              {/* Lokasi / Unit Sekolah */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Nama Titik Lokasi / Unit Sekolah
                </label>
                <input
                  type="text"
                  placeholder="Contoh: SMAN 1 Jakarta / Unit Penugasan"
                  value={editForm.location_name}
                  onChange={(e) => setEditForm({ ...editForm, location_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {editForm.attendance_type !== 'libur' && editForm.attendance_type !== 'sakit' && editForm.attendance_type !== 'izin' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-container/50 rounded-xl border border-border-subtle">
                  {/* Jam Masuk */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Jam Masuk (WIB)
                    </label>
                    <input
                      type="time"
                      value={editForm.check_in_time}
                      onChange={(e) => setEditForm({ ...editForm, check_in_time: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Status Masuk */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Ketepatan Masuk
                    </label>
                    <select
                      value={editForm.check_in_status}
                      onChange={(e) => setEditForm({ ...editForm, check_in_status: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="on_time">Tepat Waktu</option>
                      <option value="late">Terlambat</option>
                    </select>
                  </div>

                  {/* Jam Pulang */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Jam Pulang (WIB)
                    </label>
                    <input
                      type="time"
                      value={editForm.check_out_time}
                      onChange={(e) => setEditForm({ ...editForm, check_out_time: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Status Keseluruhan */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Status Kehadiran
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="present">Hadir Normal</option>
                      <option value="late">Terlambat</option>
                      <option value="absent">Alpa / Tidak Hadir</option>
                      <option value="permit">Izin / Cuti</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Catatan Admin */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Catatan / Keterangan Edit
                </label>
                <textarea
                  rows={2}
                  placeholder="Alasan perubahan data presensi oleh admin..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditAttendanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border-subtle text-text-secondary hover:bg-surface-container transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POINT 7: MODAL INPUT PRESENSI MANUAL */}
      {createAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-text-primary">Input Presensi Karyawan Manual</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateAttendanceModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreateAttendance} className="space-y-3.5">
              {/* Pilih Karyawan */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Pilih Karyawan <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={createForm.user_id}
                  onChange={(e) => setCreateForm({ ...createForm, user_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {allEmployees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} (NIK: {u.nik || '-'}) {u.school_unit ? `• ${u.school_unit}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Tanggal Presensi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Jenis Presensi */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Jenis Presensi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.attendance_type}
                    onChange={(e) => setCreateForm({ ...createForm, attendance_type: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                  >
                    <option value="masuk">Masuk Kerja (Kantor / Sekolah)</option>
                    <option value="dinas_luar">Perjalanan Dinas</option>
                    <option value="libur">Libur / Hari Off</option>
                    <option value="sakit">Sakit (Surat Dokter)</option>
                    <option value="izin">Izin Resmi</option>
                  </select>
                </div>
              </div>

              {/* Titik Lokasi */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Nama Titik Lokasi / Unit Sekolah
                </label>
                <input
                  type="text"
                  placeholder="Contoh: SMAN 1 Jakarta / Unit Penugasan"
                  value={createForm.location_name}
                  onChange={(e) => setCreateForm({ ...createForm, location_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {createForm.attendance_type !== 'libur' && createForm.attendance_type !== 'sakit' && createForm.attendance_type !== 'izin' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-container/50 rounded-xl border border-border-subtle">
                  {/* Jam Masuk */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Jam Masuk (WIB)
                    </label>
                    <input
                      type="time"
                      value={createForm.check_in_time}
                      onChange={(e) => setCreateForm({ ...createForm, check_in_time: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Ketepatan Masuk */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Ketepatan Masuk
                    </label>
                    <select
                      value={createForm.check_in_status}
                      onChange={(e) => setCreateForm({ ...createForm, check_in_status: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="on_time">Tepat Waktu</option>
                      <option value="late">Terlambat</option>
                    </select>
                  </div>

                  {/* Jam Pulang */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Jam Pulang (WIB)
                    </label>
                    <input
                      type="time"
                      value={createForm.check_out_time}
                      onChange={(e) => setCreateForm({ ...createForm, check_out_time: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Status Kehadiran */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Status Kehadiran
                    </label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs bg-surface-panel border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="present">Hadir Normal</option>
                      <option value="late">Terlambat</option>
                      <option value="absent">Alpa / Tidak Hadir</option>
                      <option value="permit">Izin / Cuti</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Catatan */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Catatan Admin (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan input manual..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateAttendanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border-subtle text-text-secondary hover:bg-surface-container transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{createSaving ? 'Menyimpan...' : 'Simpan Presensi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POINT 7: MODAL KONFIRMASI HAPUS PRESENSI */}
      {deleteConfirmModalOpen && deletingAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Hapus Data Presensi</h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus catatan presensi untuk{' '}
                  <strong className="text-text-primary font-semibold">
                    {deletingAttendance.user?.name || 'Karyawan'}
                  </strong>{' '}
                  pada tanggal{' '}
                  <strong className="text-text-primary font-semibold">
                    {deletingAttendance.date ? String(deletingAttendance.date).slice(0, 10) : '-'}
                  </strong>
                  ?
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-xs text-rose-900 leading-relaxed">
              Tindakan ini tidak dapat dibatalkan. Riwayat kehadiran ini akan dihapus dari sistem dan dicatat pada log audit aktivitas.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border-subtle text-text-secondary hover:bg-surface-container transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POINT 15: MODAL VERIFIKASI SURAT SAKIT / IZIN */}
      {verifyModalOpen && verifyingAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-text-primary">
                  Verifikasi Surat {verifyingAttendance.attendance_type === 'sakit' ? 'Keterangan Sakit (Dokter)' : 'Izin Resmi'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVerifyModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Karyawan */}
            <div className="p-3.5 bg-surface-container/60 rounded-xl border border-border-subtle space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text-primary">
                  {verifyingAttendance.user?.name || 'Karyawan'}
                </span>
                <span className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded-full ${
                  verifyingAttendance.approval_status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : verifyingAttendance.approval_status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  Status: {verifyingAttendance.approval_status}
                </span>
              </div>
              <div className="text-xs text-text-muted font-mono">
                NIK: {verifyingAttendance.user?.nik || '-'} • Unit: {verifyingAttendance.user?.school_unit || '-'} • Perusahaan: {verifyingAttendance.user?.company || '-'}
              </div>
              <div className="text-xs text-text-secondary pt-1">
                Tanggal: <strong className="font-semibold text-text-primary">{verifyingAttendance.date ? String(verifyingAttendance.date).slice(0, 10) : '-'}</strong>
              </div>
            </div>

            {/* Alasan / Catatan Karyawan */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">
                Alasan / Keterangan dari Karyawan:
              </label>
              <div className="p-3 bg-surface-panel border border-border-subtle rounded-xl text-xs text-text-primary whitespace-pre-wrap">
                {verifyingAttendance.notes || 'Tidak ada catatan tambahan.'}
              </div>
            </div>

            {/* Foto Surat Keterangan Sakit / Izin */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                <span>Foto Surat Dokter / Surat Izin Resmi:</span>
                <span className="text-[11px] text-text-muted">Klik foto untuk melihat ukuran penuh</span>
              </label>
              {(verifyingAttendance.photo_url || verifyingAttendance.photo_full_url) ? (
                <div
                  onClick={() => {
                    const raw = verifyingAttendance.photo_url || verifyingAttendance.photo_full_url;
                    setPreviewPhotoModal(getStorageUrl(raw!));
                  }}
                  className="relative group border border-border-subtle rounded-xl overflow-hidden bg-black/5 aspect-4/3 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all shadow-xs"
                >
                  <img
                    src={getStorageUrl((verifyingAttendance.photo_url || verifyingAttendance.photo_full_url)!)}
                    alt="Surat Dokter / Izin"
                    className="w-full h-full object-contain group-hover:scale-102 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white text-xs font-medium transition-opacity">
                    <Eye className="w-4 h-4" />
                    <span>Perbesar Foto</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-surface-container rounded-xl text-center text-xs text-text-muted border border-border-subtle">
                  Foto surat tidak tersedia atau belum diunggah.
                </div>
              )}
            </div>

            {/* Input Alasan Penolakan (Jika Menolak) */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-secondary">
                Alasan Penolakan (Wajib diisi bila menolak surat):
              </label>
              <textarea
                rows={2}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Contoh: Foto surat dokter buram/tidak terbaca, mohon ajukan ulang..."
                className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setVerifyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border-subtle text-text-secondary hover:bg-surface-container transition-all cursor-pointer"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteVerification('rejected')}
                  disabled={verifyLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{verifyLoading ? 'Memproses...' : 'Tolak Surat'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteVerification('approved')}
                  disabled={verifyLoading}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{verifyLoading ? 'Memproses...' : 'Setujui & Sahkan'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POINT 13: FLOATING ACTION BAR SAAT KARYAWAN DIPILIH UNTUK LAPORAN SP */}
      {selectedEmployeeIds.length > 0 && activeTab === 'recap' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface-panel/95 backdrop-blur-md border border-primary/40 shadow-xl rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-text-primary">
              {selectedEmployeeIds.length} Karyawan Dipilih
            </span>
            <span className="text-[11px] text-text-muted hidden sm:inline">
              (Laporan {filterType === 'sp' ? selectedSp : selectedDate})
            </span>
          </div>
          <div className="h-4 w-px bg-border-subtle hidden sm:block" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportAttendance('xlsx')}
              disabled={exportingAttendanceType !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Export Laporan Excel untuk karyawan yang dipilih"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>
                {exportingAttendanceType === 'xlsx' ? 'Mengekspor...' : `Export Excel (${selectedEmployeeIds.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleExportAttendance('csv')}
              disabled={exportingAttendanceType !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-primary bg-surface-container hover:bg-surface-container/80 border border-border-subtle rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Export Laporan CSV untuk karyawan yang dipilih"
            >
              <Download className="w-3.5 h-3.5 text-text-muted" />
              <span>
                {exportingAttendanceType === 'csv' ? '...' : `CSV (${selectedEmployeeIds.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={handleClearSelectedEmployees}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-container rounded-lg transition-all cursor-pointer ml-1"
              title="Batalkan Pilihan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

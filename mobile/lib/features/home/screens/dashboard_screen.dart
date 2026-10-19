import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/models/user_model.dart';
import '../../auth/providers/auth_provider.dart';
import '../../auth/screens/login_screen.dart';
import '../models/announcement_model.dart';
import '../models/attendance_today_model.dart';
import '../services/announcement_service.dart';
import '../services/attendance_service.dart';
import '../services/employee_portal_service.dart';
import '../../../core/storage/token_storage.dart';
import '../widgets/onboarding_tutorial_dialog.dart';
import 'complaints_screen.dart';
import 'live_chat_screen.dart';
import 'profile_edit_screen.dart';
import 'live_attendance_camera_screen.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  final UserModel user;

  const DashboardScreen({super.key, required this.user});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentTabIndex = 0;
  late Timer _clockTimer;
  DateTime _currentTime = DateTime.now();

  // Settings & Preferences States
  bool _reminderAttendance = true;
  bool _reminderBroadcast = true;
  bool _isGpsAllowed = true;

  // Realtime Data States
  TodayAttendanceDataModel? _todayAttendance;
  Map<String, dynamic>? _dashboardSummary;
  List<AnnouncementModel>? _announcements;
  List<dynamic>? _historyList;
  List<dynamic>? _payrollList;
  List<dynamic>? _workReportsList;
  Map<String, dynamic>? _profileData;
  DateTime _historySelectedMonth = DateTime.now();

  bool _isLoadingAttendance = true;
  bool _isLoadingAnnouncements = true;
  bool _isLoadingHistory = false;
  bool _isLoadingPayrolls = false;
  bool _isLoadingReports = false;
  bool _isLoadingProfile = false;
  bool _isSubmittingAction = false;

  // Work Report Form Controllers & States (4 Baku Activities matching Web)
  DateTime _reportSelectedDate = DateTime.now();

  // Slot 1: Absen Masuk (Wajib)
  File? _photoAbsen;
  final TextEditingController _descAbsenController = TextEditingController();

  // Slot 2: Kegiatan 1 (Wajib)
  File? _photoKegiatan1;
  final TextEditingController _descKegiatan1Controller = TextEditingController();

  // Slot 3: Kegiatan 2 (Wajib)
  File? _photoKegiatan2;
  final TextEditingController _descKegiatan2Controller = TextEditingController();

  // Slot 4: Kegiatan Lain (Opsional)
  File? _photoKegiatanLain;
  final TextEditingController _descKegiatanLainController = TextEditingController();

  bool _isSubmittingReport = false;

  void _restoreStatusBar() {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _restoreStatusBar();
    _loadAllRealtimeData();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        final tz = _todayAttendance?.timezone ?? 'WIB';
        final int tzOffsetHours = tz == 'WIT' ? 9 : (tz == 'WITA' ? 8 : 7);
        final nowUtc = DateTime.now().toUtc();
        setState(() {
          _currentTime = nowUtc.add(Duration(hours: tzOffsetHours));
        });
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAndShowTutorial();
    });
  }

  Future<void> _checkAndShowTutorial({bool force = false}) async {
    if (!mounted) return;
    try {
      final seen = await TokenStorage.hasSeenTutorial();
      if (!seen || force) {
        if (mounted) {
          await Future.delayed(const Duration(milliseconds: 650));
          if (mounted) {
            await OnboardingTutorialDialog.show(
              context,
              user: widget.user,
              onFinish: () async {
                await TokenStorage.setHasSeenTutorial(true);
              },
            );
          }
        }
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    _descAbsenController.dispose();
    _descKegiatan1Controller.dispose();
    _descKegiatan2Controller.dispose();
    _descKegiatanLainController.dispose();
    super.dispose();
  }

  Future<void> _loadAllRealtimeData() async {
    setState(() {
      _isLoadingAttendance = true;
      _isLoadingAnnouncements = true;
    });

    try {
      final results = await Future.wait([
        AttendanceService.getTodayAttendance(),
        AttendanceService.getDashboardSummary(),
        AnnouncementService.getAnnouncements(),
      ]);

      if (mounted) {
        setState(() {
          _todayAttendance = results[0] as TodayAttendanceDataModel?;
          _dashboardSummary = results[1] as Map<String, dynamic>?;
          _announcements = results[2] as List<AnnouncementModel>?;
          _isLoadingAttendance = false;
          _isLoadingAnnouncements = false;
        });
      }

      // Preload real data for tabs in parallel
      _loadPayrolls();
      _loadReports();
      _loadHistory();
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoadingAttendance = false;
          _isLoadingAnnouncements = false;
        });
      }
    }
  }

  Future<void> _loadHistory() async {
    setState(() => _isLoadingHistory = true);
    final monthStr = DateFormat('yyyy-MM').format(_historySelectedMonth);
    final list = await AttendanceService.getHistory(month: monthStr);
    if (mounted) {
      setState(() {
        _historyList = list;
        _isLoadingHistory = false;
      });
    }
  }

  void _prevHistoryMonth() {
    setState(() {
      _historySelectedMonth = DateTime(_historySelectedMonth.year, _historySelectedMonth.month - 1);
    });
    _loadHistory();
  }

  void _nextHistoryMonth() {
    setState(() {
      _historySelectedMonth = DateTime(_historySelectedMonth.year, _historySelectedMonth.month + 1);
    });
    _loadHistory();
  }

  Future<void> _pickHistoryMonth() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _historySelectedMonth,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      initialDatePickerMode: DatePickerMode.year,
    );
    if (picked != null) {
      setState(() {
        _historySelectedMonth = DateTime(picked.year, picked.month);
      });
      _loadHistory();
    }
  }

  Future<void> _loadPayrolls() async {
    setState(() => _isLoadingPayrolls = true);
    final list = await EmployeePortalService.getPayrolls();
    if (mounted) {
      setState(() {
        _payrollList = list;
        _isLoadingPayrolls = false;
      });
    }
  }

  Future<void> _loadReports() async {
    setState(() => _isLoadingReports = true);
    final list = await EmployeePortalService.getWorkReports();
    if (mounted) {
      setState(() {
        _workReportsList = list;
        _isLoadingReports = false;
      });
    }
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoadingProfile = true);
    final data = await EmployeePortalService.getProfile();
    if (mounted) {
      setState(() {
        _profileData = data;
        _isLoadingProfile = false;
      });
    }
  }

  Future<Position?> _determinePosition() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Layanan lokasi (GPS) belum aktif. Silakan aktifkan GPS perangkat Anda.'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return null;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Izin akses lokasi ditolak. Izin diperlukan untuk validasi presensi.'),
                backgroundColor: AppColors.error,
              ),
            );
          }
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Izin akses lokasi ditolak permanen. Buka Pengaturan untuk mengizinkan.'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return null;
      }

      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal memperoleh posisi GPS: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return null;
    }
  }

  // Tenant Theming Differentiators
  bool get isRiama => widget.user.isRiama;

  Color get primaryBrandColor => isRiama ? const Color(0xFF065F46) : const Color(0xFF00163D);
  Color get primaryBrandContainer => isRiama ? const Color(0xFF047857) : const Color(0xFF0F2B5C);
  Color get secondaryAccentColor => isRiama ? const Color(0xFF059669) : const Color(0xFF4648D4);
  Color get secondaryLightColor => isRiama ? const Color(0xFFD1FAE5) : const Color(0xFFE1E0FF);
  Color get secondaryDarkColor => isRiama ? const Color(0xFF064E3B) : const Color(0xFF2F2EBE);

  String get companyName => isRiama ? 'PT. Riama Mandiri Pratama' : 'PT. Rimbun Buana Sejahtera';
  String get companyShortCode => isRiama ? 'RIAMA MANDIRI' : 'RBS GLOBAL';

  // Format Helper: Rupiah Currency
  String _formatRupiah(dynamic amount) {
    if (amount == null) return 'Rp 0';
    final numVal = (num.tryParse(amount.toString()) ?? 0).toInt();
    final isNegative = numVal < 0;
    final absVal = numVal.abs().toString();
    final buffer = StringBuffer();
    for (int i = 0; i < absVal.length; i++) {
      if (i > 0 && (absVal.length - i) % 3 == 0) {
        buffer.write('.');
      }
      buffer.write(absVal[i]);
    }
    return '${isNegative ? '-Rp ' : 'Rp '}$buffer';
  }

  // Format Helper: Period Name (sama seperti web dashboard: langsung menampilkan bulan & tahun tanpa kata SP)
  String _formatPeriodName(String period) {
    final trimmed = period.trim();
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    // Cek format SP X / SPX (e.g. SP 1 -> Januari 2026, SP 8 -> Agustus 2026)
    final spMatch = RegExp(r'^SP\s*(\d+)$', caseSensitive: false).firstMatch(trimmed);
    if (spMatch != null) {
      final num = int.tryParse(spMatch.group(1)!) ?? 1;
      if (num >= 1 && num <= 12) {
        return '${monthNames[num - 1]} 2026';
      }
      return 'Bulan $num 2026';
    }

    // Cek format Surat Pesanan X
    final suratPesananMatch = RegExp(r'^Surat\s+Pesanan\s*(\d+)', caseSensitive: false).firstMatch(trimmed);
    if (suratPesananMatch != null) {
      final num = int.tryParse(suratPesananMatch.group(1)!) ?? 1;
      if (num >= 1 && num <= 12) {
        return '${monthNames[num - 1]} 2026';
      }
      return 'Bulan $num 2026';
    }

    // Cek format YYYY-MM (e.g. 2026-08 -> Agustus 2026, 2026-03 -> Maret 2026)
    final match = RegExp(r'^(\d{4})-(\d{2})$').firstMatch(trimmed);
    if (match != null) {
      final year = match.group(1);
      final month = int.tryParse(match.group(2)!) ?? 1;
      if (month >= 1 && month <= 12) {
        return '${monthNames[month - 1]} $year';
      }
    }

    return trimmed;
  }

  // Format Helper: Time Display
  String _formatTimeDisplay(String? timeStr) {
    final tz = _todayAttendance?.timezone ?? 'WIB';
    if (timeStr == null || timeStr.isEmpty || timeStr == 'null') {
      return '--:-- $tz';
    }
    final clean = timeStr.trim();
    final parts = clean.split(':');
    if (parts.length >= 2) {
      return '${parts[0].padLeft(2, '0')}:${parts[1].padLeft(2, '0')} $tz';
    }
    try {
      final dt = DateTime.parse(clean).toLocal();
      return '${DateFormat('HH:mm').format(dt)} $tz';
    } catch (_) {
      return '$clean $tz';
    }
  }

  String _formatIndonesianDateShort(DateTime dt) {
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    final dayName = days[dt.weekday - 1];
    final monthName = months[dt.month - 1];
    return '$dayName, ${dt.day} $monthName ${dt.year}';
  }

  String _getGreetingMessage() {
    final hour = DateTime.now().hour;
    if (hour < 11) return 'Selamat Pagi,';
    if (hour < 15) return 'Selamat Siang,';
    if (hour < 18) return 'Selamat Sore,';
    return 'Selamat Malam,';
  }

  // -------------------------------------------------------------
  // Attendance Action Handlers (Check-in & Check-out)
  // -------------------------------------------------------------
  void _openCheckInModal() {
    final locationName = _todayAttendance?.assignedLocation?.name ?? 'Lokasi Terdaftar';
    final radiusM = _todayAttendance?.assignedLocation?.radiusMeters ?? 100;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(28),
            topRight: Radius.circular(28),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.neutral300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: secondaryLightColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.fingerprint_rounded, color: secondaryDarkColor, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Presensi Masuk Hari Ini',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: primaryBrandColor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$locationName (Radius: ${radiusM}m)',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: AppColors.neutral500,
                          height: 1.25,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              'Pilih jenis presensi kehadiran Anda:',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.neutral700,
              ),
            ),
            const SizedBox(height: 12),

            // Option 1: Hadir Masuk dengan Selfie & GPS
            _buildCheckInOptionTile(
              icon: Icons.camera_alt_rounded,
              title: 'Hadir Masuk (Selfie & GPS)',
              subtitle: 'Ambil foto selfie di lokasi kantor/sekolah yang ditugaskan',
              color: secondaryAccentColor,
              onTap: () {
                Navigator.pop(ctx);
                _performCheckInWithCamera('masuk');
              },
            ),

            const SizedBox(height: 10),

            // Option 2: Dinas Luar
            _buildCheckInOptionTile(
              icon: Icons.business_center_rounded,
              title: 'Tugas / Dinas Luar',
              subtitle: 'Presensi bertugas di luar lokasi kantor utama',
              color: const Color(0xFF2563EB),
              onTap: () {
                Navigator.pop(ctx);
                _promptNotesAndCheckIn('dinas_luar');
              },
            ),

            const SizedBox(height: 10),

            // Option 3: Libur / Off Shift
            _buildCheckInOptionTile(
              icon: Icons.event_available_rounded,
              title: 'Absen Libur / Off Shift',
              subtitle: 'Catat hari libur atau cuti yang telah disetujui',
              color: const Color(0xFFD97706),
              onTap: () {
                Navigator.pop(ctx);
                _performLiburCheckIn();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckInOptionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.neutral900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      color: AppColors.neutral500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: color, size: 20),
          ],
        ),
      ),
    );
  }

  Future<void> _performCheckInWithCamera(String attendanceType) async {
    try {
      // 1. Dapatkan dan validasi posisi GPS terlebih dahulu
      setState(() => _isSubmittingAction = true);
      final position = await _determinePosition();
      setState(() => _isSubmittingAction = false);

      if (position == null) return;
      if (!mounted) return;

      // 2. Buka Live Camera Depan langsung di dalam aplikasi (Tanpa Intent / Tanpa Galeri / Anti TimeMark)
      final File? capturedPhoto = await Navigator.of(context).push<File>(
        MaterialPageRoute(
          builder: (_) => LiveAttendanceCameraScreen(
            title: 'Foto Selfie Kehadiran',
            subtitle: 'Wajib live camera depan • Dilarang upload gambar/galeri',
            latitude: position.latitude,
            longitude: position.longitude,
            locationName: _todayAttendance?.assignedLocation?.name ?? 'Lokasi Penugasan',
            userName: widget.user.name,
            timezone: _todayAttendance?.timezone ?? 'WIB',
          ),
        ),
      );

      if (capturedPhoto == null) return;

      setState(() => _isSubmittingAction = true);

      final res = await AttendanceService.checkIn(
        attendanceType: attendanceType,
        latitude: position.latitude,
        longitude: position.longitude,
        shiftId: _todayAttendance?.assignedShift?.id,
        photoFile: capturedPhoto,
      );

      setState(() => _isSubmittingAction = false);

      if (res['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(res['message']?.toString() ?? 'Absen masuk berhasil!'),
              backgroundColor: AppColors.success,
            ),
          );
        }
        await _loadAllRealtimeData();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(res['message']?.toString() ?? 'Gagal absen masuk.'),
              backgroundColor: AppColors.error,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      }
    } catch (e) {
      setState(() => _isSubmittingAction = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Terjadi kesalahan saat memproses kamera/GPS: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _promptNotesAndCheckIn(String attendanceType) {
    final notesController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Catatan Dinas Luar',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Tuliskan lokasi dan keperluan dinas luar Anda hari ini:',
              style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.neutral600),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              maxLines: 3,
              style: GoogleFonts.plusJakartaSans(fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Contoh: Maintenance jaringan di Unit Sekolah XYZ...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: secondaryAccentColor),
            onPressed: () async {
              final notes = notesController.text.trim();
              if (notes.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Catatan dinas luar wajib diisi!')),
                );
                return;
              }
              Navigator.pop(ctx);

              setState(() => _isSubmittingAction = true);
              final position = await _determinePosition();
              final res = await AttendanceService.checkIn(
                attendanceType: attendanceType,
                latitude: position?.latitude,
                longitude: position?.longitude,
                shiftId: _todayAttendance?.assignedShift?.id,
                notes: notes,
              );
              setState(() => _isSubmittingAction = false);

              if (res['success'] == true) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res['message']?.toString() ?? 'Absen dinas luar berhasil!'), backgroundColor: AppColors.success),
                  );
                }
                await _loadAllRealtimeData();
              } else {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res['message']?.toString() ?? 'Gagal absen dinas luar.'), backgroundColor: AppColors.error),
                  );
                }
              }
            },
            child: const Text('Kirim Presensi', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _performLiburCheckIn() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Konfirmasi Absen Libur',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Apakah Anda yakin mencatat hari ini sebagai Hari Libur / Off Shift?',
          style: GoogleFonts.plusJakartaSans(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ya, Absen Libur', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isSubmittingAction = true);
    final res = await AttendanceService.checkIn(attendanceType: 'libur');
    setState(() => _isSubmittingAction = false);

    if (res['success'] == true) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message']?.toString() ?? 'Absen libur tercatat.'), backgroundColor: AppColors.success),
        );
      }
      await _loadAllRealtimeData();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message']?.toString() ?? 'Gagal absen libur.'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _handleCheckOutAction() async {
    final attendance = _todayAttendance?.attendance;
    if (attendance == null || attendance.checkInTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Silakan lakukan Absen Masuk terlebih dahulu sebelum Absen Keluar.'),
          backgroundColor: AppColors.neutral800,
        ),
      );
      return;
    }

    if (attendance.checkOutTime != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Anda sudah melakukan Absen Keluar pada ${_formatTimeDisplay(attendance.checkOutTime)}.'),
          backgroundColor: AppColors.neutral800,
        ),
      );
      return;
    }

    final tz = _todayAttendance?.timezone ?? 'WIB';
    final nowStr = DateFormat('HH:mm').format(_currentTime);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Konfirmasi Absen Keluar',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Apakah Anda yakin ingin melakukan Absen Keluar sekarang ($nowStr $tz)?',
          style: GoogleFonts.plusJakartaSans(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: primaryBrandColor),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ya, Absen Keluar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isSubmittingAction = true);
    final position = await _determinePosition();
    final res = await AttendanceService.checkOut(
      latitude: position?.latitude,
      longitude: position?.longitude,
    );
    setState(() => _isSubmittingAction = false);

    if (res['success'] == true) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message']?.toString() ?? 'Absen pulang berhasil dicatat.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
      await _loadAllRealtimeData();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message']?.toString() ?? 'Gagal melakukan absen pulang.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _showShiftSelectionModal() async {
    final availableShifts = _todayAttendance?.availableShifts ?? [];
    if (availableShifts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tidak ada pilihan shift tambahan untuk unit Anda.'),
          backgroundColor: AppColors.neutral700,
        ),
      );
      return;
    }

    final currentShiftId = _todayAttendance?.assignedShift?.id;
    int? selectedId = currentShiftId;
    bool isSaving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.82,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(28),
                  topRight: Radius.circular(28),
                ),
              ),
              child: SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Handle bar
                    const SizedBox(height: 12),
                    Container(
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(
                        color: AppColors.neutral300,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Header
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: secondaryLightColor,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(Icons.schedule_rounded, color: secondaryDarkColor, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Pilih Shift Kerja',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.neutral900,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Pilih pola shift sesuai jadwal tugas Anda hari ini',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12,
                                    color: AppColors.neutral500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: AppColors.neutral500),
                            onPressed: () => Navigator.pop(modalCtx),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 12),
                    const Divider(height: 1, color: Color(0xFFE2E8F0)),

                    // Shift list
                    Flexible(
                      child: ListView.separated(
                        shrinkWrap: true,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        itemCount: availableShifts.length,
                        separatorBuilder: (sepCtx, sepIdx) => const SizedBox(height: 10),
                        itemBuilder: (ctx, index) {
                          final shift = availableShifts[index];
                          final isSelected = shift.id == selectedId;
                          final is3Shift = shift.code.contains('3_SHIFT') || shift.name.contains('3 Shift');
                          final is2Shift = shift.code.contains('2_SHIFT') || shift.name.contains('2 Shift');

                          return InkWell(
                            onTap: isSaving
                                ? null
                                : () async {
                                    setModalState(() {
                                      selectedId = shift.id;
                                      isSaving = true;
                                    });

                                    final messenger = ScaffoldMessenger.of(context);
                                    final res = await AttendanceService.selectShift(shift.id);

                                    if (mounted) {
                                      if (res['success'] == true) {
                                        setState(() {
                                          _todayAttendance = _todayAttendance?.copyWith(assignedShift: shift);
                                        });
                                        if (modalCtx.mounted) {
                                          Navigator.pop(modalCtx);
                                        }
                                        messenger.showSnackBar(
                                          SnackBar(
                                            content: Text('Shift berhasil diatur ke ${shift.name} (${shift.formattedTime ?? '${shift.startTime} - ${shift.endTime}'})'),
                                            backgroundColor: AppColors.success,
                                          ),
                                        );
                                      } else {
                                        setModalState(() => isSaving = false);
                                        messenger.showSnackBar(
                                          SnackBar(
                                            content: Text(res['message']?.toString() ?? 'Gagal mengubah shift.'),
                                            backgroundColor: AppColors.error,
                                          ),
                                        );
                                      }
                                    }
                                  },
                            borderRadius: BorderRadius.circular(16),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: isSelected ? secondaryLightColor.withValues(alpha: 0.5) : const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isSelected ? secondaryAccentColor : const Color(0xFFE2E8F0),
                                  width: isSelected ? 1.8 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  // Radio Indicator
                                  Container(
                                    width: 22,
                                    height: 22,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: isSelected ? secondaryAccentColor : AppColors.neutral400,
                                        width: 2,
                                      ),
                                      color: isSelected ? secondaryAccentColor : Colors.transparent,
                                    ),
                                    child: isSelected
                                        ? const Center(
                                            child: Icon(Icons.check, size: 14, color: Colors.white),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 14),

                                  // Shift Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Flexible(
                                              child: Text(
                                                shift.name,
                                                style: GoogleFonts.plusJakartaSans(
                                                  fontSize: 13.5,
                                                  fontWeight: FontWeight.w700,
                                                  color: isSelected ? secondaryDarkColor : AppColors.neutral900,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            if (is3Shift)
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFDBEAFE),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  '3 Shift',
                                                  style: GoogleFonts.plusJakartaSans(
                                                    fontSize: 9.5,
                                                    fontWeight: FontWeight.w700,
                                                    color: const Color(0xFF1D4ED8),
                                                  ),
                                                ),
                                              )
                                            else if (is2Shift)
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFFEF3C7),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  '2 Shift',
                                                  style: GoogleFonts.plusJakartaSans(
                                                    fontSize: 9.5,
                                                    fontWeight: FontWeight.w700,
                                                    color: const Color(0xFFB45309),
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            Icon(Icons.access_time_filled_rounded, size: 13, color: isSelected ? secondaryDarkColor : AppColors.neutral500),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${shift.formattedTime ?? '${shift.startTime} - ${shift.endTime}'} ${_todayAttendance?.timezone ?? 'WIB'}',
                                              style: GoogleFonts.plusJakartaSans(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: isSelected ? secondaryDarkColor : AppColors.neutral700,
                                              ),
                                            ),
                                            if (shift.crossDay) ...[
                                              const SizedBox(width: 6),
                                              Text(
                                                '(Lintas Hari)',
                                                style: GoogleFonts.plusJakartaSans(
                                                  fontSize: 10.5,
                                                  fontWeight: FontWeight.w600,
                                                  color: const Color(0xFF7C3AED),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                        if (shift.description != null && shift.description!.isNotEmpty) ...[
                                          const SizedBox(height: 2),
                                          Text(
                                            shift.description!,
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 11,
                                              color: AppColors.neutral500,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),

                                  if (isSelected && isSaving)
                                    const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Konfirmasi Keluar',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Apakah Anda yakin ingin keluar dari akun ${widget.user.name}?',
          style: GoogleFonts.plusJakartaSans(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Keluar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await ref.read(authProvider.notifier).logout();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: Stack(
          children: [
            // Content for Current Tab
            IndexedStack(
              index: _currentTabIndex,
              children: [
                _buildHomeTab(),
                _buildHistoryTab(),
                _buildPayrollsTab(),
                _buildWorkReportsTab(),
                _buildSettingTab(),
              ],
            ),

            // Fixed Top App Bar
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _buildTopHeader(),
            ),

            // Loading Overlay saat Check-in / Check-out
            if (_isSubmittingAction)
              Positioned.fill(
                child: Container(
                  color: Colors.black.withValues(alpha: 0.4),
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(color: secondaryAccentColor),
                          const SizedBox(height: 16),
                          Text(
                            'Memproses Presensi...',
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: primaryBrandColor,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Menghubungi server dan validasi GPS',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              color: AppColors.neutral500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

            // Fixed Bottom Navigation Bar
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _buildBottomNav(),
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // 1. Top Fixed Header Bar
  // -------------------------------------------------------------
  Widget _buildTopHeader() {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.96),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0C000000),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Container(
          height: 68,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Logo & Title
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: primaryBrandColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        isRiama ? 'RM' : 'RB',
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'HC Attendance',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.neutral500,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        companyShortCode,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: primaryBrandColor,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // Right Profile & Status Indicator
              Row(
                children: [
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        widget.user.name,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.neutral900,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        widget.user.position ?? (isRiama ? 'Operasional Riama' : 'Operasional RBS'),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: AppColors.neutral500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 10),
                  Tooltip(
                    message: 'Panduan Aplikasi',
                    child: InkWell(
                      borderRadius: BorderRadius.circular(22),
                      onTap: () => _checkAndShowTutorial(force: true),
                      child: Stack(
                        children: [
                          CircleAvatar(
                            radius: 19,
                            backgroundColor: secondaryLightColor,
                            child: Text(
                              widget.user.name.isNotEmpty ? widget.user.name[0].toUpperCase() : 'U',
                              style: GoogleFonts.plusJakartaSans(
                                color: secondaryDarkColor,
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: Container(
                              width: 11,
                              height: 11,
                              decoration: BoxDecoration(
                                color: AppColors.success,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

  // -------------------------------------------------------------
  // 2. Home Tab Content & Skeleton Loader
  // -------------------------------------------------------------
  Widget _buildHomeSkeleton() {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 106, bottom: 95),
      child: Column(
        children: [
          // 1. Corporate Brand Hero Skeleton
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(20, 10, 20, 16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: isRiama ? const Color(0xFF064E3B) : const Color(0xFF0F2B5C),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    AppSkeleton(width: 80, height: 12, borderRadius: 6),
                    SizedBox(width: 8),
                    AppSkeleton(width: 44, height: 16, borderRadius: 8),
                  ],
                ),
                const SizedBox(height: 10),
                const AppSkeleton(width: 170, height: 22, borderRadius: 8),
                const SizedBox(height: 8),
                const AppSkeleton(width: 220, height: 12, borderRadius: 6),
                const SizedBox(height: 16),
                const AppSkeleton(width: double.infinity, height: 38, borderRadius: 14),
              ],
            ),
          ),

          // 2. Attendance Status Card Skeleton
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.neutral200),
            ),
            child: Column(
              children: [
                const AppSkeleton(width: 110, height: 12, borderRadius: 6),
                const SizedBox(height: 10),
                const AppSkeleton(width: 190, height: 36, borderRadius: 10),
                const SizedBox(height: 6),
                const AppSkeleton(width: 160, height: 11, borderRadius: 6),
                const SizedBox(height: 22),
                const AppSkeleton(width: double.infinity, height: 50, borderRadius: 16),
                const SizedBox(height: 12),
                const AppSkeleton(width: double.infinity, height: 46, borderRadius: 16),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.neutral200),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            AppSkeleton(width: 70, height: 11, borderRadius: 4),
                            SizedBox(height: 6),
                            AppSkeleton(width: 90, height: 16, borderRadius: 6),
                            SizedBox(height: 6),
                            AppSkeleton(width: 75, height: 18, borderRadius: 10),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 50, color: AppColors.neutral200),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            AppSkeleton(width: 70, height: 11, borderRadius: 4),
                            SizedBox(height: 6),
                            AppSkeleton(width: 90, height: 16, borderRadius: 6),
                            SizedBox(height: 6),
                            AppSkeleton(width: 75, height: 18, borderRadius: 10),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // 3. Ringkasan Karyawan Skeleton
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(width: 4, height: 18, decoration: BoxDecoration(color: secondaryAccentColor, borderRadius: BorderRadius.circular(2))),
                    const SizedBox(width: 8),
                    const AppSkeleton(width: 150, height: 16, borderRadius: 6),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: AppColors.neutral200),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: const [
                                AppSkeleton(width: 80, height: 11, borderRadius: 4),
                                AppSkeleton(width: 28, height: 28, borderRadius: 8),
                              ],
                            ),
                            const SizedBox(height: 10),
                            const AppSkeleton(width: 110, height: 18, borderRadius: 6),
                            const SizedBox(height: 8),
                            const AppSkeleton(width: 90, height: 10, borderRadius: 4),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: AppColors.neutral200),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: const [
                                AppSkeleton(width: 80, height: 11, borderRadius: 4),
                                AppSkeleton(width: 28, height: 28, borderRadius: 8),
                              ],
                            ),
                            const SizedBox(height: 10),
                            const AppSkeleton(width: 80, height: 18, borderRadius: 6),
                            const SizedBox(height: 8),
                            const AppSkeleton(width: 90, height: 10, borderRadius: 4),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.neutral200),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const AppSkeleton(width: 18, height: 18, borderRadius: 4),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              AppSkeleton(width: 60, height: 10, borderRadius: 4),
                              SizedBox(height: 4),
                              AppSkeleton(width: 90, height: 14, borderRadius: 6),
                            ],
                          ),
                        ],
                      ),
                      Container(width: 1, height: 32, color: AppColors.neutral200),
                      Row(
                        children: [
                          const AppSkeleton(width: 18, height: 18, borderRadius: 4),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              AppSkeleton(width: 70, height: 10, borderRadius: 4),
                              SizedBox(height: 4),
                              AppSkeleton(width: 80, height: 14, borderRadius: 6),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Quick Action Card Skeleton
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.neutral200),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          AppSkeleton(width: 140, height: 14, borderRadius: 6),
                          AppSkeleton(width: 65, height: 18, borderRadius: 10),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: List.generate(4, (_) {
                          return Column(
                            children: const [
                              AppSkeleton(width: 50, height: 50, shape: BoxShape.circle),
                              SizedBox(height: 8),
                              AppSkeleton(width: 44, height: 10, borderRadius: 4),
                              SizedBox(height: 4),
                              AppSkeleton(width: 34, height: 8, borderRadius: 4),
                            ],
                          );
                        }),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTab() {
    if (_isLoadingAttendance && _todayAttendance == null) {
      return _buildHomeSkeleton();
    }
    final now = _currentTime;
    final dateFormatted = _formatIndonesianDateShort(now);
    final timeFormatted = DateFormat('HH:mm:ss').format(now);

    // Dynamic Shift Info from Real API
    final shiftName = _todayAttendance?.assignedShift?.name ?? 'Normal';
    final shiftTz = _todayAttendance?.timezone ?? 'WIB';
    final shiftTime = _todayAttendance?.assignedShift?.formattedTime ??
        (_todayAttendance?.assignedShift?.startTime != null
            ? '${_todayAttendance!.assignedShift!.startTime} - ${_todayAttendance!.assignedShift!.endTime} $shiftTz'
            : '08:00 - 17:00 $shiftTz');

    // Dynamic Assigned Location from Real API
    final assignedLocationName = _todayAttendance?.assignedLocation?.name ??
        widget.user.schoolUnit ??
        (isRiama ? 'Kantor Riama Pusat' : 'Kantor RBS Pusat');
    final assignedRadius = _todayAttendance?.assignedLocation?.radiusMeters ?? 100;

    // Real Attendance Records
    final attendance = _todayAttendance?.attendance;
    final isHoliday = attendance != null && (attendance.attendanceType == 'libur' || attendance.status == 'holiday');
    final hasCheckedIn = attendance != null && attendance.checkInTime != null;
    final hasCheckedOut = attendance != null && attendance.checkOutTime != null;

    // Check-in status badge calculation
    String checkInBadgeText = 'Belum Masuk';
    Color checkInBadgeBg = const Color(0xFFF1F5F9);
    Color checkInBadgeColor = AppColors.neutral600;

    if (hasCheckedIn) {
      if (attendance.attendanceType == 'libur') {
        checkInBadgeText = 'Libur / Off';
        checkInBadgeBg = const Color(0xFFFEF3C7);
        checkInBadgeColor = const Color(0xFFB45309);
      } else if (attendance.attendanceType == 'dinas_luar') {
        checkInBadgeText = 'Dinas Luar';
        checkInBadgeBg = const Color(0xFFDBEAFE);
        checkInBadgeColor = const Color(0xFF1D4ED8);
      } else if (attendance.checkInStatus == 'late') {
        checkInBadgeText = 'Terlambat';
        checkInBadgeBg = const Color(0xFFFFEDD5);
        checkInBadgeColor = const Color(0xFFC2410C);
      } else {
        checkInBadgeText = 'Tepat Waktu';
        checkInBadgeBg = AppColors.success.withValues(alpha: 0.15);
        checkInBadgeColor = const Color(0xFF047857);
      }
    }

    // Check-out status badge calculation
    String checkOutBadgeText = 'Belum Rekam';
    Color checkOutBadgeBg = const Color(0xFFE2E8F0);
    Color checkOutBadgeColor = AppColors.neutral600;

    if (hasCheckedOut) {
      checkOutBadgeText = 'Sudah Pulang';
      checkOutBadgeBg = AppColors.success.withValues(alpha: 0.15);
      checkOutBadgeColor = const Color(0xFF047857);
    } else if (hasCheckedIn) {
      checkOutBadgeText = 'Belum Pulang';
      checkOutBadgeBg = const Color(0xFFFEF3C7);
      checkOutBadgeColor = const Color(0xFFB45309);
    }

    // Real Summary Metrics (Ala Web Dashboard)
    final latestPayroll = _dashboardSummary?['latest_payroll'] as Map<String, dynamic>?;
    final workReportsSummary = _dashboardSummary?['work_reports_summary'] as Map<String, dynamic>? ?? {
      'total': 0,
      'pending': 0,
      'approved': 0,
    };

    return RefreshIndicator(
      color: secondaryAccentColor,
      onRefresh: _loadAllRealtimeData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 106, bottom: 95),
        child: Column(
          children: [
            // Corporate Brand Hero Section
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 28, 12, 46),
              decoration: BoxDecoration(
                color: primaryBrandColor,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(32),
                  bottomRight: Radius.circular(32),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x18000000),
                    blurRadius: 10,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  // Ambient geometry blur
                  Positioned(
                    top: -20,
                    right: -20,
                    child: Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: secondaryAccentColor.withValues(alpha: 0.25),
                      ),
                    ),
                  ),

                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Greeting & User block (Full width without redundant avatar D)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                _getGreetingMessage(),
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFFD9E2FF),
                                  letterSpacing: 0.3,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.18),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                                ),
                                child: Text(
                                  companyShortCode,
                                  style: GoogleFonts.plusJakartaSans(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.user.name,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              height: 1.2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$companyName • NIK: ${widget.user.nik ?? '-'}',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              color: const Color(0xFFAFC6FF),
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),

                      // Work Schedule Mini Bar (Real Shift from API - Mentok ke Kanan)
                      Container(
                        padding: const EdgeInsets.only(left: 12, right: 6, top: 9, bottom: 9),
                        decoration: BoxDecoration(
                          color: primaryBrandContainer.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                        ),
                        child: Row(
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.calendar_today_rounded, size: 13, color: Color(0xFFD9E2FF)),
                                const SizedBox(width: 5),
                                Text(
                                  dateFormatted,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFFD9E2FF),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: InkWell(
                                onTap: hasCheckedIn ? null : _showShiftSelectionModal,
                                borderRadius: BorderRadius.circular(8),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    Flexible(
                                      child: Text(
                                        '$shiftName: ',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 10.5,
                                          color: Colors.white70,
                                        ),
                                      ),
                                    ),
                                    Text(
                                      shiftTime,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                    ),
                                    if (!hasCheckedIn) ...[
                                      const SizedBox(width: 4),
                                      const Icon(Icons.swap_horiz_rounded, size: 14, color: Colors.white70),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Main Floating Attendance Punch Container (-mt-8)
            Transform.translate(
              offset: const Offset(0, -22),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x180F2B5C),
                        blurRadius: 24,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      // GPS Validation Badge & Real-Time Status Pill
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Flexible(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.location_on_rounded, size: 15, color: secondaryAccentColor),
                                  const SizedBox(width: 5),
                                  Flexible(
                                    child: Text(
                                      '$assignedLocationName (${assignedRadius}m)',
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.neutral800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: secondaryLightColor,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    color: secondaryAccentColor,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  'GPS Siap',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: secondaryDarkColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      // Interactive Shift Selector Pill / Banner (Pilihan 5 Shift Sekolah & Riama)
                      InkWell(
                        onTap: hasCheckedIn ? null : _showShiftSelectionModal,
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          margin: const EdgeInsets.only(top: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: secondaryAccentColor.withValues(alpha: 0.35),
                              width: 1.2,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(7),
                                decoration: BoxDecoration(
                                  color: secondaryLightColor,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(Icons.schedule_rounded, size: 16, color: secondaryDarkColor),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          'Shift Kerja: ',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.neutral500,
                                          ),
                                        ),
                                        Flexible(
                                          child: Text(
                                            shiftName,
                                            overflow: TextOverflow.ellipsis,
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w800,
                                              color: AppColors.neutral900,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      shiftTime,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: secondaryDarkColor,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (!hasCheckedIn) ...[
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
                                  decoration: BoxDecoration(
                                    color: secondaryAccentColor.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: secondaryAccentColor.withValues(alpha: 0.25)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'Pilih Shift',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w700,
                                          color: secondaryDarkColor,
                                        ),
                                      ),
                                      const SizedBox(width: 3),
                                      Icon(Icons.keyboard_arrow_down_rounded, size: 15, color: secondaryDarkColor),
                                    ],
                                  ),
                                ),
                              ] else ...[
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                  decoration: BoxDecoration(
                                    color: AppColors.neutral200,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    'Tersimpan',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.neutral600,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 18),

                      // Live Digital Clock Display
                      Text(
                        'WAKTU SEKARANG',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: AppColors.neutral500,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        timeFormatted,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 34,
                          fontWeight: FontWeight.w800,
                          color: primaryBrandColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _todayAttendance?.timezoneLabel ?? 'Zona Waktu Indonesia Barat (WIB)',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: AppColors.neutral400,
                        ),
                      ),

                      const SizedBox(height: 22),

                      // Action Button 1: Absen Masuk (Check-In)
                      if (!hasCheckedIn || isHoliday)
                        ElevatedButton(
                          onPressed: _openCheckInModal,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isHoliday ? const Color(0xFFD97706) : secondaryAccentColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 4,
                            shadowColor: (isHoliday ? const Color(0xFFD97706) : secondaryAccentColor).withValues(alpha: 0.4),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.fingerprint_rounded, size: 22),
                              const SizedBox(width: 8),
                              Text(
                                isHoliday ? 'Ganti ke Absen Masuk (Masuk Kerja)' : 'Absen Masuk (Check In)',
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                          decoration: BoxDecoration(
                            color: secondaryLightColor,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: secondaryAccentColor.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_circle_rounded, color: secondaryDarkColor, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                'Sudah Absen Masuk (${_formatTimeDisplay(attendance.checkInTime)})',
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: secondaryDarkColor,
                                ),
                              ),
                            ],
                          ),
                        ),

                      const SizedBox(height: 12),

                      // Action Button 2: Absen Keluar (Check-Out)
                      if (!hasCheckedOut)
                        OutlinedButton(
                          onPressed: _handleCheckOutAction,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: hasCheckedIn ? primaryBrandColor : AppColors.neutral700,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            side: BorderSide(
                              color: hasCheckedIn ? primaryBrandColor : AppColors.neutral200,
                              width: hasCheckedIn ? 1.5 : 1,
                            ),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            backgroundColor: hasCheckedIn ? primaryBrandColor.withValues(alpha: 0.05) : const Color(0xFFF8FAFC),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.logout_rounded,
                                size: 18,
                                color: hasCheckedIn ? primaryBrandColor : AppColors.neutral600,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Absen Keluar (Check Out)',
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: hasCheckedIn ? primaryBrandColor : AppColors.neutral700,
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.neutral300),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.task_alt_rounded, color: AppColors.neutral700, size: 18),
                              const SizedBox(width: 8),
                              Text(
                                'Sudah Absen Pulang (${_formatTimeDisplay(attendance.checkOutTime)})',
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12.5,
                                  color: AppColors.neutral800,
                                ),
                              ),
                            ],
                          ),
                        ),

                      const SizedBox(height: 20),

                      // Real-time Attendance Status Summary (2 Kolom Dinamis)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.neutral200),
                        ),
                        child: Row(
                          children: [
                            // Kolom Jam Masuk
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.login_rounded, size: 15, color: secondaryAccentColor),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Jam Masuk',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.neutral500,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    hasCheckedIn ? _formatTimeDisplay(attendance.checkInTime) : '--:-- ${_todayAttendance?.timezone ?? 'WIB'}',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      color: hasCheckedIn ? primaryBrandColor : AppColors.neutral400,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                    decoration: BoxDecoration(
                                      color: checkInBadgeBg,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      checkInBadgeText,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: checkInBadgeColor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(width: 1, height: 54, color: AppColors.neutral200),
                            // Kolom Jam Pulang
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(left: 14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(Icons.logout_rounded, size: 15, color: AppColors.neutral400),
                                        const SizedBox(width: 4),
                                        Text(
                                          'Jam Pulang',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.neutral500,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      hasCheckedOut ? _formatTimeDisplay(attendance.checkOutTime) : '--:-- ${_todayAttendance?.timezone ?? 'WIB'}',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800,
                                        color: hasCheckedOut ? primaryBrandColor : AppColors.neutral400,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                      decoration: BoxDecoration(
                                        color: checkOutBadgeBg,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        checkOutBadgeText,
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: checkOutBadgeColor,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ---------------------------------------------------------
            // Employee Web-Identical KPI Cards (THP, Laporan, Rincian Gaji)
            // ---------------------------------------------------------
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 4,
                        height: 18,
                        decoration: BoxDecoration(
                          color: secondaryAccentColor,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Ringkasan Karyawan',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: primaryBrandColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // KPI Grid 2x2
                  Row(
                    children: [
                      // KPI 1: Take Home Pay (Gaji Bersih)
                      Expanded(
                        child: InkWell(
                          onTap: () {
                            setState(() => _currentTabIndex = 2);
                            _loadPayrolls();
                          },
                          borderRadius: BorderRadius.circular(18),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: AppColors.neutral200),
                              boxShadow: const [
                                BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Gaji Bersih (THP)',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.neutral500,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: secondaryLightColor,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Icon(Icons.account_balance_wallet_rounded, size: 16, color: secondaryDarkColor),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  latestPayroll != null ? _formatRupiah(latestPayroll['take_home_pay']) : 'Rp 0',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: primaryBrandColor,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        latestPayroll != null ? 'Periode ${latestPayroll['period']}' : 'Belum ada data',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.neutral400),
                                      ),
                                    ),
                                    Text(
                                      'Buka →',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: secondaryAccentColor,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(width: 12),

                      // KPI 2: Laporan Kerja
                      Expanded(
                        child: InkWell(
                          onTap: () {
                            setState(() => _currentTabIndex = 3);
                            _loadReports();
                          },
                          borderRadius: BorderRadius.circular(18),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: AppColors.neutral200),
                              boxShadow: const [
                                BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Laporan Kerja',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.neutral500,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEFF6FF),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Icon(Icons.assignment_turned_in_rounded, size: 16, color: Color(0xFF2563EB)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '${workReportsSummary['total'] ?? 0} Laporan',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: primaryBrandColor,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '${workReportsSummary['approved'] ?? 0} Disetujui • ${workReportsSummary['pending'] ?? 0} Pending',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.neutral400),
                                      ),
                                    ),
                                    Text(
                                      'Kelola →',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: secondaryAccentColor,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // KPI Row: Gaji Pokok & Potongan
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.neutral200),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.description_outlined, size: 16, color: AppColors.neutral500),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Gaji Pokok',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.neutral500),
                                ),
                                Text(
                                  latestPayroll != null ? _formatRupiah(latestPayroll['basic_salary']) : 'Rp 0',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.bold, color: primaryBrandColor),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Container(width: 1, height: 32, color: AppColors.neutral200),
                        Row(
                          children: [
                            const Icon(Icons.remove_circle_outline_rounded, size: 16, color: Color(0xFFE11D48)),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Total Potongan',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.neutral500),
                                ),
                                Text(
                                  latestPayroll != null ? _formatRupiah(latestPayroll['deduction']) : 'Rp 0',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFFE11D48)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // -------------------------------------------------------------
                  // Quick Actions & Help Center (Sesuai Sketch Desain User: Card dengan Circular Buttons)
                  // -------------------------------------------------------------
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.neutral200),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x06000000),
                          blurRadius: 10,
                          offset: Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header Bar: Layanan & Bantuan Cepat
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(5),
                                  decoration: BoxDecoration(
                                    color: secondaryAccentColor.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Icon(
                                    Icons.auto_awesome_rounded,
                                    size: 15,
                                    color: secondaryAccentColor,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Layanan & Bantuan Cepat',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: primaryBrandColor,
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDF4),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFBBF7D0)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 6,
                                    height: 6,
                                    decoration: const BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Color(0xFF10B981),
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Online 24/7',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF047857),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 16),

                        // Row of Circular Menu Buttons (Sesuai Sketch Desain)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // 1. Live Chat Button
                            _buildCircularQuickAction(
                              icon: Icons.chat_bubble_rounded,
                              iconColor: const Color(0xFF059669),
                              bgColor: const Color(0xFFECFDF5),
                              borderColor: const Color(0xFFA7F3D0),
                              label: 'Live Chat',
                              sublabel: 'CS & Bot AI',
                              badgeDot: true,
                              onTap: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => LiveChatScreen(user: widget.user),
                                  ),
                                );
                                if (mounted) _restoreStatusBar();
                              },
                            ),

                            // 2. Pusat Keluhan Button
                            _buildCircularQuickAction(
                              icon: Icons.support_agent_rounded,
                              iconColor: const Color(0xFF2563EB),
                              bgColor: const Color(0xFFEFF6FF),
                              borderColor: const Color(0xFFBFDBFE),
                              label: 'Keluhan HRD',
                              sublabel: 'Pusat Bantuan',
                              onTap: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ComplaintsScreen(user: widget.user),
                                  ),
                                );
                                if (mounted) _restoreStatusBar();
                              },
                            ),

                            // 3. Riwayat Presensi Button
                            _buildCircularQuickAction(
                              icon: Icons.calendar_month_rounded,
                              iconColor: const Color(0xFFD97706),
                              bgColor: const Color(0xFFFFFBEB),
                              borderColor: const Color(0xFFFDE68A),
                              label: 'Riwayat',
                              sublabel: 'Presensi',
                              onTap: () {
                                setState(() => _currentTabIndex = 1);
                                _loadHistory();
                              },
                            ),

                            // 4. Slip Gaji Button
                            _buildCircularQuickAction(
                              icon: Icons.receipt_long_rounded,
                              iconColor: const Color(0xFF7C3AED),
                              bgColor: const Color(0xFFFAF5FF),
                              borderColor: const Color(0xFFE9D5FF),
                              label: 'Slip Gaji',
                              sublabel: 'Rincian THP',
                              onTap: () {
                                setState(() => _currentTabIndex = 2);
                                _loadPayrolls();
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Company Announcements Section
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 4,
                            height: 18,
                            decoration: BoxDecoration(
                              color: secondaryAccentColor,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Pengumuman Kantor',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: primaryBrandColor,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  if (_isLoadingAnnouncements)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: secondaryAccentColor,
                          ),
                        ),
                      ),
                    )
                  else if (_announcements == null || _announcements!.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.neutral200),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x06000000),
                            blurRadius: 10,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: secondaryLightColor,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.campaign_outlined,
                              size: 24,
                              color: secondaryDarkColor,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Belum Ada Pengumuman',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: primaryBrandColor,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Pengumuman dan informasi resmi kantor akan ditampilkan secara otomatis di sini.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              color: AppColors.neutral500,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    ..._announcements!.map((announcement) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _buildRealAnnouncementCard(announcement),
                      );
                    }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRealAnnouncementCard(AnnouncementModel announcement) {
    final isPinned = announcement.isPinned;
    final tagText = isPinned ? 'Penting' : (announcement.category ?? 'Terbaru');
    final tagBg = isPinned ? const Color(0xFFFFDDB8) : const Color(0xFFDAE2FD);
    final tagColor = isPinned ? const Color(0xFF653E00) : const Color(0xFF2D4678);

    String dateDisplay = '-';
    if (announcement.publishedAt != null && announcement.publishedAt!.isNotEmpty) {
      try {
        final dt = DateTime.parse(announcement.publishedAt!).toLocal();
        dateDisplay = _formatIndonesianDateShort(dt);
      } catch (_) {
        dateDisplay = announcement.publishedAt!;
      }
    }

    final divisionDisplay = announcement.authorName ??
        (announcement.company != null && announcement.company!.toLowerCase() == 'riama'
            ? 'Divisi HC PT. Riama Mandiri'
            : 'Divisi HC PT. Rimbun Buana');

    return InkWell(
      onTap: () => _showAnnouncementDetail(announcement, dateDisplay, divisionDisplay),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.neutral200),
          boxShadow: const [
            BoxShadow(
              color: Color(0x06000000),
              blurRadius: 10,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 14,
                      backgroundColor: secondaryLightColor,
                      child: Icon(
                        isPinned ? Icons.campaign_rounded : Icons.event_note_rounded,
                        size: 15,
                        color: secondaryDarkColor,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      dateDisplay,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: AppColors.neutral500,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: tagBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    tagText,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: tagColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              announcement.title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: primaryBrandColor,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              announcement.content,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                color: AppColors.neutral600,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  divisionDisplay,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.neutral500,
                  ),
                ),
                Row(
                  children: [
                    Text(
                      'Detail Informasi',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: secondaryAccentColor,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.arrow_forward_rounded, size: 13, color: secondaryAccentColor),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showAnnouncementDetail(
    AnnouncementModel announcement,
    String dateDisplay,
    String divisionDisplay,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.neutral300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  dateDisplay,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: AppColors.neutral500,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (announcement.isPinned)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFDDB8),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Penting',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF653E00),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              announcement.title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: primaryBrandColor,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              divisionDisplay,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                color: secondaryAccentColor,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Divider(height: 24),
            Text(
              announcement.content,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: AppColors.neutral800,
                height: 1.6,
              ),
            ),
            if (announcement.attachmentName != null && announcement.attachmentName!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.neutral200),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.attach_file_rounded, size: 20, color: AppColors.neutral600),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        announcement.attachmentName!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: primaryBrandColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryBrandColor,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: Text(
                  'Tutup',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // 3. Tab 1: Riwayat Kehadiran & Skeleton Loader
  // -------------------------------------------------------------
  Widget _buildHistorySkeleton() {
    return Column(
      children: List.generate(4, (index) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.7)),
          ),
          child: Row(
            children: [
              const AppSkeleton(width: 40, height: 40, borderRadius: 12),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        AppSkeleton(width: 110, height: 12, borderRadius: 4),
                        AppSkeleton(width: 65, height: 18, borderRadius: 10),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: const [
                        AppSkeleton(width: 80, height: 12, borderRadius: 4),
                        SizedBox(width: 12),
                        AppSkeleton(width: 80, height: 12, borderRadius: 4),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildHistoryTab() {
    // Calculate attendance statistics dynamically from _historyList
    int hadirCount = 0;
    int terlambatCount = 0;
    int izinCount = 0;
    int alpaCount = 0;

    if (_historyList != null) {
      for (final item in _historyList!) {
        final status = (item['status'] ?? '').toString().toLowerCase();
        final checkInStatus = (item['check_in_status'] ?? '').toString().toLowerCase();
        final attendanceType = (item['attendance_type'] ?? '').toString().toLowerCase();

        if (status == 'libur' || attendanceType == 'libur' || status == 'holiday' || status == 'izin' || status == 'cuti') {
          izinCount++;
        } else if (status == 'alpa' || status == 'alpha' || status == 'absent') {
          alpaCount++;
        } else if (checkInStatus == 'late') {
          terlambatCount++;
          hadirCount++;
        } else if (status == 'hadir' || status == 'present' || item['check_in_time'] != null) {
          hadirCount++;
        }
      }
    }

    final totalLogs = _historyList?.length ?? 0;

    return RefreshIndicator(
      color: secondaryAccentColor,
      onRefresh: _loadHistory,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 106, bottom: 95, left: 16, right: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Page Header Title & Refresh
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Riwayat',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: primaryBrandColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Log catatan presensi bulanan karyawan',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: AppColors.neutral500,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: _loadHistory,
                  icon: Icon(Icons.refresh_rounded, color: secondaryAccentColor),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // 1. Month Selector & Sub-bar Card
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A0F2B5C),
                    blurRadius: 16,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  InkWell(
                    onTap: _prevHistoryMonth,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F3F8),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.chevron_left_rounded, size: 22, color: primaryBrandColor),
                    ),
                  ),
                  InkWell(
                    onTap: _pickHistoryMonth,
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F4FF),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: secondaryAccentColor.withValues(alpha: 0.15)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.calendar_today_rounded, size: 15, color: secondaryAccentColor),
                          const SizedBox(width: 8),
                          Text(
                            DateFormat('MMMM yyyy', 'id_ID').format(_historySelectedMonth),
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: primaryBrandColor,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(Icons.arrow_drop_down_rounded, size: 20, color: AppColors.neutral500),
                        ],
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: _nextHistoryMonth,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F3F8),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.chevron_right_rounded, size: 22, color: primaryBrandColor),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // 2. Attendance Statistics Metric Cards (4 Cards Horizontal Grid)
            Row(
              children: [
                _buildHistoryMetricCard(
                  label: 'Hadir',
                  value: hadirCount.toString(),
                  valueColor: primaryBrandColor,
                  badgeBg: const Color(0xFFE8EEFA),
                  badgeTextColor: primaryBrandColor,
                ),
                const SizedBox(width: 8),
                _buildHistoryMetricCard(
                  label: 'Terlambat',
                  value: terlambatCount.toString(),
                  valueColor: const Color(0xFFCF8400),
                  badgeBg: const Color(0xFFFFEDD5),
                  badgeTextColor: const Color(0xFFB45309),
                ),
                const SizedBox(width: 8),
                _buildHistoryMetricCard(
                  label: 'Izin/Cuti',
                  value: izinCount.toString(),
                  valueColor: secondaryAccentColor,
                  badgeBg: const Color(0xFFE0E2FE),
                  badgeTextColor: secondaryAccentColor,
                ),
                const SizedBox(width: 8),
                _buildHistoryMetricCard(
                  label: 'Alpa',
                  value: alpaCount.toString(),
                  valueColor: AppColors.neutral500,
                  badgeBg: const Color(0xFFF1F3F8),
                  badgeTextColor: AppColors.neutral600,
                ),
              ],
            ),
            const SizedBox(height: 18),

            // 3. Header Section with Total Logs
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      'Catatan Kehadiran',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.neutral900,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E7FF),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '$totalLogs Log',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: primaryBrandColor,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  _todayAttendance?.timezoneLabel ?? 'WIB (GMT+7)',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.neutral400,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // 4. Daily Attendance Log Cards List / Empty State
            if (_isLoadingHistory)
              _buildHistorySkeleton()
            else if (_historyList == null || _historyList!.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x060F2B5C),
                      blurRadius: 14,
                      offset: Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F3F8),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.calendar_month_outlined, size: 36, color: AppColors.neutral400),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Belum Ada Catatan Kehadiran',
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: primaryBrandColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Tidak ada catatan presensi untuk periode ${DateFormat('MMMM yyyy', 'id_ID').format(_historySelectedMonth)}.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: AppColors.neutral500,
                      ),
                    ),
                  ],
                ),
              )
            else
              ..._historyList!.map((item) {
                final map = item is Map<String, dynamic> ? item : Map<String, dynamic>.from(item as Map);
                return _buildHistoryCard(map);
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryMetricCard({
    required String label,
    required String value,
    required Color valueColor,
    required Color badgeBg,
    required Color badgeTextColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x060F2B5C),
              blurRadius: 10,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: AppColors.neutral500,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: valueColor,
                height: 1.1,
              ),
            ),
            const SizedBox(height: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: badgeBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Hari',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                  color: badgeTextColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryCard(Map<String, dynamic> item) {
    final dateRaw = item['date']?.toString() ?? '';
    String formattedDate = dateRaw;
    try {
      final parsed = DateTime.parse(dateRaw);
      formattedDate = DateFormat('EEEE, d MMM yyyy', 'id_ID').format(parsed);
    } catch (_) {}

    final inTime = item['check_in_time']?.toString();
    final outTime = item['check_out_time']?.toString();
    final status = (item['status'] ?? 'hadir').toString().toLowerCase();
    final checkInStatus = (item['check_in_status'] ?? '').toString().toLowerCase();
    final attendanceType = (item['attendance_type'] ?? '').toString().toLowerCase();
    final location = item['location']?['name']?.toString() ?? item['location_name']?.toString();
    final lateMinutes = item['late_minutes'];

    // Status Badge Logic
    String badgeText = 'Tepat Waktu';
    Color badgeBg = const Color(0xFFE8EEFA);
    Color badgeTextColor = primaryBrandColor;

    if (status == 'libur' || attendanceType == 'libur') {
      badgeText = 'Libur / Off';
      badgeBg = const Color(0xFFFEF3C7);
      badgeTextColor = const Color(0xFFB45309);
    } else if (status == 'dinas_luar' || attendanceType == 'dinas_luar') {
      badgeText = 'Dinas Luar';
      badgeBg = const Color(0xFFDBEAFE);
      badgeTextColor = const Color(0xFF1D4ED8);
    } else if (checkInStatus == 'late') {
      badgeText = lateMinutes != null ? 'Terlambat ${lateMinutes}m' : 'Terlambat';
      badgeBg = const Color(0xFFFFEDD5);
      badgeTextColor = const Color(0xFFC2410C);
    } else if (status == 'izin' || status == 'cuti') {
      badgeText = 'Izin / Cuti';
      badgeBg = const Color(0xFFEDE9FE);
      badgeTextColor = const Color(0xFF6D28D9);
    } else if (status == 'alpa' || status == 'alpha') {
      badgeText = 'Alpa';
      badgeBg = const Color(0xFFFFE4E6);
      badgeTextColor = const Color(0xFFBE123C);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F2B5C),
            blurRadius: 12,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Header: Date & Status Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Icon(Icons.event_available_rounded, size: 18, color: secondaryAccentColor),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        formattedDate,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: primaryBrandColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  badgeText,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: badgeTextColor,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F3F8)),
          const SizedBox(height: 12),

          // Start Day & End Day (2 Columns Grid)
          Row(
            children: [
              // Start Day
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFDAD6),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.location_on_rounded,
                        size: 17,
                        color: Color(0xFFBA1A1A),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Start Day',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10.5,
                              color: AppColors.neutral500,
                            ),
                          ),
                          Text(
                            _formatTimeDisplay(inTime),
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.neutral900,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // End Day
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: Color(0xFFD9E2FF),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.location_on_rounded,
                        size: 17,
                        color: primaryBrandColor,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'End Day',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10.5,
                              color: AppColors.neutral500,
                            ),
                          ),
                          Text(
                            _formatTimeDisplay(outTime),
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.neutral900,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Location info if present
          if (location != null && location.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.apartment_rounded, size: 13, color: AppColors.neutral400),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    location,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      color: AppColors.neutral500,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // 4. Tab 2: Slip Gaji Karyawan & Skeleton Loader
  // -------------------------------------------------------------
  Widget _buildPayrollsSkeleton() {
    return Column(
      children: List.generate(2, (index) {
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  AppSkeleton(width: 120, height: 18, borderRadius: 8),
                  AppSkeleton(width: 75, height: 20, borderRadius: 12),
                ],
              ),
              const SizedBox(height: 16),
              const AppSkeleton(width: 150, height: 11, borderRadius: 4),
              const SizedBox(height: 8),
              const AppSkeleton(width: 180, height: 26, borderRadius: 8),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Divider(height: 1, thickness: 1, color: Color(0xFFF1F3F8)),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(3, (_) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      AppSkeleton(width: 65, height: 10, borderRadius: 4),
                      SizedBox(height: 6),
                      AppSkeleton(width: 80, height: 14, borderRadius: 6),
                    ],
                  );
                }),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildPayrollsTab() {
    return RefreshIndicator(
      color: secondaryAccentColor,
      onRefresh: _loadPayrolls,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 106, bottom: 95, left: 16, right: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Page Header Title & Refresh
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Slip Gaji',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: primaryBrandColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Rincian penghasilan & take home pay',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: AppColors.neutral500,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: _loadPayrolls,
                  icon: Icon(Icons.refresh_rounded, color: secondaryAccentColor),
                ),
              ],
            ),
            const SizedBox(height: 14),

            if (_isLoadingPayrolls)
              _buildPayrollsSkeleton()
            else if (_payrollList == null || _payrollList!.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x060F2B5C),
                      blurRadius: 14,
                      offset: Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: const BoxDecoration(
                        color: Color(0xFFF1F3F8),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.receipt_long_outlined, size: 36, color: AppColors.neutral400),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Belum Ada Slip Gaji',
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: primaryBrandColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Slip gaji Anda akan tampil di sini secara resmi setelah diterbitkan oleh divisi keuangan.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: AppColors.neutral500,
                      ),
                    ),
                  ],
                ),
              )
            else
              ..._payrollList!.map((rawItem) {
                final item = rawItem is Map<String, dynamic>
                    ? rawItem
                    : Map<String, dynamic>.from(rawItem as Map);

                final period = item['period']?.toString() ?? '-';
                final basic = (num.tryParse(item['basic_salary']?.toString() ?? '0') ?? 0).toDouble();
                final allowance = (num.tryParse(item['allowance']?.toString() ?? '0') ?? 0).toDouble();
                final bpjsKes = (num.tryParse(item['bpjs_kes']?.toString() ?? '0') ?? 0).toDouble();

                final absenceDeduction = (num.tryParse(item['absence_deduction']?.toString() ?? '0') ?? 0).toDouble();
                final pph21 = (num.tryParse(item['pph21']?.toString() ?? '0') ?? 0).toDouble();
                final deduction = (num.tryParse(item['deduction']?.toString() ?? '0') ?? 0).toDouble();

                final totalEarnings = basic + allowance + bpjsKes;
                final totalDeductions = absenceDeduction + pph21 + deduction;
                final rawThp = item['take_home_pay'];
                final thp = rawThp != null
                    ? (num.tryParse(rawThp.toString()) ?? (totalEarnings - totalDeductions)).toDouble()
                    : (totalEarnings - totalDeductions);

                return InkWell(
                  onTap: () => _showPayrollDetailModal(item),
                  borderRadius: BorderRadius.circular(22),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x060F2B5C),
                          blurRadius: 14,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Card Header: Period and Terbayar status badge
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0F4FF),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(Icons.calendar_today_rounded, size: 18, color: secondaryAccentColor),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _formatPeriodName(period).toLowerCase().startsWith('periode')
                                    ? _formatPeriodName(period)
                                    : 'Periode ${_formatPeriodName(period)}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: primaryBrandColor,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE8F5E9),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.check_circle_rounded, size: 13, color: Color(0xFF2E7D32)),
                                  const SizedBox(width: 4),
                                  Text(
                                    'TERBAYAR',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF2E7D32),
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // THP Label & Value
                        Text(
                          'Total Gaji Bersih (Take Home Pay)',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: AppColors.neutral500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _formatRupiah(thp),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: primaryBrandColor,
                            letterSpacing: -0.5,
                          ),
                        ),

                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 14),
                          child: Divider(height: 1, thickness: 1, color: Color(0xFFF1F3F8)),
                        ),

                        // Summary 3 Columns: Gaji Pokok, Tunjangan, Potongan
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Gaji Pokok',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 10.5, color: AppColors.neutral500),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _formatRupiah(basic),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.neutral900,
                                  ),
                                ),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Tunjangan',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 10.5, color: AppColors.neutral500),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  allowance > 0 ? '+${_formatRupiah(allowance)}' : 'Rp 0',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: secondaryAccentColor,
                                  ),
                                ),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Potongan',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 10.5, color: AppColors.neutral500),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  totalDeductions > 0 ? '-${_formatRupiah(totalDeductions)}' : 'Rp 0',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: totalDeductions > 0 ? const Color(0xFFBA1A1A) : AppColors.neutral600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),

                        const SizedBox(height: 14),

                        // Footer Action: "Lihat Rincian Lengkap ->"
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Text(
                              'Lihat Rincian Lengkap',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: secondaryAccentColor,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(Icons.arrow_forward_rounded, size: 15, color: secondaryAccentColor),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  void _showPayrollDetailModal(Map<String, dynamic> rawItem) {
    final item = rawItem;

    final period = item['period']?.toString() ?? '-';
    final basic = (num.tryParse(item['basic_salary']?.toString() ?? '0') ?? 0).toDouble();
    final allowance = (num.tryParse(item['allowance']?.toString() ?? '0') ?? 0).toDouble();
    final bpjsKes = (num.tryParse(item['bpjs_kes']?.toString() ?? '0') ?? 0).toDouble();
    final bpjsTk = (num.tryParse(item['bpjs_tk']?.toString() ?? '0') ?? 0).toDouble();

    final absenceDeduction = (num.tryParse(item['absence_deduction']?.toString() ?? '0') ?? 0).toDouble();
    final pph21 = (num.tryParse(item['pph21']?.toString() ?? '0') ?? 0).toDouble();
    final deduction = (num.tryParse(item['deduction']?.toString() ?? '0') ?? 0).toDouble();

    final totalEarnings = basic + allowance + bpjsKes;
    final totalDeductions = absenceDeduction + pph21 + deduction;
    final rawThp = item['take_home_pay'];
    final thp = rawThp != null
        ? (num.tryParse(rawThp.toString()) ?? (totalEarnings - totalDeductions)).toDouble()
        : (totalEarnings - totalDeductions);

    final bankName = item['bank_name']?.toString() ?? 'BCA';
    final bankAccount = item['bank_account']?.toString() ?? 'Rekening Karyawan';

    int earningCount = 1;
    if (allowance > 0) earningCount++;
    if (bpjsKes > 0) earningCount++;
    if (bpjsTk > 0) earningCount++;

    int deductionCount = 0;
    if (absenceDeduction > 0) deductionCount++;
    if (pph21 > 0) deductionCount++;
    if (deduction > 0) deductionCount++;
    if (deductionCount == 0) deductionCount = 1;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.9,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Color(0xFFFAF8FF),
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            children: [
              // Header Drag Handle & Title
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                  boxShadow: [
                    BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 1)),
                  ],
                ),
                child: Column(
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.neutral300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0F4FF),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(Icons.receipt_long_rounded, size: 18, color: secondaryAccentColor),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Detail Slip Gaji',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: primaryBrandColor,
                                  ),
                                ),
                                Text(
                                  _formatPeriodName(period).toLowerCase().startsWith('periode')
                                      ? _formatPeriodName(period)
                                      : 'Periode ${_formatPeriodName(period)}',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11,
                                    color: AppColors.neutral500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(ctx),
                          icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.neutral600),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Scrollable Body
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  children: [
                    // Status Pembayaran Pill
                    Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF0F4FF),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(Icons.calendar_today_rounded, size: 18, color: secondaryAccentColor),
                              ),
                              const SizedBox(width: 10),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Periode Pembayaran',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10.5,
                                      color: AppColors.neutral500,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _formatPeriodName(period),
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: primaryBrandColor,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE8F5E9),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.check_circle_rounded, size: 13, color: Color(0xFF2E7D32)),
                                const SizedBox(width: 4),
                                Text(
                                  'TERBAYAR',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF2E7D32),
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Hero Card Take Home Pay
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(22),
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: isRiama
                              ? [
                                  const Color(0xFF064E3B),
                                  const Color(0xFF047857),
                                  const Color(0xFF059669),
                                ]
                              : [
                                  const Color(0xFF00163D),
                                  const Color(0xFF0F2B5C),
                                  const Color(0xFF1A3A70),
                                ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: (isRiama ? const Color(0xFF047857) : const Color(0xFF0F2B5C)).withValues(alpha: 0.28),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Stack(
                        children: [
                          Positioned(
                            right: -10,
                            top: -10,
                            child: Icon(
                              Icons.payments_rounded,
                              size: 90,
                              color: Colors.white.withValues(alpha: 0.08),
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'TOTAL GAJI BERSIH (TAKE HOME PAY)',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.8,
                                  color: Colors.white.withValues(alpha: 0.8),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                _formatRupiah(thp),
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 30,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              const SizedBox(height: 14),

                              Container(
                                padding: const EdgeInsets.only(top: 12),
                                decoration: BoxDecoration(
                                  border: Border(
                                    top: BorderSide(
                                      color: Colors.white.withValues(alpha: 0.15),
                                    ),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 30,
                                      height: 30,
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.14),
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        Icons.account_balance_rounded,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '$bankName • $bankAccount',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: Colors.white,
                                            ),
                                          ),
                                          Text(
                                            'Ditransfer resmi pada ${_formatPeriodName(period)}',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 10.5,
                                              color: Colors.white.withValues(alpha: 0.7),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),

                              SizedBox(
                                width: double.infinity,
                                height: 44,
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: isRiama ? const Color(0xFF10B981) : secondaryAccentColor,
                                    foregroundColor: Colors.white,
                                    elevation: 4,
                                    shadowColor: (isRiama ? const Color(0xFF10B981) : secondaryAccentColor).withValues(alpha: 0.4),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                  onPressed: () => _handleDownloadPdf(period),
                                  icon: const Icon(Icons.download_rounded, size: 20),
                                  label: Text(
                                    'Unduh Slip Gaji PDF',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Rincian Penerimaan Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x060F2B5C),
                            blurRadius: 12,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE8F5E9),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.add_card_rounded, size: 18, color: Color(0xFF2E7D32)),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    'Rincian Penerimaan',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: primaryBrandColor,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F3F8),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '$earningCount Komponen',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.neutral600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),

                          _buildPayrollItemRow('Gaji Pokok', _formatRupiah(basic)),
                          if (allowance > 0)
                            _buildPayrollItemRow('Tunjangan Tetap / Operasional', '+${_formatRupiah(allowance)}'),
                          if (bpjsKes > 0)
                            _buildPayrollItemRow('Tunjangan BPJS Kesehatan', _formatRupiah(bpjsKes)),
                          if (bpjsTk > 0)
                            _buildPayrollItemRow('Tunjangan BPJS Ketenagakerjaan', _formatRupiah(bpjsTk)),

                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0F4FF),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Subtotal Penerimaan',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: primaryBrandColor,
                                  ),
                                ),
                                Text(
                                  _formatRupiah(totalEarnings),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w800,
                                    color: primaryBrandColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Rincian Potongan Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.6)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x060F2B5C),
                            blurRadius: 12,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFEBEE),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.remove_done_rounded, size: 18, color: Color(0xFFC62828)),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    'Rincian Potongan',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: primaryBrandColor,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F3F8),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '$deductionCount Komponen',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.neutral600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),

                          if (absenceDeduction > 0)
                            _buildPayrollItemRow('Potongan Absensi / Keterlambatan', '-${_formatRupiah(absenceDeduction)}', isNegative: true),
                          if (pph21 > 0)
                            _buildPayrollItemRow('PPh 21', '-${_formatRupiah(pph21)}', isNegative: true),
                          if (deduction > 0)
                            _buildPayrollItemRow('Potongan Lainnya', '-${_formatRupiah(deduction)}', isNegative: true),
                          if (totalDeductions <= 0)
                            _buildPayrollItemRow('Potongan Periode Ini', 'Rp 0', isNeutral: true),

                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFDAD6).withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Subtotal Potongan',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFFBA1A1A),
                                  ),
                                ),
                                Text(
                                  totalDeductions > 0 ? '-${_formatRupiah(totalDeductions)}' : 'Rp 0',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFFBA1A1A),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPayrollItemRow(String title, String amount, {bool isNegative = false, bool isNeutral = false}) {
    Color amountColor = isNegative
        ? const Color(0xFFBA1A1A)
        : (isNeutral ? AppColors.neutral600 : AppColors.neutral900);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: const Color(0xFF44464F),
              ),
            ),
          ),
          Text(
            amount,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: amountColor,
            ),
          ),
        ],
      ),
    );
  }

  void _handleDownloadPdf(String period) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: primaryBrandColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
        margin: const EdgeInsets.only(bottom: 80, left: 30, right: 30),
        content: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_rounded, color: Color(0xFFC0C1FF), size: 18),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                'Slip Gaji $period berhasil diunduh (PDF)',
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  // -------------------------------------------------------------
  // 5. Tab 3: Laporan Harian & Aktivitas Kerja (Realtime from API)
  // -------------------------------------------------------------
  String _getFileSizeString(File file) {
    try {
      final bytes = file.lengthSync();
      if (bytes < 1024) return '$bytes B';
      if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    } catch (_) {
      return '1.2 MB';
    }
  }

  String? _resolveImageUrl(String? path) {
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final baseDomain = isRiama ? 'https://riamamandiripratama.com' : 'https://rimbunbuanasejahtera.com';
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (cleanPath.startsWith('storage/')) {
      return '$baseDomain/$cleanPath';
    }
    return '$baseDomain/storage/$cleanPath';
  }

  void _showPhotoSourceBottomSheet({
    required String title,
    required Function(File) onPhotoPicked,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.neutral300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Unggah Foto - $title',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: primaryBrandColor,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Ambil foto langsung atau pilih file dari galeri ponsel Anda.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: AppColors.neutral500,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                onTap: () async {
                  Navigator.pop(ctx);
                  final picker = ImagePicker();
                  final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 75, maxWidth: 1280);
                  if (picked != null) {
                    onPhotoPicked(File(picked.path));
                  }
                },
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isRiama ? const Color(0xFFE8F5E9) : const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.camera_alt_rounded, color: secondaryAccentColor),
                ),
                title: Text('Ambil Foto Kamera Langsung', style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700)),
                subtitle: Text('Buka kamera untuk mendokumentasikan kegiatan', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.neutral500)),
              ),
              const SizedBox(height: 8),
              ListTile(
                onTap: () async {
                  Navigator.pop(ctx);
                  final picker = ImagePicker();
                  final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 75, maxWidth: 1280);
                  if (picked != null) {
                    onPhotoPicked(File(picked.path));
                  }
                },
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F3F8),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.photo_library_rounded, color: Color(0xFF2563EB)),
                ),
                title: Text('Pilih dari Galeri Foto', style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700)),
                subtitle: Text('Unggah foto yang sudah tersimpan di galeri perangkat', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.neutral500)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _resetReportForm() {
    setState(() {
      _photoAbsen = null;
      _descAbsenController.clear();
      _photoKegiatan1 = null;
      _descKegiatan1Controller.clear();
      _photoKegiatan2 = null;
      _descKegiatan2Controller.clear();
      _photoKegiatanLain = null;
      _descKegiatanLainController.clear();
      _reportSelectedDate = DateTime.now();
    });
  }

  Future<void> _submitReportFromForm() async {
    // Validasi Slot 1: Absen Masuk (Wajib)
    if (_photoAbsen == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Foto Absen Masuk (Slot 1) wajib dilampirkan!'),
          backgroundColor: Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (_descAbsenController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Rincian Laporan Absen Masuk (Slot 1) wajib diisi!'),
          backgroundColor: Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Validasi Slot 2: Kegiatan 1 (Wajib)
    if (_photoKegiatan1 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Foto Kegiatan 1 (Slot 2) wajib dilampirkan!'),
          backgroundColor: Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (_descKegiatan1Controller.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Rincian Laporan Kegiatan 1 (Slot 2) wajib diisi!'),
          backgroundColor: Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Validasi Slot 3: Kegiatan 2 (Wajib)
    if (_photoKegiatan2 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Foto Kegiatan 2 (Slot 3) wajib dilampirkan!'),
          backgroundColor: Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (_descKegiatan2Controller.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Rincian Laporan Kegiatan 2 (Slot 3) wajib diisi!'),
          backgroundColor: Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isSubmittingReport = true);

    final dateStr = DateFormat('yyyy-MM-dd').format(_reportSelectedDate);

    final res = await EmployeePortalService.submit4ActivityWorkReport(
      reportDate: dateStr,
      photoAbsen: _photoAbsen!,
      descAbsen: _descAbsenController.text.trim(),
      photoKegiatan1: _photoKegiatan1!,
      descKegiatan1: _descKegiatan1Controller.text.trim(),
      photoKegiatan2: _photoKegiatan2!,
      descKegiatan2: _descKegiatan2Controller.text.trim(),
      photoKegiatanLain: _photoKegiatanLain,
      descKegiatanLain: _descKegiatanLainController.text.trim().isNotEmpty
          ? _descKegiatanLainController.text.trim()
          : null,
    );

    setState(() => _isSubmittingReport = false);

    if (res['success'] == true) {
      _resetReportForm();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    res['message']?.toString() ?? 'Laporan 4 kegiatan harian berhasil dikirim!',
                    style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF065F46),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 4),
          ),
        );
      }

      await _loadReports();
      await _loadAllRealtimeData();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message']?.toString() ?? 'Gagal mengirim laporan harian.'),
            backgroundColor: const Color(0xFFBA1A1A),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showReportDetailModal(Map<String, dynamic> report) {
    final title = report['title']?.toString() ?? 'Laporan Kerja Harian';
    final dateRaw = report['report_date']?.toString() ?? '';
    final status = report['status']?.toString() ?? 'pending';
    final feedback = report['feedback']?.toString();

    final photoAbsenUrl = _resolveImageUrl(report['photo_absen']?.toString() ?? report['attachment_path']?.toString());
    final descAbsen = report['desc_absen']?.toString() ?? report['description']?.toString() ?? '-';

    final photoKeg1Url = _resolveImageUrl(report['photo_kegiatan1']?.toString());
    final descKeg1 = report['desc_kegiatan1']?.toString() ?? '-';

    final photoKeg2Url = _resolveImageUrl(report['photo_kegiatan2']?.toString());
    final descKeg2 = report['desc_kegiatan2']?.toString() ?? '-';

    final photoKegLainUrl = _resolveImageUrl(report['photo_kegiatan_lain']?.toString());
    final descKegLain = report['desc_kegiatan_lain']?.toString();

    String dateDisplay = dateRaw;
    try {
      final parsedDate = DateTime.parse(dateRaw);
      dateDisplay = DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(parsedDate);
    } catch (_) {}

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.50,
        maxChildSize: 0.95,
        builder: (_, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(28),
              topRight: Radius.circular(28),
            ),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.neutral300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Rincian 4 Kegiatan Harian',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: primaryBrandColor,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          title,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: primaryBrandColor,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: status == 'approved'
                                ? const Color(0xFFE8F5E9)
                                : status == 'rejected'
                                    ? const Color(0xFFFFDAD6)
                                    : const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            status == 'approved'
                                ? 'Disetujui'
                                : status == 'rejected'
                                    ? 'Perlu Revisi'
                                    : 'Menunggu Review',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: status == 'approved'
                                  ? const Color(0xFF2E7D32)
                                  : status == 'rejected'
                                      ? const Color(0xFFBA1A1A)
                                      : const Color(0xFFB45309),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.event_note_rounded, size: 14, color: AppColors.neutral500),
                        const SizedBox(width: 4),
                        Text(
                          dateDisplay,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color: AppColors.neutral600,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // Detail Slot 1: Absen Masuk
                    _buildModalActivityCard(
                      title: '1. Absen Masuk',
                      subtitle: 'Foto Masuk Bertugas',
                      isRequired: true,
                      imageUrl: photoAbsenUrl,
                      description: descAbsen,
                    ),
                    const SizedBox(height: 14),

                    // Detail Slot 2: Kegiatan 1
                    _buildModalActivityCard(
                      title: '2. Kegiatan 1',
                      subtitle: 'Aktivitas Kerja Pertama',
                      isRequired: true,
                      imageUrl: photoKeg1Url,
                      description: descKeg1,
                    ),
                    const SizedBox(height: 14),

                    // Detail Slot 3: Kegiatan 2
                    _buildModalActivityCard(
                      title: '3. Kegiatan 2',
                      subtitle: 'Aktivitas Kerja Kedua',
                      isRequired: true,
                      imageUrl: photoKeg2Url,
                      description: descKeg2,
                    ),
                    const SizedBox(height: 14),

                    // Detail Slot 4: Kegiatan Lain
                    if (photoKegLainUrl != null || (descKegLain != null && descKegLain.trim().isNotEmpty)) ...[
                      _buildModalActivityCard(
                        title: '4. Kegiatan Lain',
                        subtitle: 'Tugas Tambahan (Opsional)',
                        isRequired: false,
                        imageUrl: photoKegLainUrl,
                        description: descKegLain ?? '-',
                      ),
                      const SizedBox(height: 14),
                    ],

                    if (feedback != null && feedback.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Catatan dari Atasan / Reviewer',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFFB45309),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          feedback,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12.5,
                            color: const Color(0xFF92400E),
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModalActivityCard({
    required String title,
    required String subtitle,
    required bool isRequired,
    required String? imageUrl,
    required String description,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.neutral200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: primaryBrandColor,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: isRequired ? const Color(0xFFD1FAE5) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isRequired ? 'Wajib' : 'Opsional',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: isRequired ? const Color(0xFF065F46) : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          Text(
            subtitle,
            style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.neutral500),
          ),
          const SizedBox(height: 10),
          if (imageUrl != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                imageUrl,
                width: double.infinity,
                height: 180,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Container(
                  height: 100,
                  color: Colors.grey.shade200,
                  alignment: Alignment.center,
                  child: Text('Foto gagal dimuat', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: Colors.grey)),
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
          Text(
            'Rincian Laporan:',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: AppColors.neutral700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            description,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12.5,
              color: AppColors.neutral900,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivitySlotCard({
    required int slotNumber,
    required String title,
    required String subtitle,
    required bool isRequired,
    required File? photo,
    required TextEditingController controller,
    required String placeholder,
    required VoidCallback onPickPhoto,
    required VoidCallback onRemovePhoto,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.neutral200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title & Badge Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$slotNumber. $title',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: AppColors.neutral900,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isRequired ? const Color(0xFFD1FAE5) : const Color(0xFFF1F5F9),
                  border: Border.all(
                    color: isRequired ? const Color(0xFFA7F3D0) : const Color(0xFFE2E8F0),
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  isRequired ? 'Wajib' : 'Opsional',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: isRequired ? const Color(0xFF065F46) : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11,
              color: AppColors.neutral500,
            ),
          ),
          const SizedBox(height: 12),

          // Foto Box
          if (photo == null)
            InkWell(
              onTap: onPickPhoto,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: double.infinity,
                height: 110,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isRequired
                        ? (isRiama ? const Color(0xFFA7F3D0) : const Color(0xFFBFDBFE))
                        : AppColors.neutral300,
                    style: BorderStyle.solid,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      slotNumber == 4 ? Icons.upload_rounded : Icons.photo_camera_rounded,
                      size: 24,
                      color: isRequired ? secondaryAccentColor : AppColors.neutral500,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Foto $title',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.neutral800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isRequired ? 'Klik untuk ambil / pilih foto' : 'Opsional (jika ada)',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10.5,
                        color: AppColors.neutral400,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.file(
                    photo,
                    width: double.infinity,
                    height: 140,
                    fit: BoxFit.cover,
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: InkWell(
                    onTap: onRemovePhoto,
                    child: Container(
                      padding: const EdgeInsets.all(5),
                      decoration: const BoxDecoration(
                        color: Color(0xBB000000),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded, size: 16, color: Colors.white),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xBB000000),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _getFileSizeString(photo),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10,
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          const SizedBox(height: 12),

          // Deskripsi / Rincian
          Text(
            isRequired ? 'Rincian Laporan (Wajib) *' : 'Rincian Laporan (Opsional)',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: AppColors.neutral800,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            maxLines: 3,
            style: GoogleFonts.plusJakartaSans(fontSize: 12.5, color: AppColors.neutral900),
            decoration: InputDecoration(
              hintText: placeholder,
              hintStyle: GoogleFonts.plusJakartaSans(fontSize: 11.5, color: AppColors.neutral400),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.neutral200),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.neutral200),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: secondaryAccentColor, width: 1.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // 5. Tab 3: Laporan Kerja & Skeleton Loader
  // -------------------------------------------------------------
  Widget _buildReportsSkeleton() {
    return Column(
      children: List.generate(3, (index) {
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.7)),
          ),
          child: Row(
            children: [
              const AppSkeleton(width: 56, height: 56, borderRadius: 12),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        AppSkeleton(width: 100, height: 10, borderRadius: 4),
                        AppSkeleton(width: 60, height: 16, borderRadius: 8),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const AppSkeleton(width: 140, height: 13, borderRadius: 6),
                    const SizedBox(height: 6),
                    const AppSkeleton(width: 90, height: 10, borderRadius: 4),
                  ],
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildWorkReportsTab() {
    final shiftName = _todayAttendance?.assignedShift?.name ?? 'Shift Reguler';
    final reportCount = _workReportsList?.length ?? 0;

    return RefreshIndicator(
      color: secondaryAccentColor,
      onRefresh: _loadReports,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 106, bottom: 95, left: 20, right: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Title & Shift Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Laporan Harian',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: primaryBrandColor,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(Icons.event_rounded, size: 15, color: AppColors.neutral500),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              _formatIndonesianDateShort(_currentTime),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                color: AppColors.neutral500,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: (isRiama ? const Color(0xFFE8F5E9) : const Color(0xFFE2E7FF)),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: secondaryAccentColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        shiftName,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: secondaryAccentColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Form Card: Formulir 4 Kegiatan Harian
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.7)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x060F2B5C),
                    blurRadius: 14,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Form Card Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: isRiama ? const Color(0xFFD1FAE5) : const Color(0xFFD9E2FF),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(Icons.playlist_add_check_rounded, size: 22, color: primaryBrandColor),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Form 4 Kegiatan Harian',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: primaryBrandColor,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    'Dokumentasi 4 aktivitas kerja lengkap foto',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10.5,
                                      color: AppColors.neutral500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          'Sesuai Web',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF065F46),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Tanggal Laporan Picker
                  Text(
                    'Tanggal Pelaksanaan Laporan',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.neutral800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _reportSelectedDate,
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now().add(const Duration(days: 1)),
                      );
                      if (picked != null) {
                        setState(() => _reportSelectedDate = picked);
                      }
                    },
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF4F6FB),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.neutral200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.calendar_today_rounded, size: 16, color: secondaryAccentColor),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(_reportSelectedDate),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.neutral900,
                              ),
                            ),
                          ),
                          Icon(Icons.arrow_drop_down_rounded, color: AppColors.neutral500),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Slot 1: Absen Masuk (Wajib)
                  _buildActivitySlotCard(
                    slotNumber: 1,
                    title: 'Absen Masuk',
                    subtitle: 'Foto dan rincian saat mulai bertugas',
                    isRequired: true,
                    photo: _photoAbsen,
                    controller: _descAbsenController,
                    placeholder: 'Contoh: Hadir di lokasi tepat waktu, bersiap menjalankan tugas...',
                    onPickPhoto: () => _showPhotoSourceBottomSheet(
                      title: 'Absen Masuk',
                      onPhotoPicked: (f) => setState(() => _photoAbsen = f),
                    ),
                    onRemovePhoto: () => setState(() => _photoAbsen = null),
                  ),
                  const SizedBox(height: 16),

                  // Slot 2: Kegiatan 1 (Wajib)
                  _buildActivitySlotCard(
                    slotNumber: 2,
                    title: 'Kegiatan 1',
                    subtitle: 'Aktivitas pekerjaan utama pertama',
                    isRequired: true,
                    photo: _photoKegiatan1,
                    controller: _descKegiatan1Controller,
                    placeholder: 'Contoh: Melakukan pembersihan dan perapihan area kerja...',
                    onPickPhoto: () => _showPhotoSourceBottomSheet(
                      title: 'Kegiatan 1',
                      onPhotoPicked: (f) => setState(() => _photoKegiatan1 = f),
                    ),
                    onRemovePhoto: () => setState(() => _photoKegiatan1 = null),
                  ),
                  const SizedBox(height: 16),

                  // Slot 3: Kegiatan 2 (Wajib)
                  _buildActivitySlotCard(
                    slotNumber: 3,
                    title: 'Kegiatan 2',
                    subtitle: 'Aktivitas pekerjaan utama kedua',
                    isRequired: true,
                    photo: _photoKegiatan2,
                    controller: _descKegiatan2Controller,
                    placeholder: 'Contoh: Melakukan pengecekan inventaris dan patroli area...',
                    onPickPhoto: () => _showPhotoSourceBottomSheet(
                      title: 'Kegiatan 2',
                      onPhotoPicked: (f) => setState(() => _photoKegiatan2 = f),
                    ),
                    onRemovePhoto: () => setState(() => _photoKegiatan2 = null),
                  ),
                  const SizedBox(height: 16),

                  // Slot 4: Kegiatan Lain (Opsional)
                  _buildActivitySlotCard(
                    slotNumber: 4,
                    title: 'Kegiatan Lain',
                    subtitle: 'Aktivitas / tugas tambahan (opsional)',
                    isRequired: false,
                    photo: _photoKegiatanLain,
                    controller: _descKegiatanLainController,
                    placeholder: 'Opsional: Catatan kegiatan lain bila ada...',
                    onPickPhoto: () => _showPhotoSourceBottomSheet(
                      title: 'Kegiatan Lain',
                      onPhotoPicked: (f) => setState(() => _photoKegiatanLain = f),
                    ),
                    onRemovePhoto: () => setState(() => _photoKegiatanLain = null),
                  ),
                  const SizedBox(height: 20),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isSubmittingReport ? null : _submitReportFromForm,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryBrandColor,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 1,
                      ),
                      child: _isSubmittingReport
                          ? Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  'Mengirim Laporan 4 Kegiatan...',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.send_rounded, size: 18),
                                const SizedBox(width: 8),
                                Text(
                                  'Kirim Laporan 4 Kegiatan',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Header Section: Riwayat Laporan Terakhir
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.history_rounded, size: 19, color: primaryBrandColor),
                    const SizedBox(width: 6),
                    Text(
                      'Riwayat Laporan Terakhir',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: primaryBrandColor,
                      ),
                    ),
                  ],
                ),
                Text(
                  '$reportCount Laporan',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.neutral500,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // List Riwayat Laporan
            if (_isLoadingReports)
              _buildReportsSkeleton()
            else if (_workReportsList == null || _workReportsList!.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.7)),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: const BoxDecoration(
                        color: Color(0xFFF1F3F8),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.assignment_outlined, size: 36, color: AppColors.neutral400),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Belum Ada Laporan Kerja',
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: primaryBrandColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Isi formulir di atas untuk mengirimkan dokumentasi dan laporan aktivitas harian Anda.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: AppColors.neutral500,
                      ),
                    ),
                  ],
                ),
              )
            else
              ..._workReportsList!.map((rawReport) {
                final report = rawReport is Map<String, dynamic>
                    ? rawReport
                    : Map<String, dynamic>.from(rawReport as Map);

                final title = report['title']?.toString() ?? 'Laporan Kerja';
                final desc = report['description']?.toString() ?? '';
                final dateRaw = report['report_date']?.toString() ?? '';
                final status = report['status']?.toString() ?? 'pending';
                final photoPath = report['attachment_path']?.toString() ??
                    report['photo_absen']?.toString() ??
                    report['photo_kegiatan1']?.toString();

                final fullImageUrl = _resolveImageUrl(photoPath);

                // Date formatting
                String dateDisplay = dateRaw;
                try {
                  final parsedDate = DateTime.parse(dateRaw);
                  dateDisplay = DateFormat('EEEE, d MMM yyyy', 'id_ID').format(parsedDate);
                } catch (_) {}

                // Status styling
                String statusLabel = 'Terkirim';
                Color statusBg = const Color(0xFFEAEDFF);
                Color statusColor = secondaryAccentColor;

                if (status == 'approved') {
                  statusLabel = 'Disetujui';
                  statusBg = const Color(0xFFE8F5E9);
                  statusColor = const Color(0xFF2E7D32);
                } else if (status == 'rejected') {
                  statusLabel = 'Ditolak';
                  statusBg = const Color(0xFFFFDAD6);
                  statusColor = const Color(0xFFBA1A1A);
                } else if (status == 'pending') {
                  statusLabel = 'Menunggu';
                  statusBg = const Color(0xFFFEF3C7);
                  statusColor = const Color(0xFFB45309);
                }

                // Parse jam from description or default
                String timeDisplay = '08:30 - 17:30';
                if (desc.contains('Jam Kerja:')) {
                  final lines = desc.split('\n');
                  for (final l in lines) {
                    if (l.contains('Jam Kerja:')) {
                      timeDisplay = l.replaceAll('Jam Kerja:', '').trim();
                      break;
                    }
                  }
                }

                final hasPhoto = photoPath != null && photoPath.isNotEmpty;

                return InkWell(
                  onTap: () => _showReportDetailModal(report),
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.neutral200.withValues(alpha: 0.7)),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x040F2B5C),
                          blurRadius: 8,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        // Left Thumbnail or Icon
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            width: 56,
                            height: 56,
                            color: const Color(0xFFF1F3F8),
                            child: hasPhoto && fullImageUrl != null
                                ? Image.network(
                                    fullImageUrl,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Icon(
                                      Icons.photo_rounded,
                                      size: 26,
                                      color: AppColors.neutral400,
                                    ),
                                  )
                                : Icon(
                                    Icons.assignment_rounded,
                                    size: 26,
                                    color: secondaryAccentColor,
                                  ),
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Center Info
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      dateDisplay,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10.5,
                                        color: AppColors.neutral500,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: statusBg,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      statusLabel,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w800,
                                        color: statusColor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.neutral900,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(Icons.schedule_rounded, size: 12, color: AppColors.neutral400),
                                  const SizedBox(width: 4),
                                  Text(
                                    timeDisplay,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      color: AppColors.neutral600,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    width: 3,
                                    height: 3,
                                    decoration: const BoxDecoration(
                                      color: AppColors.neutral400,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Icon(Icons.attach_file_rounded, size: 12, color: AppColors.neutral400),
                                  const SizedBox(width: 2),
                                  Text(
                                    hasPhoto ? '1 Foto' : 'Tanpa Foto',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      color: AppColors.neutral600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // 6. Tab 4: Setting & Profile Tab (Material 3 Enterprise Design)
  // -------------------------------------------------------------
  Widget _buildSettingTab() {
    final u = _profileData?['user'] as Map<String, dynamic>?;
    final job = _profileData?['job_details'] as Map<String, dynamic>?;

    final displayName = u?['name']?.toString() ?? widget.user.name;
    final displayNik = u?['nik']?.toString() ?? widget.user.nik ?? '-';
    final rawPos = job?['position']?.toString() ?? widget.user.position;
    final displayPosition = (rawPos != null && !rawPos.toLowerCase().contains('lapangan')) ? rawPos : (rawPos == null || rawPos.toLowerCase().contains('lapangan') ? '-' : rawPos);
    final displaySchool = job?['school_unit']?.toString() ?? widget.user.schoolUnit ?? (_todayAttendance?.assignedLocation?.name ?? '-');
    final statusKerja = job?['status']?.toString() ?? 'Tetap';

    final iconBgColor = isRiama ? const Color(0xFFD1FAE5) : const Color(0xFFE0E7FF);
    final iconColor = isRiama ? const Color(0xFF065F46) : const Color(0xFF2563EB);

    if (_isLoadingProfile && _profileData == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.only(top: 150),
          child: CircularProgressIndicator(color: primaryBrandColor),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.only(top: 106, bottom: 95, left: 16, right: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section: Header Subtitle / Intro
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pengaturan Akun',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: primaryBrandColor,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Kelola preferensi absensi dan data profil Anda',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconBgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.manage_accounts_rounded,
                  color: iconColor,
                  size: 22,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Card: User Profile Summary (Tappable to Edit Profile)
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ProfileEditScreen(
                      user: widget.user,
                      initialProfileData: _profileData,
                      onProfileUpdated: () {
                        _loadProfile();
                      },
                    ),
                  ),
                );
                if (mounted) _restoreStatusBar();
              },
              borderRadius: BorderRadius.circular(18),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0A0F2B5C),
                      blurRadius: 14,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Avatar with online dot
                    Stack(
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: secondaryLightColor,
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
                          ),
                          child: Center(
                            child: Text(
                              displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: secondaryDarkColor,
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 1,
                          right: 1,
                          child: Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2.2),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  displayName,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                    color: const Color(0xFF0F172A),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: isRiama ? const Color(0xFFD1FAE5) : const Color(0xFFEEF2FF),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  statusKerja,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: isRiama ? const Color(0xFF065F46) : const Color(0xFF4648D4),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'NIK: $displayNik',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            displayPosition,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11.5,
                              color: const Color(0xFF475569),
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (displaySchool.isNotEmpty && displaySchool != '-') ...[
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                const Icon(Icons.apartment_rounded, size: 12, color: Color(0xFF64748B)),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    displaySchool,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      color: const Color(0xFF64748B),
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: Color(0xFF94A3B8),
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: 20),

          // ==========================================================
          // GROUP 1: AKUN & KEAMANAN
          // ==========================================================
          _buildSettingSectionHeader('Akun & Keamanan'),
          const SizedBox(height: 8),
          _buildSettingGroupCard(
            children: [
              _buildSettingItem(
                icon: Icons.badge_rounded,
                iconBgColor: iconBgColor,
                iconColor: iconColor,
                title: 'Informasi Akun & Data Pribadi',
                subtitle: 'Biodata, nomor telepon, email terdaftar',
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ProfileEditScreen(
                        user: widget.user,
                        initialProfileData: _profileData,
                        onProfileUpdated: () {
                          _loadProfile();
                        },
                      ),
                    ),
                  );
                  if (mounted) _restoreStatusBar();
                },
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingItem(
                icon: Icons.lock_reset_rounded,
                iconBgColor: iconBgColor,
                iconColor: iconColor,
                title: 'Keamanan & Ubah Password',
                subtitle: 'PIN verifikasi, biometric, kata sandi',
                onTap: _showChangePasswordDialog,
              ),
            ],
          ),

          const SizedBox(height: 20),

          // ==========================================================
          // GROUP 2: APLIKASI & ABSENSI
          // ==========================================================
          _buildSettingSectionHeader('Aplikasi & Absensi'),
          const SizedBox(height: 8),
          _buildSettingGroupCard(
            children: [
              _buildSettingSwitchItem(
                icon: Icons.notifications_active_rounded,
                iconBgColor: const Color(0xFFEEF2FF),
                iconColor: const Color(0xFF4648D4),
                title: 'Pengingat Masuk & Pulang',
                subtitle: 'Aktif pukul 08:00 & 17:00 (${_todayAttendance?.timezone ?? 'WIB'})',
                value: _reminderAttendance,
                onChanged: (val) {
                  setState(() => _reminderAttendance = val);
                },
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingSwitchItem(
                icon: Icons.campaign_rounded,
                iconBgColor: const Color(0xFFEEF2FF),
                iconColor: const Color(0xFF4648D4),
                title: 'Pengumuman & Memo Kantor',
                subtitle: 'Update resmi Human Capital',
                value: _reminderBroadcast,
                onChanged: (val) {
                  setState(() => _reminderBroadcast = val);
                },
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingItem(
                icon: Icons.my_location_rounded,
                iconBgColor: iconBgColor,
                iconColor: iconColor,
                title: 'Izin Lokasi & GPS',
                subtitle: 'Radius presisi kantor utama',
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: _isGpsAllowed ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        _isGpsAllowed ? 'Diizinkan' : 'Ditolak',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: _isGpsAllowed ? const Color(0xFF047857) : const Color(0xFFB91C1C),
                        ),
                      ),
                    ],
                  ),
                ),
                onTap: () async {
                  final pos = await _determinePosition();
                  if (pos != null) {
                    setState(() => _isGpsAllowed = true);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('GPS & Lokasi aktif dalam akurasi tinggi.'),
                          backgroundColor: Color(0xFF059669),
                          duration: Duration(seconds: 2),
                        ),
                      );
                    }
                  }
                },
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingItem(
                icon: Icons.translate_rounded,
                iconBgColor: iconBgColor,
                iconColor: iconColor,
                title: 'Bahasa Tampilan',
                subtitle: 'Pilihan bahasa antarmuka',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Indonesia',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 18),
                  ],
                ),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Aplikasi saat ini diatur dalam Bahasa Indonesia (Baku).'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
            ],
          ),

          const SizedBox(height: 20),

          // ==========================================================
          // GROUP 3: BANTUAN & LEGAL
          // ==========================================================
          _buildSettingSectionHeader('Bantuan & Legal'),
          const SizedBox(height: 8),
          _buildSettingGroupCard(
            children: [
              _buildSettingItem(
                icon: Icons.auto_awesome_rounded,
                iconBgColor: const Color(0xFFFDF4FF),
                iconColor: const Color(0xFFC026D3),
                title: 'Panduan Aplikasi & Tutorial Fitur',
                subtitle: 'Pelajari kembali 5 fungsi utama dasbor aplikasi',
                onTap: () {
                  _checkAndShowTutorial(force: true);
                },
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingItem(
                icon: Icons.support_agent_rounded,
                iconBgColor: iconBgColor,
                iconColor: iconColor,
                title: 'Pusat Keluhan & Bantuan HRD',
                subtitle: 'Sampaikan kendala gaji, absensi, atau fasilitas',
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ComplaintsScreen(user: widget.user),
                    ),
                  );
                  if (mounted) _restoreStatusBar();
                },
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingItem(
                icon: Icons.chat_bubble_rounded,
                iconBgColor: const Color(0xFFECFDF5),
                iconColor: const Color(0xFF059669),
                title: 'Live Chat & Bantuan AI',
                subtitle: 'Tanya jawab interaktif bot AI & agen CS HRD',
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => LiveChatScreen(user: widget.user),
                    ),
                  );
                  if (mounted) _restoreStatusBar();
                },
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingItem(
                icon: Icons.help_center_rounded,
                iconBgColor: iconBgColor,
                iconColor: iconColor,
                title: 'Pusat Bantuan & FAQ',
                subtitle: 'Panduan presisi absensi & kendala teknis',
                onTap: _showHelpFaqBottomSheet,
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingItem(
                icon: Icons.shield_rounded,
                iconBgColor: iconBgColor,
                iconColor: iconColor,
                title: 'Kebijakan Privasi & Ketentuan',
                subtitle: 'Perlindungan data biometrik & presensi',
                onTap: _showPrivacyPolicyBottomSheet,
              ),
              const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9)),
              _buildSettingItem(
                icon: Icons.verified_rounded,
                iconBgColor: iconBgColor,
                iconColor: iconColor,
                title: 'Versi Aplikasi',
                subtitle: 'HC Attendance Mobile Client',
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    'v2.4.0 (Build 302)',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF475569),
                    ),
                  ),
                ),
                onTap: () {},
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Logout Button Section
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text(
                      'Konfirmasi Keluar',
                      style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
                    ),
                    content: Text(
                      'Apakah Anda yakin ingin keluar dari akun HC Attendance?',
                      style: GoogleFonts.plusJakartaSans(fontSize: 13),
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: Text(
                          'Batal',
                          style: GoogleFonts.plusJakartaSans(color: const Color(0xFF64748B)),
                        ),
                      ),
                      ElevatedButton(
                        onPressed: () {
                          Navigator.pop(ctx);
                          _handleLogout();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: Text(
                          'Keluar',
                          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                );
              },
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: Text(
                'Keluar Akun',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w800,
                  fontSize: 13.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFDAD6),
                foregroundColor: const Color(0xFFBA1A1A),
                elevation: 0,
                side: const BorderSide(color: Color(0xFFFFB4AB)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),

          const SizedBox(height: 12),
          Center(
            child: Text(
              'HC Attendance Management Mobile • Enterprise 2026',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildSettingSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.8,
          color: const Color(0xFF64748B),
        ),
      ),
    );
  }

  Widget _buildSettingGroupCard({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F2B5C),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildSettingItem({
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String title,
    String? subtitle,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconBgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            trailing ??
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFF94A3B8),
                  size: 20,
                ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingSwitchItem({
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: Colors.white,
            activeTrackColor: secondaryAccentColor,
            inactiveThumbColor: Colors.white,
            inactiveTrackColor: const Color(0xFFCBD5E1),
          ),
        ],
      ),
    );
  }

  void _showChangePasswordDialog() {
    final currentPwController = TextEditingController();
    final newPwController = TextEditingController();
    final confirmPwController = TextEditingController();
    bool obscureCurrent = true;
    bool obscureNew = true;
    bool obscureConfirm = true;
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(context).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.lock_reset_rounded, color: Color(0xFF4648D4), size: 22),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Keamanan & Ubah Password',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 15.5,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                          Text(
                            'Gunakan minimal 6 karakter',
                            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: const Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text('Kata Sandi Saat Ini', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: currentPwController,
                    obscureText: obscureCurrent,
                    decoration: InputDecoration(
                      hintText: 'Masukkan kata sandi lama',
                      hintStyle: GoogleFonts.plusJakartaSans(color: const Color(0xFF94A3B8), fontSize: 13),
                      prefixIcon: const Icon(Icons.lock_outline_rounded, size: 18),
                      suffixIcon: IconButton(
                        icon: Icon(obscureCurrent ? Icons.visibility_off : Icons.visibility, size: 18),
                        onPressed: () => setModalState(() => obscureCurrent = !obscureCurrent),
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text('Kata Sandi Baru', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: newPwController,
                    obscureText: obscureNew,
                    decoration: InputDecoration(
                      hintText: 'Minimal 6 karakter',
                      hintStyle: GoogleFonts.plusJakartaSans(color: const Color(0xFF94A3B8), fontSize: 13),
                      prefixIcon: const Icon(Icons.key_rounded, size: 18),
                      suffixIcon: IconButton(
                        icon: Icon(obscureNew ? Icons.visibility_off : Icons.visibility, size: 18),
                        onPressed: () => setModalState(() => obscureNew = !obscureNew),
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text('Konfirmasi Kata Sandi Baru', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: confirmPwController,
                    obscureText: obscureConfirm,
                    decoration: InputDecoration(
                      hintText: 'Ulangi kata sandi baru',
                      hintStyle: GoogleFonts.plusJakartaSans(color: const Color(0xFF94A3B8), fontSize: 13),
                      prefixIcon: const Icon(Icons.key_rounded, size: 18),
                      suffixIcon: IconButton(
                        icon: Icon(obscureConfirm ? Icons.visibility_off : Icons.visibility, size: 18),
                        onPressed: () => setModalState(() => obscureConfirm = !obscureConfirm),
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: isSubmitting
                          ? null
                          : () async {
                              final currentPw = currentPwController.text.trim();
                              final newPw = newPwController.text.trim();
                              final confirmPw = confirmPwController.text.trim();

                              if (currentPw.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Kata sandi saat ini wajib diisi.')),
                                );
                                return;
                              }
                              if (newPw.length < 6) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Kata sandi baru minimal 6 karakter.')),
                                );
                                return;
                              }
                              if (newPw != confirmPw) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Konfirmasi kata sandi tidak cocok.')),
                                );
                                return;
                              }

                              setModalState(() => isSubmitting = true);
                              final res = await EmployeePortalService.updateProfile(
                                currentPassword: currentPw,
                                newPassword: newPw,
                              );
                              setModalState(() => isSubmitting = false);

                              if (!ctx.mounted) return;
                              if (res['success'] == true) {
                                Navigator.pop(ctx);
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(res['message'] ?? 'Kata sandi berhasil diperbarui.'),
                                      backgroundColor: const Color(0xFF059669),
                                    ),
                                  );
                                }
                              } else {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(res['message'] ?? 'Gagal memperbarui kata sandi.'),
                                      backgroundColor: AppColors.error,
                                    ),
                                  );
                                }
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryBrandColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: isSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(
                              'Perbarui Kata Sandi',
                              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13.5),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showHelpFaqBottomSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Icon(Icons.help_center_rounded, color: Color(0xFF4648D4), size: 24),
                const SizedBox(width: 10),
                Text(
                  'Pusat Bantuan & FAQ',
                  style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              '1. Kendala Presensi / GPS Di Luar Radius\nPastikan GPS perangkat Anda aktif dalam mode akurasi tinggi dan berada di area titik sekolah yang ditentukan.',
              style: GoogleFonts.plusJakartaSans(fontSize: 12.5, height: 1.5, color: const Color(0xFF334155)),
            ),
            const SizedBox(height: 10),
            Text(
              '2. Perubahan Data HRD (NIK & Unit)\nData NIK dan Unit Penempatan dikunci demi kepatuhan SPK. Untuk mutasi atau koreksi NIK, silakan laporkan ke admin HRD.',
              style: GoogleFonts.plusJakartaSans(fontSize: 12.5, height: 1.5, color: const Color(0xFF334155)),
            ),
            const SizedBox(height: 10),
            Text(
              '3. Bantuan Human Capital Hotline\nHubungi helpdesk melalui WhatsApp resmi operasional untuk penanganan darurat.',
              style: GoogleFonts.plusJakartaSans(fontSize: 12.5, height: 1.5, color: const Color(0xFF334155)),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryBrandColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Tutup'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showPrivacyPolicyBottomSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Icon(Icons.shield_rounded, color: Color(0xFF059669), size: 24),
                const SizedBox(width: 10),
                Text(
                  'Kebijakan Privasi & Ketentuan',
                  style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'HC Attendance menjaga keamanan dan kerahasiaan data lokasi (GPS) dan foto selfie presensi Anda. Data koordinat lokasi hanya diakses dan divalidasi saat tombol Absen Masuk/Pulang ditekan, dan tidak direkam di luar aktivitas jam operasional presensi.',
              style: GoogleFonts.plusJakartaSans(fontSize: 12.5, height: 1.5, color: const Color(0xFF334155)),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryBrandColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Mengerti'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // Helper: Quick Action Circular Button for Dashboard Card
  // -------------------------------------------------------------
  Widget _buildCircularQuickAction({
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required Color borderColor,
    required String label,
    required String sublabel,
    bool badgeDot = false,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Circular Button with optional badge
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: bgColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: borderColor, width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: iconColor.withValues(alpha: 0.14),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Icon(icon, size: 24, color: iconColor),
                  ),
                ),
                if (badgeDot)
                  Positioned(
                    top: 1,
                    right: 1,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 7),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 1.5),
            Text(
              sublabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 9.5,
                fontWeight: FontWeight.w500,
                color: AppColors.neutral400,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // 7. Redesigned Animated Curved Bottom Navigation Bar
  //    (Wave dome and elevated bubble smoothly glide to active tab)
  // -------------------------------------------------------------
  Widget _buildBottomNav() {
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    const double barHeight = 62.0;
    const double domeRise = 26.0;
    final double totalHeight = barHeight + domeRise + bottomPadding;
    const navBgColor = Color(0xFF181A20); // Dark sleek surface matching reference
    final activeAccent = isRiama ? const Color(0xFF10B981) : const Color(0xFF3B82F6);
    final activeTextAccent = isRiama ? const Color(0xFF34D399) : const Color(0xFF60A5FA);

    final double targetPos = _getNavPosition(_currentTabIndex);

    final navSlots = const [
      _NavSlotInfo(
        tabIndex: 1,
        label: 'Riwayat',
        icon: Icons.calendar_month_outlined,
        activeIcon: Icons.calendar_month_rounded,
      ),
      _NavSlotInfo(
        tabIndex: 2,
        label: 'Slip Gaji',
        icon: Icons.receipt_long_outlined,
        activeIcon: Icons.receipt_long_rounded,
      ),
      _NavSlotInfo(
        tabIndex: 0,
        label: 'Home',
        icon: Icons.home_outlined,
        activeIcon: Icons.home_rounded,
      ),
      _NavSlotInfo(
        tabIndex: 3,
        label: 'Laporan',
        icon: Icons.photo_camera_outlined,
        activeIcon: Icons.photo_camera_rounded,
      ),
      _NavSlotInfo(
        tabIndex: 4,
        label: 'Setting',
        icon: Icons.person_outline_rounded,
        activeIcon: Icons.person_rounded,
      ),
    ];

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(end: targetPos),
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      builder: (context, animatedPos, child) {
        return SizedBox(
          height: totalHeight,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final double width = constraints.maxWidth;
              final double slotWidth = width / 5.0;
              final double activeCenterX = (animatedPos + 0.5) * slotWidth;

              return Stack(
                clipBehavior: Clip.none,
                children: [
                  // 1. Moving Curved Wave Canvas Background
                  Positioned.fill(
                    child: CustomPaint(
                      painter: CurvedNavBarPainter(
                        activePosition: animatedPos,
                        totalSlots: 5,
                        backgroundColor: navBgColor,
                        shadowColor: Colors.black.withValues(alpha: 0.35),
                      ),
                    ),
                  ),

                  // 2. Navigation Items (5 Slots in the bar)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: bottomPadding,
                    height: barHeight,
                    child: Row(
                      children: List.generate(5, (index) {
                        final slot = navSlots[index];
                        final isCurrentTab = _currentTabIndex == slot.tabIndex;
                        final double distance = (animatedPos - index).abs().clamp(0.0, 1.0);
                        // Icon fades out when the elevated bubble is hovering over it
                        final double iconOpacity = (distance * 1.6).clamp(0.0, 1.0);

                        return Expanded(
                          child: InkResponse(
                            onTap: () {
                              if (_currentTabIndex != slot.tabIndex) {
                                setState(() {
                                  _currentTabIndex = slot.tabIndex;
                                });
                                if (slot.tabIndex == 1) _loadHistory();
                                if (slot.tabIndex == 2) _loadPayrolls();
                                if (slot.tabIndex == 3) _loadReports();
                                if (slot.tabIndex == 4) _loadProfile();
                              }
                            },
                            radius: 30,
                            containedInkWell: true,
                            highlightShape: BoxShape.circle,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  // In-bar Icon (fades out as active bubble arrives)
                                  Opacity(
                                    opacity: iconOpacity,
                                    child: Icon(
                                      slot.icon,
                                      size: 22,
                                      color: const Color(0xFF94A3B8),
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  // Slot Label
                                  Text(
                                    slot.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10,
                                      fontWeight: isCurrentTab ? FontWeight.w800 : FontWeight.w600,
                                      color: isCurrentTab ? activeTextAccent : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),

                  // 3. Floating Elevated Bubble (Nonjol at the active tab position)
                  Positioned(
                    left: activeCenterX - 26.0,
                    top: 3.5,
                    width: 52.0,
                    height: 52.0,
                    child: IgnorePointer(
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF20232A),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: activeAccent,
                            width: 2.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: activeAccent.withValues(alpha: 0.45),
                              blurRadius: 14,
                              spreadRadius: 1,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Center(
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 220),
                            transitionBuilder: (child, animation) {
                              return ScaleTransition(
                                scale: animation,
                                child: child,
                              );
                            },
                            child: Icon(
                              _getActiveIconForTab(_currentTabIndex),
                              key: ValueKey<int>(_currentTabIndex),
                              size: 25,
                              color: activeTextAccent,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }

  double _getNavPosition(int tabIndex) {
    switch (tabIndex) {
      case 1:
        return 0.0; // Riwayat
      case 2:
        return 1.0; // Slip Gaji
      case 0:
        return 2.0; // Home (Center)
      case 3:
        return 3.0; // Laporan
      case 4:
        return 4.0; // Setting
      default:
        return 2.0;
    }
  }

  IconData _getActiveIconForTab(int tabIndex) {
    switch (tabIndex) {
      case 1:
        return Icons.calendar_month_rounded;
      case 2:
        return Icons.receipt_long_rounded;
      case 0:
        return Icons.home_rounded;
      case 3:
        return Icons.photo_camera_rounded;
      case 4:
        return Icons.person_rounded;
      default:
        return Icons.home_rounded;
    }
  }
}

class _NavSlotInfo {
  final int tabIndex;
  final String label;
  final IconData icon;
  final IconData activeIcon;

  const _NavSlotInfo({
    required this.tabIndex,
    required this.label,
    required this.icon,
    required this.activeIcon,
  });
}

/// CustomPainter for the animated moving curved wave bottom navigation bar
class CurvedNavBarPainter extends CustomPainter {
  final double activePosition;
  final int totalSlots;
  final Color backgroundColor;
  final Color shadowColor;

  CurvedNavBarPainter({
    required this.activePosition,
    this.totalSlots = 5,
    required this.backgroundColor,
    this.shadowColor = const Color(0x35000000),
  });

  @override
  void paint(Canvas canvas, Size size) {
    final double width = size.width;
    final double height = size.height;
    final double slotWidth = width / totalSlots;
    final double centerX = (activePosition + 0.5) * slotWidth;

    const double barTopY = 24.0;      // flat baseline for side buttons
    const double domePeakY = 3.0;     // dome peak for active button
    final double waveWidth = (slotWidth * 0.46).clamp(32.0, 42.0); // half-width of the dome wave
    const double cornerRadius = 18.0;

    final path = Path();

    // Start at top-left below rounded corner
    path.moveTo(0, barTopY + cornerRadius);
    path.quadraticBezierTo(0, barTopY, cornerRadius, barTopY);

    // Wave bounds clamped safely within corners
    final double leftWaveX = (centerX - waveWidth).clamp(cornerRadius, width - cornerRadius);
    final double rightWaveX = (centerX + waveWidth).clamp(cornerRadius, width - cornerRadius);

    // Flat line towards wave
    path.lineTo(leftWaveX, barTopY);

    // Smooth cubic curve ascending into the dome
    path.cubicTo(
      centerX - (waveWidth * 0.52), barTopY,
      centerX - (waveWidth * 0.38), domePeakY,
      centerX, domePeakY,
    );

    // Smooth cubic curve descending from the dome
    path.cubicTo(
      centerX + (waveWidth * 0.38), domePeakY,
      centerX + (waveWidth * 0.52), barTopY,
      rightWaveX, barTopY,
    );

    // Flat line to top-right corner
    path.lineTo(width - cornerRadius, barTopY);
    path.quadraticBezierTo(width, barTopY, width, barTopY + cornerRadius);

    // Right edge down to bottom
    path.lineTo(width, height);

    // Bottom edge across to bottom-left
    path.lineTo(0, height);

    // Close path
    path.close();

    // 1. Draw elegant ambient shadow
    canvas.drawShadow(path, shadowColor, 14.0, false);

    // 2. Fill background
    final fillPaint = Paint()
      ..color = backgroundColor
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    // 3. Subtle glossy highlight stroke on top edge
    final strokePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.10)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final topEdgePath = Path();
    topEdgePath.moveTo(0, barTopY + cornerRadius);
    topEdgePath.quadraticBezierTo(0, barTopY, cornerRadius, barTopY);
    topEdgePath.lineTo(leftWaveX, barTopY);
    topEdgePath.cubicTo(
      centerX - (waveWidth * 0.52), barTopY,
      centerX - (waveWidth * 0.38), domePeakY,
      centerX, domePeakY,
    );
    topEdgePath.cubicTo(
      centerX + (waveWidth * 0.38), domePeakY,
      centerX + (waveWidth * 0.52), barTopY,
      rightWaveX, barTopY,
    );
    topEdgePath.lineTo(width - cornerRadius, barTopY);
    topEdgePath.quadraticBezierTo(width, barTopY, width, barTopY + cornerRadius);

    canvas.drawPath(topEdgePath, strokePaint);
  }

  @override
  bool shouldRepaint(covariant CurvedNavBarPainter oldDelegate) {
    return oldDelegate.activePosition != activePosition ||
        oldDelegate.backgroundColor != backgroundColor ||
        oldDelegate.shadowColor != shadowColor;
  }
}

/// Reusable Shimmer Skeleton Loader Widget
class AppSkeleton extends StatefulWidget {
  final double? width;
  final double? height;
  final double borderRadius;
  final BoxShape shape;
  final EdgeInsetsGeometry? margin;

  const AppSkeleton({
    super.key,
    this.width,
    this.height,
    this.borderRadius = 8,
    this.shape = BoxShape.rectangle,
    this.margin,
  });

  @override
  State<AppSkeleton> createState() => _AppSkeletonState();
}

class _AppSkeletonState extends State<AppSkeleton> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          margin: widget.margin,
          decoration: BoxDecoration(
            shape: widget.shape,
            borderRadius: widget.shape == BoxShape.circle
                ? null
                : BorderRadius.circular(widget.borderRadius),
            gradient: LinearGradient(
              begin: Alignment(-1.0 + (_controller.value * 2.5), -0.3),
              end: Alignment(1.0 + (_controller.value * 2.5), 0.3),
              colors: const [
                Color(0xFFE2E8F0),
                Color(0xFFF8FAFC),
                Color(0xFFE2E8F0),
              ],
              stops: const [0.1, 0.5, 0.9],
            ),
          ),
        );
      },
    );
  }
}

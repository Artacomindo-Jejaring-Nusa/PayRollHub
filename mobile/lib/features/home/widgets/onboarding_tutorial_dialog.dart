import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/storage/token_storage.dart';
import '../../auth/models/user_model.dart';

class TutorialStepItem {
  final int step;
  final String locationTag;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color accentColor;
  final List<String> highlights;
  final String tipText;

  const TutorialStepItem({
    required this.step,
    required this.locationTag,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accentColor,
    required this.highlights,
    required this.tipText,
  });
}

class OnboardingTutorialDialog extends StatefulWidget {
  final UserModel user;
  final VoidCallback? onFinish;

  const OnboardingTutorialDialog({
    super.key,
    required this.user,
    this.onFinish,
  });

  static Future<void> show(
    BuildContext context, {
    required UserModel user,
    VoidCallback? onFinish,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'Tutorial',
      barrierColor: Colors.black.withValues(alpha: 0.65),
      transitionDuration: const Duration(milliseconds: 350),
      pageBuilder: (ctx, anim1, anim2) => OnboardingTutorialDialog(
        user: user,
        onFinish: onFinish,
      ),
      transitionBuilder: (ctx, anim1, anim2, child) {
        return BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 4 * anim1.value, sigmaY: 4 * anim1.value),
          child: FadeTransition(
            opacity: anim1,
            child: ScaleTransition(
              scale: CurvedAnimation(
                parent: anim1,
                curve: Curves.easeOutBack,
              ),
              child: child,
            ),
          ),
        );
      },
    );
  }

  @override
  State<OnboardingTutorialDialog> createState() => _OnboardingTutorialDialogState();
}

class _OnboardingTutorialDialogState extends State<OnboardingTutorialDialog> {
  final PageController _pageController = PageController();
  int _currentIndex = 0;

  bool get _isRiama => widget.user.isRiama;
  Color get _primaryColor => _isRiama ? const Color(0xFF065F46) : const Color(0xFF0F2B5C);

  late final List<TutorialStepItem> _steps;

  @override
  void initState() {
    super.initState();
    final companyName = _isRiama ? 'PT. Riama Mandiri Pratama' : 'PT. Rimbun Buana Sejahtera';

    _steps = [
      TutorialStepItem(
        step: 1,
        locationTag: 'Bagian Atas Layar',
        title: 'Kartu Profil & Shift Kerja',
        subtitle: 'Identitas resmi karyawan dan jadwal kerja harian Anda.',
        icon: Icons.badge_rounded,
        accentColor: const Color(0xFF2563EB),
        highlights: [
          'Memuat nama lengkap, NIK, dan perusahaan Anda ($companyName).',
          'Pilihan 5 Shift Sekolah: Sentuh kartu shift untuk memilih pola 3 Shift atau 2 Shift.',
          'Unit penempatan sekolah/kantor dan status aktif secara real-time.',
        ],
        tipText: 'Sentuh bagian shift kerja di atas untuk mengganti shift harian Anda secara fleksibel.',
      ),
      TutorialStepItem(
        step: 2,
        locationTag: 'Panel Tengah Dasbor',
        title: 'Presensi GPS & Waktu Real-Time',
        subtitle: 'Pusat perekaman absensi satu sentuhan berbasis radius GPS.',
        icon: Icons.fingerprint_rounded,
        accentColor: const Color(0xFF10B981),
        highlights: [
          'Kotak "Pilih Shift" otomatis menyesuaikan jadwal masuk & batas toleransi Anda.',
          'Indikator "GPS Siap" mendeteksi apakah Anda berada di dalam radius kantor/sekolah.',
          'Tombol cepat Absen Masuk (Check In) & Absen Keluar (Check Out).',
        ],
        tipText: 'Pastikan GPS dan izin lokasi HP aktif agar presensi tervalidasi secara instan.',
      ),
      TutorialStepItem(
        step: 3,
        locationTag: 'Menu Navigasi Bawah',
        title: 'Slip Gaji & Riwayat Kehadiran',
        subtitle: 'Pantau rekap absensi bulanan dan slip pembayaran gaji digital.',
        icon: Icons.receipt_long_rounded,
        accentColor: const Color(0xFF8B5CF6),
        highlights: [
          'Menu "Riwayat": Cek rekap jam kedatangan, jam pulang, dan status kehadiran per hari.',
          'Menu "Slip Gaji": Rincian gaji pokok, tunjangan, potongan, dan lembur secara transparan.',
          'Unduh dokumen resmi Slip Gaji dalam format PDF langsung ke memori ponsel.',
        ],
        tipText: 'Rincian slip gaji dapat diakses kapan saja setelah dirilis oleh tim finance.',
      ),
      TutorialStepItem(
        step: 4,
        locationTag: 'Menu Navigasi & Fitur',
        title: 'Laporan Kerja & Keluhan HRD',
        subtitle: 'Pengiriman bukti aktivitas kerja serta pusat aspirasi ke manajemen.',
        icon: Icons.assignment_turned_in_rounded,
        accentColor: const Color(0xFFF59E0B),
        highlights: [
          'Menu "Laporan": Unggah 4 aktivitas kerja harian lengkap dengan foto dokumentasi.',
          'Pusat Keluhan HRD: Sampaikan kendala fasilitas, kendala absensi, atau keluhan resmi.',
          'Pantau respon dan penyelesaian dari HRD dengan status tindak lanjut transparan.',
        ],
        tipText: 'Laporan kerja yang diisi rutin menjadi salah satu indikator evaluasi performa kerja.',
      ),
      TutorialStepItem(
        step: 5,
        locationTag: 'Layanan Bantuan 24 Jam',
        title: 'Live Chat & AI Assistant',
        subtitle: 'Solusi cepat untuk kendala Anda bersama tim Customer Service HRD.',
        icon: Icons.support_agent_rounded,
        accentColor: const Color(0xFFEC4899),
        highlights: [
          'AI Virtual Assistant siap menjawab pertanyaan seputar absensi & slip gaji 24/7.',
          'Tombol sekali klik untuk langsung terhubung ke Agen CS HRD (Human Agent).',
          'Kirim pesan teks atau lampiran foto bukti kendala secara interaktif dan real-time.',
        ],
        tipText: 'Akses menu Live Chat dari tombol chat di dasbor kapan pun Anda memerlukan bantuan.',
      ),
    ];
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onNext() {
    if (_currentIndex < _steps.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeInOut,
      );
    } else {
      _closeTutorial();
    }
  }

  void _closeTutorial() async {
    await TokenStorage.setHasSeenTutorial(true);
    if (!mounted) return;
    widget.onFinish?.call();
    Navigator.of(context, rootNavigator: true).pop();
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_currentIndex + 1) / _steps.length;

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.90,
          constraints: const BoxConstraints(maxWidth: 400, maxHeight: 600),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 30,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Progress Bar
                LinearProgressIndicator(
                  value: progress,
                  minHeight: 4,
                  backgroundColor: const Color(0xFFF1F5F9),
                  valueColor: AlwaysStoppedAnimation<Color>(_primaryColor),
                ),

                // Top Header: Step Badge & Skip Button
                Padding(
                  padding: const EdgeInsets.only(left: 20, right: 12, top: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: _primaryColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.auto_awesome, size: 13, color: _primaryColor),
                            const SizedBox(width: 5),
                            Text(
                              'Panduan Aplikasi • ${_currentIndex + 1} / ${_steps.length}',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: _primaryColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF94A3B8)),
                        tooltip: 'Tutup & Lewati',
                        onPressed: _closeTutorial,
                      ),
                    ],
                  ),
                ),

                // Swipeable PageView Content
                Expanded(
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: _steps.length,
                    onPageChanged: (index) {
                      setState(() {
                        _currentIndex = index;
                      });
                    },
                    itemBuilder: (context, index) {
                      final item = _steps[index];
                      return SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Feature Icon with soft glow
                            Container(
                              width: 68,
                              height: 68,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: item.accentColor.withValues(alpha: 0.12),
                                border: Border.all(
                                  color: item.accentColor.withValues(alpha: 0.25),
                                  width: 2,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: item.accentColor.withValues(alpha: 0.2),
                                    blurRadius: 18,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: Icon(
                                item.icon,
                                color: item.accentColor,
                                size: 34,
                              ),
                            ),
                            const SizedBox(height: 14),

                            // Location Badge
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.place_rounded, size: 12, color: item.accentColor),
                                  const SizedBox(width: 4),
                                  Text(
                                    item.locationTag,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF475569),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),

                            // Title & Subtitle
                            Text(
                              item.title,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF0F172A),
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.subtitle,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                color: const Color(0xFF64748B),
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Highlight Checklist Cards
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: item.highlights.map((h) {
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 4),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2),
                                          child: Icon(
                                            Icons.check_circle_rounded,
                                            size: 15,
                                            color: item.accentColor,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            h,
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w500,
                                              color: const Color(0xFF334155),
                                              height: 1.35,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                            const SizedBox(height: 12),

                            // Pro Tip box
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF3C7).withValues(alpha: 0.5),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFFDE68A)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.lightbulb_rounded, size: 15, color: Color(0xFFD97706)),
                                  const SizedBox(width: 7),
                                  Expanded(
                                    child: Text(
                                      item.tipText,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFF92400E),
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),

                // Bottom Navigation & Actions Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(
                      top: BorderSide(color: Color(0xFFF1F5F9)),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Skip Button
                      TextButton(
                        onPressed: _closeTutorial,
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          foregroundColor: const Color(0xFF64748B),
                        ),
                        child: Text(
                          'Lewati',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),

                      // Animated Indicator Dots
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: List.generate(_steps.length, (index) {
                          final isActive = index == _currentIndex;
                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 250),
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            width: isActive ? 22 : 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: isActive ? _primaryColor : const Color(0xFFCBD5E1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                          );
                        }),
                      ),

                      // Next / Start Button
                      ElevatedButton(
                        onPressed: _onNext,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _primaryColor,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _currentIndex == _steps.length - 1 ? 'Mulai' : 'Lanjut',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12.5,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              _currentIndex == _steps.length - 1
                                  ? Icons.check_circle_rounded
                                  : Icons.arrow_forward_rounded,
                              size: 15,
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
      ),
    );
  }
}

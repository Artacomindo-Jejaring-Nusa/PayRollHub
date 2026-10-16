import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/models/user_model.dart';
import '../services/employee_portal_service.dart';

class ProfileEditScreen extends StatefulWidget {
  final UserModel user;
  final Map<String, dynamic>? initialProfileData;
  final VoidCallback? onProfileUpdated;

  const ProfileEditScreen({
    super.key,
    required this.user,
    this.initialProfileData,
    this.onProfileUpdated,
  });

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _phoneController;
  late TextEditingController _emailController;
  late TextEditingController _birthDateController;
  late TextEditingController _addressController;
  late TextEditingController _bankNameController;
  late TextEditingController _bankAccountController;

  final TextEditingController _currentPasswordController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  bool _obscureCurrentPassword = true;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;

  String? _selectedGender;
  DateTime? _parsedBirthDate;
  bool _isSaving = false;

  final List<String> _bankSuggestions = [
    'BNI',
    'BRI',
    'BCA',
    'Mandiri',
    'BSI',
    'Bank Jabar (BJB)',
    'CIMB Niaga',
    'Bank Danamon',
  ];

  @override
  void initState() {
    super.initState();
    final u = widget.initialProfileData?['user'] as Map<String, dynamic>?;

    _phoneController = TextEditingController(
      text: u?['phone']?.toString() ?? widget.user.phone ?? '',
    );
    _emailController = TextEditingController(
      text: u?['email']?.toString() ?? widget.user.email,
    );
    _addressController = TextEditingController(
      text: u?['address']?.toString() ?? '',
    );
    _bankNameController = TextEditingController(
      text: u?['bank_name']?.toString() ?? '',
    );
    _bankAccountController = TextEditingController(
      text: u?['bank_account']?.toString() ?? '',
    );

    // Format birth date nicely (e.g. 3 Oktober 1983)
    final rawBirthDate = u?['birth_date']?.toString() ?? '';
    if (rawBirthDate.isNotEmpty) {
      try {
        _parsedBirthDate = DateTime.tryParse(rawBirthDate);
        if (_parsedBirthDate != null) {
          _birthDateController = TextEditingController(
            text: DateFormat('d MMMM yyyy', 'id_ID').format(_parsedBirthDate!),
          );
        } else {
          _birthDateController = TextEditingController(text: rawBirthDate);
        }
      } catch (_) {
        _birthDateController = TextEditingController(text: rawBirthDate);
      }
    } else {
      _birthDateController = TextEditingController();
    }

    _selectedGender = u?['gender']?.toString();
    if (_selectedGender != 'Laki-laki' && _selectedGender != 'Perempuan') {
      if (_selectedGender != null && _selectedGender!.isNotEmpty) {
        if (_selectedGender!.toLowerCase().startsWith('l')) {
          _selectedGender = 'Laki-laki';
        } else if (_selectedGender!.toLowerCase().startsWith('p')) {
          _selectedGender = 'Perempuan';
        } else {
          _selectedGender = null;
        }
      } else {
        _selectedGender = null;
      }
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _emailController.dispose();
    _birthDateController.dispose();
    _addressController.dispose();
    _bankNameController.dispose();
    _bankAccountController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );
    super.dispose();
  }

  bool get _isRiama => widget.user.isRiama;
  Color get _primaryColor => _isRiama ? const Color(0xFF065F46) : const Color(0xFF00163D);
  Color get _headerBgColor => _isRiama ? const Color(0xFF065F46) : const Color(0xFF0F2B5C);

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final initial = _parsedBirthDate ?? DateTime(1990, 1, 1);

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1950, 1, 1),
      lastDate: DateTime(now.year - 15, 12, 31),
      helpText: 'PILIH TANGGAL LAHIR',
      cancelText: 'BATAL',
      confirmText: 'PILIH',
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: _primaryColor,
              onPrimary: Colors.white,
              onSurface: AppColors.neutral900,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _parsedBirthDate = picked;
        _birthDateController.text = DateFormat('d MMMM yyyy', 'id_ID').format(picked);
      });
    }
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    final newPass = _newPasswordController.text.trim();
    final currPass = _currentPasswordController.text.trim();
    final confPass = _confirmPasswordController.text.trim();

    if (newPass.isNotEmpty) {
      if (currPass.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Masukkan kata sandi saat ini untuk konfirmasi perubahan sandi.'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      if (newPass.length < 6) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Kata sandi baru minimal harus 6 karakter.'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      if (newPass != confPass) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Konfirmasi kata sandi baru tidak cocok.'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
    }

    setState(() => _isSaving = true);

    String? birthDateToSend;
    if (_parsedBirthDate != null) {
      birthDateToSend = DateFormat('yyyy-MM-dd').format(_parsedBirthDate!);
    } else if (_birthDateController.text.trim().isNotEmpty) {
      birthDateToSend = _birthDateController.text.trim();
    }

    final res = await EmployeePortalService.updateProfile(
      phone: _phoneController.text.trim(),
      email: _emailController.text.trim(),
      birthDate: birthDateToSend,
      gender: _selectedGender,
      bankName: _bankNameController.text.trim(),
      bankAccount: _bankAccountController.text.trim(),
      address: _addressController.text.trim(),
      currentPassword: currPass.isNotEmpty ? currPass : null,
      newPassword: newPass.isNotEmpty ? newPass : null,
    );

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (res['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  res['message'] ?? 'Data profil berhasil diperbarui.',
                  style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );

      widget.onProfileUpdated?.call();
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  res['message'] ?? 'Gagal memperbarui profil.',
                  style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = widget.initialProfileData?['user'] as Map<String, dynamic>?;
    final job = widget.initialProfileData?['job_details'] as Map<String, dynamic>?;

    final employeeName = u?['name']?.toString() ?? widget.user.name;
    final nik = u?['nik']?.toString() ?? widget.user.nik ?? '-';
    final position = job?['position']?.toString() ?? widget.user.position ?? 'Operasional Lapangan';
    final schoolUnit = job?['school_unit']?.toString() ?? widget.user.schoolUnit ?? job?['province']?.toString() ?? '-';
    final statusKerja = job?['status']?.toString() ?? 'Aktif';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
        backgroundColor: _headerBgColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          onPressed: () {
            SystemChrome.setSystemUIOverlayStyle(
              const SystemUiOverlayStyle(
                statusBarColor: Colors.transparent,
                statusBarIconBrightness: Brightness.dark,
                statusBarBrightness: Brightness.light,
                systemNavigationBarColor: Colors.white,
                systemNavigationBarIconBrightness: Brightness.dark,
              ),
            );
            Navigator.pop(context);
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Data Pribadi & Rekening',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
            Text(
              'Perbarui kontak & bank pencairan gaji',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white70,
                fontSize: 11,
              ),
            ),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: _isSaving ? null : _handleSave,
            icon: _isSaving
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check_rounded, color: Colors.white, size: 18),
            label: Text(
              'Simpan',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ============================================================
              // SECTION 1: DATA RESMI HRD (TERKUNCI / READ ONLY)
              // ============================================================
              _buildLockedHrdSection(
                name: employeeName,
                nik: nik,
                position: position,
                schoolUnit: schoolUnit,
                statusKerja: statusKerja,
              ),

              const SizedBox(height: 20),

              // ============================================================
              // SECTION 2: INFORMASI KONTAK & BIODATA PRIBADI (EDITABLE)
              // ============================================================
              _buildEditablePersonalSection(),

              const SizedBox(height: 20),

              // ============================================================
              // SECTION 3: INFORMASI REKENING BANK PENCAIRAN (EDITABLE)
              // ============================================================
              _buildEditableBankSection(),

              const SizedBox(height: 20),

              // ============================================================
              // SECTION 4: GANTI KATA SANDI (OPSIONAL)
              // ============================================================
              _buildEditablePasswordSection(),

              const SizedBox(height: 28),

              // Tombol Simpan Bawah
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isSaving ? null : _handleSave,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                        )
                      : const Icon(Icons.save_rounded, size: 20),
                  label: Text(
                    _isSaving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Data',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primaryColor,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: _primaryColor.withValues(alpha: 0.6),
                    elevation: 1,
                    shadowColor: _primaryColor.withValues(alpha: 0.3),
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // Widget: Data Resmi HRD (Terkunci)
  // --------------------------------------------------------------------------
  Widget _buildLockedHrdSection({
    required String name,
    required String nik,
    required String position,
    required String schoolUnit,
    required String statusKerja,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Bar Terkunci
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFFF1F5F9),
              borderRadius: BorderRadius.vertical(top: Radius.circular(15)),
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                const Icon(Icons.verified_user_rounded, color: Color(0xFF0F172A), size: 18),
                const SizedBox(width: 8),
                Text(
                  'Data Resmi HRD',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.lock_rounded, size: 12, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        'Terkunci',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildLockedField(
                  label: 'Nama Lengkap',
                  value: name,
                  icon: Icons.person_outline_rounded,
                ),
                const SizedBox(height: 10),
                _buildLockedField(
                  label: 'Nomor Induk Karyawan (NIK)',
                  value: nik,
                  icon: Icons.badge_outlined,
                  isMonospace: true,
                ),
                const SizedBox(height: 10),
                _buildLockedField(
                  label: 'Jabatan / Posisi',
                  value: position,
                  icon: Icons.work_outline_rounded,
                ),
                const SizedBox(height: 10),
                _buildLockedField(
                  label: 'Unit Penempatan / Wilayah',
                  value: schoolUnit,
                  icon: Icons.apartment_rounded,
                ),
                const SizedBox(height: 10),
                _buildLockedField(
                  label: 'Status Kerja',
                  value: statusKerja,
                  icon: Icons.check_circle_outline_rounded,
                  isBadge: true,
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 15, color: Color(0xFF64748B)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Data di atas dikunci secara resmi oleh HRD. Untuk perubahan NIK/Unit penempatan, hubungi administrator HRD perusahaan.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            color: const Color(0xFF64748B),
                            height: 1.4,
                          ),
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
    );
  }

  Widget _buildLockedField({
    required String label,
    required String value,
    required IconData icon,
    bool isMonospace = false,
    bool isBadge = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF94A3B8)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10.5,
                    color: const Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                if (isBadge)
                  Container(
                    margin: const EdgeInsets.only(top: 2),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD1FAE5),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: Text(
                      value,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF065F46),
                      ),
                    ),
                  )
                else
                  Text(
                    value,
                    style: isMonospace
                        ? GoogleFonts.jetBrainsMono(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF1E293B),
                          )
                        : GoogleFonts.plusJakartaSans(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF1E293B),
                          ),
                  ),
              ],
            ),
          ),
          const Icon(Icons.lock_outline_rounded, size: 14, color: Color(0xFFCBD5E1)),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // Widget: Informasi Kontak & Biodata Pribadi (Bisa Diedit)
  // --------------------------------------------------------------------------
  Widget _buildEditablePersonalSection() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Header
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 8),
            child: Row(
              children: [
                Icon(Icons.person_pin_rounded, color: _primaryColor, size: 19),
                const SizedBox(width: 8),
                Text(
                  'INFORMASI KONTAK & BIODATA PRIBADI',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: const Color(0xFF475569),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Nomor WhatsApp / HP Aktif
                _buildInputLabel('Nomor WhatsApp / HP Aktif'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w600),
                  decoration: _inputDecoration(
                    hintText: 'Contoh: 089681001888',
                    prefixIcon: Icons.phone_rounded,
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return 'Nomor HP/WhatsApp tidak boleh kosong';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: 14),

                // Email Pribadi / Kontak
                _buildInputLabel('Email Pribadi / Kontak'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w600),
                  decoration: _inputDecoration(
                    hintText: 'nama@email.com',
                    prefixIcon: Icons.alternate_email_rounded,
                  ),
                ),

                const SizedBox(height: 14),

                // Tanggal Lahir
                _buildInputLabel('Tanggal Lahir'),
                const SizedBox(height: 6),
                InkWell(
                  onTap: _pickBirthDate,
                  borderRadius: BorderRadius.circular(10),
                  child: IgnorePointer(
                    child: TextFormField(
                      controller: _birthDateController,
                      style: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w600),
                      decoration: _inputDecoration(
                        hintText: 'Pilih Tanggal Lahir',
                        prefixIcon: Icons.calendar_today_rounded,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                // Jenis Kelamin
                _buildInputLabel('Jenis Kelamin'),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: _selectedGender,
                  decoration: _inputDecoration(
                    hintText: 'Pilih Jenis Kelamin',
                    prefixIcon: Icons.wc_rounded,
                  ),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.neutral900,
                  ),
                  icon: const Icon(Icons.arrow_drop_down_rounded),
                  items: const [
                    DropdownMenuItem(value: 'Laki-laki', child: Text('Laki-laki')),
                    DropdownMenuItem(value: 'Perempuan', child: Text('Perempuan')),
                  ],
                  onChanged: (val) {
                    setState(() => _selectedGender = val);
                  },
                ),

                const SizedBox(height: 14),

                // Alamat Domisili
                _buildInputLabel('Alamat Domisili Tempat Tinggal'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _addressController,
                  maxLines: 2,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
                  decoration: _inputDecoration(
                    hintText: 'Kota / Alamat tempat tinggal saat ini',
                    prefixIcon: Icons.home_outlined,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // Widget: Informasi Rekening Bank Pencairan (Bisa Diedit)
  // --------------------------------------------------------------------------
  Widget _buildEditableBankSection() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 8),
            child: Row(
              children: [
                Icon(Icons.account_balance_rounded, color: _primaryColor, size: 19),
                const SizedBox(width: 8),
                Text(
                  'INFORMASI REKENING BANK PENCAIRAN',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: const Color(0xFF475569),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Nama Bank Pencairan
                _buildInputLabel('Nama Bank Pencairan'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _bankNameController,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w700),
                  decoration: _inputDecoration(
                    hintText: 'Contoh: BNI / BRI / Mandiri / BCA',
                    prefixIcon: Icons.account_balance_wallet_rounded,
                  ),
                ),

                const SizedBox(height: 8),

                // Quick Bank Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _bankSuggestions.map((b) {
                      final isSelected = _bankNameController.text.toUpperCase() == b.toUpperCase();
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(b),
                          selected: isSelected,
                          selectedColor: _primaryColor.withValues(alpha: 0.12),
                          labelStyle: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            color: isSelected ? _primaryColor : const Color(0xFF475569),
                          ),
                          backgroundColor: const Color(0xFFF1F5F9),
                          side: BorderSide(
                            color: isSelected ? _primaryColor : const Color(0xFFE2E8F0),
                          ),
                          onSelected: (val) {
                            if (val) {
                              setState(() {
                                _bankNameController.text = b;
                              });
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),

                const SizedBox(height: 14),

                // Nomor Rekening Bank
                _buildInputLabel('Nomor Rekening Bank'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _bankAccountController,
                  keyboardType: TextInputType.number,
                  style: GoogleFonts.jetBrainsMono(fontSize: 14, fontWeight: FontWeight.w700),
                  decoration: _inputDecoration(
                    hintText: 'Masukkan nomor rekening',
                    prefixIcon: Icons.credit_card_rounded,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // Widget: Ganti Kata Sandi (Opsional)
  // --------------------------------------------------------------------------
  Widget _buildEditablePasswordSection() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 8),
            child: Row(
              children: [
                Icon(Icons.lock_reset_rounded, color: _primaryColor, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'GANTI KATA SANDI (OPSIONAL)',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: const Color(0xFF475569),
                        ),
                      ),
                      Text(
                        'Kosongkan jika tidak ingin mengubah kata sandi',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: const Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInputLabel('Kata Sandi Saat Ini'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _currentPasswordController,
                  obscureText: _obscureCurrentPassword,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w600),
                  decoration: _inputDecoration(
                    hintText: 'Masukkan kata sandi lama',
                    prefixIcon: Icons.lock_outline_rounded,
                  ).copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureCurrentPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: const Color(0xFF64748B),
                        size: 18,
                      ),
                      onPressed: () {
                        setState(() => _obscureCurrentPassword = !_obscureCurrentPassword);
                      },
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                _buildInputLabel('Kata Sandi Baru'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _newPasswordController,
                  obscureText: _obscureNewPassword,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w600),
                  decoration: _inputDecoration(
                    hintText: 'Minimal 6 karakter',
                    prefixIcon: Icons.vpn_key_outlined,
                  ).copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureNewPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: const Color(0xFF64748B),
                        size: 18,
                      ),
                      onPressed: () {
                        setState(() => _obscureNewPassword = !_obscureNewPassword);
                      },
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                _buildInputLabel('Konfirmasi Kata Sandi Baru'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: _obscureConfirmPassword,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w600),
                  decoration: _inputDecoration(
                    hintText: 'Ulangi kata sandi baru',
                    prefixIcon: Icons.check_circle_outline_rounded,
                  ).copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureConfirmPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: const Color(0xFF64748B),
                        size: 18,
                      ),
                      onPressed: () {
                        setState(() => _obscureConfirmPassword = !_obscureConfirmPassword);
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputLabel(String label) {
    return Text(
      label,
      style: GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: const Color(0xFF334155),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String hintText,
    required IconData prefixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      hintStyle: GoogleFonts.plusJakartaSans(color: const Color(0xFF94A3B8), fontSize: 13),
      prefixIcon: Icon(prefixIcon, color: const Color(0xFF64748B), size: 18),
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: _primaryColor, width: 1.5),
      ),
    );
  }
}

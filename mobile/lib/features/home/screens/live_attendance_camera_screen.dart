import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/error_sanitizer.dart';

class LiveAttendanceCameraScreen extends StatefulWidget {
  final String title;
  final String subtitle;
  final double? latitude;
  final double? longitude;
  final String? locationName;
  final String? userName;
  final String? timezone;

  const LiveAttendanceCameraScreen({
    super.key,
    this.title = 'Foto Selfie Kehadiran',
    this.subtitle = 'Posisikan wajah Anda tepat di dalam bingkai',
    this.latitude,
    this.longitude,
    this.locationName,
    this.userName,
    this.timezone = 'WIB',
  });

  @override
  State<LiveAttendanceCameraScreen> createState() => _LiveAttendanceCameraScreenState();
}

class _LiveAttendanceCameraScreenState extends State<LiveAttendanceCameraScreen>
    with WidgetsBindingObserver {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  bool _isInitializing = true;
  String? _errorMessage;
  File? _capturedFile;
  bool _isTakingPicture = false;
  Timer? _clockTimer;
  String _currentTime = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _updateClock();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) => _updateClock());
    _initCamera();
  }

  void _updateClock() {
    if (mounted) {
      setState(() {
        _currentTime = DateFormat('HH:mm:ss').format(DateTime.now());
      });
    }
  }

  Future<void> _initCamera() async {
    setState(() {
      _isInitializing = true;
      _errorMessage = null;
    });

    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        setState(() {
          _isInitializing = false;
          _errorMessage = 'Tidak ditemukan perangkat kamera pada ponsel ini.';
        });
        return;
      }

      // Wajib utamakan Kamera Depan (Front Facing Camera) untuk absensi selfie
      CameraDescription targetCamera = _cameras.firstWhere(
        (cam) => cam.lensDirection == CameraLensDirection.front,
        orElse: () => _cameras.first,
      );

      final controller = CameraController(
        targetCamera,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );

      _controller = controller;
      await controller.initialize();

      if (mounted) {
        setState(() {
          _isInitializing = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isInitializing = false;
          _errorMessage = 'Gagal membuka kamera depan: ${ErrorSanitizer.clean(e)}\nPastikan izin kamera telah diberikan di pengaturan HP.';
        });
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final CameraController? cameraController = _controller;
    if (cameraController == null || !cameraController.value.isInitialized) {
      return;
    }

    if (state == AppLifecycleState.inactive) {
      cameraController.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _clockTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _takePicture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || _isTakingPicture) {
      return;
    }

    try {
      setState(() => _isTakingPicture = true);
      final XFile rawFile = await controller.takePicture();
      final File savedFile = File(rawFile.path);

      if (mounted) {
        setState(() {
          _capturedFile = savedFile;
          _isTakingPicture = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isTakingPicture = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ErrorSanitizer.clean(e, fallback: 'Gagal mengambil foto.')),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _retakePicture() {
    if (_capturedFile != null && _capturedFile!.existsSync()) {
      try {
        _capturedFile!.deleteSync();
      } catch (_) {}
    }
    setState(() {
      _capturedFile = null;
    });
  }

  void _confirmAndReturn() {
    if (_capturedFile != null) {
      Navigator.of(context).pop(_capturedFile);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // 1. Camera Viewfinder or Captured Preview
            Positioned.fill(
              child: _buildCameraContent(),
            ),

            // 2. Top Header Bar (Title, Back, Live Clock)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _buildTopBar(),
            ),

            // 3. Bottom Controls Area (Capture / Retake / Submit)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _buildBottomControls(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCameraContent() {
    if (_capturedFile != null) {
      // Menampilkan Preview Hasil Jepretan Kamera Langsung
      return Image.file(
        _capturedFile!,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.videocam_off_rounded, color: Colors.redAccent, size: 48),
              ),
              const SizedBox(height: 16),
              Text(
                'Kamera Depan Diperlukan',
                style: GoogleFonts.plusJakartaSans(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(
                  color: Colors.white70,
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
                onPressed: _initCamera,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Coba Lagi'),
              ),
            ],
          ),
        ),
      );
    }

    if (_isInitializing || _controller == null || !_controller!.value.isInitialized) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Colors.white),
            SizedBox(height: 16),
            Text(
              'Menghubungkan ke Sensor Kamera Depan...',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
        ),
      );
    }

    // Kamera controller siap -> Tampilkan live preview & Face Guide Overlay
    return Stack(
      fit: StackFit.expand,
      children: [
        // Camera Preview Proporsional (Anti-Gepeng / Rasio Asli Terjaga 100%)
        Positioned.fill(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final double screenWidth = constraints.maxWidth;
              final double screenHeight = constraints.maxHeight;

              // Rasio sensor kamera dalam orientasi portrait
              final double sensorRatio = _controller!.value.aspectRatio;
              final double previewRatio = sensorRatio > 1.0 ? (1.0 / sensorRatio) : sensorRatio;

              // Kalkulasi scale agar CameraPreview mengisi layar penuh secara proporsional tanpa distorsi
              final double screenRatio = screenWidth / screenHeight;
              double scale = 1.0;
              if (screenRatio > previewRatio) {
                scale = screenRatio / previewRatio;
              } else {
                scale = previewRatio / screenRatio;
              }

              return ClipRect(
                child: Center(
                  child: Transform.scale(
                    scale: scale,
                    child: AspectRatio(
                      aspectRatio: previewRatio,
                      child: CameraPreview(_controller!),
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        // Oval Face Guide Overlay (Proporsi Wajah Alami)
        Center(
          child: Container(
            width: 270,
            height: 370,
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.all(Radius.elliptical(270, 370)),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.85),
                width: 2.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.45),
                  blurRadius: 24,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Posisikan Wajah Di Sini',
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified_user_rounded, color: Colors.greenAccent, size: 14),
                        SizedBox(width: 4),
                        Text(
                          'Sensor Live Front Camera',
                          style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Watermark Security Overlay (Live info)
        Positioned(
          top: 80,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.greenAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'KAMERA DEPAN AKTIF',
                          style: GoogleFonts.plusJakartaSans(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '$_currentTime ${widget.timezone ?? 'WIB'}',
                      style: GoogleFonts.robotoMono(
                        color: Colors.amberAccent,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                if (widget.locationName != null || widget.userName != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '${widget.userName ?? ''} • ${widget.locationName ?? 'Lokasi Penugasan'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white70,
                      fontSize: 10,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTopBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.black.withValues(alpha: 0.8),
            Colors.transparent,
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
            style: IconButton.styleFrom(
              backgroundColor: Colors.black.withValues(alpha: 0.4),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.title,
                  style: GoogleFonts.plusJakartaSans(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                Text(
                  _capturedFile != null ? 'Tinjau hasil foto selfie Anda' : widget.subtitle,
                  style: GoogleFonts.plusJakartaSans(
                    color: Colors.white70,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControls() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 30),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.transparent,
            Colors.black.withValues(alpha: 0.9),
            Colors.black,
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: _capturedFile != null
          ? _buildReviewButtons()
          : _buildShutterButton(),
    );
  }

  Widget _buildShutterButton() {
    final bool canSnap = _controller != null && _controller!.value.isInitialized && !_isTakingPicture;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Dilarang menggunakan gambar galeri • Wajib foto kamera langsung',
          textAlign: TextAlign.center,
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white60,
            fontSize: 11,
          ),
        ),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: canSnap ? _takePicture : null,
          child: Container(
            width: 76,
            height: 76,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3.5),
            ),
            child: Container(
              decoration: BoxDecoration(
                color: canSnap ? Colors.white : Colors.white30,
                shape: BoxShape.circle,
              ),
              child: _isTakingPicture
                  ? const Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2.5),
                      ),
                    )
                  : const Icon(Icons.camera_alt_rounded, color: Colors.black87, size: 30),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildReviewButtons() {
    return Row(
      children: [
        // Tombol Foto Ulang
        Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: Colors.white38),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: _retakePicture,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: Text(
              'Foto Ulang',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
        ),
        const SizedBox(width: 14),
        // Tombol Gunakan Foto
        Expanded(
          flex: 2,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: _confirmAndReturn,
            icon: const Icon(Icons.check_circle_rounded, size: 18),
            label: Text(
              'Gunakan Foto Ini',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
        ),
      ],
    );
  }
}

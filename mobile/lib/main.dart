import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/services/notification_service.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/home/screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inisialisasi Firebase Cloud Messaging & Notifikasi
  try {
    await NotificationService.init();
  } catch (_) {}

  // Inisialisasi locale data bahasa Indonesia untuk intl
  try {
    await initializeDateFormatting('id_ID', null);
  } catch (_) {}

  // Set status bar transparan dengan icon gelap
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  // Global Error Widget: Mencegah red screen of death atau kebocoran path internal sistem
  ErrorWidget.builder = (FlutterErrorDetails details) {
    return const Material(
      color: Colors.white,
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded, size: 48, color: Color(0xFFEF4444)),
              SizedBox(height: 12),
              Text(
                'Terjadi Kendala Tampilan',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
              ),
              SizedBox(height: 6),
              Text(
                'Silakan muat ulang atau buka kembali halaman ini.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  };

  runApp(
    const ProviderScope(
      child: HcAttendanceApp(),
    ),
  );
}

class HcAttendanceApp extends ConsumerWidget {
  const HcAttendanceApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    return MaterialApp(
      title: 'HC Attendance',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: _buildInitialScreen(authState),
    );
  }

  Widget _buildInitialScreen(AuthState state) {
    if (state.isAuthenticated && state.user != null) {
      return DashboardScreen(user: state.user!);
    }
    return const LoginScreen();
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/home/screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

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

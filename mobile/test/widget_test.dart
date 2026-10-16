import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hc_attendance/main.dart';

void main() {
  testWidgets('HC Attendance App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: HcAttendanceApp(),
      ),
    );

    // Verifikasi bahwa halaman login berhasil dirender
    expect(find.textContaining('Welcome to'), findsOneWidget);
    expect(find.text('Masuk (Login)'), findsOneWidget);
  });
}

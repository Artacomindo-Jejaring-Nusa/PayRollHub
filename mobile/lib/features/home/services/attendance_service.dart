import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/attendance_today_model.dart';

class AttendanceService {
  /// Mengambil data absensi hari ini, lokasi penugasan terkunci, dan shift aktif.
  static Future<TodayAttendanceDataModel?> getTodayAttendance() async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/employee/attendance/today');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is Map<String, dynamic>) {
          return TodayAttendanceDataModel.fromJson(data);
        }
      }
    } on DioException {
      // ignore
    } catch (_) {}
    return null;
  }

  /// Melakukan Absen Masuk (Check-In)
  /// Mendukung tipe: 'masuk', 'libur', 'dinas_luar'
  static Future<Map<String, dynamic>> checkIn({
    String attendanceType = 'masuk',
    double? latitude,
    double? longitude,
    int? locationId,
    int? shiftId,
    String? notes,
    File? photoFile,
  }) async {
    try {
      final dio = await ApiClient.getInstance();

      if (photoFile != null && await photoFile.exists()) {
        final bytes = await photoFile.readAsBytes();
        final base64Image = 'data:image/jpeg;base64,${base64Encode(bytes)}';

        final payload = <String, dynamic>{
          'attendance_type': attendanceType,
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
          if (locationId != null) 'location_id': locationId,
          if (shiftId != null) 'shift_id': shiftId,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
          'photo': base64Image,
        };

        final response = await dio.post('/employee/attendance/check-in', data: payload);
        return {
          'success': response.statusCode == 200,
          'message': response.data['message'] ?? 'Absen masuk berhasil dicatat.',
          'data': response.data['data'],
        };
      } else {
        final payload = <String, dynamic>{
          'attendance_type': attendanceType,
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
          if (locationId != null) 'location_id': locationId,
          if (shiftId != null) 'shift_id': shiftId,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        };

        final response = await dio.post('/employee/attendance/check-in', data: payload);
        return {
          'success': response.statusCode == 200,
          'message': response.data['message'] ?? 'Absen berhasil dicatat.',
          'data': response.data['data'],
        };
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ??
          e.message ??
          'Koneksi gagal saat melakukan absensi.';
      return {'success': false, 'message': msg};
    } catch (e) {
      return {'success': false, 'message': 'Terjadi kesalahan sistem: $e'};
    }
  }

  /// Karyawan memilih shift kerja aktif (misal dari 5 pilihan shift sekolah)
  static Future<Map<String, dynamic>> selectShift(int shiftId) async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.post(
        '/employee/attendance/shift/select',
        data: {'shift_id': shiftId},
      );
      return {
        'success': response.statusCode == 200,
        'message': response.data['message'] ?? 'Shift berhasil diperbarui.',
        'data': response.data['data'] != null ? ShiftModel.fromJson(response.data['data']) : null,
      };
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Gagal mengubah shift.';
      return {'success': false, 'message': msg};
    } catch (e) {
      return {'success': false, 'message': 'Terjadi kesalahan sistem: $e'};
    }
  }

  /// Melakukan Absen Pulang (Check-Out)
  static Future<Map<String, dynamic>> checkOut({
    double? latitude,
    double? longitude,
    String? notes,
  }) async {
    try {
      final dio = await ApiClient.getInstance();
      final payload = <String, dynamic>{
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      };

      final response = await dio.post('/employee/attendance/check-out', data: payload);
      return {
        'success': response.statusCode == 200,
        'message': response.data['message'] ?? 'Absen pulang berhasil dicatat.',
        'data': response.data['data'],
      };
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Gagal melakukan absen pulang.';
      return {'success': false, 'message': msg};
    } catch (e) {
      return {'success': false, 'message': 'Terjadi kesalahan sistem: $e'};
    }
  }

  /// Mengambil Riwayat Absensi Karyawan
  static Future<List<dynamic>> getHistory({String? month, int page = 1}) async {
    try {
      final dio = await ApiClient.getInstance();
      final queryParams = <String, dynamic>{
        'page': page,
        if (month != null && month.isNotEmpty) 'month': month,
      };
      final response = await dio.get('/employee/attendance/history', queryParameters: queryParams);

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is Map && data['data'] is List) {
          return data['data'] as List;
        } else if (data is List) {
          return data;
        }
      }
    } catch (_) {}
    return [];
  }

  /// Mengambil Ringkasan Dashboard Karyawan (Gaji, Laporan, Pengumuman)
  static Future<Map<String, dynamic>?> getDashboardSummary() async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/employee/dashboard');

      if (response.statusCode == 200 && response.data != null) {
        return response.data['data'] as Map<String, dynamic>?;
      }
    } catch (_) {}
    return null;
  }
}

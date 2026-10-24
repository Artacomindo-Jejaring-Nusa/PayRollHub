import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/network/api_client.dart';

/// Service untuk mengelola antrean absensi offline (Offline-First Attendance Queue)
/// dan sinkronisasi otomatis (Auto-Sync) saat koneksi internet pulih.
class AttendanceOfflineService {
  static const String _queueKey = 'pending_offline_attendances_v1';

  /// Mengambil semua data absensi offline yang masih pending di perangkat
  static Future<List<Map<String, dynamic>>> getPendingQueue() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_queueKey);
      if (raw == null || raw.isEmpty) return [];

      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded.whereType<Map<String, dynamic>>().toList();
      }
    } catch (_) {}
    return [];
  }

  /// Memeriksa apakah ada absensi yang belum tersinkron
  static Future<bool> hasPending() async {
    final list = await getPendingQueue();
    return list.isNotEmpty;
  }

  /// Mendapatkan data absen masuk offline yang belum tersinkron (jika ada)
  static Future<Map<String, dynamic>?> getPendingCheckIn() async {
    final list = await getPendingQueue();
    for (final item in list) {
      if (item['action'] == 'check_in') {
        return item;
      }
    }
    return null;
  }

  /// Mendapatkan data absen keluar offline yang belum tersinkron (jika ada)
  static Future<Map<String, dynamic>?> getPendingCheckOut() async {
    final list = await getPendingQueue();
    for (final item in list) {
      if (item['action'] == 'check_out') {
        return item;
      }
    }
    return null;
  }

  /// Memasukkan data absensi ke antrean offline (Local Storage HP)
  static Future<Map<String, dynamic>> enqueue({
    required String action, // 'check_in' atau 'check_out'
    String attendanceType = 'masuk',
    double? latitude,
    double? longitude,
    int? locationId,
    int? shiftId,
    String? notes,
    String? photoBase64,
    DateTime? capturedAt,
  }) async {
    final now = capturedAt ?? DateTime.now();
    final timeStr = DateFormat('HH:mm').format(now);
    final capturedIso = now.toIso8601String();

    final newItem = <String, dynamic>{
      'id': 'offline_${action}_${now.millisecondsSinceEpoch}',
      'action': action,
      'attendance_type': attendanceType,
      'latitude': ?latitude,
      'longitude': ?longitude,
      'location_id': ?locationId,
      'shift_id': ?shiftId,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (photoBase64 != null && photoBase64.isNotEmpty) 'photo': photoBase64,
      'captured_at': capturedIso,
      'time_display': timeStr,
      'created_at': DateTime.now().toIso8601String(),
    };

    final prefs = await SharedPreferences.getInstance();
    final list = await getPendingQueue();

    // Hapus duplikasi action yang sama jika ada sebelumnya
    list.removeWhere((item) => item['action'] == action);
    list.add(newItem);

    await prefs.setString(_queueKey, jsonEncode(list));

    return newItem;
  }

  /// Menghapus item tertentu dari antrean setelah berhasil disinkronkan
  static Future<void> removeItem(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final list = await getPendingQueue();
    list.removeWhere((item) => item['id'] == id);
    await prefs.setString(_queueKey, jsonEncode(list));
  }

  /// Mengosongkan seluruh antrean (misal saat logout atau reset akun)
  static Future<void> clearQueue() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_queueKey);
  }

  /// Menjalankan proses Sinkronisasi Otomatis (Auto-Sync) seluruh item pending ke Server
  static Future<Map<String, dynamic>> syncAll() async {
    final list = await getPendingQueue();
    if (list.isEmpty) {
      return {'total': 0, 'synced': 0, 'failed': 0, 'message': 'Tidak ada data offline.'};
    }

    int syncedCount = 0;
    int failedCount = 0;
    String lastMessage = '';

    for (final item in List<Map<String, dynamic>>.from(list)) {
      final action = item['action']?.toString() ?? 'check_in';
      final id = item['id']?.toString() ?? '';

      try {
        final dio = await ApiClient.getInstance();
        final endpoint = action == 'check_out'
            ? '/employee/attendance/check-out'
            : '/employee/attendance/check-in';

        final payload = <String, dynamic>{
          'attendance_type': item['attendance_type'] ?? 'masuk',
          if (item['latitude'] != null) 'latitude': item['latitude'],
          if (item['longitude'] != null) 'longitude': item['longitude'],
          if (item['location_id'] != null) 'location_id': item['location_id'],
          if (item['shift_id'] != null) 'shift_id': item['shift_id'],
          if (item['notes'] != null) 'notes': item['notes'],
          if (item['photo'] != null) 'photo': item['photo'],
          if (item['captured_at'] != null) 'captured_at': item['captured_at'],
          'is_offline_sync': true,
        };

        final response = await dio.post(endpoint, data: payload);

        if (response.statusCode == 200) {
          await removeItem(id);
          syncedCount++;
          lastMessage = response.data?['message']?.toString() ?? 'Sinkronisasi berhasil.';
        } else {
          failedCount++;
        }
      } on DioException catch (e) {
        // Jika server menolak karena absensi sudah tercatat sebelumnya hari ini (422), hapus dari queue agar tidak looping
        final status = e.response?.statusCode;
        final resMsg = e.response?.data?['message']?.toString() ?? '';

        if (status == 422 && (resMsg.contains('sudah') || resMsg.contains('tercatat'))) {
          await removeItem(id);
          syncedCount++;
          lastMessage = 'Data absensi sudah sinkron di server.';
        } else if (_isNetworkError(e)) {
          // Koneksi internet masih mati, hentikan iterasi dan tunggu sinyal berikutnya
          failedCount++;
          break;
        } else {
          failedCount++;
        }
      } catch (_) {
        failedCount++;
      }
    }

    return {
      'total': list.length,
      'synced': syncedCount,
      'failed': failedCount,
      'message': lastMessage.isNotEmpty ? lastMessage : 'Sinkronisasi selesai.',
    };
  }

  /// Helper untuk mendeteksi apakah exception diakibatkan oleh ketiadaan koneksi internet
  static bool isNetworkError(dynamic e) {
    if (e is DioException) {
      return _isNetworkError(e);
    }
    if (e is SocketException) return true;
    return false;
  }

  static bool _isNetworkError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return true;
    }
    if (e.error is SocketException) return true;
    final msg = (e.message ?? '').toLowerCase();
    if (msg.contains('socket') ||
        msg.contains('network') ||
        msg.contains('connection') ||
        msg.contains('failed host lookup')) {
      return true;
    }
    return false;
  }
}

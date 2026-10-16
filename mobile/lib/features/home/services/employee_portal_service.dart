import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';

class EmployeePortalService {
  /// Mengambil riwayat slip gaji karyawan
  static Future<List<dynamic>> getPayrolls({String? period}) async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/employee/payrolls', queryParameters: {
        if (period != null && period.isNotEmpty && period != 'all') 'period': period,
      });

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is List) {
          return data;
        }
      }
    } catch (_) {}
    return [];
  }

  /// Mengambil rincian slip gaji tertentu
  static Future<Map<String, dynamic>?> getPayrollDetail(int id) async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/employee/payrolls/$id');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is Map<String, dynamic>) {
          return data;
        }
      }
    } catch (_) {}
    return null;
  }

  /// Mengambil daftar laporan kerja karyawan
  static Future<List<dynamic>> getWorkReports({int page = 1}) async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/employee/work-reports', queryParameters: {'page': page});

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is List) {
          return data;
        }
      }
    } catch (_) {}
    return [];
  }

  /// Mengirim laporan kerja baru
  static Future<Map<String, dynamic>> submitWorkReport({
    required String reportDate,
    required String title,
    required String description,
    File? attachment,
  }) async {
    try {
      final dio = await ApiClient.getInstance();

      final formData = FormData.fromMap({
        'report_date': reportDate,
        'title': title,
        'description': description,
        if (attachment != null && await attachment.exists())
          'attachment': await MultipartFile.fromFile(
            attachment.path,
            filename: attachment.path.split(Platform.pathSeparator).last,
          ),
      });

      final response = await dio.post('/employee/work-reports', data: formData);

      return {
        'success': response.statusCode == 200 || response.statusCode == 201,
        'message': response.data['message'] ?? 'Laporan kerja berhasil dikirim.',
        'data': response.data['data'],
      };
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ??
          (e.response?.data?['errors'] != null
              ? (e.response!.data['errors'] as Map).values.first.toString()
              : 'Gagal mengirim laporan kerja.');
      return {'success': false, 'message': msg};
    } catch (e) {
      return {'success': false, 'message': 'Terjadi kesalahan sistem: $e'};
    }
  }

  /// Mengirim laporan kerja baku 4 kegiatan (Absen, Kegiatan 1, Kegiatan 2, Kegiatan Lain)
  static Future<Map<String, dynamic>> submit4ActivityWorkReport({
    required String reportDate,
    required File photoAbsen,
    required String descAbsen,
    required File photoKegiatan1,
    required String descKegiatan1,
    required File photoKegiatan2,
    required String descKegiatan2,
    File? photoKegiatanLain,
    String? descKegiatanLain,
  }) async {
    try {
      final dio = await ApiClient.getInstance();

      final map = <String, dynamic>{
        'report_date': reportDate,
        'desc_absen': descAbsen,
        'desc_kegiatan1': descKegiatan1,
        'desc_kegiatan2': descKegiatan2,
        'photo_absen': await MultipartFile.fromFile(
          photoAbsen.path,
          filename: photoAbsen.path.split(Platform.pathSeparator).last,
        ),
        'photo_kegiatan1': await MultipartFile.fromFile(
          photoKegiatan1.path,
          filename: photoKegiatan1.path.split(Platform.pathSeparator).last,
        ),
        'photo_kegiatan2': await MultipartFile.fromFile(
          photoKegiatan2.path,
          filename: photoKegiatan2.path.split(Platform.pathSeparator).last,
        ),
      };

      if (photoKegiatanLain != null && await photoKegiatanLain.exists()) {
        map['photo_kegiatan_lain'] = await MultipartFile.fromFile(
          photoKegiatanLain.path,
          filename: photoKegiatanLain.path.split(Platform.pathSeparator).last,
        );
      }
      if (descKegiatanLain != null && descKegiatanLain.trim().isNotEmpty) {
        map['desc_kegiatan_lain'] = descKegiatanLain.trim();
      }

      final formData = FormData.fromMap(map);
      final response = await dio.post('/employee/work-reports', data: formData);

      return {
        'success': response.statusCode == 200 || response.statusCode == 201,
        'message': response.data['message'] ?? 'Laporan kerja harian (4 kegiatan) berhasil dikirim.',
        'data': response.data['data'],
      };
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ??
          (e.response?.data?['errors'] != null
              ? (e.response!.data['errors'] as Map).values.first.toString()
              : 'Gagal mengirim laporan kerja.');
      return {'success': false, 'message': msg};
    } catch (e) {
      return {'success': false, 'message': 'Terjadi kesalahan sistem: $e'};
    }
  }

  /// Mengambil data profil lengkap karyawan
  static Future<Map<String, dynamic>?> getProfile() async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/employee/profile');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is Map<String, dynamic>) {
          return data;
        }
      }
    } catch (_) {}
    return null;
  }

  /// Memperbarui data profil dan data pribadi karyawan
  static Future<Map<String, dynamic>> updateProfile({
    String? phone,
    String? email,
    String? birthDate,
    String? gender,
    String? bankName,
    String? bankAccount,
    String? address,
    String? currentPassword,
    String? newPassword,
  }) async {
    try {
      final dio = await ApiClient.getInstance();
      final body = <String, dynamic>{};

      if (phone != null) body['phone'] = phone.trim();
      if (email != null && email.trim().isNotEmpty) body['email'] = email.trim();
      if (birthDate != null) body['birth_date'] = birthDate.trim();
      if (gender != null) body['gender'] = gender.trim();
      if (bankName != null) body['bank_name'] = bankName.trim();
      if (bankAccount != null) body['bank_account'] = bankAccount.trim();
      if (address != null) body['address'] = address.trim();
      if (newPassword != null && newPassword.trim().isNotEmpty) {
        body['current_password'] = currentPassword ?? '';
        body['new_password'] = newPassword.trim();
      }

      final response = await dio.put('/employee/profile', data: body);

      return {
        'success': response.statusCode == 200,
        'message': response.data['message'] ?? 'Data profil berhasil diperbarui.',
        'data': response.data['data'],
      };
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ??
          (e.response?.data?['errors'] != null
              ? (e.response!.data['errors'] as Map).values.first.toString()
              : 'Gagal memperbarui profil.');
      return {'success': false, 'message': msg};
    } catch (e) {
      return {'success': false, 'message': 'Terjadi kesalahan sistem: $e'};
    }
  }
}

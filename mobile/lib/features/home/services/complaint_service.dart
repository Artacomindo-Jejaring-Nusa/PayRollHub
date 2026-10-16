import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/complaint_model.dart';

class ComplaintService {
  /// Mengambil daftar keluhan/pengaduan yang diajukan oleh karyawan yang sedang login
  static Future<Map<String, dynamic>> getComplaints({String? status}) async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/employee/complaints', queryParameters: {
        if (status != null && status.isNotEmpty && status != 'all') 'status': status,
      });

      if (response.statusCode == 200 && response.data != null) {
        final dataRaw = response.data['data'];
        final List<ComplaintModel> list = [];
        if (dataRaw is List) {
          for (final item in dataRaw) {
            if (item is Map<String, dynamic>) {
              list.add(ComplaintModel.fromJson(item));
            }
          }
        }

        ComplaintSummaryModel? summary;
        if (response.data['summary'] is Map<String, dynamic>) {
          summary = ComplaintSummaryModel.fromJson(response.data['summary']);
        }

        return {
          'success': true,
          'complaints': list,
          'summary': summary,
        };
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Gagal memuat daftar keluhan.';
      return {'success': false, 'message': msg, 'complaints': <ComplaintModel>[]};
    } catch (e) {
      return {'success': false, 'message': 'Terjadi kesalahan sistem: $e', 'complaints': <ComplaintModel>[]};
    }

    return {'success': false, 'complaints': <ComplaintModel>[]};
  }

  /// Mengajukan keluhan baru ke HRD / Manajemen
  static Future<Map<String, dynamic>> submitComplaint({
    required String title,
    required String category,
    required String description,
    File? photo,
  }) async {
    try {
      final dio = await ApiClient.getInstance();

      final map = <String, dynamic>{
        'title': title.trim(),
        'category': category.trim(),
        'description': description.trim(),
      };

      if (photo != null) {
        final fileName = photo.path.split(Platform.pathSeparator).last;
        map['photo'] = await MultipartFile.fromFile(
          photo.path,
          filename: fileName,
        );
      }

      final formData = FormData.fromMap(map);
      final response = await dio.post('/employee/complaints', data: formData);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final itemJson = response.data['data'] as Map<String, dynamic>?;
        return {
          'success': true,
          'message': response.data['message'] ?? 'Keluhan berhasil dikirimkan ke HRD.',
          'data': itemJson != null ? ComplaintModel.fromJson(itemJson) : null,
        };
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ??
          (e.response?.data?['errors'] != null
              ? (e.response!.data['errors'] as Map).values.first.toString()
              : 'Gagal mengirim keluhan.');
      return {'success': false, 'message': msg};
    } catch (e) {
      return {'success': false, 'message': 'Terjadi kesalahan sistem: $e'};
    }

    return {'success': false, 'message': 'Gagal mengirim keluhan.'};
  }
}

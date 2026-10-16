import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/announcement_model.dart';

class AnnouncementService {
  static Future<List<AnnouncementModel>> getAnnouncements() async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/employee/announcements');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is List) {
          return data
              .map((item) => AnnouncementModel.fromJson(item as Map<String, dynamic>))
              .toList();
        }
      }
    } on DioException catch (_) {
      // Return empty list on network or server error
    } catch (_) {}

    return [];
  }
}

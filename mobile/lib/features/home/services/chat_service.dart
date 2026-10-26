import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/error_sanitizer.dart';
import '../models/chat_model.dart';

class ChatService {
  /// Mengambil sesi chat aktif untuk karyawan login
  static Future<Map<String, dynamic>> getActiveSession() async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/chat/active-session');

      if (response.statusCode == 200 && response.data != null) {
        final sessionRaw = response.data['session'];
        final messagesRaw = response.data['messages'];

        ChatSessionModel? session;
        if (sessionRaw is Map<String, dynamic>) {
          session = ChatSessionModel.fromJson(sessionRaw);
        }

        final List<ChatMessageModel> messages = [];
        if (messagesRaw is List) {
          for (final item in messagesRaw) {
            if (item is Map<String, dynamic>) {
              messages.add(ChatMessageModel.fromJson(item));
            }
          }
        }

        return {
          'success': true,
          'session': session,
          'messages': messages,
        };
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Gagal memuat sesi live chat.';
      return {'success': false, 'message': ErrorSanitizer.clean(msg)};
    } catch (e) {
      return {'success': false, 'message': ErrorSanitizer.clean(e)};
    }

    return {'success': false, 'message': 'Gagal terhubung ke server.'};
  }

  /// Mengirim pesan dari karyawan (bisa teks, foto, atau klik pill action)
  static Future<Map<String, dynamic>> sendMessage({
    required int sessionId,
    String? message,
    File? photo,
    String? actionCode,
  }) async {
    try {
      final dio = await ApiClient.getInstance();

      final map = <String, dynamic>{
        'session_id': sessionId,
      };

      if (message != null && message.trim().isNotEmpty) {
        map['message'] = message.trim();
      }
      if (actionCode != null && actionCode.isNotEmpty) {
        map['action_code'] = actionCode;
      }
      if (photo != null) {
        final fileName = photo.path.split(Platform.pathSeparator).last;
        map['photo'] = await MultipartFile.fromFile(
          photo.path,
          filename: fileName,
        );
      }

      final formData = FormData.fromMap(map);
      final response = await dio.post('/chat/messages', data: formData);

      if (response.statusCode == 200 && response.data != null) {
        ChatSessionModel? session;
        if (response.data['session'] is Map<String, dynamic>) {
          session = ChatSessionModel.fromJson(response.data['session']);
        }

        ChatMessageModel? userMsg;
        if (response.data['user_message'] is Map<String, dynamic>) {
          userMsg = ChatMessageModel.fromJson(response.data['user_message']);
        }

        ChatMessageModel? botMsg;
        if (response.data['bot_message'] is Map<String, dynamic>) {
          botMsg = ChatMessageModel.fromJson(response.data['bot_message']);
        }

        return {
          'success': true,
          'session': session,
          'user_message': userMsg,
          'bot_message': botMsg,
        };
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Gagal mengirim pesan.';
      return {'success': false, 'message': ErrorSanitizer.clean(msg)};
    } catch (e) {
      return {'success': false, 'message': ErrorSanitizer.clean(e, fallback: 'Gagal mengirim pesan.')};
    }

    return {'success': false, 'message': 'Gagal memproses pengiriman.'};
  }

  /// Minta terhubung langsung ke CS / Agent Human
  static Future<Map<String, dynamic>> requestAgent(int sessionId) async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.post('/chat/request-agent', data: {
        'session_id': sessionId,
      });

      if (response.statusCode == 200 && response.data != null) {
        ChatSessionModel? session;
        if (response.data['session'] is Map<String, dynamic>) {
          session = ChatSessionModel.fromJson(response.data['session']);
        }

        ChatMessageModel? sysMsg;
        if (response.data['system_message'] is Map<String, dynamic>) {
          sysMsg = ChatMessageModel.fromJson(response.data['system_message']);
        }

        return {
          'success': true,
          'session': session,
          'system_message': sysMsg,
        };
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Gagal menghubungkan ke agen CS.';
      return {'success': false, 'message': ErrorSanitizer.clean(msg)};
    } catch (e) {
      return {'success': false, 'message': ErrorSanitizer.clean(e)};
    }

    return {'success': false};
  }

  /// Polling pesan baru secara real-time
  static Future<Map<String, dynamic>> pollMessages(int sessionId, int lastId) async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/chat/poll/$sessionId', queryParameters: {
        'last_id': lastId,
      });

      if (response.statusCode == 200 && response.data != null) {
        final messagesRaw = response.data['messages'];
        final List<ChatMessageModel> list = [];
        if (messagesRaw is List) {
          for (final item in messagesRaw) {
            if (item is Map<String, dynamic>) {
              list.add(ChatMessageModel.fromJson(item));
            }
          }
        }

        return {
          'success': true,
          'status': response.data['status']?.toString(),
          'messages': list,
        };
      }
    } catch (_) {
      // silent polling error
    }

    return {'success': false, 'messages': <ChatMessageModel>[]};
  }

  /// Selesaikan dan tutup sesi obrolan
  static Future<bool> closeSession(int sessionId) async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.post('/chat/close', data: {
        'session_id': sessionId,
      });
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

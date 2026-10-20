import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/storage/token_storage.dart';
import '../models/user_model.dart';

class AuthResponse {
  final bool success;
  final String message;
  final UserModel? user;
  final String? token;
  final String? activeApiUrl;

  AuthResponse({
    required this.success,
    required this.message,
    this.user,
    this.token,
    this.activeApiUrl,
  });
}

class AuthService {
  Future<AuthResponse> login({
    required String identifier,
    required String password,
    String? company, // 'auto', 'rbs', 'rimamandiri'
    bool rememberMe = false,
  }) async {
    // 0. Coba server lokal (Development / Debug Mode di localhost atau LAN)
    if (kDebugMode) {
      final localCandidates = [
        'http://127.0.0.1:8000/api',
        AppConstants.localLanBaseUrl,
        AppConstants.emulatorBaseUrl,
      ];

      for (final localUrl in localCandidates) {
        try {
          final localAttempt = await _attemptLoginAtUrl(
            apiUrl: localUrl,
            identifier: identifier,
            password: password,
            company: company == AppConstants.tenantAuto ? null : company,
            rememberMe: rememberMe,
          );
          if (localAttempt.success) {
            return localAttempt;
          }
        } catch (_) {}
      }
    }

    // 1. Tentukan target endpoint domain berdasarkan pilihan tenant
    if (company == AppConstants.tenantRbs) {
      return await _attemptLoginAtUrl(
        apiUrl: AppConstants.rbsApiUrl,
        identifier: identifier,
        password: password,
        company: 'rbs',
        rememberMe: rememberMe,
      );
    } else if (company == AppConstants.tenantRiama) {
      return await _attemptLoginAtUrl(
        apiUrl: AppConstants.riamaApiUrl,
        identifier: identifier,
        password: password,
        company: 'rimamandiri',
        rememberMe: rememberMe,
      );
    }

    // 2. Jika Auto-detect ('auto'):
    // Coba login pertama di domain Rimbun Buana Sejahtera
    final rbsAttempt = await _attemptLoginAtUrl(
      apiUrl: AppConstants.rbsApiUrl,
      identifier: identifier,
      password: password,
      company: null,
      rememberMe: rememberMe,
    );

    if (rbsAttempt.success) {
      return rbsAttempt;
    }

    // Jika di Rimbun tidak berhasil (misal akun terdaftar di Riama Mandiri, portal ditolak, atau NIK tidak ada di RBS),
    // sistem secara otomatis mencoba login ke domain Riama Mandiri Pratama:
    final riamaAttempt = await _attemptLoginAtUrl(
      apiUrl: AppConstants.riamaApiUrl,
      identifier: identifier,
      password: password,
      company: null,
      rememberMe: rememberMe,
    );

    if (riamaAttempt.success) {
      return riamaAttempt;
    }

    // Jika kedua domain gagal, kembalikan response error
    return riamaAttempt;
  }

  Future<AuthResponse> _attemptLoginAtUrl({
    required String apiUrl,
    required String identifier,
    required String password,
    String? company,
    required bool rememberMe,
  }) async {
    try {
      final isLocal = apiUrl.contains('localhost') ||
          apiUrl.contains('127.0.0.1') ||
          apiUrl.contains('10.0.2.2') ||
          apiUrl.contains('192.168.');

      final dio = Dio(
        BaseOptions(
          baseUrl: apiUrl,
          connectTimeout: Duration(seconds: isLocal ? 4 : 12),
          receiveTimeout: Duration(seconds: isLocal ? 4 : 12),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        ),
      );

      final requestData = <String, dynamic>{
        'identifier': identifier.trim(),
        'password': password,
        'remember_me': rememberMe,
      };

      if (company != null && company.isNotEmpty) {
        requestData['company'] = company;
      }

      final response = await dio.post('/login', data: requestData);

      if (response.statusCode == 200 && response.data['status'] == 'success') {
        final data = response.data['data'];
        final token = data['token'] as String;
        final userJson = data['user'] as Map<String, dynamic>;
        final user = UserModel.fromJson(userJson);

        // Simpan URL API aktif: jika endpoint adalah lokal development, pertahankan lokal
        final activeUrl = isLocal
            ? apiUrl
            : (user.isRiama ? AppConstants.riamaApiUrl : AppConstants.rbsApiUrl);

        await TokenStorage.setBaseUrl(activeUrl);
        await TokenStorage.saveToken(token);
        await TokenStorage.saveUser(userJson);
        await TokenStorage.saveRememberMe(remember: rememberMe, nik: identifier.trim());

        // Reset singleton dio agar memakai base URL baru
        ApiClient.resetClient();

        // Mendaftarkan token FCM ke backend setelah autentikasi sukses
        try {
          await NotificationService.syncTokenWithBackend();
        } catch (_) {}

        return AuthResponse(
          success: true,
          message: response.data['message'] ?? 'Login berhasil.',
          user: user,
          token: token,
          activeApiUrl: activeUrl,
        );
      } else {
        return AuthResponse(
          success: false,
          message: response.data['message'] ?? 'Login gagal.',
        );
      }
    } on DioException catch (e) {
      String errorMessage = 'Terjadi kesalahan koneksi server ($apiUrl).';
      if (e.response != null && e.response?.data != null) {
        final responseData = e.response?.data;
        if (responseData is Map && responseData['message'] != null) {
          errorMessage = responseData['message'].toString();
        } else if (e.response?.statusCode == 422) {
          errorMessage = 'NIK atau kata sandi tidak cocok. Silakan coba lagi.';
        } else if (e.response?.statusCode == 403) {
          errorMessage = responseData['message'] ?? 'Akses portal tidak diizinkan.';
        }
      } else if (e.type == DioExceptionType.connectionTimeout ||
                 e.type == DioExceptionType.receiveTimeout) {
        errorMessage = 'Batas waktu koneksi habis ke $apiUrl. Periksa jaringan Anda.';
      } else if (e.type == DioExceptionType.connectionError) {
        errorMessage = 'Tidak dapat terhubung ke server $apiUrl.';
      }
      return AuthResponse(success: false, message: errorMessage);
    } catch (e) {
      return AuthResponse(success: false, message: 'Kesalahan tak terduga: ${e.toString()}');
    }
  }

  Future<UserModel?> getProfile() async {
    try {
      final dio = await ApiClient.getInstance();
      final response = await dio.get('/me');
      if (response.statusCode == 200 && response.data['data'] != null) {
        return UserModel.fromJson(response.data['data']);
      }
    } catch (_) {}
    return null;
  }

  Future<void> logout() async {
    try {
      // Hapus token perangkat FCM dari database backend
      await NotificationService.deleteTokenFromBackend();
    } catch (_) {}
    try {
      final dio = await ApiClient.getInstance();
      await dio.post('/logout');
    } catch (_) {}
    await TokenStorage.clearAll();
    ApiClient.resetClient();
  }
}

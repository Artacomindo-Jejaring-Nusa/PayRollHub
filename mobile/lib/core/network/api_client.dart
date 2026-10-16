import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../storage/token_storage.dart';

class ApiClient {
  static Dio? _dio;

  static Future<Dio> getInstance({String? customBaseUrl}) async {
    final baseUrl = customBaseUrl ?? await TokenStorage.getBaseUrl();

    if (_dio != null) {
      if (customBaseUrl != null && _dio!.options.baseUrl != customBaseUrl) {
        _dio!.options.baseUrl = customBaseUrl;
      }
      return _dio!;
    }

    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      ),
    );

    _dio!.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Selalu update base URL terbaru jika tidak di-override eksplisit
          if (!options.uri.isAbsolute) {
            final currentBase = await TokenStorage.getBaseUrl();
            options.baseUrl = currentBase;
          }

          final token = await TokenStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          final tenant = await TokenStorage.getTenant();
          if (tenant != null && tenant.isNotEmpty && tenant != AppConstants.tenantAuto) {
            options.headers['X-Tenant-ID'] = tenant;
          }

          return handler.next(options);
        },
        onError: (DioException e, handler) {
          return handler.next(e);
        },
      ),
    );

    return _dio!;
  }

  static void resetClient() {
    _dio = null;
  }
}

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';

class TokenStorage {
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();

  static Future<void> saveToken(String token) async {
    await _secureStorage.write(key: AppConstants.tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    return await _secureStorage.read(key: AppConstants.tokenKey);
  }

  static Future<void> clearToken() async {
    await _secureStorage.delete(key: AppConstants.tokenKey);
  }

  static Future<void> saveUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.userKey, jsonEncode(user));
    if (user['company'] != null) {
      await prefs.setString(AppConstants.tenantKey, user['company'].toString());
    }
  }

  static Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(AppConstants.userKey);
    if (data == null || data.isEmpty) return null;
    try {
      return jsonDecode(data) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<String?> getTenant() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(AppConstants.tenantKey);
  }

  static Future<void> saveRememberMe({required bool remember, required String nik}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(AppConstants.rememberMeKey, remember);
    if (remember) {
      await prefs.setString(AppConstants.savedNikKey, nik);
    } else {
      await prefs.remove(AppConstants.savedNikKey);
    }
  }

  static Future<Map<String, dynamic>> getRememberMe() async {
    final prefs = await SharedPreferences.getInstance();
    final remember = prefs.getBool(AppConstants.rememberMeKey) ?? false;
    final savedNik = prefs.getString(AppConstants.savedNikKey) ?? '';
    return {'remember': remember, 'nik': savedNik};
  }

  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(AppConstants.activeApiUrlKey) ?? AppConstants.defaultProductionBaseUrl;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.activeApiUrlKey, url);
  }

  static const String tutorialSeenKey = 'hc_has_seen_onboarding_tutorial_v1';

  static Future<bool> hasSeenTutorial() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(tutorialSeenKey) ?? false;
  }

  static Future<void> setHasSeenTutorial(bool seen) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(tutorialSeenKey, seen);
  }

  static Future<void> clearAll() async {
    await clearToken();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.userKey);
    await prefs.remove(AppConstants.tenantKey);
  }
}

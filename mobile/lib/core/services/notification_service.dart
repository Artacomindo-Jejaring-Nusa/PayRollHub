import 'dart:convert';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../network/api_client.dart';
import '../storage/token_storage.dart';

/// Top-level background message handler required by Firebase Messaging
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (e) {
    if (kDebugMode) {
      print('[FCM Background] Firebase init error: $e');
    }
  }
}

class NotificationService {
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'high_importance_channel',
    'Notifikasi Penting',
    description: 'Saluran notifikasi untuk pengumuman, pengaduan, dan persetujuan',
    importance: Importance.high,
    playSound: true,
  );

  static bool _isInitialized = false;

  /// Callback when user taps a notification (navigation target)
  static void Function(Map<String, dynamic> data)? onNotificationTapped;

  /// Initialize Firebase & Local Notifications
  static Future<void> init() async {
    if (_isInitialized) return;

    try {
      // 1. Initialize Firebase Core
      await Firebase.initializeApp();

      // 2. Set background message handler
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      // 3. Request permissions on iOS & Android 13+
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      if (kDebugMode) {
        print('[FCM] Permission status: ${settings.authorizationStatus}');
      }

      // 4. Setup foreground notification presentation options
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 5. Initialize Flutter Local Notifications
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const darwinInit = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const initSettings = InitializationSettings(
        android: androidInit,
        iOS: darwinInit,
      );

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (response) {
          if (response.payload != null && response.payload!.isNotEmpty) {
            try {
              final data = jsonDecode(response.payload!) as Map<String, dynamic>;
              onNotificationTapped?.call(data);
            } catch (_) {}
          }
        },
      );

      // 6. Create Android Notification Channel
      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(_channel);
      }

      // 7. Foreground message listener
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        if (kDebugMode) {
          print('[FCM Foreground] Received: ${message.notification?.title}');
        }
        _showForegroundNotification(message);
      });

      // 8. Background tap listener (when app is in background and opened via notification)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        if (kDebugMode) {
          print('[FCM OpenedApp] Tapped: ${message.data}');
        }
        onNotificationTapped?.call(message.data);
      });

      // 9. Initial message (when app was terminated and launched by tapping notification)
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        Future.delayed(const Duration(milliseconds: 600), () {
          onNotificationTapped?.call(initialMessage.data);
        });
      }

      // 10. Listen for Token Refresh
      messaging.onTokenRefresh.listen((newToken) {
        if (kDebugMode) {
          print('[FCM] Token refreshed: $newToken');
        }
        syncTokenWithBackend(newToken);
      });

      _isInitialized = true;
    } catch (e) {
      if (kDebugMode) {
        print('[FCM Init Error]: $e');
      }
    }
  }

  /// Show heads-up notification in foreground
  static Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    final androidDetails = AndroidNotificationDetails(
      _channel.id,
      _channel.name,
      channelDescription: _channel.description,
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
      playSound: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final platformDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      platformDetails,
      payload: jsonEncode(message.data),
    );
  }

  /// Retrieve current device FCM token
  static Future<String?> getToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      if (kDebugMode) {
        print('[FCM getToken Error]: $e');
      }
      return null;
    }
  }

  /// Register or refresh device token with the backend server
  static Future<bool> syncTokenWithBackend([String? explicitToken]) async {
    try {
      final authToken = await TokenStorage.getToken();
      // Only register if employee is logged in
      if (authToken == null || authToken.isEmpty) {
        return false;
      }

      final fcmToken = explicitToken ?? await getToken();
      if (fcmToken == null || fcmToken.isEmpty) {
        return false;
      }

      final dio = await ApiClient.getInstance();
      final response = await dio.post(
        '/fcm-token',
        data: {
          'token': fcmToken,
          'platform': Platform.isIOS ? 'ios' : 'android',
          'device_name': Platform.operatingSystem,
        },
      );

      if (response.statusCode == 200) {
        if (kDebugMode) {
          print('[FCM] Token successfully registered with backend server.');
        }
        return true;
      }
    } catch (e) {
      if (kDebugMode) {
        print('[FCM Sync Error]: $e');
      }
    }
    return false;
  }

  /// Delete device token from backend upon employee logout
  static Future<void> deleteTokenFromBackend() async {
    try {
      final fcmToken = await getToken();
      if (fcmToken == null || fcmToken.isEmpty) return;

      final dio = await ApiClient.getInstance();
      await dio.delete(
        '/fcm-token',
        data: {
          'token': fcmToken,
        },
      );
      if (kDebugMode) {
        print('[FCM] Token removed from backend.');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[FCM Remove Error]: $e');
      }
    }
  }
}

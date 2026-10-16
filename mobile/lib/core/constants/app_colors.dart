import 'package:flutter/material.dart';

/// HC Management Mobile Color System
/// Berdasarkan spesifikasi Design System HC Management Mobile:
/// - Primary   : #0F2B5C (Navy)
/// - Secondary : #6366F1 (Indigo)
/// - Tertiary  : #F59E0B (Amber/Gold)
/// - Neutral   : #0F172A (Slate 900)
class AppColors {
  // ==========================================
  // Core Design System Tokens
  // ==========================================
  static const Color primary = Color(0xFF0F2B5C);
  static const Color secondary = Color(0xFF6366F1);
  static const Color tertiary = Color(0xFFF59E0B);
  static const Color neutral = Color(0xFF0F172A);

  // ==========================================
  // Primary Palette Shades (#0F2B5C)
  // ==========================================
  static const Color primary900 = Color(0xFF081A38);
  static const Color primary800 = Color(0xFF0F2B5C); // Core Primary
  static const Color primary700 = Color(0xFF163E82);
  static const Color primary600 = Color(0xFF1E52AA);
  static const Color primary500 = Color(0xFF2B6BD0);
  static const Color primary400 = Color(0xFF5389DC);
  static const Color primary300 = Color(0xFF86AEE9);
  static const Color primary200 = Color(0xFFBAD2F4);
  static const Color primary100 = Color(0xFFDFECFA);
  static const Color primary50  = Color(0xFFF0F6FD);

  // ==========================================
  // Secondary Palette Shades (#6366F1)
  // ==========================================
  static const Color secondary900 = Color(0xFF312E81);
  static const Color secondary800 = Color(0xFF3730A3);
  static const Color secondary700 = Color(0xFF4338CA);
  static const Color secondary600 = Color(0xFF4F46E5);
  static const Color secondary500 = Color(0xFF6366F1); // Core Secondary
  static const Color secondary400 = Color(0xFF818CF8);
  static const Color secondary300 = Color(0xFFA5B4FC);
  static const Color secondary200 = Color(0xFFC7D2FE);
  static const Color secondary100 = Color(0xFFE0E7FF);
  static const Color secondary50  = Color(0xFFEEF2FF);

  // ==========================================
  // Tertiary Palette Shades (#F59E0B)
  // ==========================================
  static const Color tertiary900 = Color(0xFF78350F);
  static const Color tertiary800 = Color(0xFF92400E);
  static const Color tertiary700 = Color(0xFFB45309);
  static const Color tertiary600 = Color(0xFFD97706);
  static const Color tertiary500 = Color(0xFFF59E0B); // Core Tertiary
  static const Color tertiary400 = Color(0xFFFBBF24);
  static const Color tertiary300 = Color(0xFFFCD34D);
  static const Color tertiary200 = Color(0xFFFDE68A);
  static const Color tertiary100 = Color(0xFFFEF3C7);
  static const Color tertiary50  = Color(0xFFFFFBEB);

  // ==========================================
  // Neutral Palette Shades (#0F172A)
  // ==========================================
  static const Color neutral950 = Color(0xFF020617);
  static const Color neutral900 = Color(0xFF0F172A); // Core Neutral
  static const Color neutral800 = Color(0xFF1E293B);
  static const Color neutral700 = Color(0xFF334155);
  static const Color neutral600 = Color(0xFF475569);
  static const Color neutral500 = Color(0xFF64748B);
  static const Color neutral400 = Color(0xFF94A3B8);
  static const Color neutral300 = Color(0xFFCBD5E1);
  static const Color neutral200 = Color(0xFFE2E8F0);
  static const Color neutral100 = Color(0xFFF1F5F9);
  static const Color neutral50  = Color(0xFFF8FAFC);

  // ==========================================
  // Surface & Layout
  // ==========================================
  static const Color surface = Color(0xFFFAF8FF);
  static const Color white = Colors.white;

  // ==========================================
  // Multi-tenant Branding
  // ==========================================
  static const Color rbsNavy = primary; // PT. Rimbun Buana Sejahtera
  static const Color riamaEmerald = Color(0xFF059669); // PT. Riama Mandiri Pratama
  static const Color riamaTeal = Color(0xFF0D9488);

  // ==========================================
  // Semantic / Feedback
  // ==========================================
  static const Color success = Color(0xFF10B981);
  static const Color warning = tertiary;
  static const Color error = Color(0xFFEF4444);

  // Shadows
  static const Color shadowBtn = Color(0x590F2B5C); // 35% opacity
  static const Color shadowCard = Color(0x140F2B5C); // 8% opacity

  // Backward compatibility aliases
  static const Color navy = primary;
  static const Color darkNavy = primary900;
  static const Color accentIndigo = secondary;
  static const Color accentIndigoLight = secondary100;
  static const Color accentIndigoDark = secondary700;
  static const Color slate50 = neutral50;
  static const Color slate100 = neutral100;
  static const Color slate200 = neutral200;
  static const Color slate300 = neutral300;
  static const Color slate400 = neutral400;
  static const Color slate500 = neutral500;
  static const Color slate600 = neutral600;
  static const Color slate700 = neutral700;
  static const Color slate800 = neutral800;
  static const Color slate900 = neutral900;
}

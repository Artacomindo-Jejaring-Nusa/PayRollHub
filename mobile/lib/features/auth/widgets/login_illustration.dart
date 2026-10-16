import 'package:flutter/material.dart';

class LoginIllustration extends StatelessWidget {
  const LoginIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 140,
        height: 140,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(36),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F2B5C).withValues(alpha: 0.35),
              blurRadius: 30,
              offset: const Offset(0, 14),
            ),
            BoxShadow(
              color: const Color(0xFF00E5FF).withValues(alpha: 0.22),
              blurRadius: 38,
              spreadRadius: 2,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(36),
          child: Image.asset(
            'assets/icons/app_logo_3d.png',
            fit: BoxFit.cover,
          ),
        ),
      ),
    );
  }
}

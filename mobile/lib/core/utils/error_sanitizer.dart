class ErrorSanitizer {
  /// Membersihkan pesan error agar ramah pengguna dan menjamin TIDAK PERNAH menampilkan
  /// kata 'artacomindo' / 'artacom', path internal Android/iOS, atau exception teknis ke pengguna.
  static String clean(
    dynamic error, {
    String fallback = 'Terjadi kesalahan sistem. Silakan coba kembali.',
  }) {
    if (error == null) return _stripForbiddenWords(fallback);
    String raw = error.toString().trim();
    if (raw.isEmpty) return _stripForbiddenWords(fallback);

    // 1. Bersihkan prefix Exception umum
    raw = raw.replaceAll(RegExp(r'^(?:Exception|Error):\s*', caseSensitive: false), '');

    // 2. Deteksi berkas hilang / memori cache terhapus (seperti scaled_xxx.jpg)
    if (raw.contains('PathNotFoundException') ||
        raw.contains('Cannot retrieve length of file') ||
        raw.contains('No such file or directory') ||
        raw.contains('errno = 2')) {
      return 'Berkas foto tidak ditemukan di memori HP. Silakan ambil ulang foto.';
    }

    // 3. Deteksi masalah koneksi internet
    if (raw.contains('SocketException') ||
        raw.contains('Failed host lookup') ||
        raw.contains('Network is unreachable') ||
        raw.contains('Connection refused') ||
        raw.contains('connectionError') ||
        raw.contains('No address associated with hostname')) {
      return 'Koneksi internet terputus atau tidak stabil. Mohon periksa sinyal HP Anda.';
    }

    // 4. Deteksi timeout
    if (raw.contains('TimeoutException') ||
        raw.contains('timed out') ||
        raw.contains('connectionTimeout') ||
        raw.contains('sendTimeout') ||
        raw.contains('receiveTimeout')) {
      return 'Koneksi internet lambat / timeout. Mohon pastikan sinyal stabil lalu coba lagi.';
    }

    // 5. Tangani crash internal Flutter / Dart umum agar tidak membocorkan stack trace
    if (raw.contains('Null check operator') ||
        raw.contains('NoSuchMethodError') ||
        raw.contains('RangeError') ||
        raw.contains('TypeError') ||
        raw.contains('Bad state') ||
        raw.contains('LateInitializationError') ||
        raw.contains('Unhandled Exception') ||
        raw.contains('#0 ') ||
        raw.contains('package:')) {
      return 'Terjadi kendala teknis pada sistem. Silakan coba beberapa saat lagi.';
    }

    // 6. Sensor path internal Android & iOS (/data/user/0/..., /storage/..., dll)
    raw = raw.replaceAll(
      RegExp(r'''/(?:data|storage|emulated|private|var)/[^\s)'",]+''', caseSensitive: false),
      '[penyimpanan]',
    );
    raw = raw.replaceAll(RegExp(r'\(OS Error: [^\)]+\)', caseSensitive: false), '');
    raw = raw.replaceAll(RegExp(r', errno\s*=\s*\d+', caseSensitive: false), '');

    // 7. Sensor absolut terhadap nama atau package 'artacomindo' / 'artacom'
    raw = _stripForbiddenWords(raw);

    final result = raw.trim();
    if (result.isEmpty || result == '[penyimpanan]' || result == 'Terjadi kesalahan:') {
      return _stripForbiddenWords(fallback);
    }

    return result;
  }

  /// Menghilangkan seluruh jejak kata 'artacomindo' dan 'artacom' (case-insensitive)
  static String _stripForbiddenWords(String text) {
    var sanitized = text;
    // Ganti package name com.artacomindo.*
    sanitized = sanitized.replaceAll(
      RegExp(r'com\.artacomindo(?:\.[a-zA-Z0-9_]+)*', caseSensitive: false),
      'aplikasi',
    );
    // Ganti kata artacomindo
    sanitized = sanitized.replaceAll(RegExp(r'artacomindo', caseSensitive: false), '');
    // Ganti kata artacom
    sanitized = sanitized.replaceAll(RegExp(r'artacom', caseSensitive: false), '');
    // Bersihkan spasi ganda yang mungkin tertinggal
    sanitized = sanitized.replaceAll(RegExp(r'\s{2,}'), ' ');
    return sanitized.trim();
  }
}

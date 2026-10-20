class AppConstants {
  static const String appName = 'HC Attendance';
  static const String appVersion = '1.0.0';

  // Production API Domains
  static const String rbsApiUrl = 'https://rimbunbuanasejahtera.com/api';
  static const String riamaApiUrl = 'https://riamamandiripratama.com/api';

  // Default fallback jika belum ditentukan
  static const String defaultProductionBaseUrl = rbsApiUrl;

  // Local development fallbacks
  static const String emulatorBaseUrl = 'http://10.0.2.2:8000/api';
  static const String localWebBaseUrl = 'http://127.0.0.1:8000/api';
  static const String localLanBaseUrl = 'http://2.2.2.11:8000/api';

  // Storage Keys
  static const String tokenKey = 'hc_auth_token';
  static const String userKey = 'hc_user_data';
  static const String tenantKey = 'hc_tenant_company';
  static const String activeApiUrlKey = 'hc_active_api_url';
  static const String rememberMeKey = 'hc_remember_me';
  static const String savedNikKey = 'hc_saved_nik';

  // Tenant Identifiers
  static const String tenantRbs = 'rbs';
  static const String tenantRiama = 'rimamandiri';
  static const String tenantAuto = 'auto';

  static String getBaseUrlForTenant(String tenant) {
    if (tenant.toLowerCase() == tenantRiama ||
        tenant.toLowerCase() == 'riama') {
      return riamaApiUrl;
    }
    return rbsApiUrl;
  }
}

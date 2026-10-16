import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/storage/token_storage.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

class AuthState {
  final bool isLoading;
  final bool isAuthenticated;
  final UserModel? user;
  final String? errorMessage;
  final String selectedTenant; // 'auto', 'rbs', 'rimamandiri'

  const AuthState({
    this.isLoading = false,
    this.isAuthenticated = false,
    this.user,
    this.errorMessage,
    this.selectedTenant = AppConstants.tenantAuto,
  });

  AuthState copyWith({
    bool? isLoading,
    bool? isAuthenticated,
    UserModel? user,
    String? errorMessage,
    String? selectedTenant,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      errorMessage: errorMessage,
      selectedTenant: selectedTenant ?? this.selectedTenant,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(const AuthState()) {
    checkInitialAuth();
  }

  void setSelectedTenant(String tenant) {
    state = state.copyWith(selectedTenant: tenant);
  }

  Future<void> checkInitialAuth() async {
    final token = await TokenStorage.getToken();
    final savedUser = await TokenStorage.getUser();

    if (token != null && token.isNotEmpty && savedUser != null) {
      final user = UserModel.fromJson(savedUser);
      state = state.copyWith(
        isAuthenticated: true,
        user: user,
      );
    }
  }

  Future<bool> login({
    required String identifier,
    required String password,
    bool rememberMe = false,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    final response = await _authService.login(
      identifier: identifier,
      password: password,
      company: state.selectedTenant,
      rememberMe: rememberMe,
    );

    if (response.success && response.user != null) {
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        user: response.user,
        errorMessage: null,
      );
      return true;
    } else {
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: false,
        errorMessage: response.message,
      );
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    await _authService.logout();
    state = const AuthState();
  }
}

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  return AuthNotifier(authService);
});

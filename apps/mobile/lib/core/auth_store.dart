import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AuthUser {
  AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.tenantId,
    this.tenantSlug,
    this.activeBranchId,
  });

  final String id;
  final String email;
  final String name;
  final String role;
  final String tenantId;
  final String? tenantSlug;
  final String? activeBranchId;

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'] as String,
        email: j['email'] as String? ?? '',
        name: j['name'] as String? ?? '',
        role: j['role'] as String? ?? '',
        tenantId: j['tenantId'] as String? ?? '',
        tenantSlug: j['tenantSlug'] as String?,
        activeBranchId: j['activeBranchId'] as String? ?? j['suggestedBranchId'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'role': role,
        'tenantId': tenantId,
        'tenantSlug': tenantSlug,
        'activeBranchId': activeBranchId,
      };
}

class AuthStore {
  static const _accessKey = 'hx_access_token';
  static const _refreshKey = 'hx_refresh_token';
  static const _userKey = 'hx_user';
  static const _tenantKey = 'hx_tenant_slug';
  static const _apiKey = 'hx_api_base';

  String? accessToken;
  String? refreshToken;
  AuthUser? user;
  String? tenantSlug;
  String? apiBaseOverride;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    accessToken = p.getString(_accessKey);
    refreshToken = p.getString(_refreshKey);
    tenantSlug = p.getString(_tenantKey);
    apiBaseOverride = p.getString(_apiKey);
    final raw = p.getString(_userKey);
    if (raw != null) {
      user = AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    }
  }

  Future<void> saveSession({
    required String access,
    required String refresh,
    required AuthUser u,
    String? slug,
  }) async {
    accessToken = access;
    refreshToken = refresh;
    user = u;
    if (slug != null && slug.isNotEmpty) tenantSlug = slug;
    final p = await SharedPreferences.getInstance();
    await p.setString(_accessKey, access);
    await p.setString(_refreshKey, refresh);
    await p.setString(_userKey, jsonEncode(u.toJson()));
    if (tenantSlug != null) await p.setString(_tenantKey, tenantSlug!);
  }

  Future<void> setTenantSlug(String slug) async {
    tenantSlug = slug.trim().isEmpty ? null : slug.trim();
    final p = await SharedPreferences.getInstance();
    if (tenantSlug == null) {
      await p.remove(_tenantKey);
    } else {
      await p.setString(_tenantKey, tenantSlug!);
    }
  }

  Future<void> setApiBase(String url) async {
    apiBaseOverride = url.trim().isEmpty ? null : url.trim();
    final p = await SharedPreferences.getInstance();
    if (apiBaseOverride == null) {
      await p.remove(_apiKey);
    } else {
      await p.setString(_apiKey, apiBaseOverride!);
    }
  }

  Future<void> clear() async {
    accessToken = null;
    refreshToken = null;
    user = null;
    final p = await SharedPreferences.getInstance();
    await p.remove(_accessKey);
    await p.remove(_refreshKey);
    await p.remove(_userKey);
  }

  bool get isLoggedIn => accessToken != null && accessToken!.isNotEmpty;
}

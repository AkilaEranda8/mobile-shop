import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_store.dart';
import 'config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;
  final int? status;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this.auth);

  final AuthStore auth;

  String get baseUrl => auth.apiBaseOverride?.isNotEmpty == true
      ? auth.apiBaseOverride!
      : AppConfig.apiBaseUrl;

  Map<String, String> _headers({bool jsonBody = true}) {
    final h = <String, String>{
      if (jsonBody) 'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (auth.accessToken != null) {
      h['Authorization'] = 'Bearer ${auth.accessToken}';
    }
    if (auth.tenantSlug != null && auth.tenantSlug!.isNotEmpty) {
      h['x-tenant-id'] = auth.tenantSlug!;
    }
    return h;
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final res = await http.get(uri, headers: _headers(jsonBody: false));
    return _decode(res);
  }

  Future<dynamic> post(String path, [Object? body]) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await http.post(
      uri,
      headers: _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(res);
  }

  Future<dynamic> patch(String path, [Object? body]) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await http.patch(
      uri,
      headers: _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    dynamic json;
    try {
      json = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      json = null;
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (json is Map && json.containsKey('data')) return json['data'];
      return json;
    }
    final msg = json is Map
        ? (json['message']?.toString() ?? 'Request failed (${res.statusCode})')
        : 'Request failed (${res.statusCode})';
    throw ApiException(msg, status: res.statusCode);
  }
}

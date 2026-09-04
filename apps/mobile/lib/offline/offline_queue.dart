import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../data/wholesale_api.dart';

enum OfflineOpType { vanSale, vanPayment, vanVisit }

class OfflineOp {
  OfflineOp({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAt,
    this.label,
  });

  final String id;
  final OfflineOpType type;
  final Map<String, dynamic> payload;
  final String createdAt;
  final String? label;

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'payload': payload,
        'createdAt': createdAt,
        'label': label,
      };

  factory OfflineOp.fromJson(Map<String, dynamic> j) => OfflineOp(
        id: j['id'] as String,
        type: OfflineOpType.values.firstWhere(
          (e) => e.name == j['type'],
          orElse: () => OfflineOpType.vanSale,
        ),
        payload: Map<String, dynamic>.from(j['payload'] as Map),
        createdAt: j['createdAt'] as String,
        label: j['label'] as String?,
      );
}

class OfflineQueue {
  static const _key = 'hx_offline_queue';
  final _uuid = const Uuid();

  Future<List<OfflineOp>> list() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    final list = jsonDecode(raw) as List;
    return list
        .whereType<Map>()
        .map((e) => OfflineOp.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> _save(List<OfflineOp> items) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_key, jsonEncode(items.map((e) => e.toJson()).toList()));
  }

  Future<void> enqueue(OfflineOpType type, Map<String, dynamic> payload, {String? label}) async {
    final items = await list();
    items.add(OfflineOp(
      id: _uuid.v4(),
      type: type,
      payload: payload,
      createdAt: DateTime.now().toIso8601String(),
      label: label,
    ));
    await _save(items);
  }

  Future<int> count() async => (await list()).length;

  Future<({int synced, int failed})> sync(WholesaleApi api) async {
    final items = await list();
    final remaining = <OfflineOp>[];
    var synced = 0;
    var failed = 0;
    for (final item in items) {
      try {
        switch (item.type) {
          case OfflineOpType.vanSale:
            await api.vanSale(item.payload);
          case OfflineOpType.vanPayment:
            await api.createPayment(item.payload);
          case OfflineOpType.vanVisit:
            await api.upsertVisit(item.payload);
        }
        synced++;
      } catch (_) {
        failed++;
        remaining.add(item);
      }
    }
    await _save(remaining);
    return (synced: synced, failed: failed);
  }
}

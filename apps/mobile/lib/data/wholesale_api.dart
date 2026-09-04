import '../core/api_client.dart';

class Dealer {
  Dealer({
    required this.id,
    required this.dealerCode,
    required this.legalName,
    this.tradingName,
    required this.phone,
    required this.totalDue,
    required this.creditLimit,
    required this.cashOnly,
  });

  final String id;
  final String dealerCode;
  final String legalName;
  final String? tradingName;
  final String phone;
  final double totalDue;
  final double creditLimit;
  final bool cashOnly;

  String get displayName =>
      (tradingName != null && tradingName!.isNotEmpty) ? tradingName! : legalName;

  factory Dealer.fromJson(Map<String, dynamic> j) => Dealer(
        id: j['id'] as String,
        dealerCode: j['dealerCode'] as String? ?? '',
        legalName: j['legalName'] as String? ?? '',
        tradingName: j['tradingName'] as String?,
        phone: j['phone'] as String? ?? '',
        totalDue: (j['totalDue'] as num?)?.toDouble() ?? 0,
        creditLimit: (j['creditLimit'] as num?)?.toDouble() ?? 0,
        cashOnly: j['cashOnly'] as bool? ?? false,
      );
}

class Vehicle {
  Vehicle({
    required this.id,
    required this.plateNumber,
    required this.name,
    this.stockBranchId,
  });

  final String id;
  final String plateNumber;
  final String name;
  final String? stockBranchId;

  factory Vehicle.fromJson(Map<String, dynamic> j) => Vehicle(
        id: j['id'] as String,
        plateNumber: j['plateNumber'] as String? ?? '',
        name: j['name'] as String? ?? '',
        stockBranchId: j['stockBranchId'] as String?,
      );
}

class WholesaleApi {
  WholesaleApi(this.api);
  final ApiClient api;

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final data = await api.post('/auth/login', {
      'email': email.trim(),
      'password': password,
    });
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<Dealer>> dealers({String? search}) async {
    final data = await api.get('/wholesale/dealers', query: {
      'limit': '200',
      'isActive': 'true',
      if (search != null && search.isNotEmpty) 'search': search,
    });
    final list = data is List ? data : (data is Map ? data['data'] : null);
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Dealer.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<Vehicle>> vehicles() async {
    final data = await api.get('/wholesale/van/vehicles', query: {'limit': '50'});
    final list = data is List ? data : (data is Map ? data['data'] : null);
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Vehicle.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<dynamic> upsertVisit(Map<String, dynamic> body) =>
      api.post('/wholesale/van/visits', body);

  Future<dynamic> vanSale(Map<String, dynamic> body) =>
      api.post('/wholesale/van/sale', body);

  Future<dynamic> createPayment(Map<String, dynamic> body) =>
      api.post('/wholesale/collections/payments', body);

  Future<dynamic> resolvePrice({
    required String dealerId,
    required String productId,
    double qty = 1,
  }) =>
      api.get('/wholesale/pricing/resolve', query: {
        'dealerId': dealerId,
        'productId': productId,
        'quantity': qty.toString(),
      });
}

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/auth_store.dart';
import '../data/wholesale_api.dart';
import '../offline/offline_queue.dart';
import 'login_screen.dart';
import 'theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _search = TextEditingController();
  List<Dealer> _dealers = [];
  List<Vehicle> _vehicles = [];
  String? _vehicleId;
  bool _loading = true;
  String? _error;
  int _queueCount = 0;

  WholesaleApi get _api => WholesaleApi(context.read<ApiClient>());
  final _queue = OfflineQueue();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dealers = await _api.dealers(search: _search.text.trim());
      final vehicles = await _api.vehicles();
      final q = await _queue.count();
      if (!mounted) return;
      setState(() {
        _dealers = dealers;
        _vehicles = vehicles;
        _vehicleId ??= vehicles.isNotEmpty ? vehicles.first.id : null;
        _queueCount = q;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _syncQueue() async {
    final r = await _queue.sync(_api);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Synced ${r.synced}, failed ${r.failed}')),
    );
    await _load();
  }

  Future<void> _logout() async {
    await context.read<AuthStore>().clear();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  Future<void> _openDealer(Dealer d) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DealerSheet(
        dealer: d,
        vehicleId: _vehicleId,
        onChanged: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthStore>().user;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Hexalyte Rep', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            Text(user?.name ?? 'Field sales', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          ],
        ),
        actions: [
          if (_queueCount > 0)
            IconButton(
              tooltip: 'Sync offline queue',
              onPressed: _syncQueue,
              icon: Badge(
                label: Text('$_queueCount'),
                child: const Icon(Icons.cloud_upload_outlined),
              ),
            ),
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
          IconButton(onPressed: _logout, icon: const Icon(Icons.logout)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            if (_vehicles.isNotEmpty) ...[
              DropdownButtonFormField<String>(
                initialValue: _vehicleId,
                decoration: const InputDecoration(labelText: 'Vehicle'),
                items: _vehicles
                    .map(
                      (v) => DropdownMenuItem(
                        value: v.id,
                        child: Text('${v.plateNumber} · ${v.name}'),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _vehicleId = v),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: _search,
              decoration: InputDecoration(
                hintText: 'Search dealer…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: _load,
                ),
              ),
              onSubmitted: (_) => _load(),
            ),
            const SizedBox(height: 16),
            Text(
              'Dealer visit',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
              )
            else if (_dealers.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text('No dealers found. Enable WHOLESALE and create dealers in web.'),
              )
            else
              ..._dealers.map(
                (d) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Card(
                    child: ListTile(
                      onTap: () => _openDealer(d),
                      title: Text(d.displayName, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text('${d.dealerCode} · ${d.phone}'),
                      trailing: d.totalDue > 0
                          ? Text(
                              money(d.totalDue),
                              style: const TextStyle(
                                color: Color(0xFFD97706),
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            )
                          : const Icon(Icons.chevron_right),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class DealerSheet extends StatefulWidget {
  const DealerSheet({
    super.key,
    required this.dealer,
    required this.vehicleId,
    required this.onChanged,
  });

  final Dealer dealer;
  final String? vehicleId;
  final VoidCallback onChanged;

  @override
  State<DealerSheet> createState() => _DealerSheetState();
}

class _DealerSheetState extends State<DealerSheet> {
  final _productId = TextEditingController();
  final _qty = TextEditingController(text: '1');
  final _price = TextEditingController(text: '0');
  final _cash = TextEditingController();
  final _collectAmount = TextEditingController();
  String _method = 'CASH';
  bool _busy = false;

  WholesaleApi get _api => WholesaleApi(context.read<ApiClient>());
  final _queue = OfflineQueue();

  @override
  void initState() {
    super.initState();
    if (widget.dealer.totalDue > 0) {
      _collectAmount.text = widget.dealer.totalDue.toStringAsFixed(2);
    }
  }

  @override
  void dispose() {
    _productId.dispose();
    _qty.dispose();
    _price.dispose();
    _cash.dispose();
    _collectAmount.dispose();
    super.dispose();
  }

  Future<bool> _isOffline() async {
    final r = await Connectivity().checkConnectivity();
    return r.contains(ConnectivityResult.none);
  }

  Future<void> _run(Future<void> Function() online, Future<void> Function() offline) async {
    setState(() => _busy = true);
    try {
      if (await _isOffline()) {
        await offline();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Queued offline')),
          );
        }
      } else {
        try {
          await online();
        } catch (e) {
          // Network-ish failure → queue
          final msg = e.toString().toLowerCase();
          if (msg.contains('socket') || msg.contains('failed host') || msg.contains('network')) {
            await offline();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Queued offline')),
              );
            }
          } else {
            rethrow;
          }
        }
      }
      widget.onChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkIn() async {
    final body = {
      'dealerId': widget.dealer.id,
      if (widget.vehicleId != null) 'vehicleId': widget.vehicleId,
      'checkIn': true,
    };
    await _run(
      () async {
        await _api.upsertVisit(body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Checked in')));
        }
      },
      () => _queue.enqueue(OfflineOpType.vanVisit, body, label: 'Visit ${widget.dealer.displayName}'),
    );
  }

  Future<void> _vanSale() async {
    if (widget.vehicleId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select a vehicle first')));
      return;
    }
    final qty = double.tryParse(_qty.text) ?? 0;
    final price = double.tryParse(_price.text) ?? 0;
    final cash = double.tryParse(_cash.text) ?? 0;
    if (_productId.text.trim().isEmpty || qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Product + qty required')));
      return;
    }
    if (cash <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter cash received')));
      return;
    }
    final body = {
      'dealerId': widget.dealer.id,
      'vehicleId': widget.vehicleId,
      'lines': [
        {
          'productId': _productId.text.trim(),
          'quantity': qty,
          'unitPrice': price,
          'sellUnit': 'PIECE',
        }
      ],
      'payments': [
        {'method': 'CASH', 'amount': cash},
      ],
    };
    await _run(
      () async {
        await _api.vanSale(body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Van sale posted')));
          Navigator.pop(context);
        }
      },
      () => _queue.enqueue(OfflineOpType.vanSale, body, label: 'Sale ${widget.dealer.displayName}'),
    );
  }

  Future<void> _collect() async {
    final amount = double.tryParse(_collectAmount.text) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Amount required')));
      return;
    }
    final body = {
      'dealerId': widget.dealer.id,
      'amount': amount,
      'method': _method,
    };
    await _run(
      () async {
        await _api.createPayment(body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment recorded')));
          Navigator.pop(context);
        }
      },
      () => _queue.enqueue(OfflineOpType.vanPayment, body, label: 'Pay ${widget.dealer.displayName}'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      margin: EdgeInsets.only(bottom: bottom),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.blueGrey.shade200,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(widget.dealer.displayName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            Text(
              '${widget.dealer.dealerCode}${widget.dealer.totalDue > 0 ? ' · due ${money(widget.dealer.totalDue)}' : ''}',
              style: TextStyle(color: Colors.blueGrey.shade600, fontSize: 13),
            ),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: _busy ? null : _checkIn,
              child: const Text('Check in'),
            ),
            const SizedBox(height: 20),
            const Text('Quick van sale', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            TextField(controller: _productId, decoration: const InputDecoration(labelText: 'Product ID')),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: TextField(controller: _qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Qty'))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: _price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Unit price'))),
              ],
            ),
            const SizedBox(height: 8),
            TextField(controller: _cash, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Cash received')),
            const SizedBox(height: 8),
            FilledButton(onPressed: _busy ? null : _vanSale, child: const Text('Post van sale')),
            const SizedBox(height: 20),
            const Text('Collect payment', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            TextField(controller: _collectAmount, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount')),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _method,
              decoration: const InputDecoration(labelText: 'Method'),
              items: const [
                DropdownMenuItem(value: 'CASH', child: Text('CASH')),
                DropdownMenuItem(value: 'CARD', child: Text('CARD')),
                DropdownMenuItem(value: 'BANK_TRANSFER', child: Text('BANK_TRANSFER')),
                DropdownMenuItem(value: 'CHEQUE', child: Text('CHEQUE')),
                DropdownMenuItem(value: 'UPI', child: Text('UPI')),
              ],
              onChanged: (v) => setState(() => _method = v ?? 'CASH'),
            ),
            const SizedBox(height: 8),
            FilledButton(onPressed: _busy ? null : _collect, child: const Text('Record payment')),
            if (_busy) ...[
              const SizedBox(height: 16),
              const Center(child: CircularProgressIndicator()),
            ],
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/auth_store.dart';
import '../core/config.dart';
import '../data/wholesale_api.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _tenant = TextEditingController();
  final _api = TextEditingController(text: AppConfig.apiBaseUrl);
  bool _busy = false;
  bool _showAdvanced = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthStore>();
    _tenant.text = auth.tenantSlug ?? '';
    if (auth.apiBaseOverride != null) _api.text = auth.apiBaseOverride!;
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _tenant.dispose();
    _api.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthStore>();
    final api = context.read<ApiClient>();
    final wholesale = WholesaleApi(api);
    try {
      await auth.setTenantSlug(_tenant.text);
      await auth.setApiBase(_api.text);
      final data = await wholesale.login(
        email: _email.text,
        password: _password.text,
      );
      final userMap = Map<String, dynamic>.from(data['user'] as Map);
      await auth.saveSession(
        access: data['accessToken'] as String,
        refresh: data['refreshToken'] as String? ?? data['accessToken'] as String,
        u: AuthUser.fromJson(userMap),
        slug: _tenant.text.trim().isEmpty ? null : _tenant.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = Colors.blueGrey.shade600;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
          children: [
            Text(
              'HEXALYTE REP',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.4,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Field sales',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Sign in to sell from van stock and collect dealer dues.',
              style: TextStyle(color: muted),
            ),
            const SizedBox(height: 32),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: true,
              autofillHints: const [AutofillHints.password],
              decoration: const InputDecoration(labelText: 'Password'),
              onSubmitted: (_) => _login(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _tenant,
              decoration: const InputDecoration(
                labelText: 'Shop slug (x-tenant-id)',
                hintText: 'e.g. myshop',
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => setState(() => _showAdvanced = !_showAdvanced),
              child: Text(_showAdvanced ? 'Hide API settings' : 'API settings'),
            ),
            if (_showAdvanced) ...[
              TextField(
                controller: _api,
                decoration: const InputDecoration(
                  labelText: 'API base URL',
                  hintText: 'http://10.0.2.2:3001/api/v1',
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Android emulator → 10.0.2.2 · iOS sim → localhost · Device → PC LAN IP',
                style: TextStyle(fontSize: 12, color: muted),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _login,
              child: _busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Sign in'),
            ),
          ],
        ),
      ),
    );
  }
}

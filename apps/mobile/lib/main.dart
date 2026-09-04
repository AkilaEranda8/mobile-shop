import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/auth_store.dart';
import 'ui/home_screen.dart';
import 'ui/login_screen.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final auth = AuthStore();
  await auth.load();
  final api = ApiClient(auth);
  runApp(
    MultiProvider(
      providers: [
        Provider.value(value: auth),
        Provider.value(value: api),
      ],
      child: HexalyteRepApp(loggedIn: auth.isLoggedIn),
    ),
  );
}

class HexalyteRepApp extends StatelessWidget {
  const HexalyteRepApp({super.key, required this.loggedIn});

  final bool loggedIn;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hexalyte Rep',
      debugShowCheckedModeBanner: false,
      theme: HxTheme.light(),
      home: loggedIn ? const HomeScreen() : const LoginScreen(),
    );
  }
}

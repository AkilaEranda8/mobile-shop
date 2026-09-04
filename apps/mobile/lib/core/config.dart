/// Runtime config. Override with:
/// flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001/api/v1
class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001/api/v1',
  );
}

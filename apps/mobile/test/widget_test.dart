import 'package:flutter_test/flutter_test.dart';
import 'package:hexalyte_rep/core/config.dart';

void main() {
  test('API base URL has a default', () {
    expect(AppConfig.apiBaseUrl.contains('/api/v1'), isTrue);
  });
}

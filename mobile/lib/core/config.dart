import 'settings.dart';

/// Where the Django backend lives. Release builds use the live site; a test build is pointed at a computer with
///   flutter run --dart-define=API_URL=http://10.0.2.2:8000
/// (10.0.2.2 is the computer itself, seen from the Android emulator; use its Wi-Fi address for a real phone).
const _builtIn = String.fromEnvironment('API_URL', defaultValue: 'https://zemalearn.com');

String _trim(String url) => url.trim().replaceFirst(RegExp(r'/+$'), '');

final builtInApiUrl = _trim(_builtIn);

/// A test build talks plain http to a computer on the local network; its address can change, so Me lets it be set.
final isTestBuild = builtInApiUrl.startsWith('http://');

/// The server to talk to: the address set under Me (test builds only), else the one built in.
String apiUrl() {
  final custom = isTestBuild ? _trim(settings.serverUrl) : '';
  return custom.isNotEmpty ? custom : builtInApiUrl;
}

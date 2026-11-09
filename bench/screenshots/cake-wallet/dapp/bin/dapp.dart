import 'dart:convert';
import 'dart:io';

import 'package:openlv/openlv.dart';

Future<void> main(List<String> args) async {
  final out = args[0];
  final server = args[1];
  final session = await OpenLv.dapp(
    protocol: OpenLvProtocol.mqtt,
    server: server,
    info: const PeerInfo(identity: 'example.openlv.sh', name: 'Example dApp'),
    onRequest: (m) async => {
      'jsonrpc': '2.0',
      'id': (m as Map)['id'],
      'error': {'code': -32601, 'message': 'Method not found'},
    },
  );
  await session.connect();
  File(out).writeAsStringSync(session.uri);
  stdout.writeln('URL ${session.uri}');
  await session.waitForLink();
  stdout.writeln('LINKED');
  try {
    final r = await session.sendWithTimeouts(
      {'jsonrpc': '2.0', 'id': 1, 'method': 'eth_requestAccounts', 'params': []},
      responseTimeout: const Duration(minutes: 10),
    );
    stdout.writeln('RESP ${jsonEncode(r)}');
  } catch (e) {
    stdout.writeln('SEND ERROR $e');
  }
  while (!File('$out.stop').existsSync()) {
    await Future<void>.delayed(const Duration(seconds: 1));
  }
  await session.close();
}

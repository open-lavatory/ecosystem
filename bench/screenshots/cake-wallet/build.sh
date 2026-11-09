#!/usr/bin/env bash
set -euxo pipefail

export FLUTTER_ROOT CARGO_HTTP_CAINFO=$NIX_SSL_CERT_FILE CARGO_BUILD_JOBS=2
FLUTTER_ROOT=$(dirname "$(dirname "$(which flutter)")")

grep -rl '^#!/bin/bash' scripts ./*.sh | xargs sed -i '1s|^#!/bin/bash|#!/usr/bin/env bash|'
rustup default stable

bash scripts/prepare_reown.sh || true
grep -rIl '^#!/bin/bash' scripts/reown_flutter --include=*.sh | xargs sed -i '1s|^#!/bin/bash|#!/usr/bin/env bash|'
(cd scripts/reown_flutter && bash scripts/generate_all.sh)
(cd scripts && git clone https://github.com/mrcyjanek/torch_dart && cd torch_dart && git checkout 0aa029e4dce8162d0650918f1ac5ada6df87f991 && git submodule update --init --force --recursive)

cp -rf pubspec_description.yaml pubspec.yaml
flutter pub get
dart run tool/generate_pubspec.dart
flutter pub get
dart run tool/configure.dart --ethereum --excludeFlutterSecureStorage
dart run tool/generate_new_secrets.dart
for pkg in cw_core cw_evm; do (cd "$pkg" && flutter pub get && dart run build_runner build); done
flutter pub get
dart run build_runner build
dart run tool/generate_localization.dart

engine=$FLUTTER_ROOT/bin/cache/artifacts/engine/linux-x64
work=$(mktemp -d)
while read -r dir; do
  out="assets/new-ui${dir#res/pictures}"
  svgs=$(mktemp -d "$work/XXXXXX")
  mkdir -p "$out"
  find "$dir" -maxdepth 1 -type f -name "*.svg" -exec cp {} "$svgs" ";"
  dart run vector_graphics_compiler --libpathops "$engine/libpath_ops.so" --libtessellator "$engine/libtessellator.so" --input-dir "$svgs" --out-dir "$out"
done < <(find res/pictures -type d)

mkdir -p scripts/monero_c/release/x86_64-linux-gnu scripts/zcash_lib/target/release
: > scripts/monero_c/release/x86_64-linux-gnu/libmonero_wallet2_api_c.so
: > scripts/monero_c/release/x86_64-linux-gnu/libwownero_wallet2_api_c.so
: > scripts/zcash_lib/target/release/libwarp_api_ffi.so

flutter build linux --debug

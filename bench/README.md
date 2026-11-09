# bench

Checks openlv in each app of `apps/` against a scripted test wallet, over a local mosquitto relay and local anvil chains.

```sh
nix run ./bench                                  # every app and the self test
nix run ./bench -- --app try-it-out              # one app
nix run ./bench -- --feature personal_sign       # one feature in every app
nix run ./bench -- --app wallet-page --headed    # other flags go to playwright test
```

Results print as a matrix of apps and features and land in `bench/.out/matrix.md`; traces of failed tests are in `bench/.out/results`.
An app is one JSON file in `apps/`, checked against `apps/descriptor.schema.json`; run `pnpm schema` after changing `runner/descriptor.ts`.

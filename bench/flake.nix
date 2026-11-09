{
  description = "openlv bench for patched apps and existing dApps";

  inputs = {
    root.url = "path:..";
    nixpkgs.follows = "root/nixpkgs";
    open-lavatory = {
      url = "github:open-lavatory/open-lavatory";
      flake = false;
    };
  };

  outputs = {
    nixpkgs,
    open-lavatory,
    ...
  }: let
    inherit (nixpkgs) lib;
    forAllSystems = f:
      lib.genAttrs ["x86_64-linux" "aarch64-linux"] (system: f nixpkgs.legacyPackages.${system});
    tools = pkgs: with pkgs; [nodejs_24 pnpm_10 mosquitto foundry git xvfb xdotool xclip imagemagick];
    env = pkgs: {
      BENCH_CHROMIUM = lib.getExe pkgs.chromium;
      BENCH_INPUT_OPEN_LAVATORY = "${open-lavatory}";
    };
  in {
    devShells = forAllSystems (pkgs: {
      default = pkgs.mkShell ({packages = tools pkgs;} // env pkgs);
    });
    apps = forAllSystems (pkgs: {
      default = {
        type = "app";
        program = lib.getExe (pkgs.writeShellApplication {
          name = "bench";
          runtimeInputs = tools pkgs;
          runtimeEnv = env pkgs;
          text = ''
            cd "$(git rev-parse --show-toplevel)/bench"
            pnpm install --frozen-lockfile --reporter=silent
            exec node runner/cli.ts "$@"
          '';
        });
      };
    });
  };
}

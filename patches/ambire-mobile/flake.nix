{
  inputs = {
    root.url = "path:../..";
    upstream = {
      url = "github:AmbireTech/extension/main";
      flake = false;
    };
    # The src/ambire-common submodule at the commit upstream pins. Its .gitmodules URL is SSH, so
    # `submodules=1` can't fetch it; bump this rev with upstream.
    ambire-common = {
      url = "github:AmbireTech/ambire-common/d10cd4dfc4f589fa419a632fffbc8d6cd79c78b5";
      flake = false;
    };
  };

  outputs = {
    root,
    upstream,
    ambire-common,
    ...
  }: let
    app = root.lib.app {
      inherit upstream;
      dir = ./.;
      tools = pkgs: [pkgs.nodejs_24 pkgs.yarn] ++ pkgs.lib.optional pkgs.stdenv.hostPlatform.isDarwin pkgs.cocoapods;
    };
  in
    app
    // {
      devShells =
        builtins.mapAttrs (_: shells: {
          default = shells.default.overrideAttrs (old: {
            shellHook =
              old.shellHook
              + ''
                if [ ! -e src/src/ambire-common/package.json ]; then
                  mkdir -p src/src/ambire-common
                  cp -r ${ambire-common}/. src/src/ambire-common
                  chmod -R u+w src/src/ambire-common
                fi
              '';
          });
        })
        app.devShells;
    };
}

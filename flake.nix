{
  description = "openlv patches for open-source apps";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {nixpkgs, ...}: let
    inherit (nixpkgs) lib;
    forAllSystems = f:
      lib.genAttrs lib.systems.flakeExposed (system: f nixpkgs.legacyPackages.${system});
  in {
    lib.app = {
      upstream,
      dir,
      tools,
    }: let
      patched = pkgs:
        pkgs.applyPatches {
          src = upstream;
          name = "source";
          patches = map (name: dir + "/${name}") (
            builtins.attrNames (lib.filterAttrs (name: _: lib.hasSuffix ".patch" name) (builtins.readDir dir))
          );
        };
    in {
      packages = forAllSystems (pkgs: {default = patched pkgs;});
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = tools pkgs;
          shellHook = ''
            if [ ! -d src ]; then
              cp -r ${patched pkgs} src
              chmod -R u+w src
            fi
          '';
        };
      });
    };
  };
}

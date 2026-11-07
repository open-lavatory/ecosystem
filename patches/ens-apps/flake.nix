{
  inputs = {
    root.url = "path:../..";
    upstream = {
      url = "github:ensdomains/apps-monorepo/48ea17b253def0528e26d2a6e2f7a9c36596ebb4";
      flake = false;
    };
  };

  outputs = {
    root,
    upstream,
    ...
  }:
    root.lib.app {
      inherit upstream;
      dir = ./.;
      tools = pkgs: [pkgs.nodejs_24 pkgs.pnpm_12];
    };
}

{
  inputs = {
    root.url = "path:../..";
    upstream = {
      url = "github:safe-global/safe-wallet-monorepo/main";
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
      tools = pkgs: [pkgs.nodejs_24 pkgs.yarn-berry] ++ pkgs.lib.optional pkgs.stdenv.hostPlatform.isDarwin pkgs.cocoapods;
    };
}

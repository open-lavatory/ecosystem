{
  inputs = {
    root.url = "path:../..";
    upstream = {
      url = "github:rainbow-me/rainbowkit?ref=refs/tags/@rainbow-me/rainbowkit@2.2.11";
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
      tools = pkgs: [pkgs.nodejs_24 pkgs.pnpm_10];
    };
}

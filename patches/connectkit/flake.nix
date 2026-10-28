{
  inputs = {
    root.url = "path:../..";
    upstream = {
      url = "github:family/connectkit?ref=release/v1.9.2";
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
      tools = pkgs: [pkgs.nodejs_22 pkgs.yarn];
    };
}

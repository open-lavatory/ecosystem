{
  inputs = {
    root.url = "path:../..";
    upstream = {
      url = "github:cake-tech/cake_wallet/8a81db52bca62ee372eda34b2357db2afb5acd15";
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
      tools = pkgs:
        with pkgs; [
          flutter341
          rustup
          clang
          cmake
          ninja
          pkg-config
          gtk3
        ];
    };
}

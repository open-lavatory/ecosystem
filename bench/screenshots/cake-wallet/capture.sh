#!/usr/bin/env bash
set -euo pipefail

out=$1
here=$(cd "$(dirname "$0")" && pwd)
bundle=$PWD/build/linux/x64/debug/bundle
work=$(mktemp -d)
pass=openlv-bench
pids=()

cleanup() {
  touch "$work/uri.stop" 2>/dev/null || true
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

display=90
while [ -e "/tmp/.X11-unix/X$display" ]; do display=$((display + 1)); done
export DISPLAY=:$display
port=18831
while (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; do port=$((port + 1)); done

Xvfb "$DISPLAY" -screen 0 1920x1800x24 -nolisten tcp >"$work/xvfb.log" 2>&1 & pids+=($!)
printf 'listener %s 127.0.0.1\nallow_anonymous true\n' "$port" >"$work/mosquitto.conf"
mosquitto -c "$work/mosquitto.conf" >"$work/mosquitto.log" 2>&1 & pids+=($!)
for _ in $(seq 1 30); do
  [ -S "/tmp/.X11-unix/X$display" ] && (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && break
  sleep 1
done

shot() { import -window root "$work/root.png"; magick "$work/root.png" -crop 780x1688+0+0 +repage "$1"; }
click() { xdotool mousemove "$1" "$2"; sleep 0.3; xdotool click 1; }
park() { xdotool mousemove 390 1250; }
settle() {
  sleep "$1"
  shot "$work/a.png"
  local same=0
  for _ in $(seq 1 15); do
    sleep 4
    shot "$work/b.png"
    if [ "$(compare -metric AE "$work/a.png" "$work/b.png" null: 2>&1 || true)" = "0 (0)" ]; then
      same=$((same + 1))
      [ "$same" -ge 3 ] && return 0
    else
      same=0
      cp "$work/b.png" "$work/a.png"
    fi
  done
  return 0
}

mkdir -p "$work/home"
(cd "$bundle" && GDK_SCALE=2 LIBGL_ALWAYS_SOFTWARE=1 HOME=$work/home exec ./cake_wallet) >"$work/app.log" 2>&1 & pids+=($!)
for _ in $(seq 1 60); do
  window=$(xdotool search --name '^Cake Wallet$' 2>/dev/null | head -1 || true)
  [ -n "$window" ] && break
  sleep 2
done
[ -n "$window" ] || { echo "no Cake Wallet window"; exit 1; }
sleep 10
xdotool windowmove "$window" 0 0
xdotool windowsize "$window" 780 1688
vm=$(grep -o 'http://127.0.0.1:[0-9]*/[^ ]*/' "$work/app.log" | head -1)

settle 40
click 391 1568; settle 25
click 391 1568; settle 25
click 173 773; sleep 2; xdotool type --delay 80 Ethereum
click 173 877; sleep 2; xdotool type --delay 80 "$pass"
click 173 982; sleep 2; xdotool type --delay 80 "$pass"
settle 20
click 391 1595; settle 90
click 698 750; sleep 3; click 698 903; sleep 3; click 698 1055; settle 20
click 391 1622; settle 25
click 391 1480; settle 90
click 711 54; settle 30
click 259 303; settle 30
click 233 364; settle 45

dapp_dir=$PWD/../dapp
rm -rf "$dapp_dir/bin" && mkdir -p "$dapp_dir" && cp -r "$here/dapp/." "$dapp_dir/"
(cd "$dapp_dir" && dart pub get >/dev/null)

request() {
  rm -f "$work/uri" "$work/uri.stop"
  (cd "$dapp_dir" && exec dart run bin/dapp.dart "$work/uri" "mqtt://127.0.0.1:$port") >"$work/dapp.log" 2>&1 &
  local dapp=$!
  for _ in $(seq 1 450); do [ -s "$work/uri" ] && break; sleep 2; done
  [ -s "$work/uri" ] || { echo "the dApp gave no connection URL"; tail -20 "$work/dapp.log"; exit 1; }
  xclip -selection clipboard -i "$work/uri" >/dev/null 2>&1 & pids+=($!)
  sleep 1
  click 391 1609; settle 30
  click 666 877; park; settle 25
  click 391 1027; park; settle 60
  : >"$work/frames.txt"
  for frame in 1 2 3 4 5 6 7 8; do
    shot "$work/frame$frame.png"
    echo "$(magick "$work/frame$frame.png" -crop 300x60+240+1527 +repage -colorspace Gray -format '%[fx:standard_deviation*1000000]' info:) $frame" >>"$work/frames.txt"
    sleep 5
  done
  cp "$work/frame$(awk '{ count[$1]++; first[$1] = first[$1] ? first[$1] : $2 } END { for (label in count) if (count[label] > most) { most = count[label]; pick = first[label] } print pick }' "$work/frames.txt").png" "$out-$1.png"
  click 72 242; park; settle 40
  touch "$work/uri.stop"
  sleep 3
  kill "$dapp" 2>/dev/null || true
}

request dark
node "$here/set-theme.mjs" "$vm" light
park; settle 60
request light

#!/bin/zsh
set -e

cd "$(dirname "$0")"

KANBAN_HOST="${KANBAN_HOST:-127.0.0.1}"
PORT="${PORT:-5173}"
NPM_VERSION="${NPM_VERSION:-10.9.4}"

pause_on_error() {
  local exit_code=$?

  if [ "$exit_code" -ne 0 ]; then
    echo ""
    echo "Startup failed. Press any key to close this window."
    read -k 1
  fi

  exit "$exit_code"
}

find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi

  local codex_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  if [ -x "$codex_node" ]; then
    echo "$codex_node"
    return
  fi

  echo ""
}

run_npm() {
  if command -v npm >/dev/null 2>&1; then
    npm "$@"
    return
  fi

  local npm_cli=".tools/npm/package/bin/npm-cli.js"
  if [ ! -f "$npm_cli" ]; then
    echo "npm was not found. Downloading a local npm copy..."
    mkdir -p .tools/npm
    curl -L --fail "https://registry.npmjs.org/npm/-/npm-${NPM_VERSION}.tgz" -o .tools/npm.tgz
    rm -rf .tools/npm/package
    tar -xzf .tools/npm.tgz -C .tools/npm
    rm .tools/npm.tgz
  fi

  "$NODE_BIN" "$npm_cli" "$@"
}

trap pause_on_error EXIT

NODE_BIN="$(find_node)"
if [ -z "$NODE_BIN" ]; then
  echo "Node.js was not found. Install Node.js 20+ first, then double-click this file again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  run_npm install
fi

if [[ "$NODE_BIN" == *"codex-primary-runtime"* ]]; then
  export NAPI_RS_FORCE_WASI="${NAPI_RS_FORCE_WASI:-1}"

  if [ ! -d node_modules/@rolldown/binding-wasm32-wasi ]; then
    ROLLDOWN_VERSION="$("$NODE_BIN" -e 'const fs = require("fs"); const path = "node_modules/rolldown/package.json"; process.stdout.write(fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")).version : "");')"

    if [ -n "$ROLLDOWN_VERSION" ]; then
      echo "Installing the local Vite runtime..."
      run_npm install --no-save --force "@rolldown/binding-wasm32-wasi@${ROLLDOWN_VERSION}"
    fi
  fi
fi

while command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://${KANBAN_HOST}:${PORT}/"

echo "Starting local kanban at ${URL}"
echo "Leave this window open while you use the app."

if [ "${OPEN_BROWSER:-1}" != "0" ]; then
  (sleep 2 && open "$URL" >/dev/null 2>&1) &
fi

"$NODE_BIN" ./node_modules/vite/bin/vite.js --host "$KANBAN_HOST" --port "$PORT"

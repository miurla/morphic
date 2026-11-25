#!/usr/bin/env bash
set -euo pipefail

model_file=/tmp/bge-m3.gguf
model_sha256=daec91ffb5dd0c27411bd71f29932917c49cf529a641d0168496c3a501e3062c
license_file=/usr/share/licenses/tutor-embedding/LICENSE.bge-m3
license_sha256=a406579cd136771c705c521db86ca7d60a6f3de7c9b5460e6193a2df27861bde

printf '%s  %s\n' "$model_sha256" "$model_file" | sha256sum --check --status
printf '%s  %s\n' "$license_sha256" "$license_file" | sha256sum --check --status

# Fail closed if the Dockerfile's import configuration changes unexpectedly.
test "${OLLAMA_MODELS:-}" = /opt/tutor-models
test "${OLLAMA_HOST:-}" = 127.0.0.1:11434
test "${OLLAMA_NO_CLOUD:-}" = 1
mkdir -p "$OLLAMA_MODELS"
build_directory=$(mktemp -d /tmp/tutor-model-build.XXXXXX)
server_log="$build_directory/ollama.log"
modelfile="$build_directory/Modelfile"
server_pid=''

cleanup() {
  local status=$?
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [[ "$status" -ne 0 && -f "$server_log" ]]; then
    cat "$server_log" >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ollama serve >"$server_log" 2>&1 &
server_pid=$!
server_ready=0
for ((attempt = 0; attempt < 120; attempt++)); do
  if ollama list >/dev/null 2>&1; then
    server_ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    printf '%s\n' 'The model import server exited before becoming ready.' >&2
    exit 1
  fi
  sleep 0.25
done
if [[ "$server_ready" -ne 1 ]]; then
  printf '%s\n' 'The model import server did not become ready within 30 seconds.' >&2
  exit 1
fi

{
  printf 'FROM %s\nLICENSE """\n' "$model_file"
  cat "$license_file"
  printf '\n"""\n'
} >"$modelfile"

ollama create bge-m3 -f "$modelfile"
ollama show bge-m3 >/dev/null
# Import must retain the exact pinned GGUF; no conversion or quantization.
printf '%s  %s/blobs/sha256-%s\n' \
  "$model_sha256" "$OLLAMA_MODELS" "$model_sha256" | sha256sum --check --status
printf '%s\n' 'BGE-M3 is installed in /opt/tutor-models.'

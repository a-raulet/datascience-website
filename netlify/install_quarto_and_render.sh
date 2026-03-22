#!/usr/bin/env bash
set -euo pipefail

QUARTO_VERSION="${QUARTO_VERSION:-1.8.25}"
TMPDIR="$(mktemp -d)"
ARCHIVE="$TMPDIR/quarto.tar.gz"
DOWNLOAD_URL="https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.tar.gz"

echo "Installing Quarto v${QUARTO_VERSION} to ${TMPDIR}..."
curl -L -o "$ARCHIVE" "$DOWNLOAD_URL"
tar -xzf "$ARCHIVE" -C "$TMPDIR"

QUARTO_BIN="$TMPDIR/quarto-${QUARTO_VERSION}/bin/quarto"
"$QUARTO_BIN" --version
"$QUARTO_BIN" render

rm -rf "$TMPDIR"

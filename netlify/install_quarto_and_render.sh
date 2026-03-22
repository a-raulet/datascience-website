#!/usr/bin/env bash
set -euo pipefail

VERSION=${QUARTO_VERSION:-1.8.25}
echo "Installing Quarto v${VERSION}..."

curl -L "https://github.com/quarto-dev/quarto-cli/releases/download/v${VERSION}/quarto-${VERSION}-linux-amd64.tar.gz" -o quarto.tar.gz
tar -xzf quarto.tar.gz
export PATH="$PWD/quarto-${VERSION}/bin:$PATH"

quarto --version
quarto render

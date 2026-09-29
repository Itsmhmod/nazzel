#!/usr/bin/env bash

# Nazzel Terminal Installer (macOS/Linux)
# https://github.com/Itsmhmod/nazzel

set -euo pipefail

REPO="Itsmhmod/nazzel"
INSTALL_DIR="${HOME}/.local/bin"
EXE_NAME="nazzel"

# 1. Detect OS and Architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
    darwin)
        PLATFORM="darwin"
        ;;
    linux)
        PLATFORM="linux"
        ;;
    *)
        echo "Error: Unsupported OS '$OS'"
        exit 1
        ;;
esac

case "$ARCH" in
    x86_64|amd64)
        TARGET_ARCH="x64"
        ;;
    aarch64|arm64)
        TARGET_ARCH="arm64"
        ;;
    *)
        echo "Error: Unsupported architecture '$ARCH'"
        exit 1
        ;;
esac

TARGET_NAME="nazzel-[VERSION]-${PLATFORM}-${TARGET_ARCH}"
# Will resolve actual version shortly

echo "=> Detecting latest stable release for $PLATFORM-$TARGET_ARCH..."

# 2. Resolve Latest Release
LATEST_RELEASE_URL="https://api.github.com/repos/${REPO}/releases/latest"
RELEASE_JSON=$(curl -s "$LATEST_RELEASE_URL")

if ! echo "$RELEASE_JSON" | grep -q '"tag_name":'; then
    echo "Error: Could not fetch latest release. Rate limit or network issue?"
    exit 1
fi

VERSION=$(echo "$RELEASE_JSON" | grep -m 1 '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//')
TAG="v${VERSION}"
echo "=> Found Nazzel v${VERSION}"

EXACT_ASSET_NAME="nazzel-${VERSION}-${PLATFORM}-${TARGET_ARCH}"
ASSET_DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${EXACT_ASSET_NAME}"
CHECKSUMS_URL="https://github.com/${REPO}/releases/download/${TAG}/SHA256SUMS"

# 3. Create temp directory
TMP_DIR=$(mktemp -d -t nazzel-install-XXXXXX)
cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cd "$TMP_DIR"

# 4. Download Binary and Checksums
echo "=> Downloading binary..."
curl -# -L -o "$EXACT_ASSET_NAME" "$ASSET_DOWNLOAD_URL"

echo "=> Downloading checksums..."
curl -sSL -o SHA256SUMS "$CHECKSUMS_URL"

# 5. Verify Integrity
echo "=> Verifying integrity..."
if ! grep "$EXACT_ASSET_NAME" SHA256SUMS > "${EXACT_ASSET_NAME}.sha256"; then
    echo "Error: Checksum for $EXACT_ASSET_NAME not found in SHA256SUMS."
    exit 1
fi

if type shasum >/dev/null 2>&1; then
    if ! shasum -a 256 -c "${EXACT_ASSET_NAME}.sha256"; then
        echo "Error: Checksum mismatch! Download may be corrupted or compromised."
        exit 1
    fi
elif type sha256sum >/dev/null 2>&1; then
    if ! sha256sum -c "${EXACT_ASSET_NAME}.sha256"; then
        echo "Error: Checksum mismatch! Download may be corrupted or compromised."
        exit 1
    fi
else
    echo "Warning: Neither shasum nor sha256sum found. Skipping integrity verification."
fi

echo "=> Checksum verified."

# 6. Install Atomically
echo "=> Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

chmod +x "$EXACT_ASSET_NAME"

# Atomic replace
mv -f "$EXACT_ASSET_NAME" "${INSTALL_DIR}/${EXE_NAME}"

# 7. Check PATH
echo ""
if command -v nazzel >/dev/null 2>&1; then
    echo "=> Successfully installed Nazzel v${VERSION}."
    nazzel --version
    echo "=> Nazzel is ready! Run 'nazzel --help' to get started."
else
    echo "=> Successfully installed Nazzel v${VERSION} to $INSTALL_DIR"
    echo ""
    echo "⚠️  WARNING: '$INSTALL_DIR' is not in your PATH."
    echo "You must add it to your shell profile."
    echo ""
    echo "For Bash (~/.bashrc):"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    echo "For Zsh (~/.zshrc):"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    echo "After updating your profile, restart your terminal or run:"
    echo "  source ~/.zshrc  # or ~/.bashrc"
    echo "  nazzel --help"
fi

#!/bin/bash
# generate-dev-certs.sh
# Generates a self-signed TLS certificate for LOCAL DEVELOPMENT ONLY.
# For production, use Let's Encrypt (certbot) or your certificate provider.
#
# Usage:
#   bash infrastructure/nginx/certs/generate-dev-certs.sh
#
# Output:
#   infrastructure/nginx/certs/server.crt
#   infrastructure/nginx/certs/server.key

set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_FILE="$CERT_DIR/server.crt"
KEY_FILE="$CERT_DIR/server.key"
DAYS_VALID=825  # ~2 years (max browsers will trust for self-signed)

echo "🔐 Generating self-signed TLS certificate for local development..."
echo "   Output: $CERT_FILE"

openssl req -x509 -nodes \
  -days "$DAYS_VALID" \
  -newkey rsa:4096 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/C=US/ST=Local/L=Local/O=PandaHub Dev/CN=localhost" \
  -extensions v3_req \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo ""
echo "✅ Certificate generated!"
echo ""
echo "   ⚠️  IMPORTANT: This is a DEVELOPMENT-ONLY self-signed certificate."
echo "   Browsers will show a security warning. This is expected for local dev."
echo "   For production, use Let's Encrypt:"
echo "     certbot certonly --webroot -w /var/www/certbot -d yourdomain.com"
echo "   Then update nginx.conf ssl_certificate paths."
echo ""
echo "   To trust this cert in Chrome (macOS/Linux):"
echo "     Open Chrome → chrome://settings/certificates → Authorities → Import $CERT_FILE"

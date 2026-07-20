#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"
readonly LAYER_NAME="sharp-layer"
readonly LAYER_DIR="/tmp/sharp-layer"
readonly ZIP_FILE="/tmp/sharp-layer.zip"

GREEN='\033[0;32m'
BLUE='\033[1;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Sharp Lambda Layer Builder${NC}"
echo -e "${BLUE}========================================${NC}"

rm -rf "$LAYER_DIR"
mkdir -p "$LAYER_DIR/nodejs"

cd "$LAYER_DIR/nodejs"

npm init -y > /dev/null 2>&1
npm install --arch=x64 --platform=linux sharp > /dev/null 2>&1

cd "$LAYER_DIR"
zip -qr "$ZIP_FILE" nodejs/

LAYER_VERSION=$(aws lambda publish-layer-version \
  --layer-name "$LAYER_NAME" \
  --zip-file fileb://"$ZIP_FILE" \
  --compatible-runtimes nodejs22.x \
  --compatible-architectures x86_64 \
  --region "$REGION" \
  --query 'LayerVersionArn' \
  --output text)

echo "$LAYER_VERSION" > layer-arn.txt

rm -rf "$LAYER_DIR" "$ZIP_FILE"

echo
echo -e "${GREEN}Layer ARN: $LAYER_VERSION${NC}"
echo -e "${GREEN}Saved to: layer-arn.txt${NC}"
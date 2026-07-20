#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"

GREEN='\033[0;32m'
BLUE='\033[1;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Test Upload Script${NC}"
echo -e "${BLUE}========================================${NC}"

BUCKET_NAME=$(cat bucket_name.txt 2>/dev/null || true)
if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}Error: bucket_name.txt not found${NC}"
    exit 1
fi

TEST_DIR="../assets"
mkdir -p "$TEST_DIR"

TEST_FILE="$TEST_DIR/test-$(date +%s).jpg"
echo "This is a test image file" > "$TEST_FILE"

echo "Uploading to s3://$BUCKET_NAME/uploads/"
aws s3 cp "$TEST_FILE" "s3://$BUCKET_NAME/uploads/" --region "$REGION"

echo
echo -e "${GREEN}Upload Complete${NC}"
echo -e "${GREEN}File     : $TEST_FILE${NC}"
echo -e "${GREEN}Bucket   : $BUCKET_NAME${NC}"
echo -e "${GREEN}Path     : s3://$BUCKET_NAME/uploads/${NC}"
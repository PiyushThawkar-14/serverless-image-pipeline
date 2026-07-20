#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"
readonly BUCKET_NAME="piyush-image-pipeline-$(date +%s)"

GREEN='\033[0;32m'
BLUE='\033[1;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     AWS S3 Bucket Creation Script${NC}"
echo -e "${BLUE}========================================${NC}"

echo "Bucket Name : $BUCKET_NAME"
echo "Region      : $REGION"
echo

aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"

aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled

echo "$BUCKET_NAME" > bucket_name.txt

echo
echo -e "${GREEN}S3 Bucket Created Successfully${NC}"
echo -e "${GREEN}Versioning Enabled${NC}"
echo -e "${GREEN}Bucket Name Saved → bucket_name.txt${NC}"
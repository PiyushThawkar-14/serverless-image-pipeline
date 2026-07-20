#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"
readonly FUNCTION_NAME="image-processor"

GREEN='\033[0;32m'
BLUE='\033[1;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    CloudWatch Logs Fetcher${NC}"
echo -e "${BLUE}========================================${NC}"

LOG_GROUP="/aws/lambda/$FUNCTION_NAME"

echo "Fetching logs from: $LOG_GROUP"
echo

LATEST_STREAM=$(aws logs describe-log-streams \
    --log-group-name "$LOG_GROUP" \
    --order-by LastEventTime \
    --descending \
    --limit 1 \
    --region "$REGION" \
    --query 'logStreams[0].logStreamName' \
    --output text)

if [ "$LATEST_STREAM" == "None" ] || [ -z "$LATEST_STREAM" ]; then
    echo -e "${YELLOW}No log streams found. Upload a file first!${NC}"
    exit 0
fi

echo "Latest Stream : $LATEST_STREAM"

aws logs get-log-events \
    --log-group-name "$LOG_GROUP" \
    --log-stream-name "$LATEST_STREAM" \
    --region "$REGION" \
    --query 'events[].message' \
    --output text

echo
echo -e "${GREEN}Logs Fetched Successfully${NC}"
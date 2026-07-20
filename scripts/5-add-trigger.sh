#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"
readonly FUNCTION_NAME="image-processor"

GREEN='\033[0;32m'
BLUE='\033[1;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    S3 Trigger Configuration Script${NC}"
echo -e "${BLUE}========================================${NC}"

BUCKET_NAME=$(cat bucket_name.txt 2>/dev/null || true)
if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}Error: bucket_name.txt not found${NC}"
    exit 1
fi

FUNCTION_ARN=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --query 'FunctionArn' \
    --output text)

echo "Bucket   : $BUCKET_NAME"
echo "Function : $FUNCTION_NAME"
echo "ARN      : $FUNCTION_ARN"
echo

aws s3api put-bucket-notification-configuration \
    --bucket "$BUCKET_NAME" \
    --notification-configuration '{
        "LambdaFunctionConfigurations": [
            {
                "LambdaFunctionArn": "'"$FUNCTION_ARN"'",
                "Events": ["s3:ObjectCreated:*"],
                "Filter": {
                    "Key": {
                        "FilterRules": [
                            {"Name": "prefix", "Value": "uploads/"}
                        ]
                    }
                }
            }
        ]
    }'

aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id s3-trigger-permission \
    --action lambda:InvokeFunction \
    --principal s3.amazonaws.com \
    --source-arn "arn:aws:s3:::$BUCKET_NAME" \
    --region "$REGION" 2>/dev/null || true

echo
echo -e "${GREEN}S3 Trigger Configured Successfully${NC}"
echo -e "${GREEN}Trigger: uploads/ folder → Lambda${NC}"
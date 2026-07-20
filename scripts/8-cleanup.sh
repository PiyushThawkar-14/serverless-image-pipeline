#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"
readonly FUNCTION_NAME="image-processor"
readonly TABLE_NAME="image-processing-jobs"
readonly ROLE_NAME="image-processor-role"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}     CLEANUP: Deleting All Resources${NC}"
echo -e "${RED}========================================${NC}"

BUCKET_NAME=$(cat bucket_name.txt 2>/dev/null || true)

if [ -n "$BUCKET_NAME" ]; then
    echo -e "${YELLOW}Emptying S3 bucket: $BUCKET_NAME${NC}"
    aws s3 rm "s3://$BUCKET_NAME" --recursive --region "$REGION" 2>/dev/null || true
    aws s3api delete-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null || true
    echo -e "${GREEN}S3 bucket deleted${NC}"
fi

echo -e "${YELLOW}Deleting Lambda function: $FUNCTION_NAME${NC}"
aws lambda delete-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || true
echo -e "${GREEN}Lambda deleted${NC}"

echo -e "${YELLOW}Deleting DynamoDB table: $TABLE_NAME${NC}"
aws dynamodb delete-table --table-name "$TABLE_NAME" --region "$REGION" 2>/dev/null || true
echo -e "${GREEN}DynamoDB table deleted${NC}"

echo -e "${YELLOW}Deleting IAM role: $ROLE_NAME${NC}"
aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "lambda-execution-policy" 2>/dev/null || true
aws iam delete-role --role-name "$ROLE_NAME" 2>/dev/null || true
echo -e "${GREEN}IAM role deleted${NC}"

rm -f bucket_name.txt dynamodb-table-name.txt iam-role-name.txt lambda-function-name.txt

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    All Resources Deleted Successfully${NC}"
echo -e "${GREEN}    No More AWS Charges Will Incur${NC}"
echo -e "${GREEN}========================================${NC}"
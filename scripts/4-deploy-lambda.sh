#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"
readonly FUNCTION_NAME="image-processor"
readonly ROLE_NAME="image-processor-role"
readonly LAMBDA_DIR="../lambda"
readonly RUNTIME="nodejs22.x"

GREEN='\033[0;32m'
BLUE='\033[1;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Lambda Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"

ROLE_ARN=$(aws iam get-role \
    --role-name "$ROLE_NAME" \
    --query 'Role.Arn' \
    --output text)

echo -e "${YELLOW}Role ARN: $ROLE_ARN${NC}"

cd "$LAMBDA_DIR"
zip function.zip process-image.mjs

cd - > /dev/null

aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --role "$ROLE_ARN" \
    --handler process-image.handler \
    --zip-file fileb://"$LAMBDA_DIR/function.zip" \
    --region "$REGION"

aws lambda wait function-active \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION"

echo "$FUNCTION_NAME" > lambda-function-name.txt
rm -f "$LAMBDA_DIR/function.zip"

echo
echo -e "${GREEN}Lambda Function Created Successfully${NC}"
echo -e "${GREEN}Function Name: $FUNCTION_NAME${NC}"
echo -e "${GREEN}Runtime      : $RUNTIME${NC}"
echo -e "${GREEN}Function Name Saved → lambda-function-name.txt${NC}"
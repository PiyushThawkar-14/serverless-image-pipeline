#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"
readonly TABLE_NAME="image-processing-jobs"

GREEN='\033[0;32m'
BLUE='\033[1;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}     AWS DynamoDB Table Creation Script${NC}"
echo -e "${BLUE}=================================================${NC}"

echo "Table Name : $TABLE_NAME"
echo "Region     : $REGION"
echo

aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions AttributeName=jobId,AttributeType=S \
    --key-schema AttributeName=jobId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" 

    aws dynamodb wait table-exists \
        --table-name "$TABLE_NAME" \
        --region "$REGION"

echo "$TABLE_NAME" > dynamodb-table-name.txt

echo
echo -e "${GREEN}DynamoDB Table Created Successfully${NC}"  
echo -e "${GREEN}Billing Mode: PAY_PER_REQUEST (free tier)${NC}"
echo -e "${GREEN}Table Name Saved → dynamodb-table-name.txt${NC}"
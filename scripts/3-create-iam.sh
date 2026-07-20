#!/usr/bin/env bash

set -euo pipefail

readonly REGION="ap-south-1"
readonly ROLE_NAME="image-processor-role"

GREEN='\033[0;32m'
BLUE='\033[1;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     IAM Role Creation Script${NC}"
echo -e "${BLUE}========================================${NC}"

echo "Role Name : $ROLE_NAME"
echo "Region    : $REGION"
echo

cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document file://trust-policy.json

cat > lambda-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "lambda-execution-policy" \
    --policy-document file://lambda-policy.json

aws iam wait role-exists \
    --role-name "$ROLE_NAME"

echo "$ROLE_NAME" > iam-role-name.txt
rm -f trust-policy.json lambda-policy.json

echo
echo -e "${GREEN}IAM Role Created Successfully${NC}"
echo -e "${GREEN}Role Name  : $ROLE_NAME${NC}"
echo -e "${GREEN}Policies Attached: S3, DynamoDB, CloudWatch, SNS${NC}"
echo -e "${GREEN}Role Name Saved → iam-role-name.txt${NC}"
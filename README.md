# Serverless Image Processing Pipeline

Resize + compress images uploaded to S3, store metadata in DynamoDB, and send SNS notifications.

## Architecture

User → S3 (uploads/) → Lambda (process-image) → S3 (processed/)
                                                   ↓
                                              DynamoDB (metadata)
                                                   ↓
                                              SNS (notification)

## Prerequisites

- AWS CLI configured
- Node.js 22.x runtime
- Sharp Lambda Layer deployed (see below)

## Setup

### 1. Create infrastructure

```bash
cd scripts
./1-create-bucket.sh
./2-create-dynamodb.sh
./3-create-iam.sh
2. Deploy Sharp Layer
./9-create-layer.sh
3. Update deploy script with Layer ARN
Open 4-deploy-lambda.sh and add --layers $(cat ../layer-arn.txt) to the create-function command.
4. Deploy Lambda & add trigger
./4-deploy-lambda.sh
./5-add-trigger.sh
5. Test
./6-upload-test.sh
./7-check-logs.sh
6. Cleanup
./8-cleanup.sh
Lambda Functions
Function	File	Trigger	Purpose
image-processor	process-image.mjs	S3 uploads/	Resize + compress + DDB + SNS
update-status	update-status.mjs	API Gateway (optional)	Update DDB status
Environment Variables
Variable	Default	Description
TABLE_NAME	image-metadata	DynamoDB table
SNS_TOPIC_ARN	—	SNS topic for notifications
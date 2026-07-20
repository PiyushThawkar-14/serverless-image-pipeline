# Serverless Image Processing Pipeline

A production-ready serverless image processing pipeline built on AWS. Images uploaded to Amazon S3 are automatically processed by AWS Lambda, metadata is stored in DynamoDB, and notifications are sent through Amazon SNS.

---

## Features

- Automatic image processing on upload
- Resize and compress images
- Store metadata in DynamoDB
- SNS notification after successful processing
- Fully serverless architecture
- AWS SDK v3
- Shell scripts for one-click deployment

---

## Architecture

```
                +----------------+
                |     User       |
                +-------+--------+
                        |
                        | Upload Image
                        v
                +----------------+
                |   Amazon S3    |
                |   uploads/     |
                +-------+--------+
                        |
                 S3 Event Trigger
                        |
                        v
                +----------------+
                | AWS Lambda     |
                | Image Processor|
                +-------+--------+
                        |
         +--------------+--------------+
         |                             |
         v                             v
+-------------------+          +-------------------+
| Processed Images  |          | DynamoDB          |
| processed/        |          | Image Metadata    |
+-------------------+          +-------------------+
                                        |
                                        v
                               +-------------------+
                               | Amazon SNS        |
                               | Notifications     |
                               +-------------------+
```

---

## Tech Stack

- AWS Lambda
- Amazon S3
- Amazon DynamoDB
- Amazon SNS
- Node.js 22
- AWS SDK v3
- Sharp

---

## Project Structure

```
.
├── lambda/
│   ├── process-image.mjs
│   └── update-status.mjs
│
├── scripts/
│   ├── 1-create-bucket.sh
│   ├── 2-create-dynamodb.sh
│   ├── 3-create-iam.sh
│   ├── 4-deploy-lambda.sh
│   ├── 5-add-trigger.sh
│   ├── 6-upload-test.sh
│   ├── 7-check-logs.sh
│   ├── 8-cleanup.sh
│   └── 9-create-layer.sh
│
└── README.md
```

---

## Prerequisites

Before deploying the project, ensure you have:

- AWS CLI configured
- Node.js 22.x
- IAM permissions for Lambda, S3, DynamoDB and SNS
- Sharp Lambda Layer

---

# Deployment

## Step 1 — Create Infrastructure

```bash
cd scripts

./1-create-bucket.sh
./2-create-dynamodb.sh
./3-create-iam.sh
```

---

## Step 2 — Create Sharp Layer

```bash
./9-create-layer.sh
```

The script generates:

```
layer-arn.txt
```

---

## Step 3 — Deploy Lambda

Edit

```
4-deploy-lambda.sh
```

and include the generated Layer ARN:

```bash
--layers $(cat ../layer-arn.txt)
```

Deploy Lambda:

```bash
./4-deploy-lambda.sh
```

---

## Step 4 — Configure S3 Trigger

```bash
./5-add-trigger.sh
```

---

## Step 5 — Upload Test Image

```bash
./6-upload-test.sh
```

---

## Step 6 — Verify Logs

```bash
./7-check-logs.sh
```

---

## Cleanup Resources

```bash
./8-cleanup.sh
```

---

# Lambda Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| image-processor | Amazon S3 | Processes uploaded images, stores metadata, publishes SNS notification |
| update-status | API Gateway (Optional) | Updates image processing status in DynamoDB |

---

# Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| TABLE_NAME | DynamoDB table name | image-metadata |
| SNS_TOPIC_ARN | SNS Topic ARN | Optional |

---

# Processing Flow

1. User uploads an image to **uploads/**.
2. S3 triggers the Lambda function.
3. Lambda resizes and compresses the image.
4. Processed image is saved to **processed/**.
5. Metadata is stored in DynamoDB.
6. SNS notification is published.

---

# Future Improvements

- Image watermarking
- Multiple image sizes
- Dead Letter Queue (DLQ)
- CloudWatch metrics
- AWS X-Ray tracing
- CI/CD using GitHub Actions
- Infrastructure as Code using Terraform or AWS CDK

---

# License

MIT License
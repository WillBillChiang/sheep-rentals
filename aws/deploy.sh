#!/bin/bash

# Sheep Rentals AWS Infrastructure Deployment Script

set -e

# Configuration
STACK_NAME="sheep-rentals-infrastructure"
ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}
PROJECT_NAME="sheep-rentals"

echo "🚀 Deploying Sheep Rentals infrastructure..."
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Stack Name: $STACK_NAME"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials are not configured. Please run 'aws configure' first."
    exit 1
fi

# Create S3 bucket for CloudFormation templates (if it doesn't exist)
BUCKET_NAME="sheep-rentals-cf-templates-$(aws sts get-caller-identity --query Account --output text)"
echo "📦 Creating/checking S3 bucket: $BUCKET_NAME"

if ! aws s3 ls "s3://$BUCKET_NAME" &> /dev/null; then
    aws s3 mb "s3://$BUCKET_NAME" --region $REGION
    echo "✅ Created S3 bucket: $BUCKET_NAME"
else
    echo "✅ S3 bucket already exists: $BUCKET_NAME"
fi

# Upload CloudFormation template to S3
echo "📤 Uploading CloudFormation template to S3..."
aws s3 cp cloudformation.yaml "s3://$BUCKET_NAME/cloudformation.yaml"

# Deploy CloudFormation stack
echo "🏗️ Deploying CloudFormation stack..."

aws cloudformation deploy \
    --template-url "https://$BUCKET_NAME.s3.$REGION.amazonaws.com/cloudformation.yaml" \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        Environment=$ENVIRONMENT \
        ProjectName=$PROJECT_NAME \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION \
    --no-fail-on-empty-changeset

echo "✅ CloudFormation stack deployed successfully!"

# Get stack outputs
echo "📋 Getting stack outputs..."
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs' \
    --output table

# Create environment file
echo "📝 Creating environment configuration..."
ENV_FILE="../backend/.env"
FRONTEND_ENV_FILE="../frontend/.env"

# Get stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

IMAGES_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ImagesBucketName`].OutputValue' \
    --output text)

USERS_TABLE=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UsersTableName`].OutputValue' \
    --output text)

PROPERTIES_TABLE=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`PropertiesTableName`].OutputValue' \
    --output text)

APPLICATIONS_TABLE=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApplicationsTableName`].OutputValue' \
    --output text)

PAYMENTS_TABLE=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`PaymentsTableName`].OutputValue' \
    --output text)

RENTAL_AGREEMENTS_TABLE=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`RentalAgreementsTableName`].OutputValue' \
    --output text)

# Create backend .env file
cat > $ENV_FILE << EOF
# AWS Configuration
AWS_REGION=$REGION
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# Cognito Configuration
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID

# S3 Configuration
S3_BUCKET_NAME=$IMAGES_BUCKET

# DynamoDB Table Names
USERS_TABLE=$USERS_TABLE
PROPERTIES_TABLE=$PROPERTIES_TABLE
APPLICATIONS_TABLE=$APPLICATIONS_TABLE
PAYMENTS_TABLE=$PAYMENTS_TABLE
RENTAL_AGREEMENTS_TABLE=$RENTAL_AGREEMENTS_TABLE

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
EOF

# Create frontend .env file
cat > $FRONTEND_ENV_FILE << EOF
# API Configuration
REACT_APP_API_URL=http://localhost:5000/api

# Cognito Configuration
REACT_APP_COGNITO_USER_POOL_ID=$USER_POOL_ID
REACT_APP_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID

# S3 Configuration
REACT_APP_S3_BUCKET=$IMAGES_BUCKET
REACT_APP_S3_REGION=$REGION
EOF

echo "✅ Environment files created:"
echo "   Backend: $ENV_FILE"
echo "   Frontend: $FRONTEND_ENV_FILE"

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update the AWS credentials in $ENV_FILE"
echo "2. Set a secure JWT_SECRET in $ENV_FILE"
echo "3. Install dependencies: npm run install-all"
echo "4. Start the development servers: npm run dev"
echo ""
echo "🔗 Useful AWS Console links:"
echo "   CloudFormation: https://console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks/stackinfo?stackId=$STACK_NAME"
echo "   DynamoDB: https://console.aws.amazon.com/dynamodb/home?region=$REGION"
echo "   S3: https://console.aws.amazon.com/s3/buckets/$IMAGES_BUCKET?region=$REGION"
echo "   Cognito: https://console.aws.amazon.com/cognito/users?region=$REGION" 
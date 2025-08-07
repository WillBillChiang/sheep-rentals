import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// DynamoDB configuration
export const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

// S3 configuration
export const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Cognito configuration
export const cognito = new AWS.CognitoIdentityServiceProvider({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Table names
export const TABLE_NAMES = {
  USERS: 'sheep-rentals-users',
  PROPERTIES: 'sheep-rentals-properties',
  APPLICATIONS: 'sheep-rentals-applications',
  PAYMENTS: 'sheep-rentals-payments',
  RENTAL_AGREEMENTS: 'sheep-rentals-rental-agreements'
};

// S3 bucket configuration
export const S3_CONFIG = {
  BUCKET_NAME: process.env.S3_BUCKET_NAME || 'sheep-rentals-images',
  REGION: process.env.AWS_REGION || 'us-east-1',
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  MAX_FILE_SIZE: 5 * 1024 * 1024 // 5MB
};

// Cognito configuration
export const COGNITO_CONFIG = {
  USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  CLIENT_ID: process.env.COGNITO_CLIENT_ID,
  REGION: process.env.AWS_REGION || 'us-east-1'
};

export default {
  dynamoDB,
  s3,
  cognito,
  TABLE_NAMES,
  S3_CONFIG,
  COGNITO_CONFIG
}; 
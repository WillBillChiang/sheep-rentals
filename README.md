# Sheep Rentals 🏠🐑

A comprehensive property rental platform connecting landlords and renters with powerful management tools.

## Features

### For Landlords

- Create and manage property listings with images, descriptions, and pricing
- Property management dashboard with payment tracking
- Monthly rent payment verification system
- Total earnings analytics
- Tenant application management

### For Renters

- Browse available properties with detailed information
- Apply directly to properties through the platform
- View application status and history
- User-friendly search and filtering

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: AWS DynamoDB
- **Storage**: AWS S3 (property images)
- **Authentication**: AWS Cognito
- **Deployment**: AWS Amplify

## Prerequisites

- Node.js 18+ and npm
- AWS Account with appropriate permissions
- AWS CLI configured

## Setup Instructions

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd sheep-rentals
   npm run install-all
   ```

2. **Configure AWS services:**

   - Set up DynamoDB tables
   - Configure S3 bucket for image storage
   - Set up Cognito User Pool
   - Configure environment variables

3. **Start development servers:**

   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

### Backend (.env)

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_CLIENT_ID=your_client_id
S3_BUCKET_NAME=your_s3_bucket
JWT_SECRET=your_jwt_secret
```

### Frontend (.env)

```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_COGNITO_USER_POOL_ID=your_user_pool_id
REACT_APP_COGNITO_CLIENT_ID=your_client_id
REACT_APP_S3_BUCKET=your_s3_bucket
```

## Project Structure

```
sheep-rentals/
├── frontend/          # React application
├── backend/           # Node.js API server
├── docs/             # Documentation
└── aws/              # AWS infrastructure as code
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
# sheep-rentals

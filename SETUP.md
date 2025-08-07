# Sheep Rentals - Setup Guide 🏠🐑

This guide will walk you through setting up the complete Sheep Rentals application with AWS infrastructure.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **AWS CLI** (v2 or higher)
- **Git**

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd sheep-rentals

# Install all dependencies
npm run install-all
```

### 2. AWS Infrastructure Setup

#### Configure AWS CLI

```bash
# Configure your AWS credentials
aws configure

# Enter your AWS Access Key ID, Secret Access Key, Region, and output format
```

#### Deploy AWS Infrastructure

```bash
# Navigate to AWS directory
cd aws

# Make the deployment script executable
chmod +x deploy.sh

# Deploy infrastructure (dev environment, us-east-1 region)
./deploy.sh dev us-east-1
```

This will create:

- DynamoDB tables for users, properties, applications, payments, and rental agreements
- S3 bucket for image storage
- Cognito User Pool for authentication
- IAM roles and policies

### 3. Configure Environment Variables

The deployment script will create `.env` files, but you need to update them with your AWS credentials:

#### Backend (.env)

```bash
# Update these values in backend/.env
AWS_ACCESS_KEY_ID=your_actual_access_key
AWS_SECRET_ACCESS_KEY=your_actual_secret_key
JWT_SECRET=your_secure_jwt_secret_here
```

#### Frontend (.env)

```bash
# The frontend .env should be automatically configured
# Verify the values are correct
```

### 4. Start Development Servers

```bash
# Start both backend and frontend servers
npm run dev
```

This will start:

- Backend API server on http://localhost:5000
- Frontend React app on http://localhost:3000

## Detailed Setup

### Backend Setup

The backend is a Node.js/Express API with TypeScript:

```bash
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev
```

**Key Features:**

- Express.js with TypeScript
- AWS DynamoDB for database
- AWS S3 for file storage
- AWS Cognito for authentication
- JWT token management
- File upload handling
- Comprehensive error handling

### Frontend Setup

The frontend is a React application with TypeScript:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

**Key Features:**

- React 18 with TypeScript
- Tailwind CSS for styling
- React Query for data fetching
- React Hook Form for forms
- React Router for navigation
- Responsive design
- Modern UI components

### AWS Services Configuration

#### DynamoDB Tables

The following tables are created:

- `sheep-rentals-users-dev` - User profiles and authentication
- `sheep-rentals-properties-dev` - Property listings
- `sheep-rentals-applications-dev` - Rental applications
- `sheep-rentals-payments-dev` - Payment tracking
- `sheep-rentals-rental-agreements-dev` - Rental agreements

#### S3 Bucket

- `sheep-rentals-images-dev` - Stores property images and user uploads
- Configured with CORS for web access
- Public read access for images

#### Cognito User Pool

- User registration and authentication
- Email verification
- Password reset functionality
- Custom user attributes for user type (landlord/renter)

## Application Features

### For Landlords

1. **Property Management**

   - Create and edit property listings
   - Upload multiple images
   - Set pricing and details
   - Manage property status

2. **Application Management**

   - View rental applications
   - Approve/reject applications
   - Communicate with renters

3. **Payment Tracking**

   - Track rent payments
   - Mark payments as received
   - View payment history
   - Generate reports

4. **Dashboard**
   - Overview of all properties
   - Recent applications
   - Payment status
   - Earnings analytics

### For Renters

1. **Property Search**

   - Browse available properties
   - Filter by location, price, features
   - View detailed property information
   - Save favorite properties

2. **Application Process**

   - Submit rental applications
   - Upload required documents
   - Track application status
   - Communicate with landlords

3. **Payment Management**

   - View payment history
   - Track upcoming payments
   - Payment reminders

4. **Dashboard**
   - Active applications
   - Current rentals
   - Payment history

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/confirm` - Email confirmation
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout

### Properties

- `GET /api/properties` - List properties (with filters)
- `GET /api/properties/:id` - Get property details
- `POST /api/properties` - Create property (landlord only)
- `PUT /api/properties/:id` - Update property (landlord only)
- `DELETE /api/properties/:id` - Delete property (landlord only)
- `GET /api/properties/landlord/my-properties` - Landlord's properties

### Applications

- `POST /api/applications` - Submit application (renter only)
- `GET /api/applications/:id` - Get application details
- `GET /api/applications/user/my-applications` - User's applications
- `PATCH /api/applications/:id/status` - Update status (landlord only)
- `PATCH /api/applications/:id/withdraw` - Withdraw application (renter only)
- `GET /api/applications/property/:propertyId` - Property applications (landlord only)

### Payments

- `POST /api/payments` - Create payment record (landlord only)
- `GET /api/payments/:id` - Get payment details
- `PATCH /api/payments/:id/status` - Update payment status (landlord only)
- `GET /api/payments/user/my-payments` - User's payments
- `GET /api/payments/landlord/overdue` - Overdue payments (landlord only)
- `GET /api/payments/landlord/upcoming` - Upcoming payments (landlord only)
- `PATCH /api/payments/bulk-update` - Bulk update payments (landlord only)

### Users

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/landlord/dashboard` - Landlord dashboard
- `GET /api/users/renter/dashboard` - Renter dashboard
- `GET /api/users/stats` - User statistics
- `DELETE /api/users/account` - Delete account

## Development

### Project Structure

```
sheep-rentals/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── config/         # AWS configuration
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── types/          # TypeScript types
│   │   └── index.ts        # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript types
│   │   └── App.tsx         # Main app component
│   ├── package.json
│   └── tailwind.config.js
├── aws/                    # AWS infrastructure
│   ├── cloudformation.yaml # CloudFormation template
│   └── deploy.sh          # Deployment script
├── package.json           # Root package.json
└── README.md
```

### Available Scripts

```bash
# Root level
npm run dev              # Start both servers
npm run install-all      # Install all dependencies
npm run build           # Build frontend

# Backend
cd backend
npm run dev             # Start development server
npm run build           # Build TypeScript
npm run start           # Start production server

# Frontend
cd frontend
npm start               # Start development server
npm run build           # Build for production
npm test                # Run tests
```

## Deployment

### Production Deployment

1. **Build the application**

   ```bash
   npm run build
   ```

2. **Deploy to AWS**

   - Use AWS Amplify for frontend
   - Use AWS Elastic Beanstalk or ECS for backend
   - Update environment variables for production

3. **Configure domain and SSL**
   - Set up custom domain
   - Configure SSL certificates
   - Update CORS settings

### Environment Variables

#### Production Backend

```bash
NODE_ENV=production
PORT=5000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_production_access_key
AWS_SECRET_ACCESS_KEY=your_production_secret_key
COGNITO_USER_POOL_ID=your_production_user_pool_id
COGNITO_CLIENT_ID=your_production_client_id
S3_BUCKET_NAME=your_production_s3_bucket
JWT_SECRET=your_production_jwt_secret
FRONTEND_URL=https://yourdomain.com
```

#### Production Frontend

```bash
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_COGNITO_USER_POOL_ID=your_production_user_pool_id
REACT_APP_COGNITO_CLIENT_ID=your_production_client_id
REACT_APP_S3_BUCKET=your_production_s3_bucket
REACT_APP_S3_REGION=us-east-1
```

## Troubleshooting

### Common Issues

1. **AWS Credentials Error**

   - Ensure AWS CLI is configured correctly
   - Check IAM permissions for the user

2. **CORS Errors**

   - Verify CORS configuration in backend
   - Check frontend API URL configuration

3. **DynamoDB Connection Issues**

   - Verify table names in environment variables
   - Check AWS region configuration

4. **S3 Upload Failures**

   - Verify bucket permissions
   - Check CORS configuration on S3 bucket

5. **Cognito Authentication Issues**
   - Verify User Pool ID and Client ID
   - Check email verification settings

### Getting Help

- Check the console logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure AWS services are properly configured
- Check network connectivity and firewall settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Happy coding! 🐑🏠**

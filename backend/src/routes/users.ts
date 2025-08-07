import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, s3, TABLE_NAMES, S3_CONFIG } from '../config/aws';
import { asyncHandler } from '../middleware/errorHandler';
import { createError } from '../middleware/errorHandler';
import { LandlordDashboard, RenterDashboard } from '../types';

const router = Router();

// Configure multer for profile image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: S3_CONFIG.MAX_FILE_SIZE,
    files: 1 // Only one profile image
  },
  fileFilter: (req, file, cb) => {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (extension && S3_CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// Get user profile
router.get('/profile', asyncHandler(async (req, res) => {
  try {
    const params = {
      TableName: TABLE_NAMES.USERS,
      Key: { id: req.user!.id }
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      throw createError('User profile not found', 404);
    }

    res.json({
      success: true,
      data: result.Item
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw createError('Failed to fetch user profile', 500);
  }
}));

// Update user profile
router.put('/profile', upload.single('profileImage'), asyncHandler(async (req, res) => {
  const profileData = req.body;
  const file = req.file;

  let profileImageUrl = undefined;

  // Upload profile image to S3 if provided
  if (file) {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `profiles/${req.user!.id}/${uuidv4()}.${fileExtension}`;

    const uploadParams = {
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read'
    };

    try {
      await s3.upload(uploadParams).promise();
      profileImageUrl = `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw createError('Failed to upload profile image', 500);
    }
  }

  const updateExpression = 'SET updatedAt = :updatedAt';
  const expressionAttributeValues: any = {
    ':updatedAt': new Date().toISOString()
  };

  // Add update expressions for each field
  if (profileData.firstName) {
    updateExpression += ', firstName = :firstName';
    expressionAttributeValues[':firstName'] = profileData.firstName;
  }

  if (profileData.lastName) {
    updateExpression += ', lastName = :lastName';
    expressionAttributeValues[':lastName'] = profileData.lastName;
  }

  if (profileData.phone) {
    updateExpression += ', phone = :phone';
    expressionAttributeValues[':phone'] = profileData.phone;
  }

  if (profileData.address) {
    updateExpression += ', address = :address';
    expressionAttributeValues[':address'] = JSON.parse(profileData.address);
  }

  if (profileData.emergencyContact) {
    updateExpression += ', emergencyContact = :emergencyContact';
    expressionAttributeValues[':emergencyContact'] = JSON.parse(profileData.emergencyContact);
  }

  if (profileImageUrl) {
    updateExpression += ', profileImage = :profileImage';
    expressionAttributeValues[':profileImage'] = profileImageUrl;
  }

  try {
    const params = {
      TableName: TABLE_NAMES.USERS,
      Key: { id: req.user!.id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.Attributes
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw createError('Failed to update profile', 500);
  }
}));

// Get landlord dashboard
router.get('/landlord/dashboard', asyncHandler(async (req, res) => {
  if (req.user!.userType !== 'landlord') {
    throw createError('Landlord access required', 403);
  }

  try {
    // Get landlord's properties
    const propertiesParams = {
      TableName: TABLE_NAMES.PROPERTIES,
      FilterExpression: 'landlordId = :landlordId',
      ExpressionAttributeValues: {
        ':landlordId': req.user!.id
      }
    };

    const propertiesResult = await dynamoDB.scan(propertiesParams).promise();
    const properties = propertiesResult.Items || [];

    // Get recent applications
    const applicationsParams = {
      TableName: TABLE_NAMES.APPLICATIONS,
      FilterExpression: 'landlordId = :landlordId',
      ExpressionAttributeValues: {
        ':landlordId': req.user!.id
      }
    };

    const applicationsResult = await dynamoDB.scan(applicationsParams).promise();
    const applications = applicationsResult.Items || [];

    // Get payments
    const paymentsParams = {
      TableName: TABLE_NAMES.PAYMENTS,
      FilterExpression: 'landlordId = :landlordId',
      ExpressionAttributeValues: {
        ':landlordId': req.user!.id
      }
    };

    const paymentsResult = await dynamoDB.scan(paymentsParams).promise();
    const payments = paymentsResult.Items || [];

    // Calculate dashboard data
    const totalProperties = properties.length;
    const propertiesByStatus = {
      available: properties.filter(p => p.status === 'available').length,
      rented: properties.filter(p => p.status === 'rented').length,
      maintenance: properties.filter(p => p.status === 'maintenance').length
    };

    const totalEarnings = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthlyEarnings = payments
      .filter(p => p.status === 'paid' && p.month === currentMonth)
      .reduce((sum, p) => sum + p.amount, 0);

    const recentApplications = applications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const overduePayments = payments
      .filter(p => p.status === 'pending' && new Date(p.dueDate) < new Date())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const upcomingPayments = payments
      .filter(p => p.status === 'pending' && new Date(p.dueDate) >= new Date())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 10);

    const dashboard: LandlordDashboard = {
      totalProperties,
      totalEarnings,
      monthlyEarnings,
      propertiesByStatus,
      recentApplications,
      overduePayments,
      upcomingPayments
    };

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error fetching landlord dashboard:', error);
    throw createError('Failed to fetch dashboard', 500);
  }
}));

// Get renter dashboard
router.get('/renter/dashboard', asyncHandler(async (req, res) => {
  if (req.user!.userType !== 'renter') {
    throw createError('Renter access required', 403);
  }

  try {
    // Get renter's applications
    const applicationsParams = {
      TableName: TABLE_NAMES.APPLICATIONS,
      FilterExpression: 'renterId = :renterId',
      ExpressionAttributeValues: {
        ':renterId': req.user!.id
      }
    };

    const applicationsResult = await dynamoDB.scan(applicationsParams).promise();
    const applications = applicationsResult.Items || [];

    // Get current rentals
    const rentalAgreementsParams = {
      TableName: TABLE_NAMES.RENTAL_AGREEMENTS,
      FilterExpression: 'renterId = :renterId AND status = :status',
      ExpressionAttributeValues: {
        ':renterId': req.user!.id,
        ':status': 'active'
      }
    };

    const rentalAgreementsResult = await dynamoDB.scan(rentalAgreementsParams).promise();
    const currentRentals = rentalAgreementsResult.Items || [];

    // Get payments
    const paymentsParams = {
      TableName: TABLE_NAMES.PAYMENTS,
      FilterExpression: 'renterId = :renterId',
      ExpressionAttributeValues: {
        ':renterId': req.user!.id
      }
    };

    const paymentsResult = await dynamoDB.scan(paymentsParams).promise();
    const payments = paymentsResult.Items || [];

    const activeApplications = applications
      .filter(a => a.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const paymentHistory = payments
      .filter(p => p.status === 'paid')
      .sort((a, b) => new Date(b.paidDate || b.createdAt).getTime() - new Date(a.paidDate || a.createdAt).getTime())
      .slice(0, 10);

    const upcomingPayments = payments
      .filter(p => p.status === 'pending' && new Date(p.dueDate) >= new Date())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    const dashboard: RenterDashboard = {
      activeApplications,
      currentRentals,
      paymentHistory,
      upcomingPayments
    };

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error fetching renter dashboard:', error);
    throw createError('Failed to fetch dashboard', 500);
  }
}));

// Get user statistics
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    let stats: any = {};

    if (req.user!.userType === 'landlord') {
      // Get property statistics
      const propertiesParams = {
        TableName: TABLE_NAMES.PROPERTIES,
        FilterExpression: 'landlordId = :landlordId',
        ExpressionAttributeValues: {
          ':landlordId': req.user!.id
        }
      };

      const propertiesResult = await dynamoDB.scan(propertiesParams).promise();
      const properties = propertiesResult.Items || [];

      // Get application statistics
      const applicationsParams = {
        TableName: TABLE_NAMES.APPLICATIONS,
        FilterExpression: 'landlordId = :landlordId',
        ExpressionAttributeValues: {
          ':landlordId': req.user!.id
        }
      };

      const applicationsResult = await dynamoDB.scan(applicationsParams).promise();
      const applications = applicationsResult.Items || [];

      // Get payment statistics
      const paymentsParams = {
        TableName: TABLE_NAMES.PAYMENTS,
        FilterExpression: 'landlordId = :landlordId',
        ExpressionAttributeValues: {
          ':landlordId': req.user!.id
        }
      };

      const paymentsResult = await dynamoDB.scan(paymentsParams).promise();
      const payments = paymentsResult.Items || [];

      stats = {
        totalProperties: properties.length,
        availableProperties: properties.filter(p => p.status === 'available').length,
        rentedProperties: properties.filter(p => p.status === 'rented').length,
        totalApplications: applications.length,
        pendingApplications: applications.filter(a => a.status === 'pending').length,
        approvedApplications: applications.filter(a => a.status === 'approved').length,
        totalPayments: payments.length,
        paidPayments: payments.filter(p => p.status === 'paid').length,
        overduePayments: payments.filter(p => p.status === 'pending' && new Date(p.dueDate) < new Date()).length,
        totalEarnings: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
      };
    } else {
      // Get renter statistics
      const applicationsParams = {
        TableName: TABLE_NAMES.APPLICATIONS,
        FilterExpression: 'renterId = :renterId',
        ExpressionAttributeValues: {
          ':renterId': req.user!.id
        }
      };

      const applicationsResult = await dynamoDB.scan(applicationsParams).promise();
      const applications = applicationsResult.Items || [];

      const rentalAgreementsParams = {
        TableName: TABLE_NAMES.RENTAL_AGREEMENTS,
        FilterExpression: 'renterId = :renterId',
        ExpressionAttributeValues: {
          ':renterId': req.user!.id
        }
      };

      const rentalAgreementsResult = await dynamoDB.scan(rentalAgreementsParams).promise();
      const rentalAgreements = rentalAgreementsResult.Items || [];

      const paymentsParams = {
        TableName: TABLE_NAMES.PAYMENTS,
        FilterExpression: 'renterId = :renterId',
        ExpressionAttributeValues: {
          ':renterId': req.user!.id
        }
      };

      const paymentsResult = await dynamoDB.scan(paymentsParams).promise();
      const payments = paymentsResult.Items || [];

      stats = {
        totalApplications: applications.length,
        pendingApplications: applications.filter(a => a.status === 'pending').length,
        approvedApplications: applications.filter(a => a.status === 'approved').length,
        rejectedApplications: applications.filter(a => a.status === 'rejected').length,
        currentRentals: rentalAgreements.filter(r => r.status === 'active').length,
        totalPayments: payments.length,
        paidPayments: payments.filter(p => p.status === 'paid').length,
        overduePayments: payments.filter(p => p.status === 'pending' && new Date(p.dueDate) < new Date()).length,
        totalSpent: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
      };
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    throw createError('Failed to fetch statistics', 500);
  }
}));

// Delete user account
router.delete('/account', asyncHandler(async (req, res) => {
  try {
    // Check if user has active rentals or properties
    if (req.user!.userType === 'landlord') {
      const propertiesParams = {
        TableName: TABLE_NAMES.PROPERTIES,
        FilterExpression: 'landlordId = :landlordId AND status = :status',
        ExpressionAttributeValues: {
          ':landlordId': req.user!.id,
          ':status': 'rented'
        }
      };

      const propertiesResult = await dynamoDB.scan(propertiesParams).promise();
      if (propertiesResult.Items && propertiesResult.Items.length > 0) {
        throw createError('Cannot delete account with active rentals', 400);
      }
    } else {
      const rentalAgreementsParams = {
        TableName: TABLE_NAMES.RENTAL_AGREEMENTS,
        FilterExpression: 'renterId = :renterId AND status = :status',
        ExpressionAttributeValues: {
          ':renterId': req.user!.id,
          ':status': 'active'
        }
      };

      const rentalAgreementsResult = await dynamoDB.scan(rentalAgreementsParams).promise();
      if (rentalAgreementsResult.Items && rentalAgreementsResult.Items.length > 0) {
        throw createError('Cannot delete account with active rentals', 400);
      }
    }

    // Delete user profile
    const params = {
      TableName: TABLE_NAMES.USERS,
      Key: { id: req.user!.id }
    };

    await dynamoDB.delete(params).promise();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user account:', error);
    throw createError('Failed to delete account', 500);
  }
}));

export default router; 
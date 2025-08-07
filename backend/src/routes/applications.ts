import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, s3, TABLE_NAMES, S3_CONFIG } from '../config/aws';
import { asyncHandler } from '../middleware/errorHandler';
import { createError } from '../middleware/errorHandler';
import { requireLandlord, requireRenter } from '../middleware/auth';
import { Application } from '../types';

const router = Router();

// Configure multer for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: S3_CONFIG.MAX_FILE_SIZE,
    files: 5 // Max 5 documents per application
  },
  fileFilter: (req, file, cb) => {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (extension && ['pdf', 'jpg', 'jpeg', 'png'].includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  }
});

// Submit application (renter only)
router.post('/', requireRenter, upload.array('documents', 5), asyncHandler(async (req, res) => {
  const applicationData = req.body;
  const files = req.files as Express.Multer.File[];

  // Validate required fields
  if (!applicationData.propertyId || !applicationData.personalInfo || !applicationData.employment) {
    throw createError('Missing required fields', 400);
  }

  // Check if property exists and is available
  const property = await dynamoDB.get({
    TableName: TABLE_NAMES.PROPERTIES,
    Key: { id: applicationData.propertyId }
  }).promise();

  if (!property.Item) {
    throw createError('Property not found', 404);
  }

  if (property.Item.status !== 'available') {
    throw createError('Property is not available for applications', 400);
  }

  // Check if user already applied to this property
  const existingApplication = await dynamoDB.scan({
    TableName: TABLE_NAMES.APPLICATIONS,
    FilterExpression: 'propertyId = :propertyId AND renterId = :renterId',
    ExpressionAttributeValues: {
      ':propertyId': applicationData.propertyId,
      ':renterId': req.user!.id
    }
  }).promise();

  if (existingApplication.Items && existingApplication.Items.length > 0) {
    throw createError('You have already applied to this property', 409);
  }

  const applicationId = uuidv4();
  const now = new Date().toISOString();
  const documents: { id: string; type: string; url: string; name: string }[] = [];

  // Upload documents to S3
  if (files && files.length > 0) {
    for (const file of files) {
      const documentId = uuidv4();
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `applications/${applicationId}/${documentId}.${fileExtension}`;

      const uploadParams = {
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read'
      };

      try {
        await s3.upload(uploadParams).promise();
        documents.push({
          id: documentId,
          type: applicationData.documentTypes?.[file.fieldname] || 'other',
          url: `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${fileName}`,
          name: file.originalname
        });
      } catch (error) {
        console.error('S3 upload error:', error);
        throw createError('Failed to upload document', 500);
      }
    }
  }

  const application: Application = {
    id: applicationId,
    propertyId: applicationData.propertyId,
    renterId: req.user!.id,
    landlordId: property.Item.landlordId,
    status: 'pending',
    personalInfo: JSON.parse(applicationData.personalInfo),
    employment: JSON.parse(applicationData.employment),
    references: JSON.parse(applicationData.references || '[]'),
    documents,
    message: applicationData.message,
    createdAt: now,
    updatedAt: now
  };

  try {
    const params = {
      TableName: TABLE_NAMES.APPLICATIONS,
      Item: application
    };

    await dynamoDB.put(params).promise();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });
  } catch (error) {
    console.error('Error creating application:', error);
    throw createError('Failed to submit application', 500);
  }
}));

// Get application by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Application ID is required', 400);
  }

  try {
    const params = {
      TableName: TABLE_NAMES.APPLICATIONS,
      Key: { id }
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      throw createError('Application not found', 404);
    }

    // Check if user has permission to view this application
    if (req.user!.userType === 'renter' && result.Item.renterId !== req.user!.id) {
      throw createError('Unauthorized to view this application', 403);
    }

    if (req.user!.userType === 'landlord' && result.Item.landlordId !== req.user!.id) {
      throw createError('Unauthorized to view this application', 403);
    }

    res.json({
      success: true,
      data: result.Item
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    throw createError('Failed to fetch application', 500);
  }
}));

// Get user's applications
router.get('/user/my-applications', asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let filterExpression = '';
  let expressionAttributeValues: any = {};

  if (req.user!.userType === 'renter') {
    filterExpression = 'renterId = :userId';
    expressionAttributeValues[':userId'] = req.user!.id;
  } else {
    filterExpression = 'landlordId = :userId';
    expressionAttributeValues[':userId'] = req.user!.id;
  }

  if (status) {
    filterExpression += ' AND status = :status';
    expressionAttributeValues[':status'] = status;
  }

  try {
    const params = {
      TableName: TABLE_NAMES.APPLICATIONS,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: Number(limit),
      ExclusiveStartKey: offset > 0 ? { id: offset.toString() } : undefined
    };

    const result = await dynamoDB.scan(params).promise();
    const applications = result.Items || [];

    // Sort by creation date (newest first)
    applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: applications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.Count || 0,
        totalPages: Math.ceil((result.Count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    throw createError('Failed to fetch applications', 500);
  }
}));

// Update application status (landlord only)
router.patch('/:id/status', requireLandlord, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!id || !status) {
    throw createError('Application ID and status are required', 400);
  }

  if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) {
    throw createError('Invalid status', 400);
  }

  // Check if application exists and belongs to landlord
  const existingApplication = await dynamoDB.get({
    TableName: TABLE_NAMES.APPLICATIONS,
    Key: { id }
  }).promise();

  if (!existingApplication.Item) {
    throw createError('Application not found', 404);
  }

  if (existingApplication.Item.landlordId !== req.user!.id) {
    throw createError('Unauthorized to update this application', 403);
  }

  try {
    const updateExpression = 'SET status = :status, updatedAt = :updatedAt, reviewedAt = :reviewedAt, reviewedBy = :reviewedBy';
    const expressionAttributeValues: any = {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
      ':reviewedAt': new Date().toISOString(),
      ':reviewedBy': req.user!.id
    };

    if (notes) {
      updateExpression += ', notes = :notes';
      expressionAttributeValues[':notes'] = notes;
    }

    const params = {
      TableName: TABLE_NAMES.APPLICATIONS,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();

    // If application is approved, update property status to rented
    if (status === 'approved') {
      const propertyParams = {
        TableName: TABLE_NAMES.PROPERTIES,
        Key: { id: existingApplication.Item.propertyId },
        UpdateExpression: 'SET status = :status, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':status': 'rented',
          ':updatedAt': new Date().toISOString()
        }
      };

      await dynamoDB.update(propertyParams).promise();
    }

    res.json({
      success: true,
      message: 'Application status updated successfully',
      data: result.Attributes
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    throw createError('Failed to update application status', 500);
  }
}));

// Withdraw application (renter only)
router.patch('/:id/withdraw', requireRenter, asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Application ID is required', 400);
  }

  // Check if application exists and belongs to renter
  const existingApplication = await dynamoDB.get({
    TableName: TABLE_NAMES.APPLICATIONS,
    Key: { id }
  }).promise();

  if (!existingApplication.Item) {
    throw createError('Application not found', 404);
  }

  if (existingApplication.Item.renterId !== req.user!.id) {
    throw createError('Unauthorized to withdraw this application', 403);
  }

  if (existingApplication.Item.status !== 'pending') {
    throw createError('Cannot withdraw application that is not pending', 400);
  }

  try {
    const params = {
      TableName: TABLE_NAMES.APPLICATIONS,
      Key: { id },
      UpdateExpression: 'SET status = :status, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':status': 'withdrawn',
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();

    res.json({
      success: true,
      message: 'Application withdrawn successfully',
      data: result.Attributes
    });
  } catch (error) {
    console.error('Error withdrawing application:', error);
    throw createError('Failed to withdraw application', 500);
  }
}));

// Get applications for a specific property (landlord only)
router.get('/property/:propertyId', requireLandlord, asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const { page = 1, limit = 10, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  // Check if property belongs to landlord
  const property = await dynamoDB.get({
    TableName: TABLE_NAMES.PROPERTIES,
    Key: { id: propertyId }
  }).promise();

  if (!property.Item) {
    throw createError('Property not found', 404);
  }

  if (property.Item.landlordId !== req.user!.id) {
    throw createError('Unauthorized to view applications for this property', 403);
  }

  let filterExpression = 'propertyId = :propertyId';
  let expressionAttributeValues: any = {
    ':propertyId': propertyId
  };

  if (status) {
    filterExpression += ' AND status = :status';
    expressionAttributeValues[':status'] = status;
  }

  try {
    const params = {
      TableName: TABLE_NAMES.APPLICATIONS,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: Number(limit),
      ExclusiveStartKey: offset > 0 ? { id: offset.toString() } : undefined
    };

    const result = await dynamoDB.scan(params).promise();
    const applications = result.Items || [];

    // Sort by creation date (newest first)
    applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: applications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.Count || 0,
        totalPages: Math.ceil((result.Count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching property applications:', error);
    throw createError('Failed to fetch applications', 500);
  }
}));

export default router; 
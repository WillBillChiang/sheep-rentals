import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, s3, TABLE_NAMES, S3_CONFIG } from '../config/aws';
import { asyncHandler } from '../middleware/errorHandler';
import { createError } from '../middleware/errorHandler';
import { requireLandlord, optionalAuth } from '../middleware/auth';
import { Property, PropertySearchParams } from '../types';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: S3_CONFIG.MAX_FILE_SIZE,
    files: 10 // Max 10 images per property
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

// Get all properties (with optional search/filtering)
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    city,
    state,
    petsAllowed,
    furnished,
    parking,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  }: PropertySearchParams = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  // Build filter expression
  let filterExpression = 'status = :status';
  let expressionAttributeValues: any = {
    ':status': 'available'
  };

  if (search) {
    filterExpression += ' AND (contains(title, :search) OR contains(description, :search) OR contains(address.city, :search))';
    expressionAttributeValues[':search'] = search;
  }

  if (minPrice) {
    filterExpression += ' AND price.monthly >= :minPrice';
    expressionAttributeValues[':minPrice'] = Number(minPrice);
  }

  if (maxPrice) {
    filterExpression += ' AND price.monthly <= :maxPrice';
    expressionAttributeValues[':maxPrice'] = Number(maxPrice);
  }

  if (bedrooms) {
    filterExpression += ' AND details.bedrooms >= :bedrooms';
    expressionAttributeValues[':bedrooms'] = Number(bedrooms);
  }

  if (bathrooms) {
    filterExpression += ' AND details.bathrooms >= :bathrooms';
    expressionAttributeValues[':bathrooms'] = Number(bathrooms);
  }

  if (city) {
    filterExpression += ' AND address.city = :city';
    expressionAttributeValues[':city'] = city;
  }

  if (state) {
    filterExpression += ' AND address.state = :state';
    expressionAttributeValues[':state'] = state;
  }

  if (petsAllowed !== undefined) {
    filterExpression += ' AND details.petsAllowed = :petsAllowed';
    expressionAttributeValues[':petsAllowed'] = petsAllowed === 'true';
  }

  if (furnished !== undefined) {
    filterExpression += ' AND details.furnished = :furnished';
    expressionAttributeValues[':furnished'] = furnished === 'true';
  }

  if (parking !== undefined) {
    filterExpression += ' AND details.parking = :parking';
    expressionAttributeValues[':parking'] = parking === 'true';
  }

  try {
    const params = {
      TableName: TABLE_NAMES.PROPERTIES,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: Number(limit),
      ExclusiveStartKey: offset > 0 ? { id: offset.toString() } : undefined
    };

    const result = await dynamoDB.scan(params).promise();
    const properties = result.Items || [];

    // Sort results
    properties.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'price':
          aValue = a.price.monthly;
          bValue = b.price.monthly;
          break;
        case 'date':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    // Get total count for pagination
    const countParams = {
      TableName: TABLE_NAMES.PROPERTIES,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Select: 'COUNT'
    };

    const countResult = await dynamoDB.scan(countParams).promise();
    const total = countResult.Count || 0;

    res.json({
      success: true,
      data: properties,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    throw createError('Failed to fetch properties', 500);
  }
}));

// Get property by ID
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Property ID is required', 400);
  }

  try {
    const params = {
      TableName: TABLE_NAMES.PROPERTIES,
      Key: { id }
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      throw createError('Property not found', 404);
    }

    res.json({
      success: true,
      data: result.Item
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    throw createError('Failed to fetch property', 500);
  }
}));

// Create new property (landlord only)
router.post('/', requireLandlord, upload.array('images', 10), asyncHandler(async (req, res) => {
  const propertyData = req.body;
  const files = req.files as Express.Multer.File[];

  // Validate required fields
  if (!propertyData.title || !propertyData.description || !propertyData.price || !propertyData.address) {
    throw createError('Missing required fields', 400);
  }

  const propertyId = uuidv4();
  const now = new Date().toISOString();
  const images: string[] = [];

  // Upload images to S3
  if (files && files.length > 0) {
    for (const file of files) {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${propertyId}/${uuidv4()}.${fileExtension}`;

      const uploadParams = {
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read'
      };

      try {
        await s3.upload(uploadParams).promise();
        images.push(`https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${fileName}`);
      } catch (error) {
        console.error('S3 upload error:', error);
        throw createError('Failed to upload image', 500);
      }
    }
  }

  const property: Property = {
    id: propertyId,
    landlordId: req.user!.id,
    title: propertyData.title,
    description: propertyData.description,
    address: JSON.parse(propertyData.address),
    coordinates: propertyData.coordinates ? JSON.parse(propertyData.coordinates) : undefined,
    price: JSON.parse(propertyData.price),
    details: JSON.parse(propertyData.details),
    amenities: JSON.parse(propertyData.amenities || '[]'),
    images,
    status: 'available',
    createdAt: now,
    updatedAt: now,
    availableDate: propertyData.availableDate,
    leaseTerms: propertyData.leaseTerms ? JSON.parse(propertyData.leaseTerms) : undefined
  };

  try {
    const params = {
      TableName: TABLE_NAMES.PROPERTIES,
      Item: property
    };

    await dynamoDB.put(params).promise();

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: property
    });
  } catch (error) {
    console.error('Error creating property:', error);
    throw createError('Failed to create property', 500);
  }
}));

// Update property (landlord only)
router.put('/:id', requireLandlord, upload.array('images', 10), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const propertyData = req.body;
  const files = req.files as Express.Multer.File[];

  if (!id) {
    throw createError('Property ID is required', 400);
  }

  // Check if property exists and belongs to landlord
  const existingProperty = await dynamoDB.get({
    TableName: TABLE_NAMES.PROPERTIES,
    Key: { id }
  }).promise();

  if (!existingProperty.Item) {
    throw createError('Property not found', 404);
  }

  if (existingProperty.Item.landlordId !== req.user!.id) {
    throw createError('Unauthorized to update this property', 403);
  }

  let images = existingProperty.Item.images || [];

  // Upload new images to S3
  if (files && files.length > 0) {
    for (const file of files) {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${id}/${uuidv4()}.${fileExtension}`;

      const uploadParams = {
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read'
      };

      try {
        await s3.upload(uploadParams).promise();
        images.push(`https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${fileName}`);
      } catch (error) {
        console.error('S3 upload error:', error);
        throw createError('Failed to upload image', 500);
      }
    }
  }

  const updateExpression = 'SET updatedAt = :updatedAt';
  const expressionAttributeValues: any = {
    ':updatedAt': new Date().toISOString()
  };

  // Add update expressions for each field
  if (propertyData.title) {
    updateExpression += ', title = :title';
    expressionAttributeValues[':title'] = propertyData.title;
  }

  if (propertyData.description) {
    updateExpression += ', description = :description';
    expressionAttributeValues[':description'] = propertyData.description;
  }

  if (propertyData.address) {
    updateExpression += ', address = :address';
    expressionAttributeValues[':address'] = JSON.parse(propertyData.address);
  }

  if (propertyData.price) {
    updateExpression += ', price = :price';
    expressionAttributeValues[':price'] = JSON.parse(propertyData.price);
  }

  if (propertyData.details) {
    updateExpression += ', details = :details';
    expressionAttributeValues[':details'] = JSON.parse(propertyData.details);
  }

  if (propertyData.amenities) {
    updateExpression += ', amenities = :amenities';
    expressionAttributeValues[':amenities'] = JSON.parse(propertyData.amenities);
  }

  if (images.length > 0) {
    updateExpression += ', images = :images';
    expressionAttributeValues[':images'] = images;
  }

  if (propertyData.status) {
    updateExpression += ', status = :status';
    expressionAttributeValues[':status'] = propertyData.status;
  }

  try {
    const params = {
      TableName: TABLE_NAMES.PROPERTIES,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: result.Attributes
    });
  } catch (error) {
    console.error('Error updating property:', error);
    throw createError('Failed to update property', 500);
  }
}));

// Delete property (landlord only)
router.delete('/:id', requireLandlord, asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Property ID is required', 400);
  }

  // Check if property exists and belongs to landlord
  const existingProperty = await dynamoDB.get({
    TableName: TABLE_NAMES.PROPERTIES,
    Key: { id }
  }).promise();

  if (!existingProperty.Item) {
    throw createError('Property not found', 404);
  }

  if (existingProperty.Item.landlordId !== req.user!.id) {
    throw createError('Unauthorized to delete this property', 403);
  }

  try {
    const params = {
      TableName: TABLE_NAMES.PROPERTIES,
      Key: { id }
    };

    await dynamoDB.delete(params).promise();

    // Delete images from S3
    if (existingProperty.Item.images && existingProperty.Item.images.length > 0) {
      const deleteParams = {
        Bucket: S3_CONFIG.BUCKET_NAME,
        Delete: {
          Objects: existingProperty.Item.images.map(url => ({
            Key: url.split('/').slice(-2).join('/') // Extract key from URL
          }))
        }
      };

      try {
        await s3.deleteObjects(deleteParams).promise();
      } catch (error) {
        console.error('Error deleting images from S3:', error);
        // Don't throw error as property is already deleted
      }
    }

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting property:', error);
    throw createError('Failed to delete property', 500);
  }
}));

// Get landlord's properties
router.get('/landlord/my-properties', requireLandlord, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const params = {
      TableName: TABLE_NAMES.PROPERTIES,
      IndexName: 'LandlordIdIndex', // You'll need to create this GSI
      KeyConditionExpression: 'landlordId = :landlordId',
      ExpressionAttributeValues: {
        ':landlordId': req.user!.id
      },
      Limit: Number(limit),
      ExclusiveStartKey: offset > 0 ? { id: offset.toString() } : undefined
    };

    const result = await dynamoDB.query(params).promise();
    const properties = result.Items || [];

    res.json({
      success: true,
      data: properties,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.Count || 0,
        totalPages: Math.ceil((result.Count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching landlord properties:', error);
    throw createError('Failed to fetch properties', 500);
  }
}));

export default router; 
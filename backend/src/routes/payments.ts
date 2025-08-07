import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLE_NAMES } from '../config/aws';
import { asyncHandler } from '../middleware/errorHandler';
import { createError } from '../middleware/errorHandler';
import { requireLandlord } from '../middleware/auth';
import { Payment, RentalAgreement } from '../types';

const router = Router();

// Create payment record (landlord only)
router.post('/', requireLandlord, asyncHandler(async (req, res) => {
  const paymentData = req.body;

  // Validate required fields
  if (!paymentData.rentalAgreementId || !paymentData.amount || !paymentData.type || !paymentData.dueDate) {
    throw createError('Missing required fields', 400);
  }

  // Check if rental agreement exists and belongs to landlord
  const rentalAgreement = await dynamoDB.get({
    TableName: TABLE_NAMES.RENTAL_AGREEMENTS,
    Key: { id: paymentData.rentalAgreementId }
  }).promise();

  if (!rentalAgreement.Item) {
    throw createError('Rental agreement not found', 404);
  }

  if (rentalAgreement.Item.landlordId !== req.user!.id) {
    throw createError('Unauthorized to create payment for this rental agreement', 403);
  }

  const paymentId = uuidv4();
  const now = new Date().toISOString();

  const payment: Payment = {
    id: paymentId,
    rentalAgreementId: paymentData.rentalAgreementId,
    propertyId: rentalAgreement.Item.propertyId,
    renterId: rentalAgreement.Item.renterId,
    landlordId: req.user!.id,
    amount: Number(paymentData.amount),
    type: paymentData.type,
    status: 'pending',
    dueDate: paymentData.dueDate,
    month: paymentData.month, // YYYY-MM format for rent payments
    notes: paymentData.notes,
    createdAt: now,
    updatedAt: now
  };

  try {
    const params = {
      TableName: TABLE_NAMES.PAYMENTS,
      Item: payment
    };

    await dynamoDB.put(params).promise();

    res.status(201).json({
      success: true,
      message: 'Payment record created successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    throw createError('Failed to create payment record', 500);
  }
}));

// Update payment status (landlord only)
router.patch('/:id/status', requireLandlord, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, paidDate, notes } = req.body;

  if (!id || !status) {
    throw createError('Payment ID and status are required', 400);
  }

  if (!['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
    throw createError('Invalid status', 400);
  }

  // Check if payment exists and belongs to landlord
  const existingPayment = await dynamoDB.get({
    TableName: TABLE_NAMES.PAYMENTS,
    Key: { id }
  }).promise();

  if (!existingPayment.Item) {
    throw createError('Payment not found', 404);
  }

  if (existingPayment.Item.landlordId !== req.user!.id) {
    throw createError('Unauthorized to update this payment', 403);
  }

  try {
    const updateExpression = 'SET status = :status, updatedAt = :updatedAt';
    const expressionAttributeValues: any = {
      ':status': status,
      ':updatedAt': new Date().toISOString()
    };

    if (status === 'paid' && paidDate) {
      updateExpression += ', paidDate = :paidDate';
      expressionAttributeValues[':paidDate'] = paidDate;
    }

    if (notes) {
      updateExpression += ', notes = :notes';
      expressionAttributeValues[':notes'] = notes;
    }

    const params = {
      TableName: TABLE_NAMES.PAYMENTS,
      Key: { id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: result.Attributes
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    throw createError('Failed to update payment status', 500);
  }
}));

// Get payment by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Payment ID is required', 400);
  }

  try {
    const params = {
      TableName: TABLE_NAMES.PAYMENTS,
      Key: { id }
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      throw createError('Payment not found', 404);
    }

    // Check if user has permission to view this payment
    if (req.user!.userType === 'renter' && result.Item.renterId !== req.user!.id) {
      throw createError('Unauthorized to view this payment', 403);
    }

    if (req.user!.userType === 'landlord' && result.Item.landlordId !== req.user!.id) {
      throw createError('Unauthorized to view this payment', 403);
    }

    res.json({
      success: true,
      data: result.Item
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw createError('Failed to fetch payment', 500);
  }
}));

// Get payments for rental agreement
router.get('/rental-agreement/:rentalAgreementId', asyncHandler(async (req, res) => {
  const { rentalAgreementId } = req.params;
  const { page = 1, limit = 10, status, type } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  // Check if rental agreement exists and user has permission
  const rentalAgreement = await dynamoDB.get({
    TableName: TABLE_NAMES.RENTAL_AGREEMENTS,
    Key: { id: rentalAgreementId }
  }).promise();

  if (!rentalAgreement.Item) {
    throw createError('Rental agreement not found', 404);
  }

  if (req.user!.userType === 'renter' && rentalAgreement.Item.renterId !== req.user!.id) {
    throw createError('Unauthorized to view payments for this rental agreement', 403);
  }

  if (req.user!.userType === 'landlord' && rentalAgreement.Item.landlordId !== req.user!.id) {
    throw createError('Unauthorized to view payments for this rental agreement', 403);
  }

  let filterExpression = 'rentalAgreementId = :rentalAgreementId';
  let expressionAttributeValues: any = {
    ':rentalAgreementId': rentalAgreementId
  };

  if (status) {
    filterExpression += ' AND status = :status';
    expressionAttributeValues[':status'] = status;
  }

  if (type) {
    filterExpression += ' AND type = :type';
    expressionAttributeValues[':type'] = type;
  }

  try {
    const params = {
      TableName: TABLE_NAMES.PAYMENTS,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: Number(limit),
      ExclusiveStartKey: offset > 0 ? { id: offset.toString() } : undefined
    };

    const result = await dynamoDB.scan(params).promise();
    const payments = result.Items || [];

    // Sort by due date (oldest first)
    payments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.Count || 0,
        totalPages: Math.ceil((result.Count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    throw createError('Failed to fetch payments', 500);
  }
}));

// Get user's payments
router.get('/user/my-payments', asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, type } = req.query;
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

  if (type) {
    filterExpression += ' AND type = :type';
    expressionAttributeValues[':type'] = type;
  }

  try {
    const params = {
      TableName: TABLE_NAMES.PAYMENTS,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: Number(limit),
      ExclusiveStartKey: offset > 0 ? { id: offset.toString() } : undefined
    };

    const result = await dynamoDB.scan(params).promise();
    const payments = result.Items || [];

    // Sort by due date (oldest first)
    payments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.Count || 0,
        totalPages: Math.ceil((result.Count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user payments:', error);
    throw createError('Failed to fetch payments', 500);
  }
}));

// Get overdue payments (landlord only)
router.get('/landlord/overdue', requireLandlord, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  try {
    const params = {
      TableName: TABLE_NAMES.PAYMENTS,
      FilterExpression: 'landlordId = :landlordId AND status = :status AND dueDate < :today',
      ExpressionAttributeValues: {
        ':landlordId': req.user!.id,
        ':status': 'pending',
        ':today': today
      },
      Limit: Number(limit),
      ExclusiveStartKey: offset > 0 ? { id: offset.toString() } : undefined
    };

    const result = await dynamoDB.scan(params).promise();
    const payments = result.Items || [];

    // Sort by due date (oldest first)
    payments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.Count || 0,
        totalPages: Math.ceil((result.Count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching overdue payments:', error);
    throw createError('Failed to fetch overdue payments', 500);
  }
}));

// Get upcoming payments (landlord only)
router.get('/landlord/upcoming', requireLandlord, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().split('T')[0];

  try {
    const params = {
      TableName: TABLE_NAMES.PAYMENTS,
      FilterExpression: 'landlordId = :landlordId AND status = :status AND dueDate BETWEEN :today AND :nextMonth',
      ExpressionAttributeValues: {
        ':landlordId': req.user!.id,
        ':status': 'pending',
        ':today': today,
        ':nextMonth': nextMonthStr
      },
      Limit: Number(limit),
      ExclusiveStartKey: offset > 0 ? { id: offset.toString() } : undefined
    };

    const result = await dynamoDB.scan(params).promise();
    const payments = result.Items || [];

    // Sort by due date (oldest first)
    payments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.Count || 0,
        totalPages: Math.ceil((result.Count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching upcoming payments:', error);
    throw createError('Failed to fetch upcoming payments', 500);
  }
}));

// Bulk update payment status (landlord only)
router.patch('/bulk-update', requireLandlord, asyncHandler(async (req, res) => {
  const { paymentIds, status, paidDate, notes } = req.body;

  if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
    throw createError('Payment IDs array is required', 400);
  }

  if (!status || !['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
    throw createError('Valid status is required', 400);
  }

  const results = [];

  for (const paymentId of paymentIds) {
    try {
      // Check if payment exists and belongs to landlord
      const existingPayment = await dynamoDB.get({
        TableName: TABLE_NAMES.PAYMENTS,
        Key: { id: paymentId }
      }).promise();

      if (!existingPayment.Item) {
        results.push({ id: paymentId, success: false, error: 'Payment not found' });
        continue;
      }

      if (existingPayment.Item.landlordId !== req.user!.id) {
        results.push({ id: paymentId, success: false, error: 'Unauthorized' });
        continue;
      }

      const updateExpression = 'SET status = :status, updatedAt = :updatedAt';
      const expressionAttributeValues: any = {
        ':status': status,
        ':updatedAt': new Date().toISOString()
      };

      if (status === 'paid' && paidDate) {
        updateExpression += ', paidDate = :paidDate';
        expressionAttributeValues[':paidDate'] = paidDate;
      }

      if (notes) {
        updateExpression += ', notes = :notes';
        expressionAttributeValues[':notes'] = notes;
      }

      const params = {
        TableName: TABLE_NAMES.PAYMENTS,
        Key: { id: paymentId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues
      };

      await dynamoDB.update(params).promise();
      results.push({ id: paymentId, success: true });
    } catch (error) {
      console.error(`Error updating payment ${paymentId}:`, error);
      results.push({ id: paymentId, success: false, error: 'Update failed' });
    }
  }

  res.json({
    success: true,
    message: 'Bulk update completed',
    data: results
  });
}));

export default router; 
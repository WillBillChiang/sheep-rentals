import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { cognito, COGNITO_CONFIG } from '../config/aws';
import { User } from '../types';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Cognito
    const params = {
      AccessToken: token
    };

    try {
      const result = await cognito.getUser(params).promise();
      
      if (!result.Username) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }

      // Get user attributes
      const userAttributes = result.UserAttributes || [];
      const user: User = {
        id: result.Username,
        email: '',
        firstName: '',
        lastName: '',
        userType: 'renter',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isVerified: false
      };

      // Map Cognito attributes to our User interface
      userAttributes.forEach(attr => {
        switch (attr.Name) {
          case 'email':
            user.email = attr.Value || '';
            break;
          case 'given_name':
            user.firstName = attr.Value || '';
            break;
          case 'family_name':
            user.lastName = attr.Value || '';
            break;
          case 'custom:userType':
            user.userType = (attr.Value as 'landlord' | 'renter') || 'renter';
            break;
          case 'phone_number':
            user.phone = attr.Value || '';
            break;
          case 'email_verified':
            user.isVerified = attr.Value === 'true';
            break;
        }
      });

      req.user = user;
      next();
    } catch (cognitoError) {
      console.error('Cognito verification error:', cognitoError);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

export const requireLandlord = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.userType !== 'landlord') {
    return res.status(403).json({
      success: false,
      error: 'Landlord access required'
    });
  }

  next();
};

export const requireRenter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.userType !== 'renter') {
    return res.status(403).json({
      success: false,
      error: 'Renter access required'
    });
  }

  next();
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);

    const params = {
      AccessToken: token
    };

    try {
      const result = await cognito.getUser(params).promise();
      
      if (result.Username) {
        const userAttributes = result.UserAttributes || [];
        const user: User = {
          id: result.Username,
          email: '',
          firstName: '',
          lastName: '',
          userType: 'renter',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isVerified: false
        };

        userAttributes.forEach(attr => {
          switch (attr.Name) {
            case 'email':
              user.email = attr.Value || '';
              break;
            case 'given_name':
              user.firstName = attr.Value || '';
              break;
            case 'family_name':
              user.lastName = attr.Value || '';
              break;
            case 'custom:userType':
              user.userType = (attr.Value as 'landlord' | 'renter') || 'renter';
              break;
            case 'phone_number':
              user.phone = attr.Value || '';
              break;
            case 'email_verified':
              user.isVerified = attr.Value === 'true';
              break;
          }
        });

        req.user = user;
      }
    } catch (error) {
      // Silently continue without user
      console.log('Optional auth failed:', error);
    }

    next();
  } catch (error) {
    next(); // Continue without user
  }
}; 
import { Router } from 'express';
import { cognito, COGNITO_CONFIG } from '../config/aws';
import { asyncHandler } from '../middleware/errorHandler';
import { createError } from '../middleware/errorHandler';
import { RegisterData, LoginCredentials, AuthTokens } from '../types';

const router = Router();

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, userType, phone }: RegisterData = req.body;

  // Validate required fields
  if (!email || !password || !firstName || !lastName || !userType) {
    throw createError('Missing required fields', 400);
  }

  // Validate user type
  if (!['landlord', 'renter'].includes(userType)) {
    throw createError('Invalid user type', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError('Invalid email format', 400);
  }

  // Validate password strength
  if (password.length < 8) {
    throw createError('Password must be at least 8 characters long', 400);
  }

  try {
    // Create user in Cognito
    const signUpParams = {
      ClientId: COGNITO_CONFIG.CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email
        },
        {
          Name: 'given_name',
          Value: firstName
        },
        {
          Name: 'family_name',
          Value: lastName
        },
        {
          Name: 'custom:userType',
          Value: userType
        },
        ...(phone && [{
          Name: 'phone_number',
          Value: phone
        }])
      ].filter(Boolean)
    };

    const result = await cognito.signUp(signUpParams).promise();

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        userId: result.UserSub,
        email: email
      }
    });
  } catch (error: any) {
    if (error.code === 'UsernameExistsException') {
      throw createError('User with this email already exists', 409);
    } else if (error.code === 'InvalidPasswordException') {
      throw createError('Password does not meet requirements', 400);
    } else {
      console.error('Cognito signup error:', error);
      throw createError('Registration failed', 500);
    }
  }
}));

// Confirm user registration
router.post('/confirm', asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    throw createError('Email and confirmation code are required', 400);
  }

  try {
    const confirmParams = {
      ClientId: COGNITO_CONFIG.CLIENT_ID!,
      Username: email,
      ConfirmationCode: code
    };

    await cognito.confirmSignUp(confirmParams).promise();

    res.json({
      success: true,
      message: 'Email confirmed successfully'
    });
  } catch (error: any) {
    if (error.code === 'CodeMismatchException') {
      throw createError('Invalid confirmation code', 400);
    } else if (error.code === 'NotAuthorizedException') {
      throw createError('User is already confirmed', 400);
    } else {
      console.error('Cognito confirmation error:', error);
      throw createError('Confirmation failed', 500);
    }
  }
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password }: LoginCredentials = req.body;

  if (!email || !password) {
    throw createError('Email and password are required', 400);
  }

  try {
    const authParams = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CONFIG.CLIENT_ID!,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };

    const result = await cognito.initiateAuth(authParams).promise();

    if (result.AuthenticationResult) {
      const tokens: AuthTokens = {
        accessToken: result.AuthenticationResult.AccessToken!,
        refreshToken: result.AuthenticationResult.RefreshToken!,
        expiresIn: result.AuthenticationResult.ExpiresIn || 3600
      };

      res.json({
        success: true,
        message: 'Login successful',
        data: tokens
      });
    } else {
      throw createError('Authentication failed', 401);
    }
  } catch (error: any) {
    if (error.code === 'NotAuthorizedException') {
      throw createError('Invalid email or password', 401);
    } else if (error.code === 'UserNotConfirmedException') {
      throw createError('Please confirm your email before logging in', 401);
    } else if (error.code === 'UserNotFoundException') {
      throw createError('User not found', 404);
    } else {
      console.error('Cognito login error:', error);
      throw createError('Login failed', 500);
    }
  }
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw createError('Refresh token is required', 400);
  }

  try {
    const refreshParams = {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: COGNITO_CONFIG.CLIENT_ID!,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    };

    const result = await cognito.initiateAuth(refreshParams).promise();

    if (result.AuthenticationResult) {
      const tokens: AuthTokens = {
        accessToken: result.AuthenticationResult.AccessToken!,
        refreshToken: refreshToken,
        expiresIn: result.AuthenticationResult.ExpiresIn || 3600
      };

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: tokens
      });
    } else {
      throw createError('Token refresh failed', 401);
    }
  } catch (error: any) {
    if (error.code === 'NotAuthorizedException') {
      throw createError('Invalid refresh token', 401);
    } else {
      console.error('Cognito refresh error:', error);
      throw createError('Token refresh failed', 500);
    }
  }
}));

// Forgot password
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw createError('Email is required', 400);
  }

  try {
    const forgotPasswordParams = {
      ClientId: COGNITO_CONFIG.CLIENT_ID!,
      Username: email
    };

    await cognito.forgotPassword(forgotPasswordParams).promise();

    res.json({
      success: true,
      message: 'Password reset code sent to your email'
    });
  } catch (error: any) {
    if (error.code === 'UserNotFoundException') {
      throw createError('User not found', 404);
    } else {
      console.error('Cognito forgot password error:', error);
      throw createError('Password reset request failed', 500);
    }
  }
}));

// Reset password
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    throw createError('Email, code, and new password are required', 400);
  }

  if (newPassword.length < 8) {
    throw createError('Password must be at least 8 characters long', 400);
  }

  try {
    const confirmForgotPasswordParams = {
      ClientId: COGNITO_CONFIG.CLIENT_ID!,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword
    };

    await cognito.confirmForgotPassword(confirmForgotPasswordParams).promise();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error: any) {
    if (error.code === 'CodeMismatchException') {
      throw createError('Invalid reset code', 400);
    } else if (error.code === 'InvalidPasswordException') {
      throw createError('Password does not meet requirements', 400);
    } else {
      console.error('Cognito reset password error:', error);
      throw createError('Password reset failed', 500);
    }
  }
}));

// Logout
router.post('/logout', asyncHandler(async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    throw createError('Access token is required', 400);
  }

  try {
    const globalSignOutParams = {
      AccessToken: accessToken
    };

    await cognito.globalSignOut(globalSignOutParams).promise();

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    console.error('Cognito logout error:', error);
    // Even if logout fails, we still return success to client
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
}));

export default router; 
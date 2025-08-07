import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { User, Property, Application, Payment, AuthTokens } from '../types';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post('/api/auth/refresh', {
            refreshToken,
          });
          
          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string): Promise<AxiosResponse<{ data: AuthTokens }>> =>
    api.post('/auth/login', { email, password }),

  register: (userData: any): Promise<AxiosResponse> =>
    api.post('/auth/register', userData),

  confirmEmail: (email: string, code: string): Promise<AxiosResponse> =>
    api.post('/auth/confirm', { email, code }),

  forgotPassword: (email: string): Promise<AxiosResponse> =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (email: string, code: string, newPassword: string): Promise<AxiosResponse> =>
    api.post('/auth/reset-password', { email, code, newPassword }),

  refreshToken: (refreshToken: string): Promise<AxiosResponse<{ data: AuthTokens }>> =>
    api.post('/auth/refresh', { refreshToken }),

  logout: (): Promise<AxiosResponse> =>
    api.post('/auth/logout'),

  getCurrentUser: (): Promise<AxiosResponse<{ data: User }>> =>
    api.get('/users/profile'),

  setToken: (token: string) => {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  },

  clearToken: () => {
    delete api.defaults.headers.common.Authorization;
  },
};

// Properties API
export const propertiesApi = {
  getAll: (params?: any): Promise<AxiosResponse<{ data: Property[]; pagination: any }>> =>
    api.get('/properties', { params }),

  getById: (id: string): Promise<AxiosResponse<{ data: Property }>> =>
    api.get(`/properties/${id}`),

  create: (propertyData: FormData): Promise<AxiosResponse<{ data: Property }>> =>
    api.post('/properties', propertyData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: string, propertyData: FormData): Promise<AxiosResponse<{ data: Property }>> =>
    api.put(`/properties/${id}`, propertyData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: string): Promise<AxiosResponse> =>
    api.delete(`/properties/${id}`),

  getMyProperties: (params?: any): Promise<AxiosResponse<{ data: Property[]; pagination: any }>> =>
    api.get('/properties/landlord/my-properties', { params }),
};

// Applications API
export const applicationsApi = {
  create: (applicationData: FormData): Promise<AxiosResponse<{ data: Application }>> =>
    api.post('/applications', applicationData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getById: (id: string): Promise<AxiosResponse<{ data: Application }>> =>
    api.get(`/applications/${id}`),

  getMyApplications: (params?: any): Promise<AxiosResponse<{ data: Application[]; pagination: any }>> =>
    api.get('/applications/user/my-applications', { params }),

  updateStatus: (id: string, status: string, notes?: string): Promise<AxiosResponse<{ data: Application }>> =>
    api.patch(`/applications/${id}/status`, { status, notes }),

  withdraw: (id: string): Promise<AxiosResponse<{ data: Application }>> =>
    api.patch(`/applications/${id}/withdraw`),

  getPropertyApplications: (propertyId: string, params?: any): Promise<AxiosResponse<{ data: Application[]; pagination: any }>> =>
    api.get(`/applications/property/${propertyId}`, { params }),
};

// Payments API
export const paymentsApi = {
  create: (paymentData: any): Promise<AxiosResponse<{ data: Payment }>> =>
    api.post('/payments', paymentData),

  getById: (id: string): Promise<AxiosResponse<{ data: Payment }>> =>
    api.get(`/payments/${id}`),

  updateStatus: (id: string, status: string, paidDate?: string, notes?: string): Promise<AxiosResponse<{ data: Payment }>> =>
    api.patch(`/payments/${id}/status`, { status, paidDate, notes }),

  getMyPayments: (params?: any): Promise<AxiosResponse<{ data: Payment[]; pagination: any }>> =>
    api.get('/payments/user/my-payments', { params }),

  getRentalAgreementPayments: (rentalAgreementId: string, params?: any): Promise<AxiosResponse<{ data: Payment[]; pagination: any }>> =>
    api.get(`/payments/rental-agreement/${rentalAgreementId}`, { params }),

  getOverduePayments: (params?: any): Promise<AxiosResponse<{ data: Payment[]; pagination: any }>> =>
    api.get('/payments/landlord/overdue', { params }),

  getUpcomingPayments: (params?: any): Promise<AxiosResponse<{ data: Payment[]; pagination: any }>> =>
    api.get('/payments/landlord/upcoming', { params }),

  bulkUpdateStatus: (paymentIds: string[], status: string, paidDate?: string, notes?: string): Promise<AxiosResponse> =>
    api.patch('/payments/bulk-update', { paymentIds, status, paidDate, notes }),
};

// Users API
export const usersApi = {
  getProfile: (): Promise<AxiosResponse<{ data: User }>> =>
    api.get('/users/profile'),

  updateProfile: (profileData: FormData): Promise<AxiosResponse<{ data: User }>> =>
    api.put('/users/profile', profileData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getLandlordDashboard: (): Promise<AxiosResponse<{ data: any }>> =>
    api.get('/users/landlord/dashboard'),

  getRenterDashboard: (): Promise<AxiosResponse<{ data: any }>> =>
    api.get('/users/renter/dashboard'),

  getStats: (): Promise<AxiosResponse<{ data: any }>> =>
    api.get('/users/stats'),

  deleteAccount: (): Promise<AxiosResponse> =>
    api.delete('/users/account'),
};

// File upload helper
export const uploadFile = async (file: File, type: 'property' | 'application' | 'profile'): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post(`/upload/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data.url;
};

// Error handler
export const handleApiError = (error: any): string => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

export default api; 
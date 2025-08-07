// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: 'landlord' | 'renter';
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
  profileImage?: string;
}

export interface UserProfile extends Omit<User, 'id'> {
  id: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

// Property types
export interface Property {
  id: string;
  landlordId: string;
  title: string;
  description: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  price: {
    monthly: number;
    deposit?: number;
    utilities?: number;
  };
  details: {
    bedrooms: number;
    bathrooms: number;
    squareFeet?: number;
    parking?: boolean;
    furnished?: boolean;
    petsAllowed?: boolean;
    smokingAllowed?: boolean;
  };
  amenities: string[];
  images: string[];
  status: 'available' | 'rented' | 'maintenance' | 'inactive';
  createdAt: string;
  updatedAt: string;
  availableDate?: string;
  leaseTerms?: {
    minLeaseMonths: number;
    maxLeaseMonths?: number;
  };
}

// Application types
export interface Application {
  id: string;
  propertyId: string;
  renterId: string;
  landlordId: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    ssn?: string;
  };
  employment: {
    employer: string;
    position: string;
    income: number;
    startDate: string;
  };
  references: {
    name: string;
    phone: string;
    relationship: string;
  }[];
  documents: {
    id: string;
    type: 'paystub' | 'bankStatement' | 'id' | 'other';
    url: string;
    name: string;
  }[];
  message?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// Payment types
export interface Payment {
  id: string;
  rentalAgreementId: string;
  propertyId: string;
  renterId: string;
  landlordId: string;
  amount: number;
  type: 'rent' | 'deposit' | 'utilities' | 'late_fee' | 'other';
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  paidDate?: string;
  month?: string; // YYYY-MM format for rent payments
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Rental Agreement types
export interface RentalAgreement {
  id: string;
  propertyId: string;
  landlordId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  utilitiesIncluded: boolean;
  status: 'active' | 'expired' | 'terminated';
  terms: string;
  createdAt: string;
  updatedAt: string;
  terminatedAt?: string;
  terminationReason?: string;
}

// Dashboard types
export interface LandlordDashboard {
  totalProperties: number;
  totalEarnings: number;
  monthlyEarnings: number;
  propertiesByStatus: {
    available: number;
    rented: number;
    maintenance: number;
  };
  recentApplications: Application[];
  overduePayments: Payment[];
  upcomingPayments: Payment[];
}

export interface RenterDashboard {
  activeApplications: Application[];
  currentRentals: RentalAgreement[];
  paymentHistory: Payment[];
  upcomingPayments: Payment[];
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Search and Filter types
export interface PropertySearchFilters {
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  city?: string;
  state?: string;
  petsAllowed?: boolean;
  furnished?: boolean;
  parking?: boolean;
  availableDate?: string;
}

export interface PropertySearchParams extends PropertySearchFilters {
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'date' | 'distance';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// File upload types
export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType: 'landlord' | 'renter';
  phone?: string;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: 'application' | 'payment' | 'maintenance' | 'general';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
} 
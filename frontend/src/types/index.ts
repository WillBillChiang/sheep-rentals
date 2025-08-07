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
  notes?: string;
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

// Form types
export interface PropertyFormData {
  title: string;
  description: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
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
  availableDate?: string;
  leaseTerms?: {
    minLeaseMonths: number;
    maxLeaseMonths?: number;
  };
}

export interface ApplicationFormData {
  propertyId: string;
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
  message?: string;
}

// UI Component types
export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  className?: string;
}

export interface SelectProps {
  label?: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Chart types
export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface LineChartData {
  date: string;
  value: number;
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

// File upload types
export interface FileUpload {
  file: File;
  preview?: string;
  progress?: number;
  uploaded?: boolean;
  error?: string;
}

// Pagination types
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

// Filter types
export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterGroup {
  name: string;
  options: FilterOption[];
  multiple?: boolean;
}

// Map types
export interface MapLocation {
  lat: number;
  lng: number;
  title?: string;
  address?: string;
}

// Image gallery types
export interface ImageGalleryProps {
  images: string[];
  currentIndex?: number;
  onClose?: () => void;
  showThumbnails?: boolean;
}

// Table types
export interface TableColumn<T> {
  key: keyof T;
  header: string;
  render?: (value: any, item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  sortable?: boolean;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  sortKey?: keyof T;
  sortDirection?: 'asc' | 'desc';
} 
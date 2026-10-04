export type UserRole = 'passenger' | 'driver' | 'admin';

export interface UserAccount {
  uid: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PassengerProfile {
  uid: string;
  fullName: string;
  photoUrl: string;
  email: string;
  phone: string;
  gender: string;
  city: string;
  bio: string;
  accountStatus: 'active' | 'suspended';
  rating: number;
  reviewCount: number;
  totalCompletedRides: number;
  showPhoneToDriver: boolean;
  showEmailToDriver: boolean;
  memberSince: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DriverVerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export interface DriverProfile {
  uid: string;
  fullName: string;
  photoUrl: string;
  city: string;
  bio: string;
  drivingExperienceYears: number;
  licenseSummary: string;
  verificationStatus: DriverVerificationStatus;
  rating: number;
  completedRides: number;
  reviewCount: number;
  memberSince: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DriverDocument {
  uid: string;
  email: string;
  phone: string;
  cnicNumber: string;
  licenseNumber: string;
  licenseExpiry: string;
  vehicleRegDocUrl: string;
  cnicDocUrl: string;
  licenseDocUrl: string;
  adminNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type VehicleType = 'Sedan' | 'SUV' | 'Hatchback' | 'Van' | 'Executive';

export interface Vehicle {
  id: string;
  driverUid: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  modelYear: number;
  registrationNumber: string;
  color: string;
  seats: number;
  images: string[];
  verified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type RideStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export interface Ride {
  id: string;
  driverUid: string;
  driverName: string;
  driverPhoto: string;
  driverVerified: boolean;
  driverRating: number;
  vehicleId: string;
  vehicleName: string;
  vehicleType: string;
  fromCity: string;
  toCity: string;
  pickupLocation: string;
  destinationLocation: string;
  optionalStops: string;
  departureDate: string;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  farePerSeat: number;
  description: string;
  status: RideStatus;
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'confirmed'
  | 'cancelled_by_passenger'
  | 'cancelled_by_driver'
  | 'ride_started'
  | 'completed';

export interface Booking {
  id: string;
  rideId: string;
  passengerUid: string;
  passengerName: string;
  passengerPhoto: string;
  passengerPhone: string;
  passengerCity: string;
  driverUid: string;
  driverName: string;
  fromCity: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  seatsBooked: number;
  totalFare: number;
  status: BookingStatus;
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LiveLocation {
  rideId: string;
  driverUid: string;
  driverName: string;
  vehicleName: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  distanceRemainingKm: number;
  etaMinutes: number;
  pickupLocation: string;
  destinationLocation: string;
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  active: boolean;
  rideStatus: 'en_route_pickup' | 'in_progress' | 'arrived' | 'completed';
  confirmedPassengerUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Review {
  id: string;
  rideId: string;
  bookingId: string;
  reviewerUid: string;
  reviewerName: string;
  reviewerRole: 'passenger' | 'driver';
  targetUid: string;
  targetName: string;
  rating: number;
  comment: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  recipientUid: string;
  senderUid: string;
  title: string;
  message: string;
  type: 'booking' | 'ride' | 'verification' | 'system' | 'tracking' | 'sos';
  read: boolean;
  relatedId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SOSAlert {
  id: string;
  senderUid: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderRole: 'passenger' | 'driver';
  lat: number;
  lng: number;
  locationLabel: string;
  rideId: string;
  message: string;
  status: 'active' | 'resolved';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt?: unknown;
}

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Karachi: { lat: 24.8607, lng: 67.0011 },
  Hyderabad: { lat: 25.3960, lng: 68.3578 },
  Lahore: { lat: 31.5204, lng: 74.3587 },
  Islamabad: { lat: 33.6844, lng: 73.0479 },
  Rawalpindi: { lat: 33.5651, lng: 73.0169 },
  Faisalabad: { lat: 31.4504, lng: 73.1350 },
  Multan: { lat: 30.1575, lng: 71.5249 },
  Peshawar: { lat: 34.0151, lng: 71.5249 },
  Sukkur: { lat: 27.7052, lng: 68.8574 },
  Quetta: { lat: 30.1798, lng: 66.9750 },
};

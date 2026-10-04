/**
 * Firestore Security Rules Test Suite (Phase 0 TDD Verification)
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED
 */
export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation (Self-Admin)',
    collection: 'users',
    docId: 'attacker1',
    operation: 'create',
    authUid: 'attacker1',
    emailVerified: true,
    payload: { uid: 'attacker1', email: 'attacker@example.com', role: 'admin', status: 'active' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Driver Self-Verification',
    collection: 'driverProfiles',
    docId: 'driver1',
    operation: 'create',
    authUid: 'driver1',
    emailVerified: true,
    payload: { uid: 'driver1', fullName: 'Malicious Driver', verificationStatus: 'verified' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unauthorized Live Location Tracking',
    collection: 'liveLocations',
    docId: 'ride123',
    operation: 'get',
    authUid: 'randomPublicUser',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Driver Document Leak to Passenger',
    collection: 'driverDocuments',
    docId: 'driver1',
    operation: 'get',
    authUid: 'passenger2',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection',
    collection: 'passengerProfiles',
    docId: 'user1',
    operation: 'update',
    authUid: 'user1',
    emailVerified: true,
    payload: { fullName: 'User One', isSuperAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Unverified Email Spoof',
    collection: 'rides',
    docId: 'ride1',
    operation: 'create',
    authUid: 'driver1',
    emailVerified: false,
    payload: { driverUid: 'driver1', fromCity: 'Karachi', toCity: 'Hyderabad' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Cross-User Booking Snooping',
    collection: 'bookings',
    docId: 'booking99',
    operation: 'get',
    authUid: 'unrelatedUser3',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Out-of-Range Rating',
    collection: 'reviews',
    docId: 'rev1',
    operation: 'create',
    authUid: 'user1',
    emailVerified: true,
    payload: { rideId: 'ride1', rating: 10, comment: 'Invalid rating' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized String Denial-of-Wallet',
    collection: 'rides',
    docId: 'ride1',
    operation: 'create',
    authUid: 'driver1',
    emailVerified: true,
    payload: { description: 'A'.repeat(5000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable Field Mutation',
    collection: 'bookings',
    docId: 'book1',
    operation: 'update',
    authUid: 'user1',
    emailVerified: true,
    payload: { passengerUid: 'someoneElse', status: 'cancelled_by_passenger' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Timestamp Forgery',
    collection: 'notifications',
    docId: 'notif1',
    operation: 'create',
    authUid: 'user1',
    emailVerified: true,
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Terminal State Modification',
    collection: 'bookings',
    docId: 'completedBooking1',
    operation: 'update',
    authUid: 'driver1',
    emailVerified: true,
    payload: { status: 'pending' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];

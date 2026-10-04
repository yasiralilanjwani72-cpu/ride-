# Ride Connect — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity & Ownership**:
   - Every user account (`/users/{userId}`), passenger profile (`/passengerProfiles/{userId}`), driver profile (`/driverProfiles/{driverId}`), and driver document (`/driverDocuments/{driverId}`) must have `uid == request.auth.uid` on creation (unless created by an Admin).
   - Users cannot self-assign `role: "admin"` on `/users/{userId}` unless their verified email is the bootstrapped admin email (`yasiralilanjwani72@gmail.com`) or they are already in `/admins/{uid}`.
   - Drivers cannot self-verify (`verificationStatus == "verified"`) on creation or update; only an Admin can set `verificationStatus` to `"verified"`, `"rejected"`, or `"suspended"`.
2. **PII & Document Protection**:
   - `/users/{userId}` is strictly readable only by the owner (`request.auth.uid == userId`) or an Admin.
   - `/driverDocuments/{driverId}` (containing CNIC, license numbers, private phone/email, and document URLs) is strictly readable only by the driver (`request.auth.uid == driverId`) or an Admin. Public users/passengers can never read `/driverDocuments`.
3. **Location Privacy Invariant**:
   - `/liveLocations/{rideId}` is strictly private. Only the driver of the ride (`resource.data.driverUid == request.auth.uid`), confirmed passengers of that ride (`request.auth.uid in resource.data.confirmedPassengerUids`), or an Admin can `get` or `list` the live location. A random/public user is strictly denied.
4. **Booking & Review Integrity**:
   - Bookings (`/bookings/{bookingId}`) can only be read/listed by the passenger (`resource.data.passengerUid == request.auth.uid`), the ride's driver (`resource.data.driverUid == request.auth.uid`), or an Admin.
   - Reviews (`/reviews/{reviewId}`) require `rating >= 1 && rating <= 5` and `reviewerUid == request.auth.uid`.
5. **Temporal & Structural Integrity**:
   - All writes enforce `createdAt == request.time` on creation, `updatedAt == request.time` on updates, and immutable `createdAt` + owner UIDs on update.
   - Every string field enforces `.size() <= MAX` according to `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Payloads

1. **Privilege Escalation (Self-Admin)**: Authenticated non-admin creates `/users/attacker1` with `role: 'admin'`. -> `PERMISSION_DENIED`
2. **Driver Self-Verification**: Driver creates or updates `/driverProfiles/driver1` with `verificationStatus: 'verified'`. -> `PERMISSION_DENIED`
3. **Unauthorized Live Location Tracking**: Random signed-in user `randomUser` attempts `get` on `/liveLocations/ride123` where `confirmedPassengerUids` does not include `randomUser`. -> `PERMISSION_DENIED`
4. **Driver Document Leak**: Passenger `user2` attempts `get` on `/driverDocuments/driver1`. -> `PERMISSION_DENIED`
5. **Shadow Field Injection**: User updates `/passengerProfiles/user1` adding an undeclared field `isSuperAdmin: true`. -> `PERMISSION_DENIED`
6. **Unverified Email Spoof**: User with `email_verified: false` attempts to create a ride or booking. -> `PERMISSION_DENIED`
7. **Cross-User Booking Snooping**: User `user3` attempts `list` on `/bookings` without filtering by `passengerUid == request.auth.uid` or `driverUid == request.auth.uid`. -> `PERMISSION_DENIED`
8. **Out-of-Range Rating**: Passenger creates `/reviews/rev1` with `rating: 10`. -> `PERMISSION_DENIED`
9. **Oversized String Denial-of-Wallet**: User creates `/rides/ride1` with `description` of 5,000 characters (limit 600). -> `PERMISSION_DENIED`
10. **Immutable Field Mutation**: Passenger updates `/bookings/book1` changing `passengerUid` or `createdAt`. -> `PERMISSION_DENIED`
11. **Timestamp Forgery**: User creates `/notifications/notif1` with a past or future client timestamp (`createdAt != request.time`). -> `PERMISSION_DENIED`
12. **Terminal State Modification**: Non-admin user attempts to update a booking whose existing status is already `'completed'` to `'pending'`. -> `PERMISSION_DENIED`

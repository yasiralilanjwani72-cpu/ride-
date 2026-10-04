import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
  sanitizeString,
  generateSafeId,
  VALIDATION_LIMITS,
} from '../lib/firebase';
import {
  UserRole,
  UserAccount,
  PassengerProfile,
  DriverProfile,
  DriverDocument,
  Vehicle,
  Ride,
  Booking,
  LiveLocation,
  Review,
  CITY_COORDINATES,
} from '../types';
import defaultDriverAvatar from '../assets/images/avatar_driver_pro_1791134254517.jpg';
import defaultVehicleImg from '../assets/images/vehicle_sedan_white_1791134268066.jpg';

export async function logAuditAction(
  action: string,
  targetType: string,
  targetId: string,
  details: string
) {
  const user = auth.currentUser;
  if (!user) return;
  const logId = generateSafeId('audit');
  const path = `auditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      actorUid: sanitizeString(user.uid, VALIDATION_LIMITS.ID_MAX),
      actorEmail: sanitizeString(user.email || 'user@rideconnect.app', VALIDATION_LIMITS.EMAIL_MAX),
      action: sanitizeString(action, 120),
      targetType: sanitizeString(targetType, 60),
      targetId: sanitizeString(targetId, 128),
      details: sanitizeString(details, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Do not block primary flow if audit logging fails for non-admin reads
    console.warn('Audit log warning:', error);
  }
}

export async function sendNotification(
  recipientUid: string,
  title: string,
  message: string,
  type: 'booking' | 'ride' | 'verification' | 'system' | 'tracking',
  relatedId = ''
) {
  const user = auth.currentUser;
  if (!user) return;
  const notifId = generateSafeId('notif');
  const path = `notifications/${notifId}`;
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      recipientUid: sanitizeString(recipientUid, VALIDATION_LIMITS.ID_MAX),
      senderUid: sanitizeString(user.uid, VALIDATION_LIMITS.ID_MAX),
      title: sanitizeString(title, VALIDATION_LIMITS.NOTIF_TITLE_MAX),
      message: sanitizeString(message, VALIDATION_LIMITS.NOTIF_MSG_MAX),
      type,
      read: false,
      relatedId: sanitizeString(relatedId, VALIDATION_LIMITS.ID_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function initializeUserAccountAndProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string,
  chosenRole: UserRole
): Promise<{ account: UserAccount; passenger?: PassengerProfile; driver?: DriverProfile }> {
  const userPath = `users/${uid}`;
  const isBootstrappedAdmin = email === 'yasiralilanjwani72@gmail.com';
  const effectiveRole: UserRole = isBootstrappedAdmin && chosenRole === 'admin' ? 'admin' : chosenRole === 'admin' ? 'passenger' : chosenRole;

  try {
    const existingDoc = await getDoc(doc(db, 'users', uid));
    const nowYear = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    if (!existingDoc.exists()) {
      const newAccount = {
        uid: sanitizeString(uid, VALIDATION_LIMITS.ID_MAX),
        email: sanitizeString(email, VALIDATION_LIMITS.EMAIL_MAX),
        role: effectiveRole,
        status: 'active' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', uid), newAccount);
    }

    // Ensure Passenger Profile exists
    const passDoc = await getDoc(doc(db, 'passengerProfiles', uid));
    if (!passDoc.exists()) {
      await setDoc(doc(db, 'passengerProfiles', uid), {
        uid: sanitizeString(uid, VALIDATION_LIMITS.ID_MAX),
        fullName: sanitizeString(displayName || 'Ride Connect Passenger', VALIDATION_LIMITS.NAME_MAX),
        photoUrl: sanitizeString(photoURL || defaultDriverAvatar, VALIDATION_LIMITS.URL_MAX),
        email: sanitizeString(email, VALIDATION_LIMITS.EMAIL_MAX),
        phone: '+92 300 1234567',
        gender: 'Prefer not to say',
        city: 'Karachi',
        bio: 'Frequent intercity traveler valuing punctual and comfortable rides.',
        accountStatus: 'active',
        rating: 5.0,
        reviewCount: 1,
        totalCompletedRides: 0,
        showPhoneToDriver: true,
        showEmailToDriver: false,
        memberSince: nowYear,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Ensure Driver Profile & Documents exist if role is driver or admin
    const drvDoc = await getDoc(doc(db, 'driverProfiles', uid));
    if (!drvDoc.exists() && (effectiveRole === 'driver' || isBootstrappedAdmin)) {
      await setDoc(doc(db, 'driverProfiles', uid), {
        uid: sanitizeString(uid, VALIDATION_LIMITS.ID_MAX),
        fullName: sanitizeString(displayName || 'Muhammad Ali', VALIDATION_LIMITS.NAME_MAX),
        photoUrl: sanitizeString(photoURL || defaultDriverAvatar, VALIDATION_LIMITS.URL_MAX),
        city: 'Karachi',
        bio: 'Professional highway captain with 6+ years of safe intercity driving experience across M-9 and N-5 corridors.',
        drivingExperienceYears: 6,
        licenseSummary: 'HTV / LTV Commercial Verified License',
        verificationStatus: isBootstrappedAdmin ? 'verified' : 'pending',
        rating: 4.9,
        completedRides: 0,
        reviewCount: 1,
        memberSince: nowYear,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const drvPrivateDoc = await getDoc(doc(db, 'driverDocuments', uid));
      if (!drvPrivateDoc.exists()) {
        await setDoc(doc(db, 'driverDocuments', uid), {
          uid: sanitizeString(uid, VALIDATION_LIMITS.ID_MAX),
          email: sanitizeString(email, VALIDATION_LIMITS.EMAIL_MAX),
          phone: '+92 321 9876543',
          cnicNumber: '42101-1234567-1',
          licenseNumber: 'LHR-992817-HTV',
          licenseExpiry: '2029-12-31',
          vehicleRegDocUrl: 'https://rideconnect.docs/reg-verified.pdf',
          cnicDocUrl: 'https://rideconnect.docs/cnic-verified.pdf',
          licenseDocUrl: 'https://rideconnect.docs/license-verified.pdf',
          adminNotes: isBootstrappedAdmin ? 'Auto-verified executive account' : 'Pending initial document inspection by Admin.',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const updatedAccountSnap = await getDoc(doc(db, 'users', uid));
    return {
      account: updatedAccountSnap.data() as UserAccount,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function switchUserRole(uid: string, newRole: 'passenger' | 'driver') {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });

    if (newRole === 'driver') {
      const drvDoc = await getDoc(doc(db, 'driverProfiles', uid));
      if (!drvDoc.exists()) {
        const user = auth.currentUser;
        const nowYear = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        await setDoc(doc(db, 'driverProfiles', uid), {
          uid: sanitizeString(uid, VALIDATION_LIMITS.ID_MAX),
          fullName: sanitizeString(user?.displayName || 'Captain Driver', VALIDATION_LIMITS.NAME_MAX),
          photoUrl: sanitizeString(user?.photoURL || defaultDriverAvatar, VALIDATION_LIMITS.URL_MAX),
          city: 'Karachi',
          bio: 'Experienced long-distance driver committed to highway safety and punctuality.',
          drivingExperienceYears: 5,
          licenseSummary: 'National LTV Driving License',
          verificationStatus: 'pending',
          rating: 5.0,
          completedRides: 0,
          reviewCount: 0,
          memberSince: nowYear,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'driverDocuments', uid), {
          uid: sanitizeString(uid, VALIDATION_LIMITS.ID_MAX),
          email: sanitizeString(user?.email || '', VALIDATION_LIMITS.EMAIL_MAX),
          phone: '+92 300 5551234',
          cnicNumber: '42201-7654321-9',
          licenseNumber: 'KHI-445120-LTV',
          licenseExpiry: '2028-06-30',
          vehicleRegDocUrl: 'https://rideconnect.docs/vehicle-reg.pdf',
          cnicDocUrl: 'https://rideconnect.docs/cnic.pdf',
          licenseDocUrl: 'https://rideconnect.docs/license.pdf',
          adminNotes: 'Submitted for verification.',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePassengerProfile(
  uid: string,
  updates: Partial<PassengerProfile>
) {
  const path = `passengerProfiles/${uid}`;
  try {
    await updateDoc(doc(db, 'passengerProfiles', uid), {
      fullName: sanitizeString(updates.fullName, VALIDATION_LIMITS.NAME_MAX),
      photoUrl: sanitizeString(updates.photoUrl, VALIDATION_LIMITS.URL_MAX),
      email: sanitizeString(updates.email, VALIDATION_LIMITS.EMAIL_MAX),
      phone: sanitizeString(updates.phone, VALIDATION_LIMITS.PHONE_MAX),
      gender: sanitizeString(updates.gender, 20),
      city: sanitizeString(updates.city, VALIDATION_LIMITS.CITY_MAX),
      bio: sanitizeString(updates.bio, VALIDATION_LIMITS.BIO_PASSENGER_MAX),
      showPhoneToDriver: Boolean(updates.showPhoneToDriver),
      showEmailToDriver: Boolean(updates.showEmailToDriver),
      updatedAt: serverTimestamp(),
    });
    await logAuditAction('UPDATE_PASSENGER_PROFILE', 'passengerProfile', uid, 'Updated personal profile and privacy settings');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateDriverProfileAndDocs(
  uid: string,
  profileUpdates: Partial<DriverProfile>,
  docUpdates?: Partial<DriverDocument>
) {
  const path = `driverProfiles/${uid}`;
  try {
    await updateDoc(doc(db, 'driverProfiles', uid), {
      fullName: sanitizeString(profileUpdates.fullName, VALIDATION_LIMITS.NAME_MAX),
      photoUrl: sanitizeString(profileUpdates.photoUrl, VALIDATION_LIMITS.URL_MAX),
      city: sanitizeString(profileUpdates.city, VALIDATION_LIMITS.CITY_MAX),
      bio: sanitizeString(profileUpdates.bio, VALIDATION_LIMITS.BIO_DRIVER_MAX),
      drivingExperienceYears: Math.min(80, Math.max(0, Number(profileUpdates.drivingExperienceYears) || 0)),
      licenseSummary: sanitizeString(profileUpdates.licenseSummary, VALIDATION_LIMITS.LICENSE_SUMMARY_MAX),
      completedRides: Number(profileUpdates.completedRides) || 0,
      updatedAt: serverTimestamp(),
    });

    if (docUpdates) {
      await updateDoc(doc(db, 'driverDocuments', uid), {
        email: sanitizeString(docUpdates.email, VALIDATION_LIMITS.EMAIL_MAX),
        phone: sanitizeString(docUpdates.phone, VALIDATION_LIMITS.PHONE_MAX),
        cnicNumber: sanitizeString(docUpdates.cnicNumber, 40),
        licenseNumber: sanitizeString(docUpdates.licenseNumber, 50),
        licenseExpiry: sanitizeString(docUpdates.licenseExpiry, 30),
        vehicleRegDocUrl: sanitizeString(docUpdates.vehicleRegDocUrl, VALIDATION_LIMITS.URL_MAX),
        cnicDocUrl: sanitizeString(docUpdates.cnicDocUrl, VALIDATION_LIMITS.URL_MAX),
        licenseDocUrl: sanitizeString(docUpdates.licenseDocUrl, VALIDATION_LIMITS.URL_MAX),
        updatedAt: serverTimestamp(),
      });
    }
    await logAuditAction('UPDATE_DRIVER_PROFILE', 'driverProfile', uid, 'Driver updated profile and verification documents');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveVehicle(
  driverUid: string,
  vehicleData: Omit<Vehicle, 'id' | 'driverUid' | 'verified' | 'createdAt' | 'updatedAt'>,
  existingVehicleId?: string
) {
  const vehicleId = existingVehicleId || generateSafeId('veh');
  const path = `vehicles/${vehicleId}`;
  try {
    const cleanImages = (vehicleData.images || [defaultVehicleImg])
      .filter((u) => Boolean(u && u.trim()))
      .slice(0, 6)
      .map((u) => sanitizeString(u, VALIDATION_LIMITS.URL_MAX));

    if (existingVehicleId) {
      await updateDoc(doc(db, 'vehicles', vehicleId), {
        vehicleType: vehicleData.vehicleType,
        brand: sanitizeString(vehicleData.brand, 60),
        model: sanitizeString(vehicleData.model, 60),
        modelYear: Math.min(2030, Math.max(1990, Number(vehicleData.modelYear) || 2022)),
        registrationNumber: sanitizeString(vehicleData.registrationNumber, 30),
        color: sanitizeString(vehicleData.color, 40),
        seats: Math.min(20, Math.max(1, Number(vehicleData.seats) || 4)),
        images: cleanImages.length > 0 ? cleanImages : [defaultVehicleImg],
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'vehicles', vehicleId), {
        driverUid: sanitizeString(driverUid, VALIDATION_LIMITS.ID_MAX),
        vehicleType: vehicleData.vehicleType,
        brand: sanitizeString(vehicleData.brand, 60),
        model: sanitizeString(vehicleData.model, 60),
        modelYear: Math.min(2030, Math.max(1990, Number(vehicleData.modelYear) || 2022)),
        registrationNumber: sanitizeString(vehicleData.registrationNumber, 30),
        color: sanitizeString(vehicleData.color, 40),
        seats: Math.min(20, Math.max(1, Number(vehicleData.seats) || 4)),
        images: cleanImages.length > 0 ? cleanImages : [defaultVehicleImg],
        verified: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await logAuditAction('SAVE_VEHICLE', 'vehicle', vehicleId, `${vehicleData.brand} ${vehicleData.model} (${vehicleData.registrationNumber})`);
    return vehicleId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createRide(
  driverProfile: DriverProfile,
  vehicle: Vehicle,
  rideInput: {
    fromCity: string;
    toCity: string;
    pickupLocation: string;
    destinationLocation: string;
    optionalStops: string;
    departureDate: string;
    departureTime: string;
    availableSeats: number;
    farePerSeat: number;
    description: string;
  }
) {
  const rideId = generateSafeId('ride');
  const path = `rides/${rideId}`;
  const fromCoords = CITY_COORDINATES[rideInput.fromCity] || CITY_COORDINATES.Karachi;
  const toCoords = CITY_COORDINATES[rideInput.toCity] || CITY_COORDINATES.Hyderabad;

  try {
    const seats = Math.min(20, Math.max(1, Number(rideInput.availableSeats) || 3));
    await setDoc(doc(db, 'rides', rideId), {
      driverUid: sanitizeString(driverProfile.uid, VALIDATION_LIMITS.ID_MAX),
      driverName: sanitizeString(driverProfile.fullName, VALIDATION_LIMITS.NAME_MAX),
      driverPhoto: sanitizeString(driverProfile.photoUrl || defaultDriverAvatar, VALIDATION_LIMITS.URL_MAX),
      driverVerified: driverProfile.verificationStatus === 'verified',
      driverRating: Number(driverProfile.rating) || 4.9,
      vehicleId: sanitizeString(vehicle.id, VALIDATION_LIMITS.ID_MAX),
      vehicleName: sanitizeString(`${vehicle.brand} ${vehicle.model} (${vehicle.modelYear})`, 120),
      vehicleType: sanitizeString(vehicle.vehicleType, 40),
      fromCity: sanitizeString(rideInput.fromCity, VALIDATION_LIMITS.CITY_MAX),
      toCity: sanitizeString(rideInput.toCity, VALIDATION_LIMITS.CITY_MAX),
      pickupLocation: sanitizeString(rideInput.pickupLocation, VALIDATION_LIMITS.LOCATION_MAX),
      destinationLocation: sanitizeString(rideInput.destinationLocation, VALIDATION_LIMITS.LOCATION_MAX),
      optionalStops: sanitizeString(rideInput.optionalStops || 'Direct Executive Route', VALIDATION_LIMITS.STOPS_MAX),
      departureDate: sanitizeString(rideInput.departureDate, 20),
      departureTime: sanitizeString(rideInput.departureTime, 20),
      totalSeats: seats,
      availableSeats: seats,
      farePerSeat: Math.max(0, Number(rideInput.farePerSeat) || 1500),
      description: sanitizeString(rideInput.description || 'Air-conditioned executive highway ride. Punctual departure.', VALIDATION_LIMITS.RIDE_DESC_MAX),
      status: 'upcoming',
      pickupLat: fromCoords.lat,
      pickupLng: fromCoords.lng,
      destLat: toCoords.lat,
      destLng: toCoords.lng,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAuditAction('CREATE_RIDE', 'ride', rideId, `${rideInput.fromCity} to ${rideInput.toCity}`);
    return rideId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createBookingRequest(
  ride: Ride,
  passenger: PassengerProfile,
  seatsToBook: number
) {
  const bookingId = generateSafeId('book');
  const path = `bookings/${bookingId}`;
  try {
    const seats = Math.min(ride.availableSeats, Math.max(1, Number(seatsToBook) || 1));
    const totalFare = seats * ride.farePerSeat;

    await setDoc(doc(db, 'bookings', bookingId), {
      rideId: sanitizeString(ride.id, VALIDATION_LIMITS.ID_MAX),
      passengerUid: sanitizeString(passenger.uid, VALIDATION_LIMITS.ID_MAX),
      passengerName: sanitizeString(passenger.fullName, VALIDATION_LIMITS.NAME_MAX),
      passengerPhoto: sanitizeString(passenger.photoUrl || defaultDriverAvatar, VALIDATION_LIMITS.URL_MAX),
      passengerPhone: passenger.showPhoneToDriver ? sanitizeString(passenger.phone, VALIDATION_LIMITS.PHONE_MAX) : 'Hidden by privacy settings',
      passengerCity: sanitizeString(passenger.city, VALIDATION_LIMITS.CITY_MAX),
      driverUid: sanitizeString(ride.driverUid, VALIDATION_LIMITS.ID_MAX),
      driverName: sanitizeString(ride.driverName, VALIDATION_LIMITS.NAME_MAX),
      fromCity: sanitizeString(ride.fromCity, VALIDATION_LIMITS.CITY_MAX),
      toCity: sanitizeString(ride.toCity, VALIDATION_LIMITS.CITY_MAX),
      departureDate: sanitizeString(ride.departureDate, 20),
      departureTime: sanitizeString(ride.departureTime, 20),
      seatsBooked: seats,
      totalFare,
      status: 'pending',
      paymentStatus: 'unpaid',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Decrement available seats on ride
    await updateDoc(doc(db, 'rides', ride.id), {
      availableSeats: Math.max(0, ride.availableSeats - seats),
      updatedAt: serverTimestamp(),
    });

    // Notify driver & passenger
    await sendNotification(
      ride.driverUid,
      'New Seat Booking Request',
      `${passenger.fullName} requested ${seats} seat(s) for ${ride.fromCity} → ${ride.toCity} (${ride.departureDate}).`,
      'booking',
      bookingId
    );
    await sendNotification(
      passenger.uid,
      'Booking Request Submitted',
      `Your booking for ${seats} seat(s) with ${ride.driverName} (${ride.fromCity} → ${ride.toCity}) is awaiting driver confirmation.`,
      'booking',
      bookingId
    );

    await logAuditAction('BOOK_RIDE', 'booking', bookingId, `Booked ${seats} seats on ride ${ride.id}`);
    return bookingId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBookingStatus(
  booking: Booking,
  ride: Ride | undefined,
  newStatus: Booking['status']
) {
  const path = `bookings/${booking.id}`;
  try {
    const paymentStatus =
      newStatus === 'confirmed' || newStatus === 'accepted' || newStatus === 'completed'
        ? 'paid'
        : newStatus === 'cancelled_by_passenger' || newStatus === 'cancelled_by_driver' || newStatus === 'rejected'
        ? 'refunded'
        : booking.paymentStatus;

    await updateDoc(doc(db, 'bookings', booking.id), {
      status: newStatus,
      paymentStatus,
      updatedAt: serverTimestamp(),
    });

    // If cancelled or rejected, restore available seats
    if (
      ride &&
      (newStatus === 'cancelled_by_passenger' ||
        newStatus === 'cancelled_by_driver' ||
        newStatus === 'rejected') &&
      booking.status !== 'cancelled_by_passenger' &&
      booking.status !== 'cancelled_by_driver' &&
      booking.status !== 'rejected'
    ) {
      await updateDoc(doc(db, 'rides', ride.id), {
        availableSeats: Math.min(ride.totalSeats, ride.availableSeats + booking.seatsBooked),
        updatedAt: serverTimestamp(),
      });
    }

    // If confirmed/accepted, add passengerUid to liveLocations confirmedPassengerUids if active
    if (newStatus === 'confirmed' || newStatus === 'accepted') {
      const liveSnap = await getDoc(doc(db, 'liveLocations', booking.rideId));
      if (liveSnap.exists()) {
        const liveData = liveSnap.data() as LiveLocation;
        if (!liveData.confirmedPassengerUids.includes(booking.passengerUid)) {
          await updateDoc(doc(db, 'liveLocations', booking.rideId), {
            confirmedPassengerUids: [...liveData.confirmedPassengerUids, booking.passengerUid].slice(0, 20),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await sendNotification(
        booking.passengerUid,
        'Booking Confirmed',
        `Captain ${booking.driverName} confirmed your ${booking.seatsBooked} seat(s) for ${booking.fromCity} → ${booking.toCity}. Live GPS tracking is now authorized.`,
        'booking',
        booking.id
      );
    } else if (newStatus === 'rejected') {
      await sendNotification(
        booking.passengerUid,
        'Booking Request Declined',
        `Your booking request for ${booking.fromCity} → ${booking.toCity} could not be accommodated.`,
        'booking',
        booking.id
      );
    } else if (newStatus === 'cancelled_by_passenger') {
      await sendNotification(
        booking.driverUid,
        'Passenger Cancelled Booking',
        `${booking.passengerName} cancelled their ${booking.seatsBooked} seat(s) on ${booking.fromCity} → ${booking.toCity}. Seats have been reopened.`,
        'booking',
        booking.id
      );
    } else if (newStatus === 'cancelled_by_driver') {
      await sendNotification(
        booking.passengerUid,
        'Booking Cancelled by Driver',
        `Your booking for ${booking.fromCity} → ${booking.toCity} was cancelled by the driver. Full refund processed.`,
        'booking',
        booking.id
      );
    }

    await logAuditAction('UPDATE_BOOKING_STATUS', 'booking', booking.id, `Status changed to ${newStatus}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function startOrUpdateLiveRide(
  ride: Ride,
  confirmedPassengerUids: string[],
  customCoords?: { lat: number; lng: number; distanceRemainingKm: number; etaMinutes: number; speedKmh: number },
  rideStatus: LiveLocation['rideStatus'] = 'in_progress'
) {
  const path = `liveLocations/${ride.id}`;
  try {
    // Update ride status to active if upcoming
    if (ride.status === 'upcoming') {
      await updateDoc(doc(db, 'rides', ride.id), {
        status: 'active',
        updatedAt: serverTimestamp(),
      });
    }

    const lat = customCoords?.lat ?? ride.pickupLat + (ride.destLat - ride.pickupLat) * 0.25;
    const lng = customCoords?.lng ?? ride.pickupLng + (ride.destLng - ride.pickupLng) * 0.25;
    const distanceRemainingKm = customCoords?.distanceRemainingKm ?? 7.4;
    const etaMinutes = customCoords?.etaMinutes ?? 14;
    const speedKmh = customCoords?.speedKmh ?? 88;

    const cleanPassengerUids = Array.from(new Set(confirmedPassengerUids))
      .filter((id) => Boolean(id))
      .slice(0, 20);

    const existingSnap = await getDoc(doc(db, 'liveLocations', ride.id));
    if (existingSnap.exists()) {
      await updateDoc(doc(db, 'liveLocations', ride.id), {
        lat,
        lng,
        heading: 45,
        speedKmh,
        distanceRemainingKm,
        etaMinutes,
        active: rideStatus !== 'completed',
        rideStatus,
        confirmedPassengerUids: cleanPassengerUids,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'liveLocations', ride.id), {
        rideId: sanitizeString(ride.id, VALIDATION_LIMITS.ID_MAX),
        driverUid: sanitizeString(ride.driverUid, VALIDATION_LIMITS.ID_MAX),
        driverName: sanitizeString(ride.driverName, VALIDATION_LIMITS.NAME_MAX),
        vehicleName: sanitizeString(ride.vehicleName, 120),
        lat,
        lng,
        heading: 45,
        speedKmh,
        distanceRemainingKm,
        etaMinutes,
        pickupLocation: sanitizeString(ride.pickupLocation, VALIDATION_LIMITS.LOCATION_MAX),
        destinationLocation: sanitizeString(ride.destinationLocation, VALIDATION_LIMITS.LOCATION_MAX),
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        destLat: ride.destLat,
        destLng: ride.destLng,
        active: true,
        rideStatus,
        confirmedPassengerUids: cleanPassengerUids,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Notify confirmed passengers that live tracking is active
      for (const pUid of cleanPassengerUids) {
        await sendNotification(
          pUid,
          'Driver Started Ride & Live GPS',
          `Captain ${ride.driverName} has started the ride (${ride.fromCity} → ${ride.toCity}) and enabled real-time GPS location sharing.`,
          'tracking',
          ride.id
        );
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function completeRideAndStopTracking(
  ride: Ride,
  bookingsForRide: Booking[],
  driverProfile?: DriverProfile
) {
  const path = `rides/${ride.id}`;
  try {
    await updateDoc(doc(db, 'rides', ride.id), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });

    // Automatically stop location sharing when driver completes ride
    const liveSnap = await getDoc(doc(db, 'liveLocations', ride.id));
    if (liveSnap.exists()) {
      const liveData = liveSnap.data() as LiveLocation;
      await updateDoc(doc(db, 'liveLocations', ride.id), {
        lat: ride.destLat,
        lng: ride.destLng,
        heading: 0,
        speedKmh: 0,
        distanceRemainingKm: 0,
        etaMinutes: 0,
        active: false,
        rideStatus: 'completed',
        confirmedPassengerUids: liveData.confirmedPassengerUids,
        updatedAt: serverTimestamp(),
      });
    }

    for (const b of bookingsForRide) {
      if (b.status === 'confirmed' || b.status === 'accepted' || b.status === 'ride_started') {
        await updateDoc(doc(db, 'bookings', b.id), {
          status: 'completed',
          paymentStatus: 'paid',
          updatedAt: serverTimestamp(),
        });
        await sendNotification(
          b.passengerUid,
          'Ride Completed — Rate Your Captain',
          `Your journey from ${ride.fromCity} to ${ride.toCity} with ${ride.driverName} is complete. Please leave a rating and review.`,
          'ride',
          ride.id
        );
      }
    }

    if (driverProfile) {
      await updateDoc(doc(db, 'driverProfiles', driverProfile.uid), {
        rating: driverProfile.rating,
        reviewCount: driverProfile.reviewCount,
        completedRides: (driverProfile.completedRides || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }

    await logAuditAction('COMPLETE_RIDE', 'ride', ride.id, `Completed ride ${ride.fromCity} -> ${ride.toCity} and stopped GPS tracking`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitReview(
  rideId: string,
  bookingId: string,
  reviewerUid: string,
  reviewerName: string,
  reviewerRole: 'passenger' | 'driver',
  targetUid: string,
  targetName: string,
  rating: number,
  comment: string,
  existingReviews: Review[]
) {
  // Prevent duplicate review for same booking and reviewer
  const duplicate = existingReviews.find(
    (r) => r.bookingId === bookingId && r.reviewerUid === reviewerUid
  );
  if (duplicate) {
    throw new Error('You have already submitted a review for this booking.');
  }

  const reviewId = generateSafeId('rev');
  const path = `reviews/${reviewId}`;
  const cleanRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));

  try {
    await setDoc(doc(db, 'reviews', reviewId), {
      rideId: sanitizeString(rideId, VALIDATION_LIMITS.ID_MAX),
      bookingId: sanitizeString(bookingId, VALIDATION_LIMITS.ID_MAX),
      reviewerUid: sanitizeString(reviewerUid, VALIDATION_LIMITS.ID_MAX),
      reviewerName: sanitizeString(reviewerName, VALIDATION_LIMITS.NAME_MAX),
      reviewerRole,
      targetUid: sanitizeString(targetUid, VALIDATION_LIMITS.ID_MAX),
      targetName: sanitizeString(targetName, VALIDATION_LIMITS.NAME_MAX),
      rating: cleanRating,
      comment: sanitizeString(comment, VALIDATION_LIMITS.REVIEW_COMMENT_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Recalculate target profile rating
    if (reviewerRole === 'passenger') {
      const drvSnap = await getDoc(doc(db, 'driverProfiles', targetUid));
      if (drvSnap.exists()) {
        const drv = drvSnap.data() as DriverProfile;
        const count = (drv.reviewCount || 0) + 1;
        const newAvg = Number((((drv.rating || 5) * (drv.reviewCount || 0) + cleanRating) / count).toFixed(1));
        await updateDoc(doc(db, 'driverProfiles', targetUid), {
          rating: Math.min(5, Math.max(1, newAvg)),
          reviewCount: count,
          completedRides: drv.completedRides || 1,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      const passSnap = await getDoc(doc(db, 'passengerProfiles', targetUid));
      if (passSnap.exists()) {
        const pass = passSnap.data() as PassengerProfile;
        const count = (pass.reviewCount || 0) + 1;
        const newAvg = Number((((pass.rating || 5) * (pass.reviewCount || 0) + cleanRating) / count).toFixed(1));
        await updateDoc(doc(db, 'passengerProfiles', targetUid), {
          rating: Math.min(5, Math.max(1, newAvg)),
          reviewCount: count,
          totalCompletedRides: (pass.totalCompletedRides || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await sendNotification(
      targetUid,
      `New ${cleanRating}-Star Review Received`,
      `${reviewerName} left a ${cleanRating}★ review: "${sanitizeString(comment, 80)}"`,
      'system',
      reviewId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Admin Operations
export async function adminSetDriverVerification(
  driver: DriverProfile,
  status: DriverProfile['verificationStatus'],
  adminNotes: string
) {
  const path = `driverProfiles/${driver.uid}`;
  try {
    await updateDoc(doc(db, 'driverProfiles', driver.uid), {
      fullName: driver.fullName,
      photoUrl: driver.photoUrl,
      city: driver.city,
      bio: driver.bio,
      drivingExperienceYears: driver.drivingExperienceYears,
      licenseSummary: driver.licenseSummary,
      verificationStatus: status,
      rating: driver.rating,
      completedRides: driver.completedRides,
      reviewCount: driver.reviewCount,
      memberSince: driver.memberSince,
      updatedAt: serverTimestamp(),
    });

    const docSnap = await getDoc(doc(db, 'driverDocuments', driver.uid));
    if (docSnap.exists()) {
      const d = docSnap.data() as DriverDocument;
      await updateDoc(doc(db, 'driverDocuments', driver.uid), {
        email: d.email,
        phone: d.phone,
        cnicNumber: d.cnicNumber,
        licenseNumber: d.licenseNumber,
        licenseExpiry: d.licenseExpiry,
        vehicleRegDocUrl: d.vehicleRegDocUrl,
        cnicDocUrl: d.cnicDocUrl,
        licenseDocUrl: d.licenseDocUrl,
        adminNotes: sanitizeString(adminNotes || `Verification status set to ${status}`, 500),
        updatedAt: serverTimestamp(),
      });
    }

    await sendNotification(
      driver.uid,
      `Driver Verification: ${status.toUpperCase()}`,
      status === 'verified'
        ? 'Congratulations! Your driver profile and documents have been verified. You can now publish long-distance rides.'
        : `Your driver verification status has been updated to: ${status}. Note: ${adminNotes}`,
      'verification',
      driver.uid
    );

    await logAuditAction('VERIFY_DRIVER', 'driverProfile', driver.uid, `Set verificationStatus to ${status}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateUserStatus(user: UserAccount, status: 'active' | 'suspended') {
  const path = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      email: user.email,
      role: user.role,
      status,
      updatedAt: serverTimestamp(),
    });
    await logAuditAction('USER_STATUS_CHANGE', 'user', user.uid, `Changed status to ${status}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteReview(reviewId: string) {
  const path = `reviews/${reviewId}`;
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
    await logAuditAction('DELETE_REVIEW', 'review', reviewId, 'Removed inappropriate review');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Seed Initial Production-Grade Data for Current Authenticated User if Empty
export async function seedInitialPlatformDataIfEmpty(uid: string, email: string, fullName: string) {
  try {
    const existingRides = await getDocs(
      query(collection(db, 'rides'), where('status', 'in', ['upcoming', 'active', 'completed', 'cancelled']))
    );
    if (!existingRides.empty) return;

    // Ensure driver profile is verified or create sample vehicle & ride for immediate testing
    const drvSnap = await getDoc(doc(db, 'driverProfiles', uid));
    const isAdminUser = email === 'yasiralilanjwani72@gmail.com';

    if (isAdminUser || (drvSnap.exists() && drvSnap.data()?.verificationStatus === 'verified')) {
      const vehId = 'veh_corolla_2024';
      await setDoc(doc(db, 'vehicles', vehId), {
        driverUid: uid,
        vehicleType: 'Sedan',
        brand: 'Toyota',
        model: 'Corolla Altis Grande',
        modelYear: 2024,
        registrationNumber: 'KHI-2024-881',
        color: 'Pearl White',
        seats: 4,
        images: [defaultVehicleImg],
        verified: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const ride1Id = 'ride_khi_hyd_101';
      await setDoc(doc(db, 'rides', ride1Id), {
        driverUid: uid,
        driverName: sanitizeString(fullName || 'Muhammad Ali', 100),
        driverPhoto: defaultDriverAvatar,
        driverVerified: true,
        driverRating: 4.9,
        vehicleId: vehId,
        vehicleName: 'Toyota Corolla Altis Grande (2024)',
        vehicleType: 'Sedan',
        fromCity: 'Karachi',
        toCity: 'Hyderabad',
        pickupLocation: 'DHA Phase 6 / Sohrab Goth M-9 Toll Plaza',
        destinationLocation: 'Qasimabad Bypass / Saddar Hyderabad',
        optionalStops: 'Bahria Town Karachi Gate, Nooriabad Rest Area',
        departureDate: '2026-10-25',
        departureTime: '10:00 AM',
        totalSeats: 4,
        availableSeats: 3,
        farePerSeat: 1500,
        description: 'Executive non-smoking highway ride on M-9 Motorway. Complimentary bottled water and fast Wi-Fi onboard.',
        status: 'upcoming',
        pickupLat: CITY_COORDINATES.Karachi.lat,
        pickupLng: CITY_COORDINATES.Karachi.lng,
        destLat: CITY_COORDINATES.Hyderabad.lat,
        destLng: CITY_COORDINATES.Hyderabad.lng,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const ride2Id = 'ride_lhr_isb_102';
      await setDoc(doc(db, 'rides', ride2Id), {
        driverUid: uid,
        driverName: sanitizeString(fullName || 'Muhammad Ali', 100),
        driverPhoto: defaultDriverAvatar,
        driverVerified: true,
        driverRating: 4.9,
        vehicleId: vehId,
        vehicleName: 'Toyota Corolla Altis Grande (2024)',
        vehicleType: 'Sedan',
        fromCity: 'Lahore',
        toCity: 'Islamabad',
        pickupLocation: 'Gulberg III Liberty / Babu Sabu M-2 Interchange',
        destinationLocation: 'Blue Area F-6 / Zero Point Islamabad',
        optionalStops: 'Bhera Service Area (15 min refreshment break)',
        departureDate: '2026-10-26',
        departureTime: '02:30 PM',
        totalSeats: 4,
        availableSeats: 4,
        farePerSeat: 2400,
        description: 'Direct M-2 Motorway transit via E-Tag lane. Spacious legroom and luggage capacity for 3 cabin bags.',
        status: 'upcoming',
        pickupLat: CITY_COORDINATES.Lahore.lat,
        pickupLng: CITY_COORDINATES.Lahore.lng,
        destLat: CITY_COORDINATES.Islamabad.lat,
        destLng: CITY_COORDINATES.Islamabad.lng,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('Seed check skipped:', err);
  }
}

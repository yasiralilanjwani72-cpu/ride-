import React, { useState, useMemo } from 'react';
import {
  PassengerProfile,
  DriverProfile,
  Vehicle,
  Ride,
  Booking,
  LiveLocation,
  Review,
  AppNotification,
} from '../types';
import {
  updatePassengerProfile,
  createBookingRequest,
  updateBookingStatus,
  submitReview,
} from '../services/firestoreService';
import LiveRideMap from './LiveRideMap';
import DriverPublicProfileModal from './DriverPublicProfileModal';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Users,
  Star,
  CheckCircle2,
  Navigation,
  Bell,
  User,
  History,
  MessageSquare,
  SlidersHorizontal,
} from 'lucide-react';
import defaultDriverAvatar from '../assets/images/avatar_driver_pro_1791134254517.jpg';

interface PassengerPortalProps {
  passengerProfile: PassengerProfile;
  driverProfiles: DriverProfile[];
  vehicles: Vehicle[];
  rides: Ride[];
  bookings: Booking[];
  liveLocations: Record<string, LiveLocation>;
  reviews: Review[];
  notifications: AppNotification[];
  onMarkNotificationRead: (notif: AppNotification) => Promise<void>;
}

export default function PassengerPortal({
  passengerProfile,
  driverProfiles,
  vehicles,
  rides,
  bookings,
  liveLocations,
  reviews,
  notifications,
  onMarkNotificationRead,
}: PassengerPortalProps) {
  const [activeSection, setActiveSection] = useState<
    'search' | 'bookings' | 'tracking' | 'profile' | 'reviews' | 'notifications'
  >('search');

  // Search & Filter states
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [minSeats, setMinSeats] = useState(1);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [minRating, setMinRating] = useState(0);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');

  // Selected Driver/Ride Modal state
  const [selectedModalData, setSelectedModalData] = useState<{
    driver: DriverProfile;
    vehicle?: Vehicle;
    ride?: Ride;
  } | null>(null);

  // Profile Edit states
  const [fullName, setFullName] = useState(passengerProfile.fullName);
  const [photoUrl, setPhotoUrl] = useState(passengerProfile.photoUrl);
  const [phone, setPhone] = useState(passengerProfile.phone);
  const [email, setEmail] = useState(passengerProfile.email);
  const [gender, setGender] = useState(passengerProfile.gender);
  const [city, setCity] = useState(passengerProfile.city);
  const [bio, setBio] = useState(passengerProfile.bio);
  const [showPhoneToDriver, setShowPhoneToDriver] = useState(passengerProfile.showPhoneToDriver);
  const [showEmailToDriver, setShowEmailToDriver] = useState(passengerProfile.showEmailToDriver);
  const [profileStatusMsg, setProfileStatusMsg] = useState<string | null>(null);

  // Review form states
  const [reviewBookingId, setReviewBookingId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  // Filtered available rides
  const filteredRides = useMemo(() => {
    return rides.filter((r) => {
      if (r.status === 'cancelled' || r.status === 'completed') return false;
      if (searchFrom && !r.fromCity.toLowerCase().includes(searchFrom.toLowerCase()) && !r.pickupLocation.toLowerCase().includes(searchFrom.toLowerCase())) {
        return false;
      }
      if (searchTo && !r.toCity.toLowerCase().includes(searchTo.toLowerCase()) && !r.destinationLocation.toLowerCase().includes(searchTo.toLowerCase())) {
        return false;
      }
      if (searchDate && r.departureDate !== searchDate) return false;
      if (r.availableSeats < minSeats) return false;
      if (r.farePerSeat > maxPrice) return false;
      if (r.driverRating < minRating) return false;
      if (vehicleFilter !== 'all' && r.vehicleType.toLowerCase() !== vehicleFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [rides, searchFrom, searchTo, searchDate, minSeats, maxPrice, minRating, vehicleFilter]);

  const myBookings = useMemo(() => {
    return bookings.filter((b) => b.passengerUid === passengerProfile.uid);
  }, [bookings, passengerProfile.uid]);

  const filteredBookings = useMemo(() => {
    return myBookings.filter((b) => {
      if (bookingFilter === 'all') return true;
      if (bookingFilter === 'pending') return b.status === 'pending';
      if (bookingFilter === 'confirmed') return b.status === 'confirmed' || b.status === 'accepted' || b.status === 'ride_started';
      if (bookingFilter === 'completed') return b.status === 'completed';
      if (bookingFilter === 'cancelled') return b.status === 'cancelled_by_passenger' || b.status === 'cancelled_by_driver' || b.status === 'rejected';
      return true;
    });
  }, [myBookings, bookingFilter]);

  // Confirmed bookings eligible for live GPS tracking
  const trackableBookings = useMemo(() => {
    return myBookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'ride_started'
    );
  }, [myBookings]);

  const completedBookingsForReview = useMemo(() => {
    return myBookings.filter((b) => b.status === 'completed');
  }, [myBookings]);

  const handleOpenDriverModal = (ride: Ride) => {
    const foundDriver = driverProfiles.find((d) => d.uid === ride.driverUid) || {
      uid: ride.driverUid,
      fullName: ride.driverName,
      photoUrl: ride.driverPhoto || defaultDriverAvatar,
      city: ride.fromCity,
      bio: 'Verified long-distance highway captain on Ride Connect.',
      drivingExperienceYears: 5,
      licenseSummary: 'Commercial Highway Verified License',
      verificationStatus: 'verified',
      rating: ride.driverRating || 4.9,
      completedRides: 42,
      reviewCount: 12,
      memberSince: 'Oct 2026',
    };
    const foundVehicle = vehicles.find((v) => v.id === ride.vehicleId);
    setSelectedModalData({ driver: foundDriver, vehicle: foundVehicle, ride });
  };

  const handleBookSeats = async (ride: Ride, seats: number) => {
    await createBookingRequest(ride, passengerProfile, seats);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatusMsg(null);
    try {
      await updatePassengerProfile(passengerProfile.uid, {
        fullName,
        photoUrl,
        phone,
        email,
        gender,
        city,
        bio,
        showPhoneToDriver,
        showEmailToDriver,
      });
      setProfileStatusMsg('Passenger profile and privacy settings saved.');
    } catch (err) {
      setProfileStatusMsg(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewMsg(null);
    const targetBooking = myBookings.find((b) => b.id === reviewBookingId);
    if (!targetBooking) {
      setReviewMsg('Please select a completed ride booking to review.');
      return;
    }
    try {
      await submitReview(
        targetBooking.rideId,
        targetBooking.id,
        passengerProfile.uid,
        passengerProfile.fullName,
        'passenger',
        targetBooking.driverUid,
        targetBooking.driverName,
        reviewRating,
        reviewComment,
        reviews
      );
      setReviewComment('');
      setReviewMsg('Thank you! Your driver rating and review have been published.');
    } catch (err) {
      setReviewMsg(err instanceof Error ? err.message : 'Could not submit review');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Sidebar Navigation */}
      <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-6">
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200">
          <img
            src={passengerProfile.photoUrl || defaultDriverAvatar}
            alt={passengerProfile.fullName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = defaultDriverAvatar;
            }}
            className="w-12 h-12 rounded-full object-cover border border-slate-300 shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{passengerProfile.fullName}</h2>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>Passenger</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{passengerProfile.city}</span>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveSection('search')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'search'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Search className="w-4 h-4" />
              <span>Search & Book Rides</span>
            </span>
            <span className="font-mono">{filteredRides.length}</span>
          </button>

          <button
            onClick={() => setActiveSection('bookings')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'bookings'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <History className="w-4 h-4" />
              <span>My Bookings & History</span>
            </span>
            <span className="font-mono">{myBookings.length}</span>
          </button>

          <button
            onClick={() => setActiveSection('tracking')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'tracking'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Navigation className="w-4 h-4" />
              <span>Track Driver Live</span>
            </span>
            <span className="font-mono">{trackableBookings.length}</span>
          </button>

          <button
            onClick={() => setActiveSection('reviews')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'reviews'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" />
              <span>Rate & Reviews</span>
            </span>
          </button>

          <button
            onClick={() => setActiveSection('notifications')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'notifications'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </span>
            {unreadCount > 0 && (
              <span className="font-mono text-emerald-500 font-bold">{unreadCount} new</span>
            )}
          </button>

          <button
            onClick={() => setActiveSection('profile')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'profile'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <User className="w-4 h-4" />
              <span>My Profile & Privacy</span>
            </span>
          </button>
        </nav>

        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1 font-mono tabular-nums">
          <div className="flex justify-between">
            <span className="font-sans">Passenger Rating</span>
            <span className="font-semibold text-slate-900">⭐ {passengerProfile.rating.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans">Completed Trips</span>
            <span className="font-semibold text-slate-900">{passengerProfile.totalCompletedRides}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans">Member Since</span>
            <span className="font-semibold text-slate-900">{passengerProfile.memberSince}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:col-span-9 space-y-6">
        {activeSection === 'search' && (
          <div className="space-y-6">
            {/* Search & Multi-Filter Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Find Long-Distance Intercity Rides</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Inspect verified driver profiles, vehicle registrations, and real-time seat availability before booking.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">From City / Pickup</label>
                  <input
                    type="text"
                    value={searchFrom}
                    onChange={(e) => setSearchFrom(e.target.value)}
                    placeholder="e.g. Karachi, Lahore..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">To Destination</label>
                  <input
                    type="text"
                    value={searchTo}
                    onChange={(e) => setSearchTo(e.target.value)}
                    placeholder="e.g. Hyderabad, Islamabad..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Travel Date</label>
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Seats Needed</label>
                  <select
                    value={minSeats}
                    onChange={(e) => setMinSeats(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}+ {n === 1 ? 'Seat' : 'Seats'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Secondary Filters: Price, Rating, Vehicle Type */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600 font-medium">Max Fare:</span>
                    <select
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                      className="px-2.5 py-1 border border-slate-300 rounded-md font-mono bg-white"
                    >
                      <option value={2000}>Up to Rs. 2,000</option>
                      <option value={3500}>Up to Rs. 3,500</option>
                      <option value={5000}>Up to Rs. 5,000</option>
                      <option value={10000}>Any Fare</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Min Rating:</span>
                    <select
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="px-2.5 py-1 border border-slate-300 rounded-md font-mono bg-white"
                    >
                      <option value={0}>Any Rating</option>
                      <option value={4.0}>4.0+ ★</option>
                      <option value={4.5}>4.5+ ★</option>
                      <option value={4.8}>4.8+ ★</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Vehicle Type:</span>
                    <select
                      value={vehicleFilter}
                      onChange={(e) => setVehicleFilter(e.target.value)}
                      className="px-2.5 py-1 border border-slate-300 rounded-md bg-white"
                    >
                      <option value="all">All Vehicles</option>
                      <option value="Sedan">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="Executive">Executive</option>
                      <option value="Hatchback">Hatchback</option>
                      <option value="Van">Van</option>
                    </select>
                  </div>
                </div>

                {(searchFrom || searchTo || searchDate || minSeats > 1 || vehicleFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchFrom('');
                      setSearchTo('');
                      setSearchDate('');
                      setMinSeats(1);
                      setMaxPrice(10000);
                      setMinRating(0);
                      setVehicleFilter('all');
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Ride Cards List */}
            <div className="space-y-4">
              {filteredRides.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                  <div className="text-sm font-semibold text-slate-900">No Matching Intercity Rides Found</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Try clearing your date or city filters, or switch to the Driver Portal to publish a new long-distance corridor ride.
                  </p>
                </div>
              ) : (
                filteredRides.map((ride) => (
                  <div
                    key={ride.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      {/* Driver & Route Info */}
                      <div className="flex items-start gap-4">
                        <img
                          src={ride.driverPhoto || defaultDriverAvatar}
                          alt={ride.driverName}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = defaultDriverAvatar;
                          }}
                          className="w-14 h-14 rounded-full object-cover border border-slate-300 shrink-0 cursor-pointer"
                          onClick={() => handleOpenDriverModal(ride)}
                        />
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleOpenDriverModal(ride)}
                              className="text-base font-bold text-slate-900 hover:underline text-left"
                            >
                              {ride.driverName} {ride.driverVerified ? '✓' : ''}
                            </button>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-xs font-mono font-semibold text-amber-600">
                              ⭐ {ride.driverRating.toFixed(1)}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-xs text-slate-600 font-medium">{ride.vehicleName}</span>
                          </div>

                          <div className="text-lg font-bold text-slate-900">
                            {ride.fromCity} → {ride.toCity}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                            <span>{ride.departureDate}</span>
                            <span aria-hidden="true">|</span>
                            <span>{ride.departureTime}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700 font-semibold">
                              {ride.availableSeats} {ride.availableSeats === 1 ? 'Seat' : 'Seats'} Available
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans">Pickup: {ride.pickupLocation}</span>
                          </div>
                        </div>
                      </div>

                      {/* Price & Action Buttons */}
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="text-left md:text-right font-mono tabular-nums">
                          <div className="text-lg font-bold text-slate-900">
                            Rs. {ride.farePerSeat.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-slate-500">/ seat</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-sans">
                            Status: <span className="capitalize font-medium text-slate-700">{ride.status}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenDriverModal(ride)}
                            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            View Profile
                          </button>
                          <button
                            onClick={() => handleOpenDriverModal(ride)}
                            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            View Ride
                          </button>
                          <button
                            onClick={() => handleOpenDriverModal(ride)}
                            disabled={ride.availableSeats === 0}
                            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {ride.availableSeats > 0 ? 'Book Now' : 'Full'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeSection === 'bookings' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">My Ride Bookings & History</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  View real-time booking approval status, cancel seats if plans change, or launch live GPS tracking.
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setBookingFilter(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                      bookingFilter === tab
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                No bookings found in this category.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredBookings.map((b) => {
                  const associatedRide = rides.find((r) => r.id === b.rideId);
                  const canCancel =
                    b.status === 'pending' || b.status === 'accepted' || b.status === 'confirmed';
                  const canTrack =
                    b.status === 'confirmed' || b.status === 'accepted' || b.status === 'ride_started';

                  return (
                    <div key={b.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <span>
                            {b.fromCity} → {b.toCity}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-xs font-normal text-slate-600">
                            Captain {b.driverName}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                          <span>{b.departureDate}</span>
                          <span aria-hidden="true">|</span>
                          <span>{b.departureTime}</span>
                          <span aria-hidden="true">·</span>
                          <span>{b.seatsBooked} Seat(s)</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-800">
                            Rs. {b.totalFare.toLocaleString()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="uppercase text-[11px] font-semibold text-emerald-700">
                            Status: {b.status.replace(/_/g, ' ')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Payment: {b.paymentStatus}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canTrack && (
                          <button
                            onClick={() => setActiveSection('tracking')}
                            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
                          >
                            Track My Ride
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => updateBookingStatus(b, associatedRide, 'cancelled_by_passenger')}
                            className="px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Cancel Booking
                          </button>
                        )}
                        {b.status === 'completed' && (
                          <button
                            onClick={() => {
                              setReviewBookingId(b.id);
                              setActiveSection('reviews');
                            }}
                            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                          >
                            Rate Driver
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeSection === 'tracking' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-slate-900">Track My Ride — Real-Time GPS Telemetry</h2>
              <p className="text-xs text-slate-500 mt-1">
                Private encrypted location stream available strictly to confirmed passengers of active rides.
              </p>
            </div>

            {trackableBookings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  No Confirmed Active Ride to Track Yet
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Once a driver accepts and confirms your booking request and starts sharing their live location, real-time GPS tracking will appear here automatically.
                </p>
              </div>
            ) : (
              trackableBookings.map((b) => {
                const liveLoc = liveLocations[b.rideId];
                const rideObj = rides.find((r) => r.id === b.rideId);

                const fallbackLoc: LiveLocation = liveLoc || {
                  rideId: b.rideId,
                  driverUid: b.driverUid,
                  driverName: b.driverName,
                  vehicleName: rideObj?.vehicleName || 'Verified Intercity Sedan',
                  lat: rideObj?.pickupLat || 24.8607,
                  lng: rideObj?.pickupLng || 67.0011,
                  heading: 45,
                  speedKmh: 76,
                  distanceRemainingKm: 7.4,
                  etaMinutes: 14,
                  pickupLocation: rideObj?.pickupLocation || b.fromCity,
                  destinationLocation: rideObj?.destinationLocation || b.toCity,
                  pickupLat: rideObj?.pickupLat || 24.8607,
                  pickupLng: rideObj?.pickupLng || 67.0011,
                  destLat: rideObj?.destLat || 25.3960,
                  destLng: rideObj?.destLng || 68.3578,
                  active: true,
                  rideStatus: 'en_route_pickup',
                  confirmedPassengerUids: [passengerProfile.uid],
                };

                return (
                  <div key={b.id} className="space-y-3">
                    <LiveRideMap liveLocation={fallbackLoc} />
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeSection === 'reviews' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Rate & Review Completed Rides</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Share your experience (1–5 Stars) to keep the Ride Connect driver community accountable.
              </p>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Completed Booking
                </label>
                <select
                  value={reviewBookingId}
                  onChange={(e) => setReviewBookingId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  required
                >
                  <option value="">-- Choose a completed trip --</option>
                  {completedBookingsForReview.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fromCity} → {b.toCity} with Captain {b.driverName} ({b.departureDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                        reviewRating >= star
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      {star} ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review Comment
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Describe punctuality, driving safety, and vehicle comfort..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Submit Verified Review
              </button>

              {reviewMsg && (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800">
                  {reviewMsg}
                </div>
              )}
            </form>

            <div className="pt-6 border-t border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Recent Community Reviews</h3>
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-500">No reviews submitted yet.</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="pb-3 border-b border-slate-100 last:border-none">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        {r.reviewerName} → {r.targetName}
                      </span>
                      <span className="font-mono text-amber-600 font-semibold">
                        {'★'.repeat(r.rating)} ({r.rating}.0)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{r.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Real-Time Notifications</h2>
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">You have no notifications yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`py-3.5 flex items-start justify-between gap-4 ${
                      !n.read ? 'bg-emerald-50/40 -mx-3 px-3 rounded-lg' : ''
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{n.title}</div>
                      <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => onMarkNotificationRead(n)}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline shrink-0"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'profile' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Passenger Profile & Privacy Controls</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your personal profile and control what contact information is visible to drivers when booking.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender (Optional)</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Profile Picture URL</label>
                  <input
                    type="text"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Short Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-900">Booking Privacy Permissions</div>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPhoneToDriver}
                    onChange={(e) => setShowPhoneToDriver(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Share my phone number with the driver when I request a booking</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={showEmailToDriver}
                    onChange={(e) => setShowEmailToDriver(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Allow drivers of confirmed bookings to view my email address</span>
                </label>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Save Passenger Profile
              </button>

              {profileStatusMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium">
                  {profileStatusMsg}
                </div>
              )}
            </form>
          </div>
        )}
      </main>

      {/* Public Driver & Vehicle Inspection Modal */}
      {selectedModalData && (
        <DriverPublicProfileModal
          driver={selectedModalData.driver}
          vehicle={selectedModalData.vehicle}
          ride={selectedModalData.ride}
          reviews={reviews}
          passengerProfile={passengerProfile}
          onClose={() => setSelectedModalData(null)}
          onBookSeats={handleBookSeats}
        />
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import {
  DriverProfile,
  DriverDocument,
  Vehicle,
  Ride,
  Booking,
  LiveLocation,
  Review,
  PassengerProfile,
  CITY_COORDINATES,
  VehicleType,
} from '../types';
import {
  updateDriverProfileAndDocs,
  saveVehicle,
  createRide,
  updateBookingStatus,
  startOrUpdateLiveRide,
  completeRideAndStopTracking,
  submitReview,
} from '../services/firestoreService';
import LiveRideMap from './LiveRideMap';
import {
  Car,
  PlusCircle,
  Users,
  Navigation,
  Wallet,
  Star,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
import defaultDriverAvatar from '../assets/images/avatar_driver_pro_1791134254517.jpg';
import defaultVehicleImg from '../assets/images/vehicle_sedan_white_1791134268066.jpg';

interface DriverPortalProps {
  driverProfile: DriverProfile;
  driverDocument?: DriverDocument | null;
  vehicles: Vehicle[];
  rides: Ride[];
  bookings: Booking[];
  liveLocations: Record<string, LiveLocation>;
  reviews: Review[];
  passengerProfiles: PassengerProfile[];
}

export default function DriverPortal({
  driverProfile,
  driverDocument,
  vehicles,
  rides,
  bookings,
  liveLocations,
  reviews,
  passengerProfiles,
}: DriverPortalProps) {
  const [activeTab, setActiveTab] = useState<
    'rides' | 'requests' | 'tracking' | 'vehicle' | 'earnings' | 'profile' | 'reviews'
  >('rides');

  // Inspect Passenger Profile Modal
  const [inspectedPassenger, setInspectedPassenger] = useState<PassengerProfile | null>(null);

  // Driver Profile & Docs Form
  const [fullName, setFullName] = useState(driverProfile.fullName);
  const [photoUrl, setPhotoUrl] = useState(driverProfile.photoUrl);
  const [city, setCity] = useState(driverProfile.city);
  const [bio, setBio] = useState(driverProfile.bio);
  const [expYears, setExpYears] = useState(driverProfile.drivingExperienceYears);
  const [licenseSummary, setLicenseSummary] = useState(driverProfile.licenseSummary);
  const [cnicNumber, setCnicNumber] = useState(driverDocument?.cnicNumber || '42101-1234567-1');
  const [licenseNumber, setLicenseNumber] = useState(driverDocument?.licenseNumber || 'LHR-992817-HTV');
  const [licenseExpiry, setLicenseExpiry] = useState(driverDocument?.licenseExpiry || '2029-12-31');
  const [phone, setPhone] = useState(driverDocument?.phone || '+92 321 9876543');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Vehicle Form
  const myVehicles = useMemo(
    () => vehicles.filter((v) => v.driverUid === driverProfile.uid),
    [vehicles, driverProfile.uid]
  );
  const primaryVehicle = myVehicles[0];

  const [vehicleType, setVehicleType] = useState<VehicleType>(primaryVehicle?.vehicleType || 'Sedan');
  const [brand, setBrand] = useState(primaryVehicle?.brand || 'Toyota');
  const [model, setModel] = useState(primaryVehicle?.model || 'Corolla Altis');
  const [modelYear, setModelYear] = useState(primaryVehicle?.modelYear || 2024);
  const [regNumber, setRegNumber] = useState(primaryVehicle?.registrationNumber || 'KHI-2024-881');
  const [color, setColor] = useState(primaryVehicle?.color || 'Pearl White');
  const [seats, setSeats] = useState(primaryVehicle?.seats || 4);
  const [imageUrl, setImageUrl] = useState(primaryVehicle?.images?.[0] || defaultVehicleImg);
  const [vehicleMsg, setVehicleMsg] = useState<string | null>(null);

  // Create Ride Form
  const [fromCity, setFromCity] = useState('Karachi');
  const [toCity, setToCity] = useState('Hyderabad');
  const [pickupLocation, setPickupLocation] = useState('DHA Phase 6 / Sohrab Goth M-9 Toll Plaza');
  const [destinationLocation, setDestinationLocation] = useState('Qasimabad Bypass / Saddar Hyderabad');
  const [optionalStops, setOptionalStops] = useState('Bahria Town Karachi Gate, Nooriabad Rest Area');
  const [departureDate, setDepartureDate] = useState('2026-10-28');
  const [departureTime, setDepartureTime] = useState('09:30 AM');
  const [availableSeats, setAvailableSeats] = useState(3);
  const [farePerSeat, setFarePerSeat] = useState(1500);
  const [rideDesc, setRideDesc] = useState(
    'Executive non-smoking intercity ride. Punctual departure and comfortable highway transit.'
  );
  const [rideMsg, setRideMsg] = useState<string | null>(null);

  // Passenger review form
  const [selectedBookingForReview, setSelectedBookingForReview] = useState('');
  const [passRating, setPassRating] = useState(5);
  const [passComment, setPassComment] = useState('');
  const [passReviewMsg, setPassReviewMsg] = useState<string | null>(null);

  const myRides = useMemo(
    () => rides.filter((r) => r.driverUid === driverProfile.uid),
    [rides, driverProfile.uid]
  );

  const myBookings = useMemo(
    () => bookings.filter((b) => b.driverUid === driverProfile.uid),
    [bookings, driverProfile.uid]
  );

  const totalEarnings = useMemo(() => {
    return myBookings
      .filter((b) => b.status === 'completed' || b.status === 'confirmed' || b.status === 'accepted')
      .reduce((acc, b) => acc + b.totalFare, 0);
  }, [myBookings]);

  const handleSaveDriverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      await updateDriverProfileAndDocs(
        driverProfile.uid,
        {
          fullName,
          photoUrl,
          city,
          bio,
          drivingExperienceYears: expYears,
          licenseSummary,
          completedRides: driverProfile.completedRides,
        },
        {
          email: driverDocument?.email || '',
          phone,
          cnicNumber,
          licenseNumber,
          licenseExpiry,
          vehicleRegDocUrl: driverDocument?.vehicleRegDocUrl || 'https://rideconnect.docs/reg.pdf',
          cnicDocUrl: driverDocument?.cnicDocUrl || 'https://rideconnect.docs/cnic.pdf',
          licenseDocUrl: driverDocument?.licenseDocUrl || 'https://rideconnect.docs/license.pdf',
        }
      );
      setProfileMsg('Driver profile and verification documents updated.');
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Failed to update driver profile');
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleMsg(null);
    try {
      await saveVehicle(
        driverProfile.uid,
        {
          vehicleType,
          brand,
          model,
          modelYear,
          registrationNumber: regNumber,
          color,
          seats,
          images: [imageUrl || defaultVehicleImg],
        },
        primaryVehicle?.id
      );
      setVehicleMsg('Vehicle profile saved and linked to your Captain account.');
    } catch (err) {
      setVehicleMsg(err instanceof Error ? err.message : 'Failed to save vehicle');
    }
  };

  const handlePublishRide = async (e: React.FormEvent) => {
    e.preventDefault();
    setRideMsg(null);
    if (driverProfile.verificationStatus !== 'verified') {
      setRideMsg('Only Verified Drivers can publish public rides. Ask Admin to approve your verification.');
      return;
    }
    const targetVeh = primaryVehicle;
    if (!targetVeh) {
      setRideMsg('Please save your Vehicle Profile first under the Vehicle tab.');
      return;
    }
    try {
      await createRide(driverProfile, targetVeh, {
        fromCity,
        toCity,
        pickupLocation,
        destinationLocation,
        optionalStops,
        departureDate,
        departureTime,
        availableSeats,
        farePerSeat,
        description: rideDesc,
      });
      setRideMsg(`Published intercity ride: ${fromCity} → ${toCity} (${departureDate})`);
    } catch (err) {
      setRideMsg(err instanceof Error ? err.message : 'Failed to publish ride');
    }
  };

  const handleStepGps = async (ride: Ride) => {
    const currentLoc = liveLocations[ride.id];
    const confirmedUids = myBookings
      .filter(
        (b) =>
          b.rideId === ride.id &&
          (b.status === 'confirmed' || b.status === 'accepted' || b.status === 'ride_started')
      )
      .map((b) => b.passengerUid);

    const nextLat = currentLoc
      ? currentLoc.lat + (ride.destLat - currentLoc.lat) * 0.22
      : ride.pickupLat + (ride.destLat - ride.pickupLat) * 0.2;
    const nextLng = currentLoc
      ? currentLoc.lng + (ride.destLng - currentLoc.lng) * 0.22
      : ride.pickupLng + (ride.destLng - ride.pickupLng) * 0.2;
    const nextDist = currentLoc ? Math.max(1.2, Number((currentLoc.distanceRemainingKm * 0.78).toFixed(1))) : 7.4;
    const nextEta = currentLoc ? Math.max(3, Math.round(currentLoc.etaMinutes * 0.78)) : 14;

    await startOrUpdateLiveRide(
      ride,
      confirmedUids,
      {
        lat: nextLat,
        lng: nextLng,
        distanceRemainingKm: nextDist,
        etaMinutes: nextEta,
        speedKmh: 92,
      },
      'in_progress'
    );
  };

  const handleReviewPassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassReviewMsg(null);
    const b = myBookings.find((x) => x.id === selectedBookingForReview);
    if (!b) return;
    try {
      await submitReview(
        b.rideId,
        b.id,
        driverProfile.uid,
        driverProfile.fullName,
        'driver',
        b.passengerUid,
        b.passengerName,
        passRating,
        passComment,
        reviews
      );
      setPassComment('');
      setPassReviewMsg('Passenger rating submitted.');
    } catch (err) {
      setPassReviewMsg(err instanceof Error ? err.message : 'Failed to rate passenger');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Driver Sidebar */}
      <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-6">
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200">
          <img
            src={driverProfile.photoUrl || defaultDriverAvatar}
            alt={driverProfile.fullName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = defaultDriverAvatar;
            }}
            className="w-12 h-12 rounded-full object-cover border border-slate-300 shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{driverProfile.fullName}</h2>
            <div className="text-xs mt-0.5 flex items-center gap-1.5">
              <span
                className={`font-semibold capitalize ${
                  driverProfile.verificationStatus === 'verified'
                    ? 'text-emerald-700'
                    : 'text-amber-600'
                }`}
              >
                {driverProfile.verificationStatus}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-500">⭐ {driverProfile.rating.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('rides')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'rides'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <PlusCircle className="w-4 h-4" />
              <span>Create & Manage Rides</span>
            </span>
            <span className="font-mono">{myRides.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'requests'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              <span>Passenger Requests</span>
            </span>
            <span className="font-mono">{myBookings.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('tracking')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'tracking'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Navigation className="w-4 h-4" />
              <span>Live GPS Sharing</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('vehicle')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'vehicle'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Car className="w-4 h-4" />
              <span>Vehicle Profile</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('earnings')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'earnings'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4" />
              <span>Earnings & Ledger</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'profile'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Driver Verification & Bio</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'reviews'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Star className="w-4 h-4" />
              <span>Reviews & Rate Passengers</span>
            </span>
          </button>
        </nav>

        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1 font-mono tabular-nums">
          <div className="flex justify-between">
            <span className="font-sans">Total Revenue</span>
            <span className="font-semibold text-emerald-700">Rs. {totalEarnings.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans">Completed Rides</span>
            <span className="font-semibold text-slate-900">{driverProfile.completedRides}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans">Experience</span>
            <span className="font-semibold text-slate-900">{driverProfile.drivingExperienceYears} Yrs</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:col-span-9 space-y-6">
        {driverProfile.verificationStatus !== 'verified' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Driver Verification Status: {driverProfile.verificationStatus.toUpperCase()}</span>
              <p className="mt-0.5">
                Only Verified Drivers can publish public long-distance rides. Ensure your CNIC and License details are submitted in the Driver Verification tab, then approve via the Admin Portal.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'rides' && (
          <div className="space-y-6">
            {/* Create Long-Distance Ride Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Publish Long-Distance Ride</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure your highway corridor, pickup & drop-off points, seat count, and fare per seat.
                </p>
              </div>

              <form onSubmit={handlePublishRide} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">From City</label>
                    <select
                      value={fromCity}
                      onChange={(e) => setFromCity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {Object.keys(CITY_COORDINATES).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">To Destination City</label>
                    <select
                      value={toCity}
                      onChange={(e) => setToCity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {Object.keys(CITY_COORDINATES).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Departure Date</label>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Departure Time</label>
                    <input
                      type="text"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      placeholder="10:00 AM"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Exact Pickup Location</label>
                    <input
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Exact Drop-off Destination</label>
                    <input
                      type="text"
                      value={destinationLocation}
                      onChange={(e) => setDestinationLocation(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Optional En-Route Stops</label>
                    <input
                      type="text"
                      value={optionalStops}
                      onChange={(e) => setOptionalStops(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Available Seats</label>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={availableSeats}
                      onChange={(e) => setAvailableSeats(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fare per Seat (Rs.)</label>
                    <input
                      type="number"
                      min={100}
                      step={50}
                      value={farePerSeat}
                      onChange={(e) => setFarePerSeat(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ride Description & Luggage Rules</label>
                  <input
                    type="text"
                    value={rideDesc}
                    onChange={(e) => setRideDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Publish Long-Distance Ride
                </button>

                {rideMsg && (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium">
                    {rideMsg}
                  </div>
                )}
              </form>
            </div>

            {/* Published Rides List */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">My Published Rides</h3>
              {myRides.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No rides published yet.</p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {myRides.map((r) => {
                    const rideBookings = myBookings.filter((b) => b.rideId === r.id);
                    const confirmedUids = rideBookings
                      .filter(
                        (b) =>
                          b.status === 'confirmed' || b.status === 'accepted' || b.status === 'ride_started'
                      )
                      .map((b) => b.passengerUid);

                    return (
                      <div key={r.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-slate-900">
                            {r.fromCity} → {r.toCity}{' '}
                            <span className="text-xs font-normal text-slate-500">({r.vehicleName})</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                            <span>{r.departureDate}</span>
                            <span aria-hidden="true">|</span>
                            <span>{r.departureTime}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {r.availableSeats}/{r.totalSeats} Seats Open
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Rs. {r.farePerSeat.toLocaleString()}/seat</span>
                            <span aria-hidden="true">·</span>
                            <span className="uppercase text-emerald-700 font-semibold">{r.status}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {r.status !== 'completed' && r.status !== 'cancelled' && (
                            <>
                              <button
                                onClick={async () => {
                                  await startOrUpdateLiveRide(r, confirmedUids);
                                  setActiveTab('tracking');
                                }}
                                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
                              >
                                {r.status === 'active' ? 'Update Live GPS' : 'Start Ride & Share GPS'}
                              </button>

                              <button
                                onClick={() => completeRideAndStopTracking(r, rideBookings, driverProfile)}
                                className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                              >
                                End & Complete Ride
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Passenger Booking Requests & Confirmed Manifest</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect passenger profiles, accept or decline seat bookings, and manage your passenger manifest.
              </p>
            </div>

            {myBookings.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No passenger booking requests received yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {myBookings.map((b) => {
                  const rideObj = myRides.find((r) => r.id === b.rideId);
                  const passProfile = passengerProfiles.find((p) => p.uid === b.passengerUid);

                  return (
                    <div key={b.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{b.passengerName}</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-xs text-slate-500">{b.passengerCity}</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-xs font-mono text-slate-700">{b.passengerPhone}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                          <span>
                            {b.fromCity} → {b.toCity}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{b.departureDate}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-900">{b.seatsBooked} Seat(s)</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700">
                            Rs. {b.totalFare.toLocaleString()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="uppercase font-semibold">{b.status.replace(/_/g, ' ')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {passProfile && (
                          <button
                            onClick={() => setInspectedPassenger(passProfile)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            View Passenger Profile
                          </button>
                        )}

                        {b.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateBookingStatus(b, rideObj, 'confirmed')}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Accept & Confirm
                            </button>
                            <button
                              onClick={() => updateBookingStatus(b, rideObj, 'rejected')}
                              className="px-3.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {(b.status === 'confirmed' || b.status === 'accepted') && (
                          <button
                            onClick={() => updateBookingStatus(b, rideObj, 'cancelled_by_driver')}
                            className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Cancel Booking
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

        {activeTab === 'tracking' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-slate-900">Driver Live Location Transmitter</h2>
              <p className="text-xs text-slate-500 mt-1">
                Start location sharing for any active ride, broadcast real-time highway progress, or complete the trip to automatically terminate GPS sharing.
              </p>
            </div>

            {myRides.filter((r) => r.status !== 'cancelled').map((r) => {
              const liveLoc = liveLocations[r.id];
              const rideBookings = myBookings.filter((b) => b.rideId === r.id);
              const confirmedUids = rideBookings
                .filter(
                  (b) =>
                    b.status === 'confirmed' || b.status === 'accepted' || b.status === 'ride_started'
                )
                .map((b) => b.passengerUid);

              const displayLoc: LiveLocation = liveLoc || {
                rideId: r.id,
                driverUid: r.driverUid,
                driverName: r.driverName,
                vehicleName: r.vehicleName,
                lat: r.pickupLat,
                lng: r.pickupLng,
                heading: 45,
                speedKmh: 85,
                distanceRemainingKm: 12.6,
                etaMinutes: 18,
                pickupLocation: r.pickupLocation,
                destinationLocation: r.destinationLocation,
                pickupLat: r.pickupLat,
                pickupLng: r.pickupLng,
                destLat: r.destLat,
                destLng: r.destLng,
                active: r.status === 'active',
                rideStatus: r.status === 'completed' ? 'completed' : 'in_progress',
                confirmedPassengerUids: confirmedUids,
              };

              return (
                <div key={r.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
                    <div>
                      <span className="text-sm font-bold text-slate-900">
                        {r.fromCity} → {r.toCity}
                      </span>
                      <span className="text-xs text-slate-500 ml-2 font-mono">
                        ({confirmedUids.length} Confirmed Passengers Authorized)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status !== 'completed' && (
                        <>
                          <button
                            onClick={() => handleStepGps(r)}
                            className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            {liveLoc?.active ? 'Broadcast Next GPS Coordinate' : 'Start Live Location Sharing'}
                          </button>
                          <button
                            onClick={() => completeRideAndStopTracking(r, rideBookings, driverProfile)}
                            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            Complete Ride & Stop Sharing
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <LiveRideMap
                    liveLocation={displayLoc}
                    isDriverView={true}
                    onStepDriverPosition={() => handleStepGps(r)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'vehicle' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Vehicle Profile Management</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Passengers inspect your vehicle specifications, seating capacity, and photos before booking.
              </p>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Executive">Executive</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Van">Van</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model Year</label>
                  <input
                    type="number"
                    value={modelYear}
                    onChange={(e) => setModelYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Number</label>
                  <input
                    type="text"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Exterior Color</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Passenger Seats</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Photo URL</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Save Vehicle Profile
              </button>

              {vehicleMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium">
                  {vehicleMsg}
                </div>
              )}
            </form>
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Driver Earnings & Booking Ledger</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial breakdown of confirmed and completed intercity seat bookings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 font-mono tabular-nums">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs text-slate-500 font-sans">Total Confirmed/Completed Earnings</div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  Rs. {totalEarnings.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs text-slate-500 font-sans">Completed Rides</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {driverProfile.completedRides}
                </div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs text-slate-500 font-sans">Active Seat Bookings</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {myBookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length}
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {myBookings.map((b) => (
                <div key={b.id} className="py-3.5 flex items-center justify-between text-xs font-mono tabular-nums">
                  <div>
                    <div className="font-sans font-bold text-slate-900">
                      {b.fromCity} → {b.toCity} ({b.passengerName})
                    </div>
                    <div className="text-slate-500">
                      {b.departureDate} · {b.seatsBooked} Seat(s) · {b.status.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">Rs. {b.totalFare.toLocaleString()}</div>
                    <div className="text-emerald-700 uppercase">{b.paymentStatus}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Driver Profile & Verification Documents</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sensitive CNIC and License documents are stored in an isolated collection protected from public access.
              </p>
            </div>

            <form onSubmit={handleSaveDriverProfile} className="space-y-4 max-w-2xl">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Home City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Driving Experience (Years)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={expYears}
                    onChange={(e) => setExpYears(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">License Category Summary</label>
                  <input
                    type="text"
                    value={licenseSummary}
                    onChange={(e) => setLicenseSummary(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CNIC / National ID Number (Private)</label>
                  <input
                    type="text"
                    value={cnicNumber}
                    onChange={(e) => setCnicNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Driving License Number (Private)</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">License Expiry Date</label>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={(e) => setLicenseExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Contact Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Public Driver Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Save Driver Profile & Submit Documents
              </button>

              {profileMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium">
                  {profileMsg}
                </div>
              )}
            </form>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Rate Passengers & View My Driver Reviews</h2>
            </div>

            <form onSubmit={handleReviewPassenger} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Booking to Rate Passenger</label>
                <select
                  value={selectedBookingForReview}
                  onChange={(e) => setSelectedBookingForReview(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  required
                >
                  <option value="">-- Choose passenger booking --</option>
                  {myBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.passengerName} ({b.fromCity} → {b.toCity})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setPassRating(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border ${
                      passRating >= s
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    {s} ★
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={passComment}
                onChange={(e) => setPassComment(e.target.value)}
                placeholder="Courteous and punctual passenger..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
              >
                Submit Passenger Rating
              </button>
              {passReviewMsg && <div className="text-xs text-emerald-700 font-medium">{passReviewMsg}</div>}
            </form>
          </div>
        )}
      </main>

      {/* Passenger Profile Inspection Modal (Privacy-Compliant) */}
      {inspectedPassenger && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={inspectedPassenger.photoUrl || defaultDriverAvatar}
                  alt={inspectedPassenger.fullName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border border-slate-300"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{inspectedPassenger.fullName}</h3>
                  <div className="text-xs text-slate-500 font-mono">
                    ⭐ {inspectedPassenger.rating.toFixed(1)} · {inspectedPassenger.totalCompletedRides} Rides · {inspectedPassenger.city}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectedPassenger(null)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-600">{inspectedPassenger.bio}</p>
            <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100 font-mono">
              <div>
                <span className="text-slate-500 font-sans">Phone: </span>
                <span>
                  {inspectedPassenger.showPhoneToDriver
                    ? inspectedPassenger.phone
                    : 'Hidden by Passenger Privacy Settings'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Email: </span>
                <span>
                  {inspectedPassenger.showEmailToDriver
                    ? inspectedPassenger.email
                    : 'Hidden by Passenger Privacy Settings'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Member Since: </span>
                <span>{inspectedPassenger.memberSince}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  DriverProfile,
  Vehicle,
  Ride,
  Review,
  PassengerProfile,
} from '../types';
import {
  CheckCircle2,
  Star,
  Car,
  MapPin,
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  X,
} from 'lucide-react';
import defaultDriverAvatar from '../assets/images/avatar_driver_pro_1791134254517.jpg';
import defaultVehicleImg from '../assets/images/vehicle_sedan_white_1791134268066.jpg';

interface DriverPublicProfileModalProps {
  driver: DriverProfile;
  vehicle?: Vehicle;
  ride?: Ride;
  reviews: Review[];
  passengerProfile?: PassengerProfile | null;
  initialTab?: 'overview' | 'vehicle' | 'ride' | 'reviews';
  onClose: () => void;
  onBookSeats?: (ride: Ride, seats: number) => Promise<void>;
}

export default function DriverPublicProfileModal({
  driver,
  vehicle,
  ride,
  reviews,
  passengerProfile,
  initialTab = 'overview',
  onClose,
  onBookSeats,
}: DriverPublicProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'vehicle' | 'ride' | 'reviews'>(initialTab);
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState<string | null>(null);

  const driverReviews = reviews.filter((r) => r.targetUid === driver.uid);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBookNow = async () => {
    if (!ride || !onBookSeats) return;
    setIsBooking(true);
    setBookingFeedback(null);
    try {
      await onBookSeats(ride, seatsToBook);
      setBookingFeedback('Booking request submitted! You can track status in your Bookings tab.');
    } catch (err) {
      setBookingFeedback(err instanceof Error ? err.message : 'Failed to submit booking');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full overflow-hidden shadow-xl my-8">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
          <div className="flex items-center gap-4">
            <img
              src={driver.photoUrl || defaultDriverAvatar}
              alt={driver.fullName}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = defaultDriverAvatar;
              }}
              className="w-16 h-16 rounded-full object-cover border border-slate-300 bg-slate-200 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{driver.fullName}</h2>
                {driver.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified Driver ✓</span>
                  </span>
                )}
              </div>
              {/* Clean unboxed metadata per Zero-Pill Discipline */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1 font-mono tabular-nums">
                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {driver.rating.toFixed(1)} Rating
                </span>
                <span aria-hidden="true">·</span>
                <span>{driver.completedRides} Completed Rides</span>
                <span aria-hidden="true">·</span>
                <span>{driver.drivingExperienceYears} Years Driving Experience</span>
                <span aria-hidden="true">·</span>
                <span>{driver.city}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Action Tabs: [Overview] [View Vehicle] [View Ride] [Reviews] */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Driver Profile
            </button>
            <button
              onClick={() => setActiveTab('vehicle')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'vehicle'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              View Vehicle
            </button>
            {ride && (
              <button
                onClick={() => setActiveTab('ride')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'ride'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                View Ride & Book
              </button>
            )}
            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'reviews'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reviews ({driverReviews.length})
            </button>
          </div>

          {ride && activeTab !== 'ride' && (
            <button
              onClick={() => setActiveTab('ride')}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              Book Ride (Rs. {ride.farePerSeat.toLocaleString()} / seat)
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">About Captain {driver.fullName}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{driver.bio}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 font-mono tabular-nums">
                <div>
                  <div className="text-xs text-slate-500 font-sans">Verification</div>
                  <div className="text-sm font-semibold text-emerald-700 mt-0.5 capitalize">
                    {driver.verificationStatus} ✓
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-sans">License Class</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                    {driver.licenseSummary}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-sans">Member Since</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">
                    {driver.memberSince}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-sans">Reviews</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">
                    {driver.reviewCount} Verified
                  </div>
                </div>
              </div>

              {vehicle && (
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Primary Assigned Vehicle</div>
                    <div className="text-sm font-semibold text-slate-900 mt-0.5">
                      {vehicle.brand} {vehicle.model} {vehicle.modelYear} · {vehicle.color} · {vehicle.seats} Passenger Seats
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('vehicle')}
                    className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap"
                  >
                    Inspect Vehicle →
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'vehicle' && (
            <div>
              {vehicle ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-4/3">
                    <img
                      src={vehicle.images?.[0] || defaultVehicleImg}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = defaultVehicleImg;
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {vehicle.brand} {vehicle.model} {vehicle.modelYear}
                      </h3>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>{vehicle.color}</span>
                        <span aria-hidden="true">·</span>
                        <span>{vehicle.seats} Passenger Seats</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 font-semibold">
                          {vehicle.verified ? 'Verified Vehicle ✓' : 'Pending Inspection'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-200 text-sm">
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Vehicle Category</span>
                        <span className="font-medium text-slate-900">{vehicle.vehicleType}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Registration Plate</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {vehicle.registrationNumber}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Exterior Color</span>
                        <span className="font-medium text-slate-900">{vehicle.color}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Passenger Capacity</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {vehicle.seats} Seats
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 py-6 text-center">
                  Vehicle specifications are listed on the ride card: {ride?.vehicleName || 'Executive Sedan'}.
                </div>
              )}
            </div>
          )}

          {activeTab === 'ride' && ride && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">Intercity Corridor</div>
                  <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                    {ride.fromCity} → {ride.toCity}
                  </h3>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-xs text-slate-500 font-sans">Fare per Seat</div>
                  <div className="text-xl font-bold text-emerald-700">
                    Rs. {ride.farePerSeat.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500">Pickup Point</div>
                    <div className="font-medium text-slate-900">{ride.pickupLocation}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500">Drop-off Destination</div>
                    <div className="font-medium text-slate-900">{ride.destinationLocation}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500">Departure Date & Time</div>
                    <div className="font-mono font-medium text-slate-900">
                      {ride.departureDate} · {ride.departureTime}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500">Seat Availability</div>
                    <div className="font-mono font-medium text-slate-900">
                      {ride.availableSeats} of {ride.totalSeats} seats available
                    </div>
                  </div>
                </div>
              </div>

              {ride.optionalStops && (
                <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-800">En-Route Stops: </span>
                  {ride.optionalStops}
                </div>
              )}

              <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200">
                {ride.description}
              </div>

              {/* Seat Selector & Book Action */}
              {onBookSeats && ride.availableSeats > 0 && passengerProfile && (
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-slate-700">Select Seats:</label>
                    <select
                      value={seatsToBook}
                      onChange={(e) => setSeatsToBook(Number(e.target.value))}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white"
                    >
                      {Array.from({ length: ride.availableSeats }, (_, idx) => idx + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'Seat' : 'Seats'} — Rs. {(n * ride.farePerSeat).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleBookNow}
                    disabled={isBooking}
                    className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isBooking
                      ? 'Submitting Request...'
                      : `Confirm Booking Request (Rs. ${(seatsToBook * ride.farePerSeat).toLocaleString()})`}
                  </button>
                </div>
              )}

              {bookingFeedback && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
                  {bookingFeedback}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {driverReviews.length === 0 ? (
                <div className="text-sm text-slate-500 py-6 text-center">
                  No passenger reviews recorded yet for Captain {driver.fullName}.
                </div>
              ) : (
                driverReviews.map((rev) => (
                  <div key={rev.id} className="pb-4 border-b border-slate-200 last:border-none">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">{rev.reviewerName}</span>
                      <span className="font-mono text-amber-600 font-semibold">
                        {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)} ({rev.rating}.0)
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{rev.comment}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

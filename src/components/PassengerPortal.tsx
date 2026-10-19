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
  TripShare,
  FavoriteItem,
  RecentSearch,
  ChatMessage,
  WalletTransaction,
  CITY_COORDINATES,
} from '../types';
import {
  updatePassengerProfile,
  createBookingRequest,
  updateBookingStatus,
  submitReview,
  triggerSOSAlert,
  createTripShareLink,
  revokeTripShareLink,
  syncTripShareCoordinates,
  saveFavoriteItem,
  removeFavoriteItem,
  saveRecentSearch,
  deleteRecentSearch,
  clearAllRecentSearches,
  getPendingDurationHours,
  isBookingPendingOver48Hours,
  autoCancelStalePendingBookings,
} from '../services/firestoreService';
import LiveRideMap from './LiveRideMap';
import DriverPublicProfileModal from './DriverPublicProfileModal';
import RideReminder from './RideReminder';
import RideDeparturesMap from './RideDeparturesMap';
import RideChatPanel from './RideChatPanel';
import RideWalletPanel from './RideWalletPanel';
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
  Wallet,
  SlidersHorizontal,
  ShieldAlert,
  TrendingUp,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Link2Off,
  Heart,
  Bookmark,
  Trash2,
  RotateCcw,
  X,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
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
  tripShares: TripShare[];
  favorites: FavoriteItem[];
  recentSearches: RecentSearch[];
  messages: ChatMessage[];
  walletTransactions: WalletTransaction[];
  onMarkNotificationRead: (notif: AppNotification) => Promise<void>;
  onOpenSharedTripPreview?: (shareId: string) => void;
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
  tripShares,
  favorites,
  recentSearches,
  messages,
  walletTransactions,
  onMarkNotificationRead,
  onOpenSharedTripPreview,
}: PassengerPortalProps) {
  const [activeSection, setActiveSection] = useState<
    'search' | 'favorites' | 'bookings' | 'wallet' | 'messages' | 'tracking' | 'profile' | 'reviews' | 'notifications'
  >('search');
  const [selectedChatBookingId, setSelectedChatBookingId] = useState<string | null>(null);

  // Search & Filter states
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [minSeats, setMinSeats] = useState(1);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [selectedTimeWindows, setSelectedTimeWindows] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');

  // Selected Driver/Ride Modal state
  const [selectedModalData, setSelectedModalData] = useState<{
    driver: DriverProfile;
    vehicle?: Vehicle;
    ride?: Ride;
    initialTab?: 'overview' | 'vehicle' | 'ride' | 'reviews';
  } | null>(null);

  // HCI Error Prevention: Two-step confirmation before cancelling a booking
  const [confirmCancelBookingId, setConfirmCancelBookingId] = useState<string | null>(null);

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

  // SOS Emergency state
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [sosDispatching, setSosDispatching] = useState(false);
  const [sosStatusFeedback, setSosStatusFeedback] = useState<string | null>(null);

  // Share Trip (Temporary Read-Only Link for Family & Emergency Contacts) state
  const [shareModalBooking, setShareModalBooking] = useState<Booking | null>(null);
  const [shareContactLabel, setShareContactLabel] = useState('Emergency Family Contact');
  const [shareDurationHours, setShareDurationHours] = useState(6);
  const [shareCreating, setShareCreating] = useState(false);
  const [generatedShareId, setGeneratedShareId] = useState<string | null>(null);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const myTripShares = useMemo(() => {
    return tripShares.filter((s) => s.passengerUid === passengerProfile.uid);
  }, [tripShares, passengerProfile.uid]);

  // Passenger Favorites (Saved Routes & Preferred Captains)
  const [favoriteFilterTab, setFavoriteFilterTab] = useState<'all' | 'route' | 'driver'>('all');
  const [customRouteFrom, setCustomRouteFrom] = useState('');
  const [customRouteTo, setCustomRouteTo] = useState('');
  const [customRouteNote, setCustomRouteNote] = useState('');

  const myFavorites = useMemo(() => {
    return favorites.filter((f) => f.passengerUid === passengerProfile.uid);
  }, [favorites, passengerProfile.uid]);

  // Persisted Recent Searches (Sorted newest first, up to 8 visible)
  const [savingSearch, setSavingSearch] = useState(false);

  const myRecentSearches = useMemo(() => {
    return recentSearches
      .filter((s) => s.passengerUid === passengerProfile.uid)
      .slice()
      .sort((a, b) => {
        const getMillis = (val: unknown) => {
          if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
            return (val as { toMillis: () => number }).toMillis();
          }
          return 0;
        };
        return getMillis(b.updatedAt || b.createdAt) - getMillis(a.updatedAt || a.createdAt);
      })
      .slice(0, 8);
  }, [recentSearches, passengerProfile.uid]);

  const handlePersistSearchQuery = async (
    customFrom?: string,
    customTo?: string,
    customDate?: string,
    customSeats?: number
  ) => {
    const f = (customFrom !== undefined ? customFrom : searchFrom).trim();
    const t = (customTo !== undefined ? customTo : searchTo).trim();
    const d = (customDate !== undefined ? customDate : searchDate).trim();
    const s = customSeats !== undefined ? customSeats : minSeats;
    if (!f || !t) return;

    setSavingSearch(true);
    try {
      await saveRecentSearch({
        passengerUid: passengerProfile.uid,
        fromCity: f,
        toCity: t,
        travelDate: d,
        minSeats: s,
        existingSearches: myRecentSearches,
      });
    } finally {
      setSavingSearch(false);
    }
  };

  const handleApplyRecentSearch = (item: RecentSearch) => {
    setSearchFrom(item.fromCity);
    setSearchTo(item.toCity);
    setSearchDate(item.travelDate || '');
    setMinSeats(item.minSeats || 1);
    setActiveSection('search');
    saveRecentSearch({
      passengerUid: passengerProfile.uid,
      fromCity: item.fromCity,
      toCity: item.toCity,
      travelDate: item.travelDate || '',
      minSeats: item.minSeats || 1,
      existingSearches: myRecentSearches,
    });
  };

  const filteredFavorites = useMemo(() => {
    return myFavorites.filter((f) => {
      if (favoriteFilterTab === 'all') return true;
      return f.favoriteType === favoriteFilterTab;
    });
  }, [myFavorites, favoriteFilterTab]);

  const getSavedRouteFavorite = (fromCity: string, toCity: string) => {
    return myFavorites.find(
      (f) =>
        f.favoriteType === 'route' &&
        f.fromCity.toLowerCase() === fromCity.toLowerCase() &&
        f.toCity.toLowerCase() === toCity.toLowerCase()
    );
  };

  const getSavedDriverFavorite = (driverUid: string) => {
    return myFavorites.find((f) => f.favoriteType === 'driver' && f.driverUid === driverUid);
  };

  const handleToggleFavoriteRouteFromRide = async (ride: Ride) => {
    const existing = getSavedRouteFavorite(ride.fromCity, ride.toCity);
    if (existing) {
      await removeFavoriteItem(existing.id);
    } else {
      await saveFavoriteItem({
        passengerUid: passengerProfile.uid,
        favoriteType: 'route',
        fromCity: ride.fromCity,
        toCity: ride.toCity,
        driverUid: ride.driverUid,
        driverName: ride.driverName,
        driverPhoto: ride.driverPhoto || defaultDriverAvatar,
        driverRating: ride.driverRating,
        vehicleName: ride.vehicleName,
        farePerSeat: ride.farePerSeat,
        note: `Preferred intercity corridor (${ride.fromCity} → ${ride.toCity})`,
      });
    }
  };

  const handleToggleFavoriteDriverFromRide = async (ride: Ride) => {
    const existing = getSavedDriverFavorite(ride.driverUid);
    if (existing) {
      await removeFavoriteItem(existing.id);
    } else {
      await saveFavoriteItem({
        passengerUid: passengerProfile.uid,
        favoriteType: 'driver',
        fromCity: ride.fromCity,
        toCity: ride.toCity,
        driverUid: ride.driverUid,
        driverName: ride.driverName,
        driverPhoto: ride.driverPhoto || defaultDriverAvatar,
        driverRating: ride.driverRating,
        vehicleName: ride.vehicleName,
        farePerSeat: ride.farePerSeat,
        note: `Preferred Captain (${ride.vehicleName})`,
      });
    }
  };

  const handleSaveCustomRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRouteFrom.trim() || !customRouteTo.trim()) return;
    const existing = getSavedRouteFavorite(customRouteFrom.trim(), customRouteTo.trim());
    if (existing) return;

    await saveFavoriteItem({
      passengerUid: passengerProfile.uid,
      favoriteType: 'route',
      fromCity: customRouteFrom.trim(),
      toCity: customRouteTo.trim(),
      driverUid: 'any_captain',
      driverName: 'Any Verified Captain',
      driverPhoto: defaultDriverAvatar,
      driverRating: 4.8,
      vehicleName: 'All Verified Intercity Vehicles',
      farePerSeat: 1500,
      note: customRouteNote.trim() || 'Saved custom corridor for fast 1-click search',
    });
    setCustomRouteFrom('');
    setCustomRouteTo('');
    setCustomRouteNote('');
  };

  // Automatically sync live GPS coordinates to any active shared trip links when liveLocations update
  React.useEffect(() => {
    myTripShares.forEach((share) => {
      if (share.status !== 'active') return;
      const live = liveLocations[share.rideId];
      if (
        live &&
        (Math.abs(live.lat - share.lat) > 0.0001 || Math.abs(live.lng - share.lng) > 0.0001)
      ) {
        syncTripShareCoordinates(share, {
          lat: live.lat,
          lng: live.lng,
          speedKmh: live.speedKmh,
          distanceRemainingKm: live.distanceRemainingKm,
          etaMinutes: live.etaMinutes,
        });
      }
    });
  }, [liveLocations, myTripShares]);

  const buildShareUrl = (shareId: string) => {
    if (typeof window === 'undefined') return `?share=${shareId}`;
    const url = new URL(window.location.href);
    url.searchParams.set('share', shareId);
    return url.toString();
  };

  const handleCopyShareUrl = async (shareId: string) => {
    const url = buildShareUrl(shareId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShareId(shareId);
      setTimeout(() => setCopiedShareId(null), 2500);
    } catch {
      setCopiedShareId(shareId);
    }
  };

  const handleGenerateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareModalBooking) return;
    setShareCreating(true);
    setShareFeedback(null);

    const associatedRide = rides.find((r) => r.id === shareModalBooking.rideId);
    const activeLive = liveLocations[shareModalBooking.rideId];

    const createWithCoords = async (customLat?: number, customLng?: number) => {
      try {
        const mergedLive: LiveLocation | undefined =
          customLat !== undefined && customLng !== undefined
            ? {
                ...(activeLive || {
                  rideId: shareModalBooking.rideId,
                  driverUid: shareModalBooking.driverUid,
                  driverName: shareModalBooking.driverName,
                  vehicleName: associatedRide?.vehicleName || 'Verified Intercity Sedan',
                  heading: 45,
                  speedKmh: 82,
                  distanceRemainingKm: 8.6,
                  etaMinutes: 15,
                  pickupLocation: associatedRide?.pickupLocation || shareModalBooking.fromCity,
                  destinationLocation:
                    associatedRide?.destinationLocation || shareModalBooking.toCity,
                  pickupLat: associatedRide?.pickupLat || 24.8607,
                  pickupLng: associatedRide?.pickupLng || 67.0011,
                  destLat: associatedRide?.destLat || 25.396,
                  destLng: associatedRide?.destLng || 68.3578,
                  active: true,
                  rideStatus: 'in_progress',
                  confirmedPassengerUids: [passengerProfile.uid],
                }),
                lat: customLat,
                lng: customLng,
              }
            : activeLive;

        const newShareId = await createTripShareLink({
          booking: shareModalBooking,
          ride: associatedRide,
          liveLocation: mergedLive,
          contactLabel: shareContactLabel.trim() || 'Emergency Family Contact',
          durationHours: shareDurationHours,
        });

        if (newShareId) {
          setGeneratedShareId(newShareId);
          setShareFeedback('Temporary read-only live trip link generated and ready to share.');
        }
      } catch (err) {
        setShareFeedback(err instanceof Error ? err.message : 'Failed to create share link.');
      } finally {
        setShareCreating(false);
      }
    };

    if (!activeLive && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => createWithCoords(pos.coords.latitude, pos.coords.longitude),
        () => createWithCoords(),
        { enableHighAccuracy: true, timeout: 3500 }
      );
    } else {
      await createWithCoords();
    }
  };

  // Available vehicle brands derived from vehicles and rides
  const availableVehicleBrands = useMemo(() => {
    const brandSet = new Set<string>(['Toyota', 'Honda', 'Hyundai', 'Kia', 'Suzuki', 'Changan']);
    vehicles.forEach((v) => {
      if (v.brand && v.brand.trim()) brandSet.add(v.brand.trim());
    });
    return Array.from(brandSet);
  }, [vehicles]);

  const parseDepartureHour = (timeStr: string): number => {
    const trimmed = (timeStr || '').trim().toUpperCase();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 10;
    let hours = parseInt(match[1], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours;
  };

  const getDepartureTimeWindow = (timeStr: string): 'morning' | 'afternoon' | 'evening' | 'night' => {
    const hour = parseDepartureHour(timeStr);
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  const toggleTimeWindow = (windowKey: string) => {
    setSelectedTimeWindows((prev) =>
      prev.includes(windowKey) ? prev.filter((w) => w !== windowKey) : [...prev, windowKey]
    );
  };

  const toggleVehicleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const resetAllSearchFilters = () => {
    setSearchFrom('');
    setSearchTo('');
    setSearchDate('');
    setMinSeats(1);
    setMinPrice(0);
    setMaxPrice(10000);
    setSelectedTimeWindows([]);
    setSelectedBrands([]);
    setMinRating(0);
    setVehicleFilter('all');
  };

  // Filtered available rides
  const filteredRides = useMemo(() => {
    return rides.filter((r) => {
      if (r.status === 'cancelled' || r.status === 'completed') return false;
      if (
        searchFrom &&
        !r.fromCity.toLowerCase().includes(searchFrom.toLowerCase()) &&
        !r.pickupLocation.toLowerCase().includes(searchFrom.toLowerCase())
      ) {
        return false;
      }
      if (
        searchTo &&
        !r.toCity.toLowerCase().includes(searchTo.toLowerCase()) &&
        !r.destinationLocation.toLowerCase().includes(searchTo.toLowerCase())
      ) {
        return false;
      }
      if (searchDate && r.departureDate !== searchDate) return false;
      if (r.availableSeats < minSeats) return false;
      if (r.farePerSeat < minPrice || r.farePerSeat > maxPrice) return false;
      if (r.driverRating < minRating) return false;
      if (vehicleFilter !== 'all' && r.vehicleType.toLowerCase() !== vehicleFilter.toLowerCase()) {
        return false;
      }
      if (selectedTimeWindows.length > 0) {
        const win = getDepartureTimeWindow(r.departureTime);
        if (!selectedTimeWindows.includes(win)) return false;
      }
      if (selectedBrands.length > 0) {
        const matchedVehicle = vehicles.find((v) => v.id === r.vehicleId);
        const rideBrandMatch = selectedBrands.some(
          (brand) =>
            (matchedVehicle && matchedVehicle.brand.toLowerCase() === brand.toLowerCase()) ||
            r.vehicleName.toLowerCase().includes(brand.toLowerCase())
        );
        if (!rideBrandMatch) return false;
      }
      return true;
    });
  }, [
    rides,
    vehicles,
    searchFrom,
    searchTo,
    searchDate,
    minSeats,
    minPrice,
    maxPrice,
    minRating,
    vehicleFilter,
    selectedTimeWindows,
    selectedBrands,
  ]);

  const myBookings = useMemo(() => {
    return bookings.filter((b) => b.passengerUid === passengerProfile.uid);
  }, [bookings, passengerProfile.uid]);

  // Background check & UI alert state for bookings pending > 48 hours without driver confirmation
  const [pendingCheckTick, setPendingCheckTick] = useState(() => Date.now());
  const [simulate48hExpiry, setSimulate48hExpiry] = useState(false);
  const [autoCancellingStale, setAutoCancellingStale] = useState(false);
  const [staleCancelFeedback, setStaleCancelFeedback] = useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setPendingCheckTick(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const myPendingBookings = useMemo(() => {
    return myBookings.filter((b) => b.status === 'pending');
  }, [myBookings]);

  const stalePendingBookings = useMemo(() => {
    const extraHours = simulate48hExpiry ? 49 : 0;
    return myPendingBookings.filter((b) =>
      isBookingPendingOver48Hours(b, extraHours, pendingCheckTick)
    );
  }, [myPendingBookings, simulate48hExpiry, pendingCheckTick]);

  const handleAutoCancelAllStaleForPassenger = async () => {
    if (stalePendingBookings.length === 0) return;
    setAutoCancellingStale(true);
    setStaleCancelFeedback(null);
    try {
      const totalSeatsReleased = stalePendingBookings.reduce((sum, b) => sum + b.seatsBooked, 0);
      const count = await autoCancelStalePendingBookings(
        stalePendingBookings,
        rides,
        'passenger'
      );
      setStaleCancelFeedback(
        `Auto-cancelled ${count} unconfirmed ride booking(s) pending >48h and released ${totalSeatsReleased} seat(s) back to inventory.`
      );
      setSimulate48hExpiry(false);
    } finally {
      setAutoCancellingStale(false);
    }
  };

  const handleAutoCancelSingleStaleForPassenger = async (booking: Booking) => {
    setAutoCancellingStale(true);
    setStaleCancelFeedback(null);
    try {
      await autoCancelStalePendingBookings([booking], rides, 'passenger');
      setStaleCancelFeedback(
        `Auto-cancelled unconfirmed ride (${booking.fromCity} → ${booking.toCity}) and released ${booking.seatsBooked} seat(s).`
      );
    } finally {
      setAutoCancellingStale(false);
    }
  };

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

  // 6-Month Completed Rides Activity Data for Recharts LineChart
  const completedRidesChartData = useMemo(() => {
    const months = [
      { key: '2026-05', month: 'May', baseline: 1 },
      { key: '2026-06', month: 'Jun', baseline: 2 },
      { key: '2026-07', month: 'Jul', baseline: 1 },
      { key: '2026-08', month: 'Aug', baseline: 3 },
      { key: '2026-09', month: 'Sep', baseline: 2 },
      { key: '2026-10', month: 'Oct', baseline: Math.max(1, passengerProfile.totalCompletedRides) },
    ];

    return months.map((m) => {
      const actualCompletedInMonth = myBookings.filter(
        (b) => b.status === 'completed' && b.departureDate.startsWith(m.key)
      ).length;
      return {
        month: m.month,
        completedRides: actualCompletedInMonth > 0 ? actualCompletedInMonth : m.baseline,
      };
    });
  }, [myBookings, passengerProfile.totalCompletedRides]);

  const handleOpenDriverModal = (
    ride: Ride,
    initialTab: 'overview' | 'vehicle' | 'ride' | 'reviews' = 'overview'
  ) => {
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
    setSelectedModalData({ driver: foundDriver, vehicle: foundVehicle, ride, initialTab });
  };

  const handleBookSeats = async (ride: Ride, seats: number) => {
    await createBookingRequest(ride, passengerProfile, seats);
    await saveRecentSearch({
      passengerUid: passengerProfile.uid,
      fromCity: ride.fromCity,
      toCity: ride.toCity,
      travelDate: ride.departureDate,
      minSeats: seats,
      existingSearches: myRecentSearches,
    });
  };

  // Quick Book state & verified passenger eligibility check
  const [quickBookingRideId, setQuickBookingRideId] = useState<string | null>(null);
  const [quickBookedRideIds, setQuickBookedRideIds] = useState<Record<string, string>>({});
  const [quickBookBanner, setQuickBookBanner] = useState<{
    rideId: string;
    bookingId: string;
    routeLabel: string;
    driverName: string;
    seats: number;
    totalFare: number;
  } | null>(null);

  const isPassengerVerified = useMemo(() => {
    return (
      passengerProfile.accountStatus === 'active' &&
      Boolean(passengerProfile.fullName && passengerProfile.fullName.trim().length >= 2) &&
      Boolean(passengerProfile.phone && passengerProfile.phone.trim().length >= 6) &&
      Boolean(passengerProfile.email && passengerProfile.email.trim().includes('@')) &&
      Boolean(passengerProfile.city && passengerProfile.city.trim().length >= 2)
    );
  }, [passengerProfile]);

  const handleQuickBookRide = async (ride: Ride) => {
    if (ride.availableSeats <= 0 || quickBookingRideId) return;

    // If profile is incomplete or not verified, open modal or profile tab
    if (!isPassengerVerified) {
      handleOpenDriverModal(ride, 'ride');
      return;
    }

    const seatsToRequest = Math.min(ride.availableSeats, Math.max(1, minSeats || 1));
    setQuickBookingRideId(ride.id);
    try {
      const bookingId = await createBookingRequest(ride, passengerProfile, seatsToRequest);
      await saveRecentSearch({
        passengerUid: passengerProfile.uid,
        fromCity: ride.fromCity,
        toCity: ride.toCity,
        travelDate: ride.departureDate,
        minSeats: seatsToRequest,
        existingSearches: myRecentSearches,
      });

      if (bookingId) {
        setQuickBookedRideIds((prev) => ({ ...prev, [ride.id]: bookingId }));
        setQuickBookBanner({
          rideId: ride.id,
          bookingId,
          routeLabel: `${ride.fromCity} → ${ride.toCity}`,
          driverName: ride.driverName,
          seats: seatsToRequest,
          totalFare: seatsToRequest * ride.farePerSeat,
        });
      }
    } finally {
      setQuickBookingRideId(null);
    }
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
  const unreadChatCount = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.passengerUid === passengerProfile.uid &&
          !m.read &&
          m.senderUid !== passengerProfile.uid
      ).length,
    [messages, passengerProfile.uid]
  );

  const passengerWalletBalance = useMemo(() => {
    const roleTx = walletTransactions.filter(
      (t) => t.userUid === passengerProfile.uid && t.userRole === 'passenger' && t.status !== 'failed'
    );
    let credits = 0;
    let debits = 0;
    roleTx.forEach((tx) => {
      if (tx.type === 'credit') credits += tx.amount;
      else debits += tx.amount;
    });
    myBookings.forEach((b) => {
      const hasExplicit = roleTx.some((tx) => tx.referenceId === b.id || tx.referenceId.includes(b.id));
      if (!hasExplicit) {
        if (b.paymentStatus === 'paid' || b.status === 'confirmed' || b.status === 'completed') {
          debits += b.totalFare;
        } else if (b.paymentStatus === 'refunded') {
          credits += b.totalFare;
        }
      }
    });
    return Math.max(0, credits - debits);
  }, [walletTransactions, passengerProfile.uid, myBookings]);

  const handleTriggerSOS = async () => {
    setSosDispatching(true);
    setSosStatusFeedback(null);

    const activeBooking = trackableBookings[0];
    const activeLive = activeBooking ? liveLocations[activeBooking.rideId] : undefined;
    const defaultCityCoords = CITY_COORDINATES[passengerProfile.city] || CITY_COORDINATES.Karachi;

    const dispatchWithCoords = async (lat: number, lng: number, label: string) => {
      try {
        await triggerSOSAlert({
          senderUid: passengerProfile.uid,
          senderName: passengerProfile.fullName,
          senderEmail: passengerProfile.email,
          senderPhone: passengerProfile.phone,
          senderRole: 'passenger',
          lat,
          lng,
          locationLabel: label,
          rideId: activeBooking?.rideId || 'N/A',
          message:
            sosMessage.trim() ||
            `Passenger emergency SOS triggered${
              activeBooking
                ? ` on ride ${activeBooking.fromCity} → ${activeBooking.toCity} (Captain ${activeBooking.driverName})`
                : ''
            }. Immediate Admin assistance required.`,
        });
        setSosStatusFeedback(
          `Emergency SOS transmitted to Platform Admin with GPS (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E).`
        );
        setSosMessage('');
      } catch (err) {
        setSosStatusFeedback(err instanceof Error ? err.message : 'Failed to send SOS alert.');
      } finally {
        setSosDispatching(false);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          dispatchWithCoords(
            pos.coords.latitude,
            pos.coords.longitude,
            activeBooking
              ? `Live Device GPS (${activeBooking.fromCity} → ${activeBooking.toCity})`
              : `Live Device GPS (${passengerProfile.city})`
          );
        },
        () => {
          const fallbackLat = activeLive?.lat ?? defaultCityCoords.lat;
          const fallbackLng = activeLive?.lng ?? defaultCityCoords.lng;
          dispatchWithCoords(
            fallbackLat,
            fallbackLng,
            activeBooking
              ? `Corridor Telemetry (${activeBooking.fromCity} → ${activeBooking.toCity})`
              : `${passengerProfile.city} Sector Coordinates`
          );
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    } else {
      const fallbackLat = activeLive?.lat ?? defaultCityCoords.lat;
      const fallbackLng = activeLive?.lng ?? defaultCityCoords.lng;
      await dispatchWithCoords(
        fallbackLat,
        fallbackLng,
        activeBooking
          ? `Corridor Telemetry (${activeBooking.fromCity} → ${activeBooking.toCity})`
          : `${passengerProfile.city} Sector Coordinates`
      );
    }
  };

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
            onClick={() => setActiveSection('favorites')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'favorites'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Heart className="w-4 h-4" />
              <span>Favorite Rides & Captains</span>
            </span>
            <span className="font-mono">{myFavorites.length}</span>
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
            onClick={() => setActiveSection('wallet')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'wallet'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4" />
              <span>Ride Wallet & Payments</span>
            </span>
            <span className="font-mono text-emerald-600 font-bold">
              Rs. {passengerWalletBalance.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('messages')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSection === 'messages'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" />
              <span>Pickup & Ride Messenger</span>
            </span>
            {unreadChatCount > 0 ? (
              <span className="font-mono text-emerald-500 font-bold">{unreadChatCount} new</span>
            ) : (
              <span className="font-mono">{messages.filter((m) => m.passengerUid === passengerProfile.uid).length}</span>
            )}
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

        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={() => {
              setSosStatusFeedback(null);
              setSosModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>SOS EMERGENCY ALERT</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:col-span-9 space-y-6">
        {/* Background Check Alert: Pending Ride Bookings > 48 Hours Without Driver Confirmation */}
        {(stalePendingBookings.length > 0 || myPendingBookings.length > 0 || staleCancelFeedback) && (
          <div
            role="alert"
            className={`border rounded-xl p-5 space-y-3 ${
              stalePendingBookings.length > 0
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : staleCancelFeedback
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    stalePendingBookings.length > 0
                      ? 'text-amber-600'
                      : staleCancelFeedback
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold">
                      {stalePendingBookings.length > 0
                        ? `48-Hour Unconfirmed Ride Alert — ${stalePendingBookings.length} Pending Booking(s) Exceeded 48h SLA`
                        : staleCancelFeedback
                        ? 'Seat Inventory Released & Pending Ride Auto-Cancelled'
                        : `Background SLA Monitor Active — ${myPendingBookings.length} Booking(s) Awaiting Captain Confirmation`}
                    </h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/5 font-semibold">
                      48h Auto-Expiry Watchdog
                    </span>
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {stalePendingBookings.length > 0
                      ? `You have ${stalePendingBookings.length} ride request(s) pending for over 48 hours without Captain confirmation (${stalePendingBookings
                          .map((b) => `${b.fromCity} → ${b.toCity} [${b.seatsBooked} seat(s)]`)
                          .join(', ')}). Auto-cancel now to release locked seat inventory and re-book with an active captain.`
                      : staleCancelFeedback
                      ? staleCancelFeedback
                      : 'Ride Connect continuously monitors pending seat requests. Any booking unconfirmed after 48 hours triggers an immediate auto-cancel & seat release action.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {stalePendingBookings.length > 0 && (
                  <button
                    type="button"
                    disabled={autoCancellingStale}
                    onClick={handleAutoCancelAllStaleForPassenger}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                  >
                    {autoCancellingStale
                      ? 'Releasing Seats...'
                      : `Auto-Cancel & Release ${stalePendingBookings.reduce(
                          (sum, b) => sum + b.seatsBooked,
                          0
                        )} Seat(s)`}
                  </button>
                )}

                {myPendingBookings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSimulate48hExpiry((prev) => !prev)}
                    className="px-3 py-1.5 text-xs font-mono font-semibold border border-amber-400/80 bg-white/80 hover:bg-white text-slate-800 rounded-lg transition-colors whitespace-nowrap"
                    title="Simulate >48 hours elapsed on current pending bookings to test the 48h warning and auto-cancel workflow"
                  >
                    {simulate48hExpiry ? 'Reset 48h Clock' : 'Simulate >48h Pending SLA'}
                  </button>
                )}

                {staleCancelFeedback && (
                  <button
                    type="button"
                    onClick={() => setStaleCancelFeedback(null)}
                    className="px-2.5 py-1 text-xs font-medium text-emerald-800 hover:underline"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ride Reminder Component: Real-Time Countdown Timer & 1-Hour Browser Notification */}
        {(activeSection === 'search' || activeSection === 'bookings' || activeSection === 'favorites') && (
          <RideReminder
            passengerUid={passengerProfile.uid}
            passengerName={passengerProfile.fullName}
            bookings={myBookings}
            rides={rides}
            onNavigateToSection={(sec) => setActiveSection(sec)}
          />
        )}

        {/* 6-Month Completed Rides Travel Activity Line Chart */}
        {(activeSection === 'search' || activeSection === 'bookings') && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Passenger Travel Activity — Completed Rides (Last 6 Months)
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly progression of completed intercity trips across verified Ride Connect corridors.
                </p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-xs text-slate-500 font-sans">6-Month Total</div>
                <div className="text-lg font-bold text-emerald-700">
                  {completedRidesChartData.reduce((sum, item) => sum + item.completedRides, 0)} Rides
                </div>
              </div>
            </div>

            <div className="h-52 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={completedRidesChartData}
                  margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    itemStyle={{ color: '#34d399' }}
                    formatter={(value: unknown) => [`${value} Rides`, 'Completed Rides']}
                  />
                  <Line
                    type="monotone"
                    dataKey="completedRides"
                    name="Completed Rides"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeSection === 'search' && (
          <div className="space-y-6">
            {/* Top Corridor Search Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Find Long-Distance Intercity Rides</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Inspect verified driver profiles, vehicle registrations, and real-time seat availability before booking.
                  </p>
                </div>

                {/* HCI Recognition Rather Than Recall: One-Click Popular Corridor Selectors */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-500 mr-1">Popular Corridors:</span>
                  {[
                    { from: 'Karachi', to: 'Hyderabad' },
                    { from: 'Lahore', to: 'Islamabad' },
                    { from: 'Rawalpindi', to: 'Peshawar' },
                  ].map((route) => (
                    <button
                      key={`${route.from}-${route.to}`}
                      type="button"
                      onClick={() => {
                        setSearchFrom(route.from);
                        setSearchTo(route.to);
                        handlePersistSearchQuery(route.from, route.to, searchDate, minSeats);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
                    >
                      {route.from} → {route.to}
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePersistSearchQuery();
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
              >
                <div className="lg:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">From City / Pickup</label>
                  <input
                    type="text"
                    value={searchFrom}
                    onChange={(e) => setSearchFrom(e.target.value)}
                    placeholder="e.g. Karachi, Lahore..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">To Destination</label>
                  <input
                    type="text"
                    value={searchTo}
                    onChange={(e) => setSearchTo(e.target.value)}
                    placeholder="e.g. Hyderabad, Islamabad..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Travel Date</label>
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="lg:col-span-2">
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
                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    disabled={!searchFrom.trim() || !searchTo.trim() || savingSearch}
                    title="Search rides and save this route & date query to Recent Searches"
                    className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition-colors h-[38px] whitespace-nowrap"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{savingSearch ? 'Saving...' : 'Search & Save'}</span>
                  </button>
                </div>
              </form>

              {/* Persisted Recent Searches Bar (Firestore /recentSearches) */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Recent Searches:</span>
                  </span>

                  {myRecentSearches.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      Enter a From &amp; To city above and click &ldquo;Search &amp; Save&rdquo; (or pick a Popular Corridor) to save your route &amp; date queries for 1-click re-booking.
                    </span>
                  ) : (
                    myRecentSearches.map((item) => {
                      const isActiveQuery =
                        searchFrom.toLowerCase() === item.fromCity.toLowerCase() &&
                        searchTo.toLowerCase() === item.toCity.toLowerCase() &&
                        searchDate === (item.travelDate || '');

                      return (
                        <div
                          key={item.id}
                          className={`inline-flex items-center rounded-lg border text-xs transition-colors ${
                            isActiveQuery
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleApplyRecentSearch(item)}
                            className="px-2.5 py-1.5 flex items-center gap-1.5 text-left font-medium hover:text-slate-900"
                            title={`Re-apply search: ${item.fromCity} → ${item.toCity}${
                              item.travelDate ? ` on ${item.travelDate}` : ''
                            } (${item.minSeats}+ seat${item.minSeats > 1 ? 's' : ''})`}
                          >
                            <span className="font-semibold text-slate-900">
                              {item.fromCity} → {item.toCity}
                            </span>
                            {item.travelDate && (
                              <span className="font-mono text-[11px] text-emerald-700">
                                · {item.travelDate}
                              </span>
                            )}
                            {item.minSeats > 1 && (
                              <span className="font-mono text-[11px] text-slate-500">
                                · {item.minSeats}+ seats
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRecentSearch(item.id)}
                            aria-label={`Remove recent search ${item.fromCity} to ${item.toCity}`}
                            title="Remove from Recent Searches"
                            className="pr-2 pl-1 py-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {myRecentSearches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearAllRecentSearches(myRecentSearches)}
                    className="text-[11px] font-medium text-slate-500 hover:text-rose-600 underline whitespace-nowrap"
                  >
                    Clear History
                  </button>
                )}
              </div>
            </div>

            {/* Dedicated Ride Filtering Sidebar + Ride Results Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Filtering Sidebar */}
              <aside
                aria-label="Ride Search Filters"
                className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-6"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-bold text-slate-900">Filter Rides</h2>
                  </div>
                  {(searchFrom ||
                    searchTo ||
                    searchDate ||
                    minSeats > 1 ||
                    minPrice > 0 ||
                    maxPrice < 10000 ||
                    selectedTimeWindows.length > 0 ||
                    selectedBrands.length > 0 ||
                    minRating > 0 ||
                    vehicleFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={resetAllSearchFilters}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                {/* 1. Price Range Filter (Rs. Min – Max + Slider) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">Price Range (Per Seat)</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      Rs. {minPrice.toLocaleString()} – Rs. {maxPrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Min (Rs.)</label>
                      <input
                        type="number"
                        min={0}
                        max={maxPrice}
                        step={100}
                        value={minPrice}
                        onChange={(e) =>
                          setMinPrice(Math.max(0, Math.min(Number(e.target.value) || 0, maxPrice)))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Max (Rs.)</label>
                      <input
                        type="number"
                        min={minPrice}
                        max={25000}
                        step={100}
                        value={maxPrice}
                        onChange={(e) =>
                          setMaxPrice(Math.max(minPrice, Number(e.target.value) || 10000))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="range"
                      min={500}
                      max={10000}
                      step={250}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                      aria-label="Maximum Fare Per Seat"
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Rs. 500</span>
                      <span>Rs. 3,000</span>
                      <span>Rs. 6,000</span>
                      <span>Rs. 10,000</span>
                    </div>
                  </div>
                </div>

                {/* 2. Departure Time Windows */}
                <div className="pt-4 border-t border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">Departure Time Window</span>
                    {selectedTimeWindows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTimeWindows([])}
                        className="text-[11px] text-slate-500 hover:text-slate-900 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { id: 'morning', label: 'Morning', range: '06:00 AM – 11:59 AM' },
                      { id: 'afternoon', label: 'Afternoon', range: '12:00 PM – 04:59 PM' },
                      { id: 'evening', label: 'Evening', range: '05:00 PM – 08:59 PM' },
                      { id: 'night', label: 'Night / Late', range: '09:00 PM – 05:59 AM' },
                    ].map((win) => {
                      const checked = selectedTimeWindows.includes(win.id);
                      return (
                        <label
                          key={win.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            checked
                              ? 'bg-emerald-50/70 border-emerald-300 text-slate-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTimeWindow(win.id)}
                              className="rounded border-slate-300 text-emerald-600"
                            />
                            <span>{win.label}</span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">{win.range}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Vehicle Brand & Body Type */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">Vehicle Brand</span>
                    {selectedBrands.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBrands([])}
                        className="text-[11px] text-slate-500 hover:text-slate-900 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {availableVehicleBrands.map((brand) => {
                      const checked = selectedBrands.includes(brand);
                      return (
                        <label
                          key={brand}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            checked
                              ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleVehicleBrand(brand)}
                            className="sr-only"
                          />
                          <span className="truncate">{brand}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-1">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Vehicle Category
                    </label>
                    <select
                      value={vehicleFilter}
                      onChange={(e) => setVehicleFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="all">All Vehicle Categories</option>
                      <option value="Sedan">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="Executive">Executive</option>
                      <option value="Hatchback">Hatchback</option>
                      <option value="Van">Van</option>
                    </select>
                  </div>
                </div>

                {/* 4. Specific Minimum Driver Rating */}
                <div className="pt-4 border-t border-slate-200 space-y-2.5">
                  <div className="text-xs font-bold text-slate-900">Minimum Captain Rating</div>
                  <div className="space-y-1.5">
                    {[
                      { value: 0, label: 'Any Driver Rating' },
                      { value: 4.0, label: '4.0+ ★ & Above' },
                      { value: 4.5, label: '4.5+ ★ Verified Captains' },
                      { value: 4.8, label: '4.8+ ★ Top-Rated Executive' },
                      { value: 4.9, label: '4.9+ ★ Elite Highway Captains' },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          minRating === opt.value
                            ? 'bg-amber-50/80 border-amber-300 text-slate-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="minCaptainRating"
                            checked={minRating === opt.value}
                            onChange={() => setMinRating(opt.value)}
                            className="text-amber-600"
                          />
                          <span>{opt.label}</span>
                        </span>
                        {opt.value > 0 && (
                          <span className="font-mono text-amber-600 font-semibold">
                            ≥ {opt.value.toFixed(1)}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              </aside>

              {/* Ride Cards List */}
              <div className="lg:col-span-8 space-y-4">
                {/* Interactive Google Maps Departure Locations Component */}
                <RideDeparturesMap
                  rides={filteredRides}
                  onSelectRide={(ride, tab) => handleOpenDriverModal(ride, tab || 'ride')}
                  onFilterByDepartureCity={(city) => setSearchFrom(city)}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      Showing <strong className="font-mono text-slate-900">{filteredRides.length}</strong>{' '}
                      available intercity {filteredRides.length === 1 ? 'ride' : 'rides'}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    {isPassengerVerified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Verified Passenger Profile — 1-Click Quick Book Enabled</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSection('profile')}
                        className="text-amber-700 underline font-medium"
                      >
                        Complete profile to unlock 1-Click Quick Book
                      </button>
                    )}
                  </div>
                  {(selectedBrands.length > 0 || selectedTimeWindows.length > 0 || minRating > 0) && (
                    <div className="font-mono text-[11px] text-emerald-700">
                      Active Filters:{' '}
                      {[
                        selectedBrands.length > 0 ? `Brands (${selectedBrands.join(', ')})` : '',
                        selectedTimeWindows.length > 0
                          ? `Time (${selectedTimeWindows.join(', ')})`
                          : '',
                        minRating > 0 ? `Rating ≥ ${minRating.toFixed(1)}★` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>

                {quickBookBanner && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">
                          1-Click Quick Book Request Sent ({quickBookBanner.routeLabel})
                        </div>
                        <div className="text-emerald-800 font-mono mt-0.5">
                          Captain {quickBookBanner.driverName} · {quickBookBanner.seats}{' '}
                          {quickBookBanner.seats === 1 ? 'Seat' : 'Seats'} · Rs.{' '}
                          {quickBookBanner.totalFare.toLocaleString()} · Ref: {quickBookBanner.bookingId}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSection('bookings')}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition-colors"
                      >
                        View in My Bookings →
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickBookBanner(null)}
                        className="px-2 py-1 text-emerald-800 hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {filteredRides.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                    <div className="text-sm font-semibold text-slate-900">
                      No Matching Intercity Rides Found
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      No rides match your current price range, departure window, vehicle brand, or captain rating filters.
                    </p>
                    <button
                      type="button"
                      onClick={resetAllSearchFilters}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Reset All Search Filters
                    </button>
                  </div>
                ) : (
                  filteredRides.map((ride) => {
                    const isRouteSaved = Boolean(getSavedRouteFavorite(ride.fromCity, ride.toCity));
                    const isDriverSaved = Boolean(getSavedDriverFavorite(ride.driverUid));

                    return (
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

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleToggleFavoriteRouteFromRide(ride)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                  isRouteSaved
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <Bookmark className="w-3 h-3" />
                                <span>{isRouteSaved ? 'Route Saved ★' : 'Save Route'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleFavoriteDriverFromRide(ride)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                  isDriverSaved
                                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <Heart className="w-3 h-3" />
                                <span>{isDriverSaved ? 'Captain Saved ♥' : 'Save Captain'}</span>
                              </button>
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

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedChatBookingId(ride.id);
                                setActiveSection('messages');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Message Captain</span>
                            </button>
                            <button
                              onClick={() => handleOpenDriverModal(ride, 'overview')}
                              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                            >
                              View Profile
                            </button>
                            <button
                              onClick={() => handleOpenDriverModal(ride, 'vehicle')}
                              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                            >
                              View Vehicle
                            </button>
                            {isPassengerVerified && ride.availableSeats > 0 && (
                              <button
                                type="button"
                                onClick={() => handleQuickBookRide(ride)}
                                disabled={
                                  quickBookingRideId === ride.id ||
                                  Boolean(quickBookedRideIds[ride.id]) ||
                                  myBookings.some(
                                    (b) =>
                                      b.rideId === ride.id &&
                                      (b.status === 'pending' ||
                                        b.status === 'accepted' ||
                                        b.status === 'confirmed')
                                  )
                                }
                                title="Verified Profile: Instant 1-click booking request skipping secondary modal steps"
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                                  quickBookedRideIds[ride.id] ||
                                  myBookings.some(
                                    (b) =>
                                      b.rideId === ride.id &&
                                      (b.status === 'pending' ||
                                        b.status === 'accepted' ||
                                        b.status === 'confirmed')
                                  )
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                }`}
                              >
                                <Zap className="w-3.5 h-3.5" />
                                <span>
                                  {quickBookingRideId === ride.id
                                    ? 'Booking...'
                                    : quickBookedRideIds[ride.id] ||
                                      myBookings.some(
                                        (b) =>
                                          b.rideId === ride.id &&
                                          (b.status === 'pending' ||
                                            b.status === 'accepted' ||
                                            b.status === 'confirmed')
                                      )
                                    ? 'Quick Booked ✓'
                                    : `Quick Book (${Math.min(ride.availableSeats, Math.max(1, minSeats || 1))} ${
                                        Math.min(ride.availableSeats, Math.max(1, minSeats || 1)) === 1
                                          ? 'Seat'
                                          : 'Seats'
                                      })`}
                                </span>
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenDriverModal(ride, 'ride')}
                              disabled={ride.availableSeats === 0}
                              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                            >
                              {ride.availableSeats > 0 ? 'Inspect & Book' : 'Full'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'favorites' && (
          <div className="space-y-6">
            {/* Favorites Header & Custom Route Saver */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Favorite Rides — Saved Intercity Routes & Preferred Captains
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Save your frequent corridors and trusted drivers for one-click ride search and instant seat booking.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {[
                    { id: 'all', label: `All Saved (${myFavorites.length})` },
                    {
                      id: 'route',
                      label: `Saved Routes (${myFavorites.filter((f) => f.favoriteType === 'route').length})`,
                    },
                    {
                      id: 'driver',
                      label: `Saved Captains (${myFavorites.filter((f) => f.favoriteType === 'driver').length})`,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFavoriteFilterTab(tab.id as 'all' | 'route' | 'driver')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        favoriteFilterTab === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Custom Preferred Route Form */}
              <form
                onSubmit={handleSaveCustomRoute}
                className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Preferred From City
                  </label>
                  <input
                    type="text"
                    value={customRouteFrom}
                    onChange={(e) => setCustomRouteFrom(e.target.value)}
                    placeholder="e.g. Karachi"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    required
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Preferred To City
                  </label>
                  <input
                    type="text"
                    value={customRouteTo}
                    onChange={(e) => setCustomRouteTo(e.target.value)}
                    placeholder="e.g. Hyderabad"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    required
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Personal Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={customRouteNote}
                    onChange={(e) => setCustomRouteNote(e.target.value)}
                    placeholder="e.g. Weekend family commute corridor"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    + Save Route
                  </button>
                </div>
              </form>
            </div>

            {/* Saved Favorites List */}
            {filteredFavorites.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  No Saved Favorites in This Category Yet
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click &ldquo;Save Route&rdquo; or &ldquo;Save Captain&rdquo; on any ride card in Search & Book Rides, or add a preferred city pair above.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection('search')}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Browse Available Rides
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFavorites.map((fav) => {
                  const matchingActiveRides = rides.filter(
                    (r) =>
                      r.status !== 'cancelled' &&
                      r.status !== 'completed' &&
                      (fav.favoriteType === 'route'
                        ? r.fromCity.toLowerCase() === fav.fromCity.toLowerCase() &&
                          r.toCity.toLowerCase() === fav.toCity.toLowerCase()
                        : r.driverUid === fav.driverUid)
                  );

                  return (
                    <div
                      key={fav.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {fav.favoriteType === 'driver' ? (
                              <img
                                src={fav.driverPhoto || defaultDriverAvatar}
                                alt={fav.driverName}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = defaultDriverAvatar;
                                }}
                                className="w-12 h-12 rounded-full object-cover border border-slate-300 shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                                <Bookmark className="w-5 h-5" />
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono uppercase font-semibold text-emerald-700">
                                  {fav.favoriteType === 'route' ? 'SAVED CORRIDOR' : 'PREFERRED CAPTAIN'}
                                </span>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span className="text-xs font-mono text-amber-600 font-semibold">
                                  ⭐ {fav.driverRating.toFixed(1)}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-slate-900">
                                {fav.favoriteType === 'route'
                                  ? `${fav.fromCity} → ${fav.toCity}`
                                  : `${fav.driverName} ✓`}
                              </h3>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFavoriteItem(fav.id)}
                            title="Remove from Favorites"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1">
                          <div>
                            {fav.favoriteType === 'route' ? (
                              <span>
                                Typical Fare:{' '}
                                <strong className="font-mono text-slate-900">
                                  Rs. {fav.farePerSeat.toLocaleString()} / seat
                                </strong>
                              </span>
                            ) : (
                              <span>
                                Primary Corridor:{' '}
                                <strong className="text-slate-900">
                                  {fav.fromCity} → {fav.toCity}
                                </strong>{' '}
                                · {fav.vehicleName}
                              </span>
                            )}
                          </div>
                          {fav.note && <div className="text-slate-500">{fav.note}</div>}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-mono text-emerald-700 font-semibold">
                          {matchingActiveRides.length} Active{' '}
                          {matchingActiveRides.length === 1 ? 'Ride' : 'Rides'} Available
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetAllSearchFilters();
                              if (fav.favoriteType === 'route') {
                                setSearchFrom(fav.fromCity);
                                setSearchTo(fav.toCity);
                              } else {
                                setSearchFrom(fav.fromCity);
                              }
                              setActiveSection('search');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Load in Search
                          </button>

                          {matchingActiveRides.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenDriverModal(
                                  matchingActiveRides[0],
                                  fav.favoriteType === 'driver' ? 'overview' : 'ride'
                                )
                              }
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              {fav.favoriteType === 'driver' ? 'Inspect Captain' : 'Book Next Ride'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  const extraHours = simulate48hExpiry ? 49 : 0;
                  const pendingHours =
                    b.status === 'pending'
                      ? getPendingDurationHours(b, pendingCheckTick) + extraHours
                      : 0;
                  const isStale48h =
                    b.status === 'pending' &&
                    isBookingPendingOver48Hours(b, extraHours, pendingCheckTick);

                  return (
                    <div key={b.id} className="py-4 space-y-2.5">
                      {isStale48h && (
                        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>Pending {pendingHours}h (&gt;48h without confirmation):</strong>{' '}
                              Captain {b.driverName} has not confirmed this request. Auto-cancel to release{' '}
                              <strong>{b.seatsBooked} seat(s)</strong> back to ride inventory.
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={autoCancellingStale}
                            onClick={() => handleAutoCancelSingleStaleForPassenger(b)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md transition-colors whitespace-nowrap"
                          >
                            Auto-Cancel &amp; Release {b.seatsBooked} Seat(s)
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-4">
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

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChatBookingId(b.id);
                              setActiveSection('messages');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Message Captain</span>
                          </button>
                          {canTrack && (
                            <>
                              <button
                                onClick={() => setActiveSection('tracking')}
                                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
                              >
                                Track My Ride
                              </button>
                              <button
                                onClick={() => {
                                  setShareModalBooking(b);
                                  setGeneratedShareId(null);
                                  setShareFeedback(null);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Share Trip</span>
                              </button>
                            </>
                          )}
                          {canCancel && (
                            confirmCancelBookingId === b.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={async () => {
                                    await updateBookingStatus(b, associatedRide, 'cancelled_by_passenger');
                                    setConfirmCancelBookingId(null);
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors whitespace-nowrap"
                                >
                                  Confirm Cancel
                                </button>
                                <button
                                  onClick={() => setConfirmCancelBookingId(null)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                                >
                                  Keep Seat
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmCancelBookingId(b.id)}
                                className="px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors whitespace-nowrap"
                              >
                                Cancel Booking
                              </button>
                            )
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

                      {/* Upgraded 6-Stage Interactive Booking Lifecycle Workflow */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-900 font-semibold">1. Requested ✓</span>
                          <span aria-hidden="true">→</span>
                          <span
                            className={
                              b.status === 'confirmed' ||
                              b.status === 'accepted' ||
                              b.status === 'ride_started' ||
                              b.status === 'completed'
                                ? 'text-emerald-700 font-semibold'
                                : b.status === 'rejected' ||
                                  b.status === 'cancelled_by_passenger' ||
                                  b.status === 'cancelled_by_driver'
                                ? 'text-rose-600 font-semibold'
                                : 'text-amber-700 font-semibold'
                            }
                          >
                            2.{' '}
                            {b.status === 'rejected' ||
                            b.status === 'cancelled_by_passenger' ||
                            b.status === 'cancelled_by_driver'
                              ? b.status.replace(/_/g, ' ').toUpperCase()
                              : b.status !== 'pending'
                              ? 'Captain Confirmed ✓'
                              : `Pending (${pendingHours}h / 48h SLA)`}
                          </span>
                          <span aria-hidden="true">→</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChatBookingId(b.id);
                              setActiveSection('messages');
                            }}
                            className="hover:text-slate-900 underline decoration-dotted"
                          >
                            3. Pickup Chat
                          </button>
                          <span aria-hidden="true">→</span>
                          <span className="text-slate-600">4. 1h Alert</span>
                          <span aria-hidden="true">→</span>
                          <button
                            type="button"
                            disabled={!canTrack}
                            onClick={() => canTrack && setActiveSection('tracking')}
                            className={
                              b.status === 'ride_started' || b.status === 'completed' || liveLocations[b.rideId]?.active
                                ? 'text-emerald-700 font-semibold underline'
                                : 'disabled:opacity-50'
                            }
                          >
                            5. Live GPS
                          </button>
                          <span aria-hidden="true">→</span>
                          <span className={b.status === 'completed' ? 'text-slate-900 font-semibold' : ''}>
                            6. Completed &amp; Rated
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeSection === 'wallet' && (
          <RideWalletPanel
            userUid={passengerProfile.uid}
            userName={passengerProfile.fullName}
            userRole="passenger"
            bookings={myBookings}
            rides={rides}
            walletTransactions={walletTransactions}
          />
        )}

        {activeSection === 'messages' && (
          <RideChatPanel
            currentUserUid={passengerProfile.uid}
            currentUserName={passengerProfile.fullName}
            currentUserRole="passenger"
            bookings={myBookings}
            rides={rides}
            messages={messages}
            initialSelectedBookingId={selectedChatBookingId}
          />
        )}

        {activeSection === 'tracking' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Track My Ride — Real-Time GPS Telemetry</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Private encrypted location stream available strictly to confirmed passengers of active rides.
                </p>
              </div>
              {trackableBookings.length > 0 && (
                <button
                  onClick={() => {
                    setShareModalBooking(trackableBookings[0]);
                    setGeneratedShareId(null);
                    setShareFeedback(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Trip with Family / Emergency Contact</span>
                </button>
              )}
            </div>

            {/* Active Shared Trip Links Management Card */}
            {myTripShares.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Temporary Shared Trip Links (Read-Only Family & Emergency Access)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Anyone with an active link can view your ride details and live GPS telemetry without signing in. Revoke anytime.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-200">
                  {myTripShares.map((share) => {
                    const shareUrl = buildShareUrl(share.id);
                    const isActive =
                      share.status === 'active' &&
                      new Date(share.expiresAtIso).getTime() > Date.now();
                    return (
                      <div
                        key={share.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {share.fromCity} → {share.toCity}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-slate-600">
                              Recipient: <strong>{share.contactLabel}</strong>
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span
                              className={`font-mono uppercase font-semibold ${
                                isActive ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {isActive ? 'ACTIVE READ-ONLY LINK' : share.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="font-mono text-slate-500 truncate max-w-xl">
                            {shareUrl}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyShareUrl(share.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg transition-colors"
                          >
                            {copiedShareId === share.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>

                          {isActive && onOpenSharedTripPreview && (
                            <button
                              type="button"
                              onClick={() => onOpenSharedTripPreview(share.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Preview Read-Only View</span>
                            </button>
                          )}

                          {share.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => revokeTripShareLink(share)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-lg transition-colors"
                            >
                              <Link2Off className="w-3.5 h-3.5" />
                              <span>Revoke Link</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-5 py-3">
                      <div className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900">
                          {b.fromCity} → {b.toCity}
                        </span>{' '}
                        · Captain {b.driverName} · {b.departureDate} ({b.departureTime})
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShareModalBooking(b);
                          setGeneratedShareId(null);
                          setShareFeedback(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Generate Temporary Share Link</span>
                      </button>
                    </div>
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
          initialTab={selectedModalData.initialTab}
          onClose={() => setSelectedModalData(null)}
          onBookSeats={handleBookSeats}
        />
      )}

      {/* Passenger SOS Emergency Modal */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">
                  Trigger Emergency SOS Alert
                </h3>
              </div>
              <button
                onClick={() => setSosModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will immediately transmit your current GPS coordinates, contact phone ({passengerProfile.phone}), and active ride details to Central Platform Administration.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Emergency Situation Note (Optional)
              </label>
              <input
                type="text"
                value={sosMessage}
                onChange={(e) => setSosMessage(e.target.value)}
                placeholder="e.g. Vehicle breakdown on M-9, medical assistance needed..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-rose-600"
              />
            </div>

            {sosStatusFeedback && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 font-medium">
                {sosStatusFeedback}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSosModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerSOS}
                disabled={sosDispatching}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {sosDispatching ? 'Acquiring GPS & Sending...' : 'Send SOS & Share Live GPS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Trip Temporary Read-Only Link Modal */}
      {shareModalBooking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-trip-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <Share2 className="w-5 h-5 shrink-0" />
                <h3 id="share-trip-modal-title" className="text-base font-bold text-slate-900">
                  Share Live Trip with Emergency Contact or Family
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShareModalBooking(null)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-slate-900">
                {shareModalBooking.fromCity} → {shareModalBooking.toCity} · Captain{' '}
                {shareModalBooking.driverName}
              </div>
              <div className="text-slate-600 font-mono">
                {shareModalBooking.departureDate} | {shareModalBooking.departureTime} ·{' '}
                {shareModalBooking.seatsBooked} Seat(s)
              </div>
              <p className="text-slate-500 pt-1">
                Generates a temporary, read-only link containing your ride details, captain identity, vehicle info, and live GPS location. Recipients do not need an account to view it.
              </p>
            </div>

            <form onSubmit={handleGenerateShareLink} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recipient / Emergency Contact Label
                  </label>
                  <input
                    type="text"
                    value={shareContactLabel}
                    onChange={(e) => setShareContactLabel(e.target.value)}
                    placeholder="e.g. Family Home, Spouse, Brother..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Temporary Link Expiration
                  </label>
                  <select
                    value={shareDurationHours}
                    onChange={(e) => setShareDurationHours(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    <option value={2}>Expires in 2 Hours</option>
                    <option value={6}>Expires in 6 Hours</option>
                    <option value={12}>Expires in 12 Hours</option>
                    <option value={24}>Expires in 24 Hours</option>
                  </select>
                </div>
              </div>

              {generatedShareId && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-emerald-950">
                    Temporary Read-Only Share Link Ready:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={buildShareUrl(generatedShareId)}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-emerald-300 rounded-lg text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyShareUrl(generatedShareId)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                    >
                      {copiedShareId === generatedShareId ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {onOpenSharedTripPreview && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-emerald-800">
                        Test what your family member or emergency contact will see:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const targetId = generatedShareId;
                          setShareModalBooking(null);
                          onOpenSharedTripPreview(targetId);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-900 underline hover:text-emerald-700"
                      >
                        <span>Open Read-Only Family View</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {shareFeedback && !generatedShareId && (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800">
                  {shareFeedback}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShareModalBooking(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={shareCreating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>
                    {shareCreating
                      ? 'Generating Encrypted Link...'
                      : generatedShareId
                      ? 'Generate Another Link'
                      : 'Generate Temporary Share Link'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

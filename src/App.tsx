/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
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
  AppNotification,
  AuditLog,
} from './types';
import {
  initializeUserAccountAndProfile,
  switchUserRole,
  seedInitialPlatformDataIfEmpty,
} from './services/firestoreService';
import PassengerPortal from './components/PassengerPortal';
import DriverPortal from './components/DriverPortal';
import AdminPortal from './components/AdminPortal';
import heroImg from './assets/images/hero_highway_ride_1791134239181.jpg';
import driverAvatarImg from './assets/images/avatar_driver_pro_1791134254517.jpg';
import sedanImg from './assets/images/vehicle_sedan_white_1791134268066.jpg';
import { ShieldCheck, Navigation, Users, Car, Star, LogOut } from 'lucide-react';

export default function App() {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [selectedSignupRole, setSelectedSignupRole] = useState<UserRole>('passenger');
  const [activePortal, setActivePortal] = useState<'passenger' | 'driver' | 'admin'>('passenger');
  const [authError, setAuthError] = useState<string | null>(null);

  // Real-time Firestore state
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [myPassengerProfile, setMyPassengerProfile] = useState<PassengerProfile | null>(null);
  const [myDriverProfile, setMyDriverProfile] = useState<DriverProfile | null>(null);
  const [myDriverDoc, setMyDriverDoc] = useState<DriverDocument | null>(null);

  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [passengerProfiles, setPassengerProfiles] = useState<PassengerProfile[]>([]);
  const [driverProfiles, setDriverProfiles] = useState<DriverProfile[]>([]);
  const [driverDocuments, setDriverDocuments] = useState<Record<string, DriverDocument>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const isBootstrappedAdmin = fbUser?.email === 'yasiralilanjwani72@gmail.com';
  const isAdmin = isBootstrappedAdmin || userAccount?.role === 'admin';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (user) {
        try {
          const { account } = await initializeUserAccountAndProfile(
            user.uid,
            user.email || '',
            user.displayName || 'Muhammad Ali',
            user.photoURL || driverAvatarImg,
            selectedSignupRole
          );
          setUserAccount(account);
          if (user.email === 'yasiralilanjwani72@gmail.com' && selectedSignupRole === 'admin') {
            setActivePortal('admin');
          } else if (account.role === 'driver') {
            setActivePortal('driver');
          } else {
            setActivePortal('passenger');
          }
          await seedInitialPlatformDataIfEmpty(
            user.uid,
            user.email || '',
            user.displayName || 'Muhammad Ali'
          );
        } catch (err) {
          console.error('Initialization error:', err);
        }
      } else {
        setUserAccount(null);
        setMyPassengerProfile(null);
        setMyDriverProfile(null);
        setMyDriverDoc(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [selectedSignupRole]);

  // Attach Real-Time Firestore Listeners only when authenticated
  useEffect(() => {
    if (!authReady || !fbUser) return;

    const uid = fbUser.uid;
    const unsubs: Array<() => void> = [];

    // 1. Own User Account
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) setUserAccount(snap.data() as UserAccount);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
      )
    );

    // 2. Own Passenger Profile
    unsubs.push(
      onSnapshot(
        doc(db, 'passengerProfiles', uid),
        (snap) => {
          if (snap.exists()) setMyPassengerProfile(snap.data() as PassengerProfile);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `passengerProfiles/${uid}`)
      )
    );

    // 3. Own Driver Profile & Private Driver Documents
    unsubs.push(
      onSnapshot(
        doc(db, 'driverProfiles', uid),
        (snap) => {
          if (snap.exists()) setMyDriverProfile(snap.data() as DriverProfile);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `driverProfiles/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'driverDocuments', uid),
        (snap) => {
          if (snap.exists()) setMyDriverDoc(snap.data() as DriverDocument);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `driverDocuments/${uid}`)
      )
    );

    // 4. All Public Driver Profiles (rule requires verificationStatus filter)
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'driverProfiles'),
          where('verificationStatus', 'in', ['pending', 'verified', 'rejected', 'suspended'])
        ),
        (snap) => {
          setDriverProfiles(snap.docs.map((d) => d.data() as DriverProfile));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'driverProfiles')
      )
    );

    // 5. All Vehicles (rule requires seats >= 1)
    unsubs.push(
      onSnapshot(
        query(collection(db, 'vehicles'), where('seats', '>=', 1)),
        (snap) => {
          setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, 'id'>) })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
      )
    );

    // 6. All Rides (rule requires status in allowed list)
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'rides'),
          where('status', 'in', ['upcoming', 'active', 'completed', 'cancelled'])
        ),
        (snap) => {
          setRides(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Ride, 'id'>) })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'rides')
      )
    );

    // 7. Reviews (rule requires rating >= 1)
    unsubs.push(
      onSnapshot(
        query(collection(db, 'reviews'), where('rating', '>=', 1)),
        (snap) => {
          setReviews(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Review, 'id'>) })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
      )
    );

    // 8. Own Notifications
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('recipientUid', '==', uid)),
        (snap) => {
          setNotifications(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );

    // 9. Bookings & Live Locations (Scoped by role / Admin)
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'bookings'),
          (snap) => {
            setBookings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) })));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'liveLocations'),
          (snap) => {
            const map: Record<string, LiveLocation> = {};
            snap.docs.forEach((d) => {
              map[d.id] = d.data() as LiveLocation;
            });
            setLiveLocations(map);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'liveLocations')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setAllUsers(snap.docs.map((d) => d.data() as UserAccount));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'passengerProfiles'),
          (snap) => {
            setPassengerProfiles(snap.docs.map((d) => d.data() as PassengerProfile));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'passengerProfiles')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'driverDocuments'),
          (snap) => {
            const docMap: Record<string, DriverDocument> = {};
            snap.docs.forEach((d) => {
              docMap[d.id] = d.data() as DriverDocument;
            });
            setDriverDocuments(docMap);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'driverDocuments')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'auditLogs'), where('action', '>=', '')),
          (snap) => {
            setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) })));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
        )
      );
    } else {
      // Non-admin: listen to passenger bookings and driver bookings separately and merge
      let passBookings: Booking[] = [];
      let drvBookings: Booking[] = [];

      unsubs.push(
        onSnapshot(
          query(collection(db, 'bookings'), where('passengerUid', '==', uid)),
          (snap) => {
            passBookings = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }));
            const merged = [...passBookings];
            drvBookings.forEach((dbk) => {
              if (!merged.some((m) => m.id === dbk.id)) merged.push(dbk);
            });
            setBookings(merged);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'bookings'), where('driverUid', '==', uid)),
          (snap) => {
            drvBookings = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }));
            const merged = [...passBookings];
            drvBookings.forEach((dbk) => {
              if (!merged.some((m) => m.id === dbk.id)) merged.push(dbk);
            });
            setBookings(merged);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
        )
      );

      // Private LiveLocations: listen where driverUid == uid OR confirmedPassengerUids array-contains uid
      unsubs.push(
        onSnapshot(
          query(collection(db, 'liveLocations'), where('driverUid', '==', uid)),
          (snap) => {
            setLiveLocations((prev) => {
              const next = { ...prev };
              snap.docs.forEach((d) => {
                next[d.id] = d.data() as LiveLocation;
              });
              return next;
            });
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'liveLocations')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'liveLocations'), where('confirmedPassengerUids', 'array-contains', uid)),
          (snap) => {
            setLiveLocations((prev) => {
              const next = { ...prev };
              snap.docs.forEach((d) => {
                next[d.id] = d.data() as LiveLocation;
              });
              return next;
            });
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'liveLocations')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, fbUser, isAdmin]);

  const handleLogin = async (roleChoice: UserRole) => {
    setSelectedSignupRole(roleChoice);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  const handlePortalSwitch = async (target: 'passenger' | 'driver' | 'admin') => {
    if (!fbUser) return;
    if (target === 'driver' && !myDriverProfile) {
      await switchUserRole(fbUser.uid, 'driver');
    }
    setActivePortal(target);
  };

  const handleMarkNotificationRead = async (notif: AppNotification) => {
    try {
      await updateDoc(doc(db, 'notifications', notif.id), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notif.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        {/* Zone 1: Single text element wordmark */}
        <a href="#top" className="text-xl font-bold tracking-tight text-slate-900 font-display">
          Ride Connect
        </a>

        {/* Zone 2: 4-5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => fbUser && handlePortalSwitch('passenger')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
              activePortal === 'passenger' && fbUser
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-600'
                : ''
            }`}
          >
            Passenger Portal
          </button>
          <button
            onClick={() => fbUser && handlePortalSwitch('driver')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
              activePortal === 'driver' && fbUser
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-600'
                : ''
            }`}
          >
            Driver Portal
          </button>
          {isAdmin && (
            <button
              onClick={() => fbUser && handlePortalSwitch('admin')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
                activePortal === 'admin' && fbUser
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-600'
                  : ''
              }`}
            >
              Admin Portal
            </button>
          )}
          <a href="#workflow" className="hover:text-slate-900 transition-colors whitespace-nowrap">
            Platform Flow
          </a>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-3">
          {fbUser ? (
            <>
              <button
                onClick={() =>
                  handlePortalSwitch(activePortal === 'passenger' ? 'driver' : 'passenger')
                }
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                Switch to {activePortal === 'passenger' ? 'Driver' : 'Passenger'}
              </button>
              <button
                onClick={() => signOut(auth)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => handleLogin('passenger')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <div className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-8">
        {!authReady ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Initializing Ride Connect secure session...
          </div>
        ) : !fbUser ? (
          /* Unauthenticated Landing & Role Registration Experience */
          <div className="space-y-16">
            {/* Hero Section with Measured Scrim */}
            <section className="relative rounded-2xl overflow-hidden border border-slate-200 min-h-[460px] flex items-end">
              <img
                src={heroImg}
                alt="Executive long-distance highway transit"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/20" />

              <div className="relative z-10 p-8 sm:p-12 max-w-3xl text-white space-y-6">
                <div className="text-xs font-mono text-emerald-400 tracking-wide">
                  INTERCITY MOBILITY · VERIFIED CAPTAINS · PRIVATE LIVE GPS TELEMETRY
                </div>
                <h1 className="text-3xl sm:text-5xl font-bold leading-tight font-display">
                  Long-Distance Ride Booking Built on Verified Trust.
                </h1>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
                  Inspect complete driver profiles, verified vehicle registrations, and real passenger reviews before booking your seat. Track your captain live on the highway once confirmed.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => handleLogin('passenger')}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    Continue as Passenger
                  </button>
                  <button
                    onClick={() => handleLogin('driver')}
                    className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    Register as Captain / Driver
                  </button>
                  <button
                    onClick={() => handleLogin('admin')}
                    className="px-4 py-3 bg-slate-900/80 hover:bg-slate-900 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    Admin Command Portal
                  </button>
                </div>

                {authError && (
                  <div className="p-3 bg-rose-950/90 border border-rose-700 rounded-lg text-xs text-rose-200">
                    {authError}
                  </div>
                )}
              </div>
            </section>

            {/* Driver & Vehicle Profile Preview Section (Claim-to-Proof Adjacency) */}
            <section id="workflow" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-4">
                <div className="text-xs font-mono text-emerald-700 font-semibold">
                  01. Transparent Driver & Vehicle Profiles
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
                  Know Your Captain and Vehicle Before You Book a Seat.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every driver submits CNIC, commercial driving license, and vehicle registration documents for Admin verification before publishing intercity routes. Passengers inspect verified credentials, seat availability, and real community reviews upfront.
                </p>
                <div className="pt-2 space-y-2 text-xs text-slate-700">
                  <div>· Complete Passenger & Driver Profiles with privacy controls</div>
                  <div>· Encrypted Live GPS location accessible only to confirmed passengers & Admin</div>
                  <div>· Real-time seat inventory & instant cancellation recovery</div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-4">
                    <img
                      src={driverAvatarImg}
                      alt="Muhammad Ali"
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full object-cover border border-slate-300"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">Muhammad Ali</h3>
                        <span className="text-xs font-semibold text-emerald-700">
                          Verified Driver ✓
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
                        ⭐ 4.8 Rating · 150 Completed Rides · 5 Years Driving Experience
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs text-slate-500 font-sans">Karachi → Hyderabad</div>
                    <div className="text-lg font-bold text-emerald-700">Rs. 1,500 / seat</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <img
                    src={sedanImg}
                    alt="Toyota Corolla 2024"
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover rounded-lg border border-slate-200"
                  />
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-slate-900">Toyota Corolla 2022</div>
                    <div className="text-slate-600">
                      White · 4 Passenger Seats · Verified Vehicle ✓
                    </div>
                    <div className="text-slate-500 font-mono">
                      25 October | 10:00 AM · 3 Seats Available
                    </div>
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => handleLogin('passenger')}
                        className="px-3.5 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800"
                      >
                        Sign In to Book Ride
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* Authenticated Multi-Portal Workspace */
          <div className="space-y-6">
            {/* Mobile / Tablet Portal Switcher Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-900">Active Workspace:</span>
                <span className="uppercase font-mono font-semibold text-emerald-700">
                  {activePortal} Portal
                </span>
                <span aria-hidden="true">·</span>
                <span>Signed in as {fbUser.email}</span>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => handlePortalSwitch('passenger')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activePortal === 'passenger'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Passenger Portal
                </button>
                <button
                  onClick={() => handlePortalSwitch('driver')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activePortal === 'driver'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Driver Portal
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handlePortalSwitch('admin')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      activePortal === 'admin'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Admin Portal
                  </button>
                )}
              </div>
            </div>

            {activePortal === 'passenger' && myPassengerProfile && (
              <PassengerPortal
                passengerProfile={myPassengerProfile}
                driverProfiles={driverProfiles}
                vehicles={vehicles}
                rides={rides}
                bookings={bookings}
                liveLocations={liveLocations}
                reviews={reviews}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
              />
            )}

            {activePortal === 'driver' && myDriverProfile && (
              <DriverPortal
                driverProfile={myDriverProfile}
                driverDocument={myDriverDoc}
                vehicles={vehicles}
                rides={rides}
                bookings={bookings}
                liveLocations={liveLocations}
                reviews={reviews}
                passengerProfiles={
                  passengerProfiles.length > 0
                    ? passengerProfiles
                    : myPassengerProfile
                    ? [myPassengerProfile]
                    : []
                }
              />
            )}

            {activePortal === 'admin' && isAdmin && (
              <AdminPortal
                users={allUsers}
                passengerProfiles={passengerProfiles}
                driverProfiles={driverProfiles}
                driverDocuments={driverDocuments}
                vehicles={vehicles}
                rides={rides}
                bookings={bookings}
                liveLocations={liveLocations}
                reviews={reviews}
                auditLogs={auditLogs}
              />
            )}
          </div>
        )}
      </div>

      {/* Quiet Editorial Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-6 px-6 text-xs text-slate-500">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>Ride Connect — Intercity Ride Booking & Live GPS Telemetry Platform</div>
          <div className="flex items-center gap-4">
            <span>Role-Based Firestore Security</span>
            <span aria-hidden="true">·</span>
            <span>Private Live Location Stream</span>
            <span aria-hidden="true">·</span>
            <span>Google Maps Platform Integration</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


import { db, functions } from './firebase.ts';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, orderBy, addDoc, Timestamp, runTransaction, deleteDoc, writeBatch, serverTimestamp, where, limit, startAfter, QueryDocumentSnapshot, DocumentData, deleteField, onSnapshot } from '@firebase/firestore';
import { httpsCallable } from '@firebase/functions';
import { PickSelection, User, RaceResults, ScoringSettingsDoc, Driver, Constructor, EventSchedule, InvitationCode, AdminLogEntry, LeagueConfig, MaintenanceState } from '../types.ts';
import { User as FirebaseUser } from '@firebase/auth';
import { EVENTS, LEAGUE_DUES_AMOUNT } from '../constants.ts';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// Helper to sanitize user data
const sanitizeUser = (id: string, data: DocumentData): User => {
    return {
        id,
        ...data,
        displayName: data.displayName || 'Unknown Team',
        email: data.email || '',
        duesPaidStatus: data.duesPaidStatus || 'Unpaid'
    } as User;
};

// Cloud Function Wrappers
export const triggerManualLeaderboardSync = async () => {
    const syncFn = httpsCallable(functions, 'manualLeaderboardSync');
    const result = await syncFn();
    return result.data as { success: boolean, usersProcessed: number };
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) return sanitizeUser(uid, snap.data());
    return null;
};

export const createUserProfileDocument = async (user: FirebaseUser, additionalData: any = {}) => {
    if (!user) return;

    // Destructure invitationCode OUT so it doesn't get spread into the user document
    const { invitationCode, ...profileData } = additionalData;

    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const publicRef = doc(db, 'public_users', user.uid);

        // Check if user already exists (idempotency guard)
        const existingUser = await transaction.get(userRef);
        if (existingUser.exists()) {
            console.warn(`User document already exists for ${user.uid}, skipping creation.`);
            return;
        }

        // ATOMIC WRITE 1: Create private user profile
        transaction.set(userRef, {
            displayName: profileData.displayName || user.displayName || 'New Team',
            email: user.email,
            firstName: profileData.firstName || '',
            lastName: profileData.lastName || '',
            duesPaidStatus: 'Unpaid',
            createdAt: serverTimestamp(),
        });

        // ATOMIC WRITE 2: Create public profile for leaderboard
        transaction.set(publicRef, {
            displayName: profileData.displayName || user.displayName || 'New Team',
            totalPoints: 0,
            rank: 999,
            breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 }
        });

        // ATOMIC WRITE 3: Mark invitation code as used
        if (invitationCode) {
            const inviteRef = doc(db, 'invitation_codes', invitationCode);
            transaction.update(inviteRef, {
                status: 'used',
                usedBy: user.uid,
                usedByEmail: user.email,
                usedAt: serverTimestamp()
            });
        }
    });
};

export const updateUserProfile = async (uid: string, data: Partial<User>) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, data);
    
    // Sync display name to public profile if changed
    if (data.displayName) {
        const publicRef = doc(db, 'public_users', uid);
        await updateDoc(publicRef, { displayName: data.displayName });
    }
};

export const purgeUserData = async (uid: string) => {
    // 1. Delete User Profile
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);

    // 2. Delete Public Profile
    const publicRef = doc(db, 'public_users', uid);
    await deleteDoc(publicRef);

    // 3. Delete Picks
    const picksRef = doc(db, 'userPicks', uid);
    await deleteDoc(picksRef);

    // 4. Delete Dues Payments (Query)
    const duesQ = query(collection(db, 'dues_payments'), where('uid', '==', uid));
    const duesSnap = await getDocs(duesQ);
    const duesBatch = writeBatch(db);
    duesSnap.forEach(d => duesBatch.delete(d.ref));
    await duesBatch.commit();

    // 5. Reset Invitation Code (Query) - Optional but good for cleanup
    const inviteQ = query(collection(db, 'invitation_codes'), where('usedBy', '==', uid));
    const inviteSnap = await getDocs(inviteQ);
    if (!inviteSnap.empty) {
        const inviteBatch = writeBatch(db);
        inviteSnap.forEach(d => {
            inviteBatch.update(d.ref, {
                status: 'active',
                usedBy: deleteField(),
                usedByEmail: deleteField(),
                usedAt: deleteField()
            });
        });
        await inviteBatch.commit();
    }
    
    return true;
};

export const getUserPicks = async (uid: string): Promise<{ [eventId: string]: PickSelection }> => {
    const picksRef = doc(db, 'userPicks', uid);
    const snap = await getDoc(picksRef);
    if (snap.exists()) return snap.data() as { [eventId: string]: PickSelection };
    return {};
};

export const saveUserPicks = async (uid: string, eventId: string, picks: PickSelection, isAdminOverride = false) => {
    const picksRef = doc(db, 'userPicks', uid);
    await setDoc(picksRef, { [eventId]: picks }, { merge: true });
};

export const fetchAllUserPicks = async (): Promise<{ [uid: string]: { [eid: string]: PickSelection } }> => {
    const colRef = collection(db, 'userPicks');
    const snap = await getDocs(colRef);
    const all: { [uid: string]: { [eid: string]: PickSelection } } = {};
    snap.forEach(d => {
        all[d.id] = d.data() as any;
    });
    return all;
};

export const saveFormLocks = async (locks: { [eventId: string]: boolean }) => {
    const ref = doc(db, 'app_state', 'form_locks');
    await setDoc(ref, locks, { merge: true });
};

export const saveRaceResults = async (results: RaceResults) => {
    const ref = doc(db, 'app_state', 'race_results');
    await setDoc(ref, results, { merge: true });
};

export const saveScoringSettings = async (settings: ScoringSettingsDoc) => {
    const ref = doc(db, 'app_state', 'scoring_config');
    await setDoc(ref, settings);
};

export const getLeagueEntities = async (): Promise<{ drivers: Driver[], constructors: Constructor[] } | null> => {
    const ref = doc(db, 'app_state', 'entities');
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as { drivers: Driver[], constructors: Constructor[] };
    return null;
};

export const saveLeagueEntities = async (drivers: Driver[], constructors: Constructor[]) => {
    const ref = doc(db, 'app_state', 'entities');
    await setDoc(ref, { drivers, constructors });
};

export const getEventSchedules = async (): Promise<{ [eventId: string]: EventSchedule }> => {
    const ref = doc(db, 'app_state', 'event_schedules');
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as { [eventId: string]: EventSchedule };
    return {};
};

export const saveEventSchedule = async (eventId: string, schedule: EventSchedule) => {
    const ref = doc(db, 'app_state', 'event_schedules');
    await setDoc(ref, { [eventId]: schedule }, { merge: true });
};

export const getAllUsers = async (pageSize = 50, lastDoc: any = null) => {
    let q = query(collection(db, 'users'), orderBy('displayName'), limit(pageSize));
    if (lastDoc) {
        q = query(collection(db, 'users'), orderBy('displayName'), startAfter(lastDoc), limit(pageSize));
    }
    const snap = await getDocs(q);
    const users = snap.docs.map(d => sanitizeUser(d.id, d.data()));
    return { users, lastDoc: snap.docs[snap.docs.length - 1] };
};

export const getAllUsersAndPicks = async (pageSize = 50, lastDoc: any = null) => {
    let q = query(collection(db, 'public_users'), orderBy('totalPoints', 'desc'), limit(pageSize));
    
    if (lastDoc) {
        q = query(collection(db, 'public_users'), orderBy('totalPoints', 'desc'), startAfter(lastDoc), limit(pageSize));
    }
    
    const snap = await getDocs(q);
    const users: User[] = [];
    
    snap.forEach(d => {
        users.push(sanitizeUser(d.id, d.data()));
    });

    // In this implementation, we mostly use public data. 
    // `allPicks` is returned empty for 'public' source as calculations are pre-baked.
    const allPicks: { [uid: string]: { [eid: string]: PickSelection } } = {};
    
    return { 
        users, 
        allPicks, 
        lastDoc: snap.docs[snap.docs.length - 1],
        source: 'public' as const
    };
};

export const updateUserAdminStatus = async (uid: string, isAdmin: boolean) => {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, { isAdmin });
};

export const updateUserDuesStatus = async (uid: string, status: 'Paid' | 'Unpaid') => {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, { duesPaidStatus: status });
};

export const updatePickPenalty = async (uid: string, eventId: string, penalty: number, reason: string) => {
    const ref = doc(db, 'userPicks', uid);
    await updateDoc(ref, {
        [`${eventId}.penalty`]: penalty,
        [`${eventId}.penaltyReason`]: reason
    });
};

export const logDuesPaymentInitiation = async (user: User, amount: number, season: string, memo: string) => {
    const ref = collection(db, 'dues_payments');
    await addDoc(ref, {
        uid: user.id,
        userEmail: user.email,
        amount,
        season,
        memo,
        status: 'initiated',
        timestamp: serverTimestamp()
    });
};

export const getInvitationCodes = async (): Promise<InvitationCode[]> => {
    const ref = collection(db, 'invitation_codes');
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({
        ...d.data(),
        code: d.data().code || d.id
    } as InvitationCode));
};

export const createInvitationCode = async (createdByUid: string) => {
    const code = 'LOL-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const ref = doc(db, 'invitation_codes', code);
    await setDoc(ref, {
        code,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: createdByUid
    });
    return code;
};

export const createBulkInvitationCodes = async (createdByUid: string, count: number) => {
    const batch = writeBatch(db);
    for (let i = 0; i < count; i++) {
        const code = 'LOL-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const ref = doc(db, 'invitation_codes', code);
        batch.set(ref, {
            code,
            status: 'active',
            createdAt: serverTimestamp(),
            createdBy: createdByUid
        });
    }
    await batch.commit();
};

export const deleteInvitationCode = async (code: string) => {
    const ref = doc(db, 'invitation_codes', code);
    await deleteDoc(ref);
};

export const reserveInvitationCode = async (code: string, reservedFor: string) => {
    const ref = doc(db, 'invitation_codes', code);
    await updateDoc(ref, {
        reservedFor: reservedFor
    });
};

export const clearReservation = async (code: string) => {
     const ref = doc(db, 'invitation_codes', code);
     await updateDoc(ref, {
         reservedFor: deleteField()
     });
};

export const getLeagueConfig = async (): Promise<LeagueConfig> => {
    const configRef = doc(db, 'app_state', 'league_config');
    const snapshot = await getDoc(configRef);
    if (snapshot.exists()) {
        return snapshot.data() as LeagueConfig;
    }
    return { duesAmount: LEAGUE_DUES_AMOUNT };
};

export const saveLeagueConfig = async (config: LeagueConfig) => {
    const configRef = doc(db, 'app_state', 'league_config');
    await setDoc(configRef, config, { merge: true });
};

export const logAdminAction = async (entry: Omit<AdminLogEntry, 'id' | 'timestamp'>) => {
    try {
        await addDoc(collection(db, 'admin_logs'), {
            ...entry,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Failed to log admin action", e);
    }
};

export const getAdminLogs = async (eventId?: string): Promise<AdminLogEntry[]> => {
    try {
        let q = query(collection(db, 'admin_logs'), orderBy('timestamp', 'desc'));
        if (eventId) {
            q = query(collection(db, 'admin_logs'), where('eventId', '==', eventId), orderBy('timestamp', 'desc'));
        }
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminLogEntry));
    } catch (e) {
        console.error("Failed to fetch logs", e);
        return [];
    }
};

// --- Generic Database Manager Functions ---

export const getGenericDocuments = async (collectionName: string, pageSize = 20, lastDoc: any = null) => {
    const colRef = collection(db, collectionName);
    // Note: We don't know the fields, so we can't reliably sort by 'createdAt' unless we know it exists.
    // Defaulting to simple limit or sorting by document ID if possible, but Firestore auto-sorts by ID.
    // For pagination to work, we need an orderBy.
    let q = query(colRef, limit(pageSize));
    if (lastDoc) {
        q = query(colRef, startAfter(lastDoc), limit(pageSize));
    }
    
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
    }));
    
    return { 
        docs, 
        lastDoc: snap.docs[snap.docs.length - 1] 
    };
};

export const saveGenericDocument = async (collectionName: string, docId: string, data: any) => {
    const docRef = doc(db, collectionName, docId);
    // Use merge: true to avoid overwriting entire doc if we are just patching
    // But for a full editor save, we might want to replace. 
    // Let's use set with merge so it creates if not exists but updates otherwise.
    await setDoc(docRef, data, { merge: true });
};

export const deleteGenericDocument = async (collectionName: string, docId: string) => {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
};

// --- Maintenance Mode ---

export const onMaintenanceState = (callback: (state: MaintenanceState | null) => void) => {
    const ref = doc(db, 'app_state', 'maintenance');
    return onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            callback(snap.data() as MaintenanceState);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error("Maintenance listener error:", error);
        callback(null);
    });
};

export const setMaintenanceMode = async (enabled: boolean, adminUid: string, message?: string) => {
    const ref = doc(db, 'app_state', 'maintenance');
    await setDoc(ref, {
        enabled,
        message: message || null,
        enabled_by: adminUid,
        enabled_at: serverTimestamp()
    }, { merge: true });
};
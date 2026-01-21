
import { db, functions } from './firebase.ts';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, orderBy, addDoc, Timestamp, runTransaction, deleteDoc, writeBatch, serverTimestamp, where, limit, startAfter, QueryDocumentSnapshot, DocumentData } from '@firebase/firestore';
import { httpsCallable } from '@firebase/functions';
import { PickSelection, User, RaceResults, ScoringSettingsDoc, Driver, Constructor, EventSchedule, InvitationCode, AdminLogEntry, LeagueConfig } from '../types.ts';
import { User as FirebaseUser } from '@firebase/auth';
import { EVENTS, LEAGUE_DUES_AMOUNT } from '../constants.ts';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// Cloud Function Wrappers
export const triggerManualLeaderboardSync = async () => {
    const syncFn = httpsCallable(functions, 'manualLeaderboardSync');
    const result = await syncFn();
    return result.data as { success: boolean, usersProcessed: number };
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) return { id: uid, ...snap.data() } as User;
    return null;
};

/**
 * Creates the initial user document.
 * Note: public_users is now handled by a Cloud Function trigger to avoid permission errors on protected fields.
 */
export const createUserProfileDocument = async (user: FirebaseUser, additionalData: any = {}) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);
    
    if (!snapshot.exists()) {
        const { displayName, email } = user;
        const createdAt = new Date();
        try {
            // Only write to private user doc. 
            // The Cloud Function 'initializePublicProfile' will detect this and set up the leaderboard doc.
            await setDoc(userRef, {
                displayName: additionalData.displayName || displayName,
                email,
                createdAt,
                firstName: additionalData.firstName || '',
                lastName: additionalData.lastName || '',
                isAdmin: false,
                duesPaidStatus: 'Unpaid'
            });
        } catch (error) {
            console.error('Error creating user document', error);
            throw error;
        }
    }
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
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
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
        const data = d.data();
        users.push({ id: d.id, displayName: data.displayName, ...data } as User);
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

export const markInvitationCodeUsed = async (code: string, userId: string) => {
    const ref = doc(db, 'invitation_codes', code);
    await updateDoc(ref, {
        status: 'used',
        usedBy: userId,
        usedAt: serverTimestamp()
    });
};

export const deleteInvitationCode = async (code: string) => {
    const ref = doc(db, 'invitation_codes', code);
    await deleteDoc(ref);
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

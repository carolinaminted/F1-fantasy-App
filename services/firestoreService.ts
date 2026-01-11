import { db, functions } from './firebase.ts';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, orderBy, addDoc, Timestamp, runTransaction, deleteDoc, writeBatch, serverTimestamp, where, limit, startAfter, QueryDocumentSnapshot, DocumentData } from '@firebase/firestore';
import { httpsCallable } from '@firebase/functions';
import { PickSelection, User, RaceResults, ScoringSettingsDoc, Driver, Constructor, EventSchedule, InvitationCode, AdminLogEntry } from '../types.ts';
import { User as FirebaseUser } from '@firebase/auth';
import { EVENTS } from '../constants.ts';

/**
 * SCALABILITY CONFIGURATION [S1C-01]
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// Cloud Function Wrappers
export const triggerManualLeaderboardSync = async () => {
    const syncFn = httpsCallable(functions, 'manualLeaderboardSync');
    const result = await syncFn();
    return result.data as { success: boolean, usersProcessed: number };
};

// User Profile Management
export const createUserProfileDocument = async (userAuth: FirebaseUser, additionalData: { displayName: string; firstName: string; lastName: string; invitationCode?: string }) => {
    if (!userAuth) return;
    const userRef = doc(db, 'users', userAuth.uid);
    const publicUserRef = doc(db, 'public_users', userAuth.uid);
    const userPicksRef = doc(db, 'userPicks', userAuth.uid);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                const { email } = userAuth;
                const { displayName, firstName, lastName, invitationCode } = additionalData;

                transaction.set(userRef, {
                    displayName,
                    email,
                    firstName,
                    lastName,
                    invitationCode: invitationCode || null,
                    duesPaidStatus: 'Unpaid',
                });

                transaction.set(publicUserRef, {
                    displayName,
                });

                transaction.set(userPicksRef, {});

                if (invitationCode) {
                    const invRef = doc(db, 'invitation_codes', invitationCode);
                    transaction.update(invRef, {
                        status: 'used',
                        usedBy: userAuth.uid,
                        usedByEmail: email,
                        usedAt: serverTimestamp()
                    });
                }
            }
        });
    } catch (error) {
        console.error("Error creating user profile or picks document via transaction", error);
        throw error;
    }
    return userRef;
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
    const userRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
        return { id: uid, ...snapshot.data() } as User;
    }
    return null;
};

export const updateUserProfile = async (uid: string, data: { displayName: string; email: string; firstName?: string; lastName?: string }) => {
    const userRef = doc(db, 'users', uid);
    const publicUserRef = doc(db, 'public_users', uid);
    
    try {
        const batch = writeBatch(db);
        batch.update(userRef, data);
        batch.set(publicUserRef, { displayName: data.displayName }, { merge: true });
        await batch.commit();
        console.log(`Profile updated for user ${uid}`);
    } catch (error) {
        console.error("Error updating user profile", error);
        throw error;
    }
};

export const updateUserDuesStatus = async (uid: string, status: 'Paid' | 'Unpaid') => {
    const userRef = doc(db, 'users', uid);
    try {
        await updateDoc(userRef, { duesPaidStatus: status });
        console.log(`Dues status for user ${uid} updated to ${status}`);
    } catch (error) {
        console.error("Error updating dues status", error);
        throw error;
    }
};

export const updateUserAdminStatus = async (uid: string, isAdmin: boolean) => {
    const userRef = doc(db, 'users', uid);
    try {
        await updateDoc(userRef, { isAdmin });
        console.log(`Admin status for user ${uid} updated to ${isAdmin}`);
    } catch (error) {
        console.error("Error updating admin status", error);
        throw error;
    }
};

export const getAllUsers = async (
    limitCount: number = DEFAULT_PAGE_SIZE, 
    lastVisible: QueryDocumentSnapshot<DocumentData> | null = null
): Promise<{ users: User[], lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
    try {
        const usersCollection = collection(db, 'users');
        let q = query(usersCollection, orderBy('displayName'), limit(Math.min(limitCount, MAX_PAGE_SIZE)));
        
        if (lastVisible) {
            q = query(usersCollection, orderBy('displayName'), startAfter(lastVisible), limit(Math.min(limitCount, MAX_PAGE_SIZE)));
        }

        const usersSnapshot = await getDocs(q);
        const users: User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        const last = usersSnapshot.docs[usersSnapshot.docs.length - 1] || null;
        
        return { users, lastDoc: last };
    } catch (error) {
        console.error("Error fetching users batch:", error);
        return { users: [], lastDoc: null };
    }
};

export const getAllUsersAndPicks = async (
    limitCount: number = DEFAULT_PAGE_SIZE,
    lastVisible: QueryDocumentSnapshot<DocumentData> | null = null
): Promise<{ 
    users: User[], 
    allPicks: { [userId: string]: { [eventId: string]: PickSelection } }, 
    lastDoc: QueryDocumentSnapshot<DocumentData> | null,
    source: 'public' | 'private_fallback' 
}> => {
    try {
        const publicUsersCollection = collection(db, 'public_users');
        
        let q = query(publicUsersCollection, orderBy('rank', 'asc'), limit(Math.min(limitCount, MAX_PAGE_SIZE)));
        
        if (lastVisible) {
            q = query(publicUsersCollection, orderBy('rank', 'asc'), startAfter(lastVisible), limit(Math.min(limitCount, MAX_PAGE_SIZE)));
        }

        const usersSnapshot = await getDocs(q);
        let source: 'public' | 'private_fallback' = 'public';

        let users: User[] = usersSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            email: '', 
            duesPaidStatus: undefined,
            isAdmin: false
        } as User));

        const isPreCalculated = users.length > 0 && typeof users[0].totalPoints === 'number';
        
        const allPicks: { [userId: string]: { [eventId: string]: PickSelection } } = {};
        
        if (!isPreCalculated && users.length > 0) {
            const userIds = users.map(u => u.id);
            const userPicksCollection = collection(db, 'userPicks');
            for (const uid of userIds) {
                const pDoc = await getDoc(doc(userPicksCollection, uid));
                if (pDoc.exists()) {
                    allPicks[uid] = pDoc.data() as { [eventId: string]: PickSelection };
                }
            }
        }

        const last = usersSnapshot.docs[usersSnapshot.docs.length - 1] || null;
        return { users, allPicks, lastDoc: last, source };
    } catch (error) {
        console.error("Error fetching leaderboard batch", error);
        return { users: [], allPicks: {}, lastDoc: null, source: 'public' };
    }
};

/**
 * Fetch all picks from every user in the league.
 * Used for frontend aggregation of popularity stats.
 */
export const fetchAllUserPicks = async (): Promise<{ [userId: string]: { [eventId: string]: PickSelection } }> => {
    const picksCollection = collection(db, 'userPicks');
    const snapshot = await getDocs(picksCollection);
    const allPicks: { [userId: string]: { [eventId: string]: PickSelection } } = {};
    snapshot.forEach(doc => {
        allPicks[doc.id] = doc.data() as { [eventId: string]: PickSelection };
    });
    return allPicks;
};

export const getUserPicks = async (uid: string): Promise<{ [eventId: string]: PickSelection }> => {
    const picksRef = doc(db, 'userPicks', uid);
    const snapshot = await getDoc(picksRef);
    return snapshot.exists() ? snapshot.data() as { [eventId: string]: PickSelection } : {};
};

export const saveUserPicks = async (uid: string, eventId: string, picks: PickSelection, isAdmin: boolean = false) => {
    if (!isAdmin) {
        const event = EVENTS.find(e => e.id === eventId);
        if (event) {
            const lockTime = new Date(event.lockAtUtc).getTime();
            if (Date.now() >= lockTime) {
                 throw new Error("Picks submission is locked for this event.");
            }
        }
    }

    const picksRef = doc(db, 'userPicks', uid);
    try {
        await setDoc(picksRef, { [eventId]: picks }, { merge: true });
    } catch (error) {
        console.error("Error saving user picks", error);
        throw error;
    }
};

export const updatePickPenalty = async (uid: string, eventId: string, penalty: number, reason: string) => {
    const picksRef = doc(db, 'userPicks', uid);
    try {
        await updateDoc(picksRef, {
            [`${eventId}.penalty`]: penalty,
            [`${eventId}.penaltyReason`]: reason
        });
    } catch (error) {
        console.error("Error updating penalty", error);
        throw error;
    }
};

export const saveFormLocks = async (locks: { [eventId: string]: boolean }) => {
    const locksRef = doc(db, 'app_state', 'form_locks');
    try {
        await setDoc(locksRef, locks);
    } catch (error) {
        console.error("Error saving form locks", error);
        throw error;
    }
};

export const saveRaceResults = async (results: RaceResults) => {
    const resultsRef = doc(db, 'app_state', 'race_results');
    try {
        await setDoc(resultsRef, results);
    } catch (error) {
        console.error("Error saving race results", error);
        throw error;
    }
};

export const saveScoringSettings = async (settings: ScoringSettingsDoc) => {
    const configRef = doc(db, 'app_state', 'scoring_config');
    try {
        await setDoc(configRef, settings);
    } catch (error) {
        console.error("Error saving scoring settings", error);
        throw error;
    }
};

export const getLeagueEntities = async (): Promise<{ drivers: Driver[]; constructors: Constructor[] } | null> => {
    const entitiesRef = doc(db, 'app_state', 'entities');
    const snapshot = await getDoc(entitiesRef);
    if (snapshot.exists()) {
        return snapshot.data() as { drivers: Driver[]; constructors: Constructor[] };
    }
    return null;
};

export const saveLeagueEntities = async (drivers: Driver[], constructors: Constructor[]) => {
    const entitiesRef = doc(db, 'app_state', 'entities');
    try {
        await setDoc(entitiesRef, { drivers, constructors });
    } catch (error) {
        console.error("Error saving league entities", error);
        throw error;
    }
};

export const getEventSchedules = async (): Promise<{ [eventId: string]: EventSchedule }> => {
    const schedulesRef = doc(db, 'app_state', 'event_schedules');
    const snapshot = await getDoc(schedulesRef);
    if (snapshot.exists()) {
        return snapshot.data() as { [eventId: string]: EventSchedule };
    }
    return {};
};

export const saveEventSchedule = async (eventId: string, schedule: EventSchedule) => {
    const schedulesRef = doc(db, 'app_state', 'event_schedules');
    try {
        await setDoc(schedulesRef, { [eventId]: schedule }, { merge: true });
    } catch (error) {
        console.error("Error saving event schedule", error);
        throw error;
    }
};

export const logDuesPaymentInitiation = async (
    user: User, 
    amountInDollars: number, 
    season: string, 
    memo: string
) => {
    if (!user) throw new Error("User must be logged in to initiate a payment.");
    const duesPaymentData = {
        uid: user.id,
        email: user.email,
        amount: amountInDollars * 100, 
        season,
        memo,
        status: 'initiated' as const,
        createdAt: Timestamp.now(),
    };
    try {
        const duesCollectionRef = collection(db, 'dues_payments');
        const docRef = await addDoc(duesCollectionRef, duesPaymentData);
        return docRef.id;
    } catch (error) {
        console.error("Error logging dues payment initiation:", error);
        throw error;
    }
};

export const getInvitationCodes = async (): Promise<InvitationCode[]> => {
    const codesRef = collection(db, 'invitation_codes');
    const q = query(codesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        code: doc.id,
        ...doc.data()
    } as InvitationCode));
};

export const createInvitationCode = async (adminUid: string): Promise<string> => {
    const code = `FF1-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const codeRef = doc(db, 'invitation_codes', code);
    await setDoc(codeRef, {
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: adminUid
    });
    return code;
};

export const createBulkInvitationCodes = async (adminUid: string, count: number): Promise<void> => {
    const batch = writeBatch(db);
    for (let i = 0; i < count; i++) {
        const code = `FF1-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const codeRef = doc(db, 'invitation_codes', code);
        batch.set(codeRef, {
            status: 'active',
            createdAt: serverTimestamp(),
            createdBy: adminUid
        });
    }
    await batch.commit();
};

export const deleteInvitationCode = async (code: string): Promise<void> => {
    const codeRef = doc(db, 'invitation_codes', code);
    try {
        await deleteDoc(codeRef);
    } catch (error) {
        console.error("Error deleting invitation code", error);
        throw error;
    }
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
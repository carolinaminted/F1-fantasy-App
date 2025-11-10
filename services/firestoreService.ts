import { db } from './firebase.ts';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { PickSelection, User } from '../types.ts';
import { User as FirebaseUser } from 'firebase/auth';

// User Profile Management
export const createUserProfileDocument = async (userAuth: FirebaseUser, additionalData: { displayName: string }) => {
    if (!userAuth) return;
    const userRef = doc(db, 'users', userAuth.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        const { email } = userAuth;
        const { displayName } = additionalData;
        const userPicksRef = doc(db, 'userPicks', userAuth.uid); // Reference to the picks document

        try {
            // Create the user profile document
            await setDoc(userRef, {
                displayName,
                email,
            });

            // Create the initial empty user picks document to ensure it exists for all users
            await setDoc(userPicksRef, {});

        } catch (error) {
            console.error("Error creating user profile or picks document", error);
            // Re-throw the error to be handled by the calling function
            throw error;
        }
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

// User Picks Management
export const getUserPicks = async (uid: string): Promise<{ [eventId: string]: PickSelection }> => {
    const picksRef = doc(db, 'userPicks', uid);
    const snapshot = await getDoc(picksRef);
    return snapshot.exists() ? snapshot.data() : {};
};

export const saveUserPicks = async (uid: string, eventId: string, picks: PickSelection) => {
    const picksRef = doc(db, 'userPicks', uid);
    try {
        await setDoc(picksRef, { [eventId]: picks }, { merge: true });
        console.log(`Picks for ${eventId} saved successfully for user ${uid}`);
    } catch (error) {
        console.error("Error saving user picks", error);
    }
};

// For Leaderboard
export const getAllUsersAndPicks = async () => {
    const usersCollection = collection(db, 'users');
    const userPicksCollection = collection(db, 'userPicks');

    const usersSnapshot = await getDocs(usersCollection);
    const userPicksSnapshot = await getDocs(userPicksCollection);

    const users: User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    const allPicks: { [userId: string]: { [eventId: string]: PickSelection } } = {};
    userPicksSnapshot.forEach(doc => {
        allPicks[doc.id] = doc.data();
    });

    return { users, allPicks };
};
import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { auth, googleProvider, db, messaging, VAPID_KEY } from '../config/firebase';

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const loggedUser = result.user;

  const userRef = doc(db, 'users', loggedUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      displayName: loggedUser.displayName,
      email: loggedUser.email,
      photoURL: loggedUser.photoURL,
      groups: [],
      createdAt: new Date().toISOString()
    });
  }

  return loggedUser;
}

/**
 * Sign out current user
 */
export async function logOut() {
  await signOut(auth);
}

/**
 * Request notification permission and save FCM token
 */
export async function requestNotificationPermission(userId) {
  if (!messaging) {
    throw new Error('Notifications not available in this browser');
  }

  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (userId && token) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
        notificationsEnabled: true
      });
    }

    return { permission, token };
  }

  return { permission, token: null };
}

/**
 * Disable notifications for user
 */
export async function disableNotifications(userId, currentToken) {
  if (!userId || !currentToken) return;

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const currentTokens = userSnap.data().fcmTokens || [];
    const newTokens = currentTokens.filter(t => t !== currentToken);
    await updateDoc(userRef, {
      fcmTokens: newTokens,
      notificationsEnabled: false
    });
  }
}

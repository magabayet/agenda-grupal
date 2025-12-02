import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Send a message for a specific date
 */
export async function sendDayMessage(user, groupId, groupData, dateStr, messageText) {
  if (!user || !groupId || !groupData || !messageText.trim()) return;

  const groupRef = doc(db, 'calendar_groups', groupId);

  const newMessage = {
    uid: user.uid,
    name: user.displayName,
    photoURL: user.photoURL || '',
    text: messageText.trim(),
    timestamp: new Date().toISOString()
  };

  // Get existing messages for the day
  const existingMessages = groupData.messages?.[dateStr];
  let updatedMessages;

  if (Array.isArray(existingMessages)) {
    updatedMessages = [...existingMessages, newMessage];
  } else if (existingMessages && typeof existingMessages === 'object') {
    // Migrate from old format { uid: "message" } to array
    const migratedMessages = Object.entries(existingMessages).map(([uid, text]) => {
      const member = groupData.members?.find(m => m.uid === uid);
      return {
        uid,
        name: member?.name || 'Usuario',
        photoURL: member?.photoURL || '',
        text,
        timestamp: new Date(0).toISOString()
      };
    });
    updatedMessages = [...migratedMessages, newMessage];
  } else {
    updatedMessages = [newMessage];
  }

  await updateDoc(groupRef, {
    [`messages.${dateStr}`]: updatedMessages
  });

  return updatedMessages.length;
}

/**
 * Send a message to general chat
 */
export async function sendGeneralMessage(user, groupId, groupData, messageText) {
  if (!user || !groupId || !groupData || !messageText.trim()) return;

  const groupRef = doc(db, 'calendar_groups', groupId);

  const newMessage = {
    uid: user.uid,
    name: user.displayName,
    photoURL: user.photoURL || '',
    text: messageText.trim(),
    timestamp: new Date().toISOString()
  };

  const existingMessages = groupData.generalChat || [];
  const updatedMessages = [...existingMessages, newMessage];

  await updateDoc(groupRef, {
    generalChat: updatedMessages
  });

  return updatedMessages.length;
}

/**
 * Normalize messages from either array or object format
 */
export function normalizeMessages(rawMessages, members) {
  if (Array.isArray(rawMessages)) {
    return rawMessages;
  } else if (rawMessages && typeof rawMessages === 'object') {
    // Old format { uid: "message" }
    return Object.entries(rawMessages).map(([uid, text]) => {
      const member = members?.find(m => m.uid === uid);
      return {
        uid,
        name: member?.name || 'Usuario',
        photoURL: member?.photoURL || '',
        text,
        timestamp: new Date(0).toISOString()
      };
    });
  }
  return [];
}

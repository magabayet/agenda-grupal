import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Generate a 6-character alphanumeric group code
 */
function generateGroupCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Create a new group
 */
export async function createGroup(user, { name, description, emails }) {
  const newGroupId = generateGroupCode();
  const groupRef = doc(db, 'calendar_groups', newGroupId);

  const initialData = {
    name: name?.trim() || '',
    description: description?.trim() || '',
    members: [{
      uid: user.uid,
      name: user.displayName,
      photoURL: user.photoURL || ''
    }],
    votes: {},
    messages: {},
    stars: {},
    createdAt: new Date().toISOString()
  };

  await setDoc(groupRef, initialData);

  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    groups: arrayUnion(newGroupId)
  });

  // Send email invites if provided
  if (emails?.trim()) {
    sendEmailInvites(emails, newGroupId, name);
  }

  return newGroupId;
}

/**
 * Join an existing group
 */
export async function joinGroup(user, groupIdInput) {
  const cleanId = groupIdInput.trim().toUpperCase();
  const groupRef = doc(db, 'calendar_groups', cleanId);

  const docSnap = await getDoc(groupRef);
  if (!docSnap.exists()) {
    throw new Error('Invalid group code');
  }

  const currentData = docSnap.data();
  const isMember = currentData.members.some(m => m.uid === user.uid);

  if (!isMember) {
    await updateDoc(groupRef, {
      members: arrayUnion({
        uid: user.uid,
        name: user.displayName,
        photoURL: user.photoURL || ''
      })
    });

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      groups: arrayUnion(cleanId)
    });
  }

  return cleanId;
}

/**
 * Update group info (name, description)
 */
export async function updateGroupInfo(groupId, { name, description }) {
  const groupRef = doc(db, 'calendar_groups', groupId);
  await updateDoc(groupRef, {
    name: name?.trim() || '',
    description: description?.trim() || ''
  });
}

/**
 * Leave/archive a group
 */
export async function leaveGroup(user, groupId) {
  const userRef = doc(db, 'users', user.uid);
  const groupRef = doc(db, 'calendar_groups', groupId);

  // Get current group data
  const groupSnap = await getDoc(groupRef);
  if (groupSnap.exists()) {
    const gData = groupSnap.data();

    // Remove user from members list
    const updatedMembers = (gData.members || []).filter(m => m.uid !== user.uid);

    // Remove user votes from all dates
    const updatedVotes = { ...gData.votes };
    for (const dateStr in updatedVotes) {
      if (Array.isArray(updatedVotes[dateStr])) {
        updatedVotes[dateStr] = updatedVotes[dateStr].filter(uid => uid !== user.uid);
      }
    }

    await updateDoc(groupRef, {
      members: updatedMembers,
      votes: updatedVotes
    });
  }

  // Remove group from user's list
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const uData = userSnap.data();
    const updatedGroups = (uData.groups || []).filter(g => g !== groupId);
    await updateDoc(userRef, { groups: updatedGroups });
  }
}

/**
 * Send email invites via Gmail
 */
export function sendEmailInvites(emailsString, groupId, groupName) {
  const emails = emailsString.split(/[,\s]+/).filter(e => e.includes('@'));
  if (emails.length === 0) return;

  const subject = encodeURIComponent(`Te invito a ${groupName || 'mi grupo'} en AgendaGrupal`);
  const body = encodeURIComponent(
    `¡Hola!\n\nTe invito a unirte a mi grupo "${groupName || 'AgendaGrupal'}" para coordinar fechas.\n\n` +
    `Código del grupo: ${groupId}\n\n` +
    `Entra aquí: https://planificador-grupal.web.app\n\n` +
    `1. Inicia sesión con Google\n` +
    `2. Ingresa el código: ${groupId}\n` +
    `3. ¡Listo!\n\n` +
    `- Enviado desde AgendaGrupal reconect`
  );

  const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${emails.join(',')}&su=${subject}&body=${body}`;
  window.open(gmailUrl, '_blank');
}

/**
 * Copy group code to clipboard
 */
export async function copyGroupCode(groupId) {
  try {
    await navigator.clipboard.writeText(groupId);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = groupId;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
}

/**
 * Copy full invite message to clipboard
 */
export async function copyFullInvite(groupId, groupName) {
  const name = groupName ? `"${groupName}"` : 'mi calendario grupal';
  const text = `¡Únete a ${name}!\n\nCódigo: ${groupId}\nEntra aquí: https://planificador-grupal.web.app`;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
}

/**
 * Share group via native share API or copy to clipboard
 */
export async function shareGroup(groupId, groupName) {
  const shareData = {
    title: groupName || 'AgendaGrupal',
    text: `¡Únete a "${groupName || 'AgendaGrupal'}"!\nCódigo: ${groupId}`,
    url: 'https://planificador-grupal.web.app'
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (err) {
      if (err.name !== 'AbortError') {
        await copyFullInvite(groupId, groupName);
        return 'copied';
      }
      return 'cancelled';
    }
  } else {
    await copyFullInvite(groupId, groupName);
    return 'copied';
  }
}

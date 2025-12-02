import { doc, getDoc, updateDoc, arrayUnion, deleteField } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Toggle date availability in a group
 */
export async function toggleDateAvailability(user, groupId, groupData, dateStr, skipConflictCheck = false, userData = null) {
  if (!user || !groupId || !groupData) return { success: false };

  const currentVotes = groupData.votes || {};
  const dateVotes = currentVotes[dateStr] || [];
  const isCurrentlyAvailable = dateVotes.includes(user.uid);

  // If marking as available, check for conflicts
  if (!isCurrentlyAvailable && !skipConflictCheck && userData) {
    // Check if day is blocked
    if (userData.blockedDays?.[dateStr]) {
      return { success: false, error: 'blocked', message: 'Este día está bloqueado. Desbloquéalo primero.' };
    }

    // Check for confirmed plan in another group
    const confirmedPlan = userData.confirmedPlans?.[dateStr];
    if (confirmedPlan && confirmedPlan.groupId !== groupId) {
      return {
        success: false,
        error: 'conflict',
        conflicts: [{
          type: 'confirmed',
          groupName: confirmedPlan.groupName,
          groupId: confirmedPlan.groupId
        }]
      };
    }

    // Check for availability in other groups
    const otherGroupsWithAvailability = [];
    const groupIds = userData.groups || [];

    for (const gId of groupIds) {
      if (gId === groupId) continue;
      try {
        const otherGroupRef = doc(db, 'calendar_groups', gId);
        const groupSnap = await getDoc(otherGroupRef);
        if (groupSnap.exists()) {
          const gData = groupSnap.data();
          const votes = gData.votes?.[dateStr] || [];
          if (votes.includes(user.uid)) {
            otherGroupsWithAvailability.push({
              type: 'available',
              groupName: gData.name || `Grupo ${gId}`,
              groupId: gId
            });
          }
        }
      } catch (err) {
        console.error(`Error checking group ${gId}:`, err);
      }
    }

    if (otherGroupsWithAvailability.length > 0) {
      return {
        success: false,
        error: 'conflict',
        conflicts: otherGroupsWithAvailability
      };
    }
  }

  // Execute the change
  const groupRef = doc(db, 'calendar_groups', groupId);
  let newDateVotes;
  if (isCurrentlyAvailable) {
    newDateVotes = dateVotes.filter(uid => uid !== user.uid);
  } else {
    newDateVotes = [...dateVotes, user.uid];
  }

  await updateDoc(groupRef, {
    [`votes.${dateStr}`]: newDateVotes
  });

  return { success: true, isNowAvailable: !isCurrentlyAvailable };
}

/**
 * Toggle star on a date
 */
export async function toggleStar(user, groupId, groupData, dateStr) {
  if (!user || !groupId || !groupData) return;

  const groupRef = doc(db, 'calendar_groups', groupId);
  const currentStars = groupData.stars || {};
  const dateStars = currentStars[dateStr] || [];

  let newDateStars;
  if (dateStars.includes(user.uid)) {
    newDateStars = dateStars.filter(uid => uid !== user.uid);
  } else {
    newDateStars = [...dateStars, user.uid];
  }

  await updateDoc(groupRef, {
    [`stars.${dateStr}`]: newDateStars
  });
}

/**
 * Block a day for user (affects all groups)
 */
export async function blockDay(user, userData, dateStr, reason) {
  if (!user || !dateStr) return;

  const userRef = doc(db, 'users', user.uid);

  // Save blocked day in user profile
  await updateDoc(userRef, {
    [`blockedDays.${dateStr}`]: {
      reason: reason?.trim() || '',
      blockedAt: new Date().toISOString()
    }
  });

  // Remove availability from all user's groups
  const groupIds = userData?.groups || [];
  for (const gId of groupIds) {
    try {
      const groupRef = doc(db, 'calendar_groups', gId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const gData = groupSnap.data();
        const votes = gData.votes?.[dateStr] || [];
        if (votes.includes(user.uid)) {
          await updateDoc(groupRef, {
            [`votes.${dateStr}`]: votes.filter(uid => uid !== user.uid)
          });
        }
      }
    } catch (err) {
      console.error(`Error updating group ${gId}:`, err);
    }
  }
}

/**
 * Unblock a day
 */
export async function unblockDay(user, dateStr) {
  if (!user || !dateStr) return;

  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    [`blockedDays.${dateStr}`]: deleteField()
  });
}

/**
 * Confirm a plan for a date
 */
export async function confirmPlan(user, userData, groupId, groupData, dateStr) {
  if (!user || !groupId || !groupData || !dateStr) return;

  const userRef = doc(db, 'users', user.uid);
  const groupRef = doc(db, 'calendar_groups', groupId);

  // Save confirmed plan in user profile
  await updateDoc(userRef, {
    [`confirmedPlans.${dateStr}`]: {
      groupId: groupId,
      groupName: groupData.name || `Grupo ${groupId}`,
      confirmedAt: new Date().toISOString()
    }
  });

  // Mark in group that there's a confirmed plan
  await updateDoc(groupRef, {
    [`confirmedDays.${dateStr}`]: arrayUnion({
      uid: user.uid,
      name: user.displayName || 'Usuario',
      photoURL: user.photoURL || null,
      confirmedAt: new Date().toISOString()
    })
  });

  // Remove availability from other groups for this day
  const groupIds = userData?.groups || [];
  for (const gId of groupIds) {
    if (gId === groupId) continue;
    try {
      const otherGroupRef = doc(db, 'calendar_groups', gId);
      const groupSnap = await getDoc(otherGroupRef);
      if (groupSnap.exists()) {
        const gData = groupSnap.data();
        const votes = gData.votes?.[dateStr] || [];
        if (votes.includes(user.uid)) {
          await updateDoc(otherGroupRef, {
            [`votes.${dateStr}`]: votes.filter(uid => uid !== user.uid)
          });
        }
      }
    } catch (err) {
      console.error(`Error updating group ${gId}:`, err);
    }
  }
}

/**
 * Cancel a confirmed plan
 */
export async function cancelConfirmedPlan(user, groupId, groupData, dateStr) {
  if (!user || !groupId || !groupData) return;

  const userRef = doc(db, 'users', user.uid);
  const groupRef = doc(db, 'calendar_groups', groupId);

  await updateDoc(userRef, {
    [`confirmedPlans.${dateStr}`]: deleteField()
  });

  // Remove user from group's confirmed list for this day
  const currentConfirmed = groupData.confirmedDays?.[dateStr] || [];
  const updatedConfirmed = currentConfirmed.filter(c => c.uid !== user.uid);

  if (updatedConfirmed.length === 0) {
    await updateDoc(groupRef, {
      [`confirmedDays.${dateStr}`]: deleteField()
    });
  } else {
    await updateDoc(groupRef, {
      [`confirmedDays.${dateStr}`]: updatedConfirmed
    });
  }
}

/**
 * Mark messages as read for a specific date
 */
export async function markMessagesAsRead(user, groupId, dateStr, messageCount) {
  if (!user || !groupId || messageCount === 0) return;

  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    [`lastSeenMessages.${groupId}.${dateStr}`]: messageCount
  });
}

/**
 * Mark general chat messages as read
 */
export async function markGeneralChatAsRead(user, groupId, messageCount) {
  if (!user || !groupId || messageCount === 0) return;

  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    [`lastSeenMessages.${groupId}._general`]: messageCount
  });
}

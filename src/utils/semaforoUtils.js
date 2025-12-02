import { CheckCircle, XCircle, Users, Lock } from 'lucide-react';

/**
 * Calculate day status (traffic light system)
 */
export function getDayStatus(dateStr, groupData, userData, user, groupId) {
  const defaultStatus = {
    colorClass: 'bg-slate-100 border-slate-200 text-slate-500',
    statusIcon: null,
    statusIconType: 'xcircle',
    isUserAvailable: false,
    voteCount: 0,
    totalMembers: 1,
    percentage: 0,
    isStarred: false,
    starCount: 0,
    isBlocked: false,
    blockReason: '',
    isConfirmed: false,
    confirmedInOtherGroup: null,
    unreadCount: 0,
    confirmedUsers: [],
    confirmedCount: 0,
    hasMyMessage: false,
    messageCount: 0,
    statusType: 'red'
  };

  if (!groupData) return defaultStatus;

  const totalMembers = groupData.members?.length || 1;
  const votes = groupData.votes?.[dateStr] || [];
  const voteCount = votes.length;
  const percentage = totalMembers > 0 ? voteCount / totalMembers : 0;

  const isUserAvailable = votes.includes(user?.uid);

  const stars = groupData.stars?.[dateStr] || [];
  const isStarred = stars.includes(user?.uid);
  const starCount = stars.length;

  const rawMessages = groupData.messages?.[dateStr];
  let messageCount = 0;
  let hasMyMessage = false;

  if (Array.isArray(rawMessages)) {
    messageCount = rawMessages.length;
    hasMyMessage = rawMessages.some(m => m.uid === user?.uid);
  } else if (rawMessages && typeof rawMessages === 'object') {
    messageCount = Object.keys(rawMessages).length;
    hasMyMessage = !!rawMessages[user?.uid];
  }

  // Block and confirmation states
  const isBlocked = !!userData?.blockedDays?.[dateStr];
  const blockReason = userData?.blockedDays?.[dateStr]?.reason || '';

  const confirmedPlan = userData?.confirmedPlans?.[dateStr];
  const isConfirmed = confirmedPlan?.groupId === groupId;
  const confirmedInOtherGroup = confirmedPlan && confirmedPlan.groupId !== groupId ? confirmedPlan : null;

  // Confirmed users list
  const confirmedUsers = groupData.confirmedDays?.[dateStr] || [];
  const confirmedCount = confirmedUsers.length;

  // Unread messages
  const seenCount = userData?.lastSeenMessages?.[groupId]?.[dateStr] || 0;
  const unreadCount = Math.max(0, messageCount - seenCount);

  // Traffic light colors
  let colorClass = 'bg-red-100 border-red-200 text-red-800';
  let statusIconType = 'xcircle';
  let statusType = 'red';

  if (isBlocked) {
    colorClass = 'bg-slate-200 border-slate-300 text-slate-600';
    statusIconType = 'lock';
    statusType = 'blocked';
  } else if (percentage === 1 && voteCount > 0) {
    colorClass = 'bg-green-100 border-green-200 text-green-800';
    statusIconType = 'checkcircle';
    statusType = 'green';
  } else if (percentage >= 0.5) {
    colorClass = 'bg-yellow-100 border-yellow-200 text-yellow-800';
    statusIconType = 'users';
    statusType = 'yellow';
  }

  return {
    colorClass,
    statusIcon: null, // Will be rendered by component
    statusIconType,
    isUserAvailable,
    voteCount,
    totalMembers,
    percentage,
    isStarred,
    starCount,
    hasMyMessage,
    messageCount,
    statusType,
    isBlocked,
    blockReason,
    isConfirmed,
    confirmedInOtherGroup,
    unreadCount,
    confirmedUsers,
    confirmedCount
  };
}

/**
 * Get unread message count for a specific date
 */
export function getUnreadMessageCount(dateStr, groupData, userData, groupId) {
  const rawMessages = groupData?.messages?.[dateStr];
  let totalMessages = 0;

  if (Array.isArray(rawMessages)) {
    totalMessages = rawMessages.length;
  } else if (rawMessages && typeof rawMessages === 'object') {
    totalMessages = Object.keys(rawMessages).length;
  }

  const seenCount = userData?.lastSeenMessages?.[groupId]?.[dateStr] || 0;
  return Math.max(0, totalMessages - seenCount);
}

/**
 * Get unread count for general chat
 */
export function getUnreadGeneralChatCount(groupData, userData, groupId) {
  const totalMessages = groupData?.generalChat?.length || 0;
  const seenCount = userData?.lastSeenMessages?.[groupId]?.['_general'] || 0;
  return Math.max(0, totalMessages - seenCount);
}

/**
 * Filter days based on filter criteria
 */
export function filterDays(calendarDays, filter, getDayStatusFn) {
  if (filter === 'all') return calendarDays;

  return calendarDays.filter(day => {
    const status = getDayStatusFn(day.dateStr);
    switch (filter) {
      case 'available':
        return status.isUserAvailable;
      case 'starred':
        return status.isStarred;
      case 'green':
        return status.statusType === 'green';
      case 'yellow':
        return status.statusType === 'yellow';
      case 'red':
        return status.statusType === 'red';
      default:
        return true;
    }
  });
}

/**
 * Get status background color for mini indicators
 */
export function getStatusBgColor(statusType) {
  switch (statusType) {
    case 'green':
      return 'bg-green-500';
    case 'yellow':
      return 'bg-yellow-400';
    case 'red':
      return 'bg-red-400';
    default:
      return 'bg-slate-400';
  }
}

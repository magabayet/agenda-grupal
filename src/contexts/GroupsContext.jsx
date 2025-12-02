import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const GroupsContext = createContext(null);

export function GroupsProvider({ children }) {
  const { user, userData } = useAuth();
  const [userGroups, setUserGroups] = useState([]);
  const [currentGroupId, setCurrentGroupId] = useState('');
  const [currentGroupData, setCurrentGroupData] = useState(null);

  // Refs for managing group listeners
  const groupsMapRef = useRef(new Map());
  const groupUnsubscribesRef = useRef([]);
  const currentGroupIdsRef = useRef([]);

  // Listen to user's groups in real-time
  useEffect(() => {
    if (!user) {
      setUserGroups([]);
      groupsMapRef.current.clear();
      return;
    }

    const userRef = doc(db, 'users', user.uid);

    const unsubscribeUser = onSnapshot(userRef, (userSnap) => {
      if (!userSnap.exists()) {
        setUserGroups([]);
        groupsMapRef.current.clear();
        return;
      }

      const data = userSnap.data();
      const newGroupIds = data.groups || [];
      const oldGroupIds = currentGroupIdsRef.current;

      // Detect removed groups
      const removedIds = oldGroupIds.filter(id => !newGroupIds.includes(id));
      // Detect new groups
      const addedIds = newGroupIds.filter(id => !oldGroupIds.includes(id));

      // Clean data and listeners from removed groups
      removedIds.forEach(id => {
        groupsMapRef.current.delete(id);
      });

      // Update current IDs reference
      currentGroupIdsRef.current = newGroupIds;

      if (newGroupIds.length === 0) {
        groupUnsubscribesRef.current.forEach(unsub => unsub());
        groupUnsubscribesRef.current = [];
        setUserGroups([]);
        return;
      }

      // Create listeners only for new groups
      addedIds.forEach((gId) => {
        const groupRef = doc(db, 'calendar_groups', gId);
        const unsubGroup = onSnapshot(groupRef, (groupSnap) => {
          if (groupSnap.exists()) {
            const gData = groupSnap.data();
            groupsMapRef.current.set(gId, {
              id: gId,
              name: gData.name || '',
              description: gData.description || '',
              memberCount: gData.members?.length || 0,
              members: gData.members || [],
              generalChat: gData.generalChat || [],
              messages: gData.messages || {}
            });
          } else {
            groupsMapRef.current.delete(gId);
          }

          // Update state maintaining original order
          const orderedGroups = currentGroupIdsRef.current
            .filter(id => groupsMapRef.current.has(id))
            .map(id => groupsMapRef.current.get(id));
          setUserGroups(orderedGroups);
        }, (error) => {
          console.error(`Error listening to group ${gId}:`, error);
        });

        groupUnsubscribesRef.current.push(unsubGroup);
      });

      // Update state if groups were removed but none added
      if (addedIds.length === 0 && removedIds.length > 0) {
        const orderedGroups = currentGroupIdsRef.current
          .filter(id => groupsMapRef.current.has(id))
          .map(id => groupsMapRef.current.get(id));
        setUserGroups(orderedGroups);
      }
    }, (error) => {
      console.error("Error listening to user:", error);
    });

    return () => {
      unsubscribeUser();
      groupUnsubscribesRef.current.forEach(unsub => unsub());
      groupUnsubscribesRef.current = [];
      groupsMapRef.current.clear();
      currentGroupIdsRef.current = [];
    };
  }, [user]);

  // Listen to current group changes
  useEffect(() => {
    if (!user || !currentGroupId) return;

    const groupRef = doc(db, 'calendar_groups', currentGroupId);

    const unsubscribe = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentGroupData(docSnap.data());
      } else {
        setCurrentGroupData(null);
      }
    }, (error) => {
      console.error("Error listening to group:", error);
    });

    return () => unsubscribe();
  }, [user, currentGroupId]);

  // Helper to count unread messages for a group
  const getTotalUnreadForGroup = (group) => {
    if (!userData?.lastSeenMessages) return 0;

    const groupSeenData = userData.lastSeenMessages[group.id] || {};
    let totalUnread = 0;

    // Unread general chat messages
    const generalChatTotal = group.generalChat?.length || 0;
    const generalChatSeen = groupSeenData['_general'] || 0;
    totalUnread += Math.max(0, generalChatTotal - generalChatSeen);

    // Unread day chat messages
    const messages = group.messages || {};
    Object.entries(messages).forEach(([dateStr, dateMessages]) => {
      let msgCount = 0;
      if (Array.isArray(dateMessages)) {
        msgCount = dateMessages.length;
      } else if (dateMessages && typeof dateMessages === 'object') {
        msgCount = Object.keys(dateMessages).length;
      }
      const seenCount = groupSeenData[dateStr] || 0;
      totalUnread += Math.max(0, msgCount - seenCount);
    });

    return totalUnread;
  };

  const selectGroup = (groupId) => {
    setCurrentGroupId(groupId);
  };

  const clearCurrentGroup = () => {
    setCurrentGroupId('');
    setCurrentGroupData(null);
  };

  const value = {
    userGroups,
    currentGroupId,
    currentGroupData,
    selectGroup,
    clearCurrentGroup,
    getTotalUnreadForGroup
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
}

export function useGroups() {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
}

export default GroupsContext;

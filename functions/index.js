const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

/**
 * Cloud Function que se dispara cuando se actualiza un grupo
 * Envía notificaciones push cuando hay nuevos mensajes
 */
exports.onGroupUpdate = onDocumentUpdated("calendar_groups/{groupId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const groupId = event.params.groupId;

  // Verificar si hay nuevos mensajes en el chat general
  const beforeGeneralChat = before.generalChat || [];
  const afterGeneralChat = after.generalChat || [];

  if (afterGeneralChat.length > beforeGeneralChat.length) {
    // Hay un nuevo mensaje en el chat general
    const newMessage = afterGeneralChat[afterGeneralChat.length - 1];
    const senderUid = newMessage.uid;
    const senderName = newMessage.name || 'Alguien';
    const messageText = newMessage.text || '';
    const groupName = after.name || `Grupo ${groupId}`;

    // Enviar notificación a todos los miembros excepto al que envió
    await sendNotificationToGroupMembers(
      after.members || [],
      senderUid,
      {
        title: groupName,
        body: `${senderName}: ${messageText.substring(0, 100)}`,
        data: {
          type: 'general_chat',
          groupId: groupId,
          url: `https://planificador-grupal.web.app`
        }
      }
    );
  }

  // Verificar si hay nuevos mensajes en los chats de días
  const beforeMessages = before.messages || {};
  const afterMessages = after.messages || {};

  for (const dateStr of Object.keys(afterMessages)) {
    const beforeDateMsgs = beforeMessages[dateStr];
    const afterDateMsgs = afterMessages[dateStr];

    // Contar mensajes
    const beforeCount = Array.isArray(beforeDateMsgs) ? beforeDateMsgs.length :
                        (beforeDateMsgs && typeof beforeDateMsgs === 'object') ? Object.keys(beforeDateMsgs).length : 0;
    const afterCount = Array.isArray(afterDateMsgs) ? afterDateMsgs.length :
                       (afterDateMsgs && typeof afterDateMsgs === 'object') ? Object.keys(afterDateMsgs).length : 0;

    if (afterCount > beforeCount && Array.isArray(afterDateMsgs)) {
      // Hay un nuevo mensaje en este día
      const newMessage = afterDateMsgs[afterDateMsgs.length - 1];
      const senderUid = newMessage.uid;
      const senderName = newMessage.name || 'Alguien';
      const messageText = newMessage.text || '';
      const groupName = after.name || `Grupo ${groupId}`;

      // Formatear la fecha
      const [year, month, day] = dateStr.split('-');
      const date = new Date(year, month - 1, day);
      const dateFormatted = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

      await sendNotificationToGroupMembers(
        after.members || [],
        senderUid,
        {
          title: `${groupName} - ${dateFormatted}`,
          body: `${senderName}: ${messageText.substring(0, 100)}`,
          data: {
            type: 'day_chat',
            groupId: groupId,
            dateStr: dateStr,
            url: `https://planificador-grupal.web.app`
          }
        }
      );
    }
  }

  return null;
});

/**
 * Envía notificaciones a todos los miembros del grupo excepto al remitente
 */
async function sendNotificationToGroupMembers(members, excludeUid, notificationData) {
  const tokens = [];

  // Obtener tokens FCM de cada miembro
  for (const member of members) {
    if (member.uid === excludeUid) continue; // No enviar al remitente

    try {
      const userDoc = await db.collection('users').doc(member.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const userTokens = userData.fcmTokens || [];
        const notificationsEnabled = userData.notificationsEnabled !== false;

        if (notificationsEnabled && userTokens.length > 0) {
          tokens.push(...userTokens);
        }
      }
    } catch (error) {
      console.error(`Error obteniendo tokens para ${member.uid}:`, error);
    }
  }

  if (tokens.length === 0) {
    console.log('No hay tokens para enviar notificaciones');
    return;
  }

  // Preparar el mensaje
  const message = {
    notification: {
      title: notificationData.title,
      body: notificationData.body
    },
    data: notificationData.data || {},
    tokens: tokens
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(`Notificaciones enviadas: ${response.successCount} éxitos, ${response.failureCount} fallos`);

    // Limpiar tokens inválidos
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
          invalidTokens.push(tokens[idx]);
        }
      });

      // Remover tokens inválidos de la base de datos
      for (const invalidToken of invalidTokens) {
        await removeInvalidToken(invalidToken);
      }
    }
  } catch (error) {
    console.error('Error enviando notificaciones:', error);
  }
}

/**
 * Remueve un token inválido de todos los usuarios
 */
async function removeInvalidToken(token) {
  try {
    const usersSnapshot = await db.collection('users')
      .where('fcmTokens', 'array-contains', token)
      .get();

    for (const userDoc of usersSnapshot.docs) {
      const currentTokens = userDoc.data().fcmTokens || [];
      const newTokens = currentTokens.filter(t => t !== token);
      await userDoc.ref.update({ fcmTokens: newTokens });
    }
  } catch (error) {
    console.error('Error removiendo token inválido:', error);
  }
}

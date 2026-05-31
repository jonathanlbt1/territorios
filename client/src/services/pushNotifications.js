import api from './api';

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestPermission() {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }
  
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Register service worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    throw error;
  }
}

/**
 * Get existing service worker registration
 */
export async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }
  return navigator.serviceWorker.ready;
}

/**
 * Convert URL-safe base64 to Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }

  // Request permission first
  const permission = await requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  // Get VAPID public key from server
  const { data: vapidData } = await api.get('/push/vapid-public-key');
  if (!vapidData.configured || !vapidData.publicKey) {
    throw new Error('Push notifications not configured on server');
  }

  // Get or register service worker
  const registration = await getServiceWorkerRegistration() || await registerServiceWorker();

  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey)
  });

  // Send subscription to server
  const subscriptionJSON = subscription.toJSON();
  await api.post('/push/subscribe', {
    subscription: {
      endpoint: subscriptionJSON.endpoint,
      keys: {
        p256dh: subscriptionJSON.keys.p256dh,
        auth: subscriptionJSON.keys.auth
      }
    }
  });

  console.log('Push subscription successful');
  return subscription;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return;
  }

  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    // Unsubscribe locally
    await subscription.unsubscribe();
    
    // Remove from server
    await api.post('/push/unsubscribe', {
      endpoint: subscription.endpoint
    });
    
    console.log('Push unsubscription successful');
  }
}

/**
 * Check if user is subscribed to push
 */
export async function isSubscribedToPush() {
  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * Get push subscription status from server
 */
export async function getPushStatus() {
  try {
    const { data } = await api.get('/push/status');
    return data;
  } catch {
    return { subscribed: false, configured: false };
  }
}

/**
 * Initialize push notifications
 * Call this when the app starts and user is logged in
 */
export async function initializePushNotifications() {
  if (!isPushSupported()) {
    console.log('Push notifications not supported on this device');
    return { supported: false };
  }

  try {
    // Register service worker
    await registerServiceWorker();

    // Check if already subscribed
    const isSubscribed = await isSubscribedToPush();
    const permission = getPermissionStatus();

    return {
      supported: true,
      subscribed: isSubscribed,
      permission
    };
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return {
      supported: true,
      subscribed: false,
      permission: getPermissionStatus(),
      error: error.message
    };
  }
}

export default {
  isPushSupported,
  getPermissionStatus,
  requestPermission,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  getPushStatus,
  initializePushNotifications
};


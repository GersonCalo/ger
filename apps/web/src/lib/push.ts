import { api } from './api';

const PUSH_STORAGE_KEY = 'push_notifications_enabled';
const PUSH_ASKED_KEY = 'push_notifications_asked';

export const isPushSupported = (): boolean => {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

export const hasAskedPermission = (): boolean => {
  return localStorage.getItem(PUSH_ASKED_KEY) === 'true';
};

export const isPushEnabled = (): boolean => {
  return localStorage.getItem(PUSH_STORAGE_KEY) !== 'false';
};

export const setPushEnabled = (enabled: boolean) => {
  if (enabled) {
    localStorage.removeItem(PUSH_STORAGE_KEY);
  } else {
    localStorage.setItem(PUSH_STORAGE_KEY, 'false');
  }
};

export const markAsAsked = () => {
  localStorage.setItem(PUSH_ASKED_KEY, 'true');
};

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });
  return registration;
};

export const subscribeToPush = async (token: string): Promise<boolean> => {
  if (!isPushSupported() || !isPushEnabled()) return false;

  try {
    const registration = await registerServiceWorker();

    // Check current permission
    if (Notification.permission === 'denied') {
      setPushEnabled(false);
      return false;
    }

    // Request permission if not granted
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushEnabled(false);
        return false;
      }
    }

    // Get VAPID public key from server
    let publicKey: string;
    try {
      const resp = await api.getVapidPublicKey(token);
      publicKey = resp.publicKey;
    } catch {
      console.warn('Push notifications: VAPID key not available from server');
      return false;
    }

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send subscription to server
    const raw = subscription.toJSON();
    await api.subscribeToPush(token, {
      endpoint: raw.endpoint!,
      keys: {
        p256dh: raw.keys!.p256dh!,
        auth: raw.keys!.auth!,
      },
    });

    return true;
  } catch (err) {
    console.error('Error subscribing to push notifications:', err);
    return false;
  }
};

export const unsubscribeFromPush = async (token: string): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    setPushEnabled(false);
    return true;
  } catch (err) {
    console.error('Error unsubscribing from push notifications:', err);
    return false;
  }
};

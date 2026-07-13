import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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

// Detect browser and platform
function getBrowserInfo() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isMacSafari = isSafari && !isIOS;
  const isIOSSafari = isIOS && isSafari;
  
  // Check if running as installed PWA (standalone mode)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
  
  return { isIOS, isSafari, isMacSafari, isIOSSafari, isStandalone };
}

export function usePushNotifications(token) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState('default');
  const [browserInfo, setBrowserInfo] = useState({});
  const [requiresPWA, setRequiresPWA] = useState(false);

  useEffect(() => {
    const info = getBrowserInfo();
    setBrowserInfo(info);
    
    // Check basic browser support
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    
    // For iOS Safari, push only works when installed as PWA
    if (info.isIOSSafari && !info.isStandalone) {
      setRequiresPWA(true);
      setIsSupported(false);
      setLoading(false);
      return;
    }
    
    // For macOS Safari 16+, standard web push is supported
    // For other browsers, check standard support
    const supported = hasServiceWorker && hasPushManager && hasNotification;
    setIsSupported(supported);

    if (!supported) {
      setLoading(false);
      return;
    }

    // Check current permission status
    setPermission(Notification.permission);

    // Check if already subscribed
    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Failed to check subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || !token) return false;

    try {
      setLoading(true);

      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      
      if (permissionResult !== 'granted') {
        console.log('Notification permission denied');
        setLoading(false);
        return false;
      }

      // Get VAPID public key from backend
      const keyResponse = await fetch(`${API_URL}/api/push/public-key`);
      if (!keyResponse.ok) {
        throw new Error('Failed to get VAPID public key');
      }
      const { public_key } = await keyResponse.json();

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key)
      });

      // Send subscription to backend
      const response = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          user_id: '' // Will be set by backend from token
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription on backend');
      }

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      setLoading(false);
      return false;
    }
  }, [isSupported, token]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !token) return false;

    try {
      setLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Notify backend
        await fetch(`${API_URL}/api/push/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      setIsSubscribed(false);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      setLoading(false);
      return false;
    }
  }, [isSupported, token]);

  const sendTestNotification = useCallback(async () => {
    if (!token) return false;

    try {
      const response = await fetch(`${API_URL}/api/push/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return false;
    }
  }, [token]);

  return {
    isSupported,
    isSubscribed,
    loading,
    permission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    browserInfo,
    requiresPWA
  };
}

import { useState, useEffect, useCallback } from 'react';
import {
  getPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  initializePushNotifications
} from '../services/pushNotifications';

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const result = await initializePushNotifications();
        setSupported(result.supported);
        setPermission(result.permission || 'default');
        setSubscribed(result.subscribed || false);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await subscribeToPush();
      setSubscribed(true);
      setPermission('granted');
      return { success: true };
    } catch (err) {
      setError(err.message);
      // Update permission status in case it was denied
      setPermission(getPermissionStatus());
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh subscription status
  const refreshStatus = useCallback(async () => {
    try {
      const isSubbed = await isSubscribedToPush();
      setSubscribed(isSubbed);
      setPermission(getPermissionStatus());
    } catch (err) {
      console.error('Error refreshing push status:', err);
    }
  }, []);

  return {
    supported,
    permission,
    subscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    refreshStatus,
    // Computed states
    canSubscribe: supported && permission !== 'denied' && !subscribed,
    isDenied: permission === 'denied',
    isGranted: permission === 'granted'
  };
}

export default usePushNotifications;


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Create mock functions with vi.hoisted
const {
  mockIsPushSupported,
  mockGetPermissionStatus,
  mockSubscribeToPush,
  mockUnsubscribeFromPush,
  mockIsSubscribedToPush,
  mockInitializePushNotifications,
} = vi.hoisted(() => ({
  mockIsPushSupported: vi.fn(),
  mockGetPermissionStatus: vi.fn(),
  mockSubscribeToPush: vi.fn(),
  mockUnsubscribeFromPush: vi.fn(),
  mockIsSubscribedToPush: vi.fn(),
  mockInitializePushNotifications: vi.fn(),
}));

vi.mock('../../src/services/pushNotifications', () => ({
  isPushSupported: mockIsPushSupported,
  getPermissionStatus: mockGetPermissionStatus,
  subscribeToPush: mockSubscribeToPush,
  unsubscribeFromPush: mockUnsubscribeFromPush,
  isSubscribedToPush: mockIsSubscribedToPush,
  initializePushNotifications: mockInitializePushNotifications,
}));

import { usePushNotifications } from '../../src/hooks/usePushNotifications';

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitializePushNotifications.mockResolvedValue({
      supported: true,
      permission: 'default',
      subscribed: false,
    });
    mockGetPermissionStatus.mockReturnValue('default');
  });

  describe('initialization', () => {
    it('should start with loading true', () => {
      const { result } = renderHook(() => usePushNotifications());
      
      // Initial state before async completes
      expect(result.current.loading).toBe(true);
    });

    it('should call initializePushNotifications on mount', async () => {
      renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(mockInitializePushNotifications).toHaveBeenCalledTimes(1);
      });
    });

    it('should set supported from init result', async () => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: 'default',
        subscribed: false,
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.supported).toBe(true);
      });
    });

    it('should set supported false when not supported', async () => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: false,
        permission: 'default',
        subscribed: false,
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.supported).toBe(false);
      });
    });

    it('should set permission from init result', async () => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: 'granted',
        subscribed: true,
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.permission).toBe('granted');
      });
    });

    it('should set subscribed from init result', async () => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: 'granted',
        subscribed: true,
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.subscribed).toBe(true);
      });
    });

    it('should set loading false after init completes', async () => {
      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle init error', async () => {
      mockInitializePushNotifications.mockRejectedValue(new Error('Init failed'));

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.error).toBe('Init failed');
        expect(result.current.loading).toBe(false);
      });
    });

    it('should default permission to "default" when undefined', async () => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: undefined,
        subscribed: false,
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.permission).toBe('default');
      });
    });

    it('should default subscribed to false when undefined', async () => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: 'default',
        subscribed: undefined,
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.subscribed).toBe(false);
      });
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: 'default',
        subscribed: false,
      });
    });

    it('should call subscribeToPush', async () => {
      mockSubscribeToPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.subscribe();
      });

      expect(mockSubscribeToPush).toHaveBeenCalledTimes(1);
    });

    it('should set loading true during subscribe', async () => {
      let resolveSubscribe;
      mockSubscribeToPush.mockImplementation(() => new Promise(resolve => {
        resolveSubscribe = resolve;
      }));

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.subscribe();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveSubscribe();
      });
    });

    it('should set subscribed true on success', async () => {
      mockSubscribeToPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.subscribe();
      });

      expect(result.current.subscribed).toBe(true);
    });

    it('should set permission to granted on success', async () => {
      mockSubscribeToPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.subscribe();
      });

      expect(result.current.permission).toBe('granted');
    });

    it('should return success true on success', async () => {
      mockSubscribeToPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let subscribeResult;
      await act(async () => {
        subscribeResult = await result.current.subscribe();
      });

      expect(subscribeResult).toEqual({ success: true });
    });

    it('should clear error before subscribing', async () => {
      mockInitializePushNotifications.mockRejectedValueOnce(new Error('Init error'));
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: 'default',
        subscribed: false,
      });

      const { result, rerender } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.error).toBe('Init error');
      });

      // Re-render to get fresh state
      rerender();
      mockSubscribeToPush.mockResolvedValue();

      await act(async () => {
        await result.current.subscribe();
      });

      expect(result.current.error).toBe(null);
    });

    it('should set error on subscribe failure', async () => {
      mockSubscribeToPush.mockRejectedValue(new Error('Subscribe failed'));
      mockGetPermissionStatus.mockReturnValue('denied');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.subscribe();
      });

      expect(result.current.error).toBe('Subscribe failed');
    });

    it('should update permission status on failure', async () => {
      mockSubscribeToPush.mockRejectedValue(new Error('Permission denied'));
      mockGetPermissionStatus.mockReturnValue('denied');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.subscribe();
      });

      expect(result.current.permission).toBe('denied');
    });

    it('should return error on failure', async () => {
      mockSubscribeToPush.mockRejectedValue(new Error('Subscribe failed'));
      mockGetPermissionStatus.mockReturnValue('denied');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let subscribeResult;
      await act(async () => {
        subscribeResult = await result.current.subscribe();
      });

      expect(subscribeResult).toEqual({ success: false, error: 'Subscribe failed' });
    });

    it('should set loading false after subscribe completes', async () => {
      mockSubscribeToPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.subscribe();
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('unsubscribe', () => {
    beforeEach(() => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: 'granted',
        subscribed: true,
      });
    });

    it('should call unsubscribeFromPush', async () => {
      mockUnsubscribeFromPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.unsubscribe();
      });

      expect(mockUnsubscribeFromPush).toHaveBeenCalledTimes(1);
    });

    it('should set subscribed false on success', async () => {
      mockUnsubscribeFromPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.subscribed).toBe(true);
      });

      await act(async () => {
        await result.current.unsubscribe();
      });

      expect(result.current.subscribed).toBe(false);
    });

    it('should return success true on success', async () => {
      mockUnsubscribeFromPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let unsubscribeResult;
      await act(async () => {
        unsubscribeResult = await result.current.unsubscribe();
      });

      expect(unsubscribeResult).toEqual({ success: true });
    });

    it('should set error on unsubscribe failure', async () => {
      mockUnsubscribeFromPush.mockRejectedValue(new Error('Unsubscribe failed'));

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.unsubscribe();
      });

      expect(result.current.error).toBe('Unsubscribe failed');
    });

    it('should return error on failure', async () => {
      mockUnsubscribeFromPush.mockRejectedValue(new Error('Unsubscribe failed'));

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let unsubscribeResult;
      await act(async () => {
        unsubscribeResult = await result.current.unsubscribe();
      });

      expect(unsubscribeResult).toEqual({ success: false, error: 'Unsubscribe failed' });
    });

    it('should set loading false after unsubscribe completes', async () => {
      mockUnsubscribeFromPush.mockResolvedValue();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.unsubscribe();
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('refreshStatus', () => {
    it('should call isSubscribedToPush', async () => {
      mockIsSubscribedToPush.mockResolvedValue(true);

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshStatus();
      });

      expect(mockIsSubscribedToPush).toHaveBeenCalled();
    });

    it('should call getPermissionStatus', async () => {
      mockIsSubscribedToPush.mockResolvedValue(true);
      mockGetPermissionStatus.mockReturnValue('granted');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshStatus();
      });

      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });

    it('should update subscribed state', async () => {
      mockInitializePushNotifications.mockResolvedValue({
        supported: true,
        permission: 'default',
        subscribed: false,
      });
      mockIsSubscribedToPush.mockResolvedValue(true);
      mockGetPermissionStatus.mockReturnValue('granted');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.subscribed).toBe(false);
      });

      await act(async () => {
        await result.current.refreshStatus();
      });

      expect(result.current.subscribed).toBe(true);
    });

    it('should update permission state', async () => {
      mockIsSubscribedToPush.mockResolvedValue(true);
      mockGetPermissionStatus.mockReturnValue('granted');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshStatus();
      });

      expect(result.current.permission).toBe('granted');
    });

    it('should handle refresh error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockIsSubscribedToPush.mockRejectedValue(new Error('Refresh failed'));

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshStatus();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Error refreshing push status:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('computed states', () => {
    describe('canSubscribe', () => {
      it('should be true when supported, not denied, and not subscribed', async () => {
        mockInitializePushNotifications.mockResolvedValue({
          supported: true,
          permission: 'default',
          subscribed: false,
        });

        const { result } = renderHook(() => usePushNotifications());

        await waitFor(() => {
          expect(result.current.canSubscribe).toBe(true);
        });
      });

      it('should be false when not supported', async () => {
        mockInitializePushNotifications.mockResolvedValue({
          supported: false,
          permission: 'default',
          subscribed: false,
        });

        const { result } = renderHook(() => usePushNotifications());

        await waitFor(() => {
          expect(result.current.canSubscribe).toBe(false);
        });
      });

      it('should be false when permission denied', async () => {
        mockInitializePushNotifications.mockResolvedValue({
          supported: true,
          permission: 'denied',
          subscribed: false,
        });

        const { result } = renderHook(() => usePushNotifications());

        await waitFor(() => {
          expect(result.current.canSubscribe).toBe(false);
        });
      });

      it('should be false when already subscribed', async () => {
        mockInitializePushNotifications.mockResolvedValue({
          supported: true,
          permission: 'granted',
          subscribed: true,
        });

        const { result } = renderHook(() => usePushNotifications());

        await waitFor(() => {
          expect(result.current.canSubscribe).toBe(false);
        });
      });
    });

    describe('isDenied', () => {
      it('should be true when permission is denied', async () => {
        mockInitializePushNotifications.mockResolvedValue({
          supported: true,
          permission: 'denied',
          subscribed: false,
        });

        const { result } = renderHook(() => usePushNotifications());

        await waitFor(() => {
          expect(result.current.isDenied).toBe(true);
        });
      });

      it('should be false when permission is not denied', async () => {
        mockInitializePushNotifications.mockResolvedValue({
          supported: true,
          permission: 'default',
          subscribed: false,
        });

        const { result } = renderHook(() => usePushNotifications());

        await waitFor(() => {
          expect(result.current.isDenied).toBe(false);
        });
      });
    });

    describe('isGranted', () => {
      it('should be true when permission is granted', async () => {
        mockInitializePushNotifications.mockResolvedValue({
          supported: true,
          permission: 'granted',
          subscribed: true,
        });

        const { result } = renderHook(() => usePushNotifications());

        await waitFor(() => {
          expect(result.current.isGranted).toBe(true);
        });
      });

      it('should be false when permission is not granted', async () => {
        mockInitializePushNotifications.mockResolvedValue({
          supported: true,
          permission: 'default',
          subscribed: false,
        });

        const { result } = renderHook(() => usePushNotifications());

        await waitFor(() => {
          expect(result.current.isGranted).toBe(false);
        });
      });
    });
  });

  describe('return value structure', () => {
    it('should return all expected properties', async () => {
      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).toHaveProperty('supported');
      expect(result.current).toHaveProperty('permission');
      expect(result.current).toHaveProperty('subscribed');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('subscribe');
      expect(result.current).toHaveProperty('unsubscribe');
      expect(result.current).toHaveProperty('refreshStatus');
      expect(result.current).toHaveProperty('canSubscribe');
      expect(result.current).toHaveProperty('isDenied');
      expect(result.current).toHaveProperty('isGranted');
    });

    it('should return functions for subscribe, unsubscribe, refreshStatus', async () => {
      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.unsubscribe).toBe('function');
      expect(typeof result.current.refreshStatus).toBe('function');
    });
  });
});

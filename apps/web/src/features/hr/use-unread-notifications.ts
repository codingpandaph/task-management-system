import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function useUnreadNotifications(userId?: string) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const refresh = () =>
      void api<{ count: number }>('notifications/unread-count')
        .then(({ count }) => setUnread(count))
        .catch(() => setUnread(0));
    window.addEventListener('notifications:changed', refresh);
    refresh();
    return () => window.removeEventListener('notifications:changed', refresh);
  }, [userId]);
  return unread;
}

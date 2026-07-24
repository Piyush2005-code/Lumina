import { X } from 'lucide-react';
import type { Notification } from '../types';
import styles from './NotifDrawer.module.css';

interface Props {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

const ICONS: Record<string, React.ReactNode> = {
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  warning: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  error: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
};

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

export default function NotifDrawer({ notifications, onDismiss, onClearAll }: Props) {
  return (
    <div className={styles.drawer}>
      <div className={styles.header}>
        <span className={styles.title}>Notifications</span>
        <button className={styles.clearBtn} onClick={onClearAll}>Clear all</button>
      </div>
      <div className={styles.list}>
        {notifications.length === 0 && (
          <div className={styles.empty}>No notifications</div>
        )}
        {notifications.map(n => (
          <div key={n.id} className={styles.item}>
            <span className={`${styles.icon} ${styles[n.type]}`}>{ICONS[n.type]}</span>
            <div className={styles.body}>
              <div className={styles.itemTitle}>{n.title}</div>
              <div className={styles.itemMsg}>{n.message}</div>
              <div className={styles.itemTime}>{timeAgo(n.ts)}</div>
            </div>
            <button className={styles.dismiss} onClick={() => onDismiss(n.id)}><X size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

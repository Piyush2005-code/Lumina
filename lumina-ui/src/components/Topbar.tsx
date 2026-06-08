import { Bell, Settings } from 'lucide-react';
import styles from './Topbar.module.css';

interface Props {
  unreadCount: number;
  notifDrawerOpen: boolean;
  onToggleNotif: () => void;
  onToggleSettings: () => void;
  sessionTitle: string;
}

export default function Topbar({ unreadCount, onToggleNotif, onToggleSettings, sessionTitle }: Props) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <img src="/logo.png" alt="Lumina" className={styles.logoImg} />
          <span className={styles.logoText}>Lumina</span>
        </div>
        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbItem}>Workspace</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={`${styles.breadcrumbItem} ${styles.active}`}>{sessionTitle}</span>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.statusPill}>
          <span className={styles.statusDot} />
          <span>Running</span>
        </div>
        <button className={styles.iconBtn} onClick={onToggleNotif}>
          <Bell size={16} />
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </button>
        <button className={styles.iconBtn} onClick={onToggleSettings}>
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

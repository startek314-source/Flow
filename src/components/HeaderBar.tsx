'use client';

import { Bell, Search, Settings, Share2 } from 'lucide-react';

interface HeaderBarProps {
  title: string;
  showSearch?: boolean;
  showSettings?: boolean;
  showShare?: boolean;
  showNotification?: boolean;
  onSearchClick?: () => void;
  onSettingsClick?: () => void;
  onShareClick?: () => void;
  onNotificationClick?: () => void;
  rightElement?: React.ReactNode;
  subtitle?: string;
}

export default function HeaderBar({
  title,
  showSearch = false,
  showSettings = false,
  showShare = false,
  showNotification = false,
  onSearchClick,
  onSettingsClick,
  onShareClick,
  onNotificationClick,
  rightElement,
  subtitle,
}: HeaderBarProps) {
  return (
    <header className="app-header">
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {showSearch && (
          <button className="btn btn-ghost btn-icon" onClick={onSearchClick} aria-label="検索">
            <Search size={20} />
          </button>
        )}
        {showShare && (
          <button className="btn btn-ghost btn-icon" onClick={onShareClick} aria-label="Flow Share">
            <Share2 size={20} />
          </button>
        )}
        {showNotification && (
          <button className="btn btn-ghost btn-icon" onClick={onNotificationClick} aria-label="通知">
            <Bell size={20} />
          </button>
        )}
        {showSettings && (
          <button className="btn btn-ghost btn-icon" onClick={onSettingsClick} aria-label="設定">
            <Settings size={20} />
          </button>
        )}
        {rightElement}
      </div>
    </header>
  );
}

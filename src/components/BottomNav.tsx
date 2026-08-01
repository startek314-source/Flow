'use client';

import { Home, FileText, Calendar, MessageSquare, Share2, Settings } from 'lucide-react';

export type TabId = 'home' | 'notes' | 'schedule' | 'chat' | 'share' | 'settings';

interface NavItem {
  id: TabId;
  icon: React.ElementType;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: Home, label: 'ホーム' },
  { id: 'notes', icon: FileText, label: 'メモ' },
  { id: 'schedule', icon: Calendar, label: '予定' },
  { id: 'chat', icon: MessageSquare, label: 'チャット' },
  { id: 'share', icon: Share2, label: 'Flow Share' },
  { id: 'settings', icon: Settings, label: '設定' },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`nav-item ${activeTab === id ? 'active' : ''}`}
          onClick={() => onTabChange(id)}
          aria-label={label}
          aria-current={activeTab === id ? 'page' : undefined}
        >
          <Icon
            size={22}
            strokeWidth={activeTab === id ? 2.5 : 1.8}
            style={{ transition: 'var(--transition)' }}
          />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

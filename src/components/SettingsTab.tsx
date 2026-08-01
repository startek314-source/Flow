'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Bell, User, Info, ChevronRight, Check, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
import { getProfile, saveProfile, type UserProfile } from '@/lib/db';
import { requestNotificationPermission, getNotificationPermission } from '@/lib/notifications';

interface SettingsTabProps {
  profile: UserProfile | null;
  onProfileUpdate: (profile: UserProfile) => void;
}

type ThemeOption = 'light' | 'dark' | 'auto';

export default function SettingsTab({ profile, onProfileUpdate }: SettingsTabProps) {
  const [name, setName] = useState(profile?.name || '');
  const [theme, setTheme] = useState<ThemeOption>(profile?.theme || 'auto');
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const [isSaving, setIsSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    const updated: UserProfile = { ...profile, name: name.trim() || profile.name, theme };
    await saveProfile(updated);
    onProfileUpdate(updated);
    setSavedMsg('保存しました ✓');
    setIsSaving(false);
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const handleThemeChange = (t: ThemeOption) => {
    setTheme(t);
    localStorage.setItem('flow-theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (t === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleRequestNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    if (profile) {
      const updated = { ...profile, notificationsEnabled: granted };
      await saveProfile(updated);
      onProfileUpdate(updated);
    }
  };

  const handleClearData = async () => {
    const dbs = await indexedDB.databases?.();
    if (dbs) {
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    }
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div style={{ padding: '0 16px', paddingTop: 12, paddingBottom: 32 }}>
      {/* Profile Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--accent), var(--purple))',
          borderRadius: 'var(--radius-xl)',
          padding: '20px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: 'white',
          }}>
            {name.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{name || 'ユーザー'}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              {new Date(profile?.createdAt || Date.now()).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} から使用中
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="お名前"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {savedMsg || (isSaving ? '...' : '保存')}
          </button>
        </div>
      </div>

      {/* Theme */}
      <section style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          テーマ
        </p>
        <div className="card" style={{ padding: 4, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {([
            { id: 'light', icon: Sun, label: 'ライト' },
            { id: 'dark', icon: Moon, label: 'ダーク' },
            { id: 'auto', icon: Monitor, label: '自動' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => handleThemeChange(id)} style={{
              padding: '10px 8px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              background: theme === id ? 'var(--accent)' : 'transparent',
              color: theme === id ? 'white' : 'var(--text-secondary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
              transition: 'var(--transition)',
            }}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          通知
        </p>
        <div className={`permission-card ${notifPermission === 'granted' ? 'granted' : notifPermission === 'denied' ? 'denied' : ''}`}
          onClick={notifPermission === 'default' ? handleRequestNotif : undefined}
          style={{ cursor: notifPermission === 'default' ? 'pointer' : 'default' }}
        >
          <div className="perm-icon">
            <Bell size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>プッシュ通知</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {notifPermission === 'granted' ? '有効' : notifPermission === 'denied' ? 'ブラウザ設定から許可してください' : 'タップして有効化'}
            </p>
          </div>
          {notifPermission === 'granted' && <Check size={18} style={{ color: 'var(--success)' }} />}
          {notifPermission === 'denied' && <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />}
          {notifPermission === 'default' && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
              有効にする
            </div>
          )}
        </div>
      </section>

      {/* Info */}
      <section style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          アプリ情報
        </p>
        <div className="card" style={{ padding: '4px 0' }}>
          {[
            { label: 'バージョン', value: '1.0.0' },
            { label: 'オフライン対応', value: '完全対応' },
            { label: 'データ保存', value: 'デバイス内のみ' },
            { label: '通信', value: 'なし（完全ローカル）' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderBottom: '1px solid var(--divider)',
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          危険ゾーン
        </p>
        {!showClearConfirm ? (
          <button className="btn btn-danger w-full" style={{ justifyContent: 'center', height: 44 }} onClick={() => setShowClearConfirm(true)}>
            <Trash2 size={16} /> すべてのデータをクリア
          </button>
        ) : (
          <div className="card" style={{ padding: '14px 16px', borderColor: 'var(--danger)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>⚠️ 本当に削除しますか？</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              すべてのメモ・スケジュール・設定が削除されます。この操作は取り消せません。
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowClearConfirm(false)}>キャンセル</button>
              <button className="btn btn-danger" style={{ flex: 2, justifyContent: 'center' }} onClick={handleClearData}>削除する</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

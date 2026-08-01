'use client';

import { useState, useEffect } from 'react';
import { Bell, User, ChevronRight, Check, X } from 'lucide-react';
import { getProfile, saveProfile, type UserProfile, generateId } from '@/lib/db';
import { requestNotificationPermission, getNotificationPermission } from '@/lib/notifications';

interface OnboardingModalProps {
  onComplete: (profile: UserProfile) => void;
}

type Step = 'welcome' | 'permissions' | 'profile';

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [notifStatus, setNotifStatus] = useState<string>('default');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setNotifStatus(getNotificationPermission());
  }, []);

  const handleRequestNotification = async () => {
    const granted = await requestNotificationPermission();
    setNotifStatus(granted ? 'granted' : 'denied');
  };

  const handleComplete = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    const profile: UserProfile = {
      id: generateId(),
      name: name.trim(),
      notificationsEnabled: notifStatus === 'granted',
      theme: 'auto',
      onboardingCompleted: true,
      createdAt: Date.now(),
    };
    await saveProfile(profile);
    setIsLoading(false);
    onComplete(profile);
  };

  return (
    <div className="modal-backdrop" style={{ alignItems: 'center' }}>
      <div className="modal-center" style={{ maxWidth: 420, width: 'calc(100% - 32px)' }}>
        {step === 'welcome' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #60a5fa, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(96,165,250,0.4)',
            }}>
              <img src="/icons/icon.svg" alt="Flow" style={{ width: 52, height: 52, objectFit: 'contain' }} />
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
              Flow へようこそ！
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 28 }}>
              メモ、スケジュール、Flow Share を備えた<br />
              あなただけのプレミアムアプリです。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              {[
                { icon: '📝', label: '高機能メモ' },
                { icon: '🔔', label: 'アラーム通知' },
                { icon: '📅', label: 'スケジュール' },
                { icon: '📤', label: 'Flow Share' },
              ].map((f) => (
                <div key={f.label} style={{
                  background: 'var(--bg-dim)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{ fontSize: 24 }}>{f.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{f.label}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary w-full" style={{ height: 48 }} onClick={() => setStep('permissions')}>
              はじめる
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 'permissions' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
              権限の設定
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Flow をフル活用するために以下の権限を有効にしてください。
            </p>

            {/* Notification permission */}
            <div
              className={`permission-card ${notifStatus === 'granted' ? 'granted' : notifStatus === 'denied' ? 'denied' : ''}`}
              onClick={notifStatus !== 'granted' && notifStatus !== 'denied' ? handleRequestNotification : undefined}
              style={{ marginBottom: 12, cursor: notifStatus === 'granted' || notifStatus === 'denied' ? 'default' : 'pointer' }}
            >
              <div className="perm-icon">
                <Bell size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>通知を許可</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  アラームやスケジュールリマインダーに必要です
                </p>
              </div>
              <div style={{ flexShrink: 0 }}>
                {notifStatus === 'granted' && <Check size={18} style={{ color: 'var(--success)' }} />}
                {notifStatus === 'denied' && <X size={18} style={{ color: 'var(--danger)' }} />}
                {notifStatus === 'default' && (
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                    background: 'var(--accent-subtle)', padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                  }}>有効にする</div>
                )}
              </div>
            </div>

            {notifStatus === 'denied' && (
              <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)' }}>
                通知が拒否されています。ブラウザの設定から許可してください。アラーム機能は制限されます。
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep('profile')}>
                スキップ
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep('profile')}>
                次へ
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 'profile' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
              あなたのお名前は？
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Flow であなたへの挨拶に使用します。
            </p>

            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <User size={28} color="white" />
            </div>

            <input
              className="input"
              type="text"
              placeholder="お名前を入力してください"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleComplete()}
              maxLength={24}
              autoFocus
              style={{ marginBottom: 20, textAlign: 'center', fontSize: 18, fontWeight: 600 }}
            />

            <button
              className="btn btn-primary w-full"
              style={{ height: 48, opacity: name.trim() ? 1 : 0.5 }}
              onClick={handleComplete}
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? 'セットアップ中...' : 'Flow を始める 🚀'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

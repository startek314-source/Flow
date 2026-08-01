'use client';

import { useEffect, useState } from 'react';

type OS = 'ios' | 'android' | 'windows' | 'mac' | 'other';

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'mac';
  return 'other';
}

function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

interface InstallStepsProps {
  os: OS;
}

function InstallSteps({ os }: InstallStepsProps) {
  if (os === 'ios') {
    return (
      <div className="install-card">
        <p style={{ marginBottom: 16, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
          Flow は PWA アプリです。Safari でホーム画面に追加してからご利用ください。
        </p>
        {[
          { icon: '🧭', text: 'Safari でこのページを開いてください（Chrome 不可）' },
          { icon: '⬆️', text: '画面下部の 共有アイコン（□から矢印） をタップします' },
          { icon: '➕', text: 'メニューから「ホーム画面に追加」を選択します' },
          { icon: '✅', text: '右上の「追加」をタップすると完了です！' },
        ].map((step, i) => (
          <div key={i} className="install-step">
            <div className="step-num">{i + 1}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{step.icon}</span>
              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (os === 'android') {
    return (
      <div className="install-card">
        <p style={{ marginBottom: 16, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
          Chrome でホーム画面に追加してご利用ください。
        </p>
        {[
          { icon: '🌐', text: 'Chrome でこのページを開いてください' },
          { icon: '⋮', text: '右上のメニュー（縦三点）をタップします' },
          { icon: '📲', text: '「ホーム画面に追加」を選択します' },
          { icon: '✅', text: '「追加」をタップすると完了です！' },
        ].map((step, i) => (
          <div key={i} className="install-step">
            <div className="step-num">{i + 1}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{step.icon}</span>
              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (os === 'windows') {
    return (
      <div className="install-card">
        <p style={{ marginBottom: 16, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
          Chrome または Edge でインストールしてご利用ください。
        </p>
        {[
          { icon: '🖥️', text: 'Chrome または Edge でこのページを開きます' },
          { icon: '📌', text: 'アドレスバー右端の「インストール」アイコン（＋）をクリック' },
          { icon: '✅', text: '「インストール」ボタンをクリックすると完了です！' },
          { icon: '💻', text: 'デスクトップまたはスタートメニューから Flow を起動できます' },
        ].map((step, i) => (
          <div key={i} className="install-step">
            <div className="step-num">{i + 1}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{step.icon}</span>
              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (os === 'mac') {
    return (
      <div className="install-card">
        <p style={{ marginBottom: 16, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
          Safari または Chrome でインストールしてご利用ください。
        </p>
        {[
          { icon: '🧭', text: 'Safari の場合: 「ファイル」→「Dock に追加」を選択' },
          { icon: '🌐', text: 'Chrome の場合: アドレスバー右の「⊕」アイコンをクリック' },
          { icon: '✅', text: '「インストール」をクリックすると完了です！' },
          { icon: '🍎', text: 'Dock またはアプリフォルダから Flow を起動できます' },
        ].map((step, i) => (
          <div key={i} className="install-step">
            <div className="step-num">{i + 1}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{step.icon}</span>
              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="install-card">
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        お使いのブラウザの「ホーム画面に追加」または「アプリをインストール」機能をご利用ください。
      </p>
    </div>
  );
}

interface PwaInstallGuardProps {
  children: React.ReactNode;
}

export default function PwaInstallGuard({ children }: PwaInstallGuardProps) {
  const [hydrated, setHydrated] = useState(false);
  const [isPwa, setIsPwa] = useState(false);
  const [os, setOs] = useState<OS>('other');

  useEffect(() => {
    setHydrated(true);
    setIsPwa(isPWA());
    setOs(detectOS());
  }, []);

  if (!hydrated) {
    return (
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100dvh' }} />
    );
  }

  if (!isPwa) {
    return (
      <div className="install-screen">
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <img src="/icons/icon.svg" alt="Flow" style={{ width: 60, height: 60, objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>
            Flow
          </h1>
          <p style={{ fontSize: 15, opacity: 0.85, fontWeight: 400 }}>
            アプリとしてインストールしてください。
          </p>
        </div>

        {/* OS Detection Badge */}
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 8,
          padding: '6px 14px',
          marginBottom: 20,
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>{os === 'ios' ? '🍎 iOS' : os === 'android' ? '🤖 Android' : os === 'windows' ? '🪟 Windows' : os === 'mac' ? '🍎 macOS' : '💻 デスクトップ'}</span>
          <span style={{ opacity: 0.7 }}>向けの手順</span>
        </div>

        <InstallSteps os={os} />

        <p style={{ marginTop: 24, fontSize: 12, opacity: 0.6, textAlign: 'center', lineHeight: 1.6 }}>
          Flow はオフラインで動作するプレミアムアプリです。<br />
          インストール後にすべての機能をご利用いただけます。
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

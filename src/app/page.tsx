'use client';

import { useState, useEffect, useCallback } from 'react';
import PwaInstallGuard from '@/components/PwaInstallGuard';
import OnboardingModal from '@/components/OnboardingModal';
import BottomNav, { type TabId } from '@/components/BottomNav';
import HeaderBar from '@/components/HeaderBar';
import HomeTab from '@/components/HomeTab';
import NotesTab from '@/components/NotesTab';
import ScheduleTab from '@/components/ScheduleTab';
import FlowShareModal from '@/components/FlowShareModal';
import SettingsTab from '@/components/SettingsTab';
import RichNoteEditor from '@/components/RichNoteEditor';
import { getProfile, saveNote, createNote, type UserProfile, type Note, type Schedule } from '@/lib/db';
import { registerServiceWorker, startAlarmScheduler } from '@/lib/notifications';
import type { FlowSharePayload } from '@/lib/flowShare';

export default function FlowApp() {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showFlowShare, setShowFlowShare] = useState(false);
  const [shareNotes, setShareNotes] = useState<Note[]>([]);
  const [shareSchedules, setShareSchedules] = useState<Schedule[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    registerServiceWorker();
    startAlarmScheduler();

    getProfile().then((p) => {
      if (p && p.onboardingCompleted) {
        setProfile(p);
        // Apply theme
        const savedTheme = localStorage.getItem('flow-theme') || p.theme;
        if (savedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (savedTheme === 'light') {
          document.documentElement.classList.remove('dark');
        }
      } else {
        setShowOnboarding(true);
      }
      setIsReady(true);
    });

    // Handle tab from URL
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabId | null;
    if (tab) setActiveTab(tab);
    const action = params.get('action');
    if (action === 'new') handleNewNote();
  }, []);

  const handleNewNote = async () => {
    const note = createNote({ blocks: [{ type: 'body', text: '' }] });
    await saveNote(note);
    setEditingNote(note);
    refresh();
  };

  const handleOpenNote = (note: Note) => {
    setEditingNote(note);
  };

  const handleNoteUpdate = (updated: Note) => {
    refresh();
  };

  const handleFlowShareNotes = (notes: Note[]) => {
    setShareNotes(notes);
    setShareSchedules([]);
    setShowFlowShare(true);
  };

  const handleFlowShareSchedules = (schedules: Schedule[]) => {
    setShareSchedules(schedules);
    setShareNotes([]);
    setShowFlowShare(true);
  };

  const handleImport = async (payload: FlowSharePayload) => {
    try {
      if (payload.notes && payload.notes.length > 0) {
        for (const note of payload.notes) {
          if (!note || !note.id) continue;
          await saveNote({ ...note, id: note.id + '-imp-' + Date.now().toString(36), createdAt: Date.now(), updatedAt: Date.now() });
        }
      }
      if (payload.schedules && payload.schedules.length > 0) {
        const { saveSchedule } = await import('@/lib/db');
        for (const sched of payload.schedules) {
          if (!sched || !sched.id) continue;
          await saveSchedule({ ...sched, id: sched.id + '-imp-' + Date.now().toString(36), updatedAt: Date.now() });
        }
      }
      refresh();
    } catch (err) {
      console.error('Import error:', err);
      refresh();
    }
  };

  if (!isReady) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #60a5fa 0%, #6366f1 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/icons/icon.svg" alt="Flow" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        </div>
        <div style={{ width: 120, height: 3, background: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'white', animation: 'shimmer 1.2s ease infinite', width: '60%' }} />
        </div>
      </div>
    );
  }

  return (
    <PwaInstallGuard>
      {showOnboarding && (
        <OnboardingModal
          onComplete={(p) => {
            setProfile(p);
            setShowOnboarding(false);
          }}
        />
      )}

      {editingNote && (
        <RichNoteEditor
          note={editingNote}
          onBack={() => { setEditingNote(null); refresh(); }}
          onUpdate={handleNoteUpdate}
        />
      )}

      <div className="app-shell">
        {/* Header */}
        <HeaderBar
          title={
            activeTab === 'home' ? 'Flow' :
            activeTab === 'notes' ? 'メモ' :
            activeTab === 'schedule' ? 'スケジュール' :
            activeTab === 'share' ? 'Flow Share' :
            '設定'
          }
          showSearch={activeTab === 'notes'}
          showShare={activeTab === 'home' || activeTab === 'notes' || activeTab === 'schedule'}
          showSettings={activeTab === 'home'}
          onShareClick={() => { setShareNotes([]); setShareSchedules([]); setShowFlowShare(true); }}
          onSettingsClick={() => setActiveTab('settings')}
          rightElement={
            (activeTab === 'notes' || activeTab === 'home') ? (
              <button
                className="fab"
                style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
                onClick={handleNewNote}
                aria-label="新しいメモ"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            ) : null
          }
        />

        {/* Tab Content */}
        <div className="app-content">
          {activeTab === 'home' && (
            <div key="home" className="tab-content-container">
              <HomeTab
                profile={profile}
                onOpenNote={handleOpenNote}
                onNewNote={handleNewNote}
                onTabChange={(tab) => setActiveTab(tab)}
                onFlowShare={handleFlowShareNotes}
                refreshKey={refreshKey}
              />
            </div>
          )}
          {activeTab === 'notes' && (
            <div key="notes" className="tab-content-container">
              <NotesTab
                onOpenNote={handleOpenNote}
                onNewNote={handleNewNote}
                onFlowShare={handleFlowShareNotes}
                refreshKey={refreshKey}
              />
            </div>
          )}
          {activeTab === 'schedule' && (
            <div key="schedule" className="tab-content-container">
              <ScheduleTab
                onFlowShare={handleFlowShareSchedules}
                refreshKey={refreshKey}
              />
            </div>
          )}
          {activeTab === 'share' && (
            <div key="share" className="tab-content-container">
              <div style={{ padding: '20px 16px' }}>
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 20,
                    background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                    boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Flow Share</h2>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                    QRコードまたはBluetoothでメモとスケジュールを<br />オフラインで共有できます
                  </p>
                  <button className="btn btn-primary" style={{ height: 50, fontSize: 15, marginBottom: 12, width: '100%', maxWidth: 280 }}
                    onClick={() => { setShareNotes([]); setShareSchedules([]); setShowFlowShare(true); }}>
                    Flow Share を開始
                  </button>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    メモタブやスケジュールタブで選択してから共有もできます
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div key="settings" className="tab-content-container">
              <SettingsTab
                profile={profile}
                onProfileUpdate={(p) => { setProfile(p); refresh(); }}
              />
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Flow Share Modal */}
      {showFlowShare && (
        <FlowShareModal
          preselectedNotes={shareNotes}
          preselectedSchedules={shareSchedules}
          onClose={() => { setShowFlowShare(false); setShareNotes([]); setShareSchedules([]); }}
          onImport={handleImport}
        />
      )}
    </PwaInstallGuard>
  );
}

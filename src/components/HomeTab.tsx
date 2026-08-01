'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Bell, Calendar, FileText, Clock, Star, Sparkles, ChevronRight, Share2, Trash2 } from 'lucide-react';
import { getNotes, getSchedules, getAlarms, type Note, type Schedule, type Alarm, type UserProfile } from '@/lib/db';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
}

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;
  return formatDate(ts);
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは';
  return `${greeting}、${name}！`;
}

interface HomeTabProps {
  profile: UserProfile | null;
  onOpenNote: (note: Note) => void;
  onNewNote: () => void;
  onTabChange: (tab: 'notes' | 'schedule' | 'share') => void;
  onFlowShare?: (notes: Note[]) => void;
  refreshKey: number;
}

export default function HomeTab({ profile, onOpenNote, onNewNote, onTabChange, onFlowShare, refreshKey }: HomeTabProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [n, s, a] = await Promise.all([getNotes(), getSchedules(), getAlarms()]);
    setNotes(n.filter((x) => !x.deletedAt));
    setSchedules(s);
    setAlarms(a.filter((x) => !x.fired));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const today = new Date();
  const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  const todaySchedules = schedules.filter((s) => {
    return s.startAt >= todayStart.getTime() && s.startAt <= todayEnd.getTime();
  }).sort((a, b) => a.startAt - b.startAt);

  const upcomingAlarms = alarms
    .filter((a) => a.scheduledAt > Date.now())
    .sort((a, b) => a.scheduledAt - b.scheduledAt)
    .slice(0, 3);

  const recentNotes = notes
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  const pinnedNotes = notes.filter((n) => n.pinned).slice(0, 3);
  const favoriteNotes = notes.filter((n) => n.favorite).slice(0, 3);

  const totalNotes = notes.length;
  const totalSchedules = schedules.length;
  const totalAlarms = alarms.length;

  return (
    <div style={{ padding: '0 16px', paddingTop: 12, paddingBottom: 20 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
          {profile ? getGreeting(profile.name) : 'Flow へようこそ！'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { icon: FileText, value: totalNotes, label: 'メモ', color: 'var(--accent)', bg: 'var(--accent-subtle)', onClick: () => onTabChange('notes') },
          { icon: Calendar, value: totalSchedules, label: '予定', color: 'var(--purple)', bg: 'rgba(139,92,246,0.08)', onClick: () => onTabChange('schedule') },
          { icon: Bell, value: totalAlarms, label: 'アラーム', color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)', onClick: () => {} },
        ].map(({ icon: Icon, value, label, color, bg, onClick }) => (
          <button key={label} onClick={onClick} style={{
            background: bg, borderRadius: 'var(--radius-lg)', padding: '14px 12px',
            border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            transition: 'var(--transition)',
          }}>
            <Icon size={20} style={{ color }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        <button
          className="btn btn-primary"
          style={{ height: 50, fontSize: 14, borderRadius: 'var(--radius-lg)' }}
          onClick={onNewNote}
        >
          <Plus size={18} /> 新しいメモ
        </button>
        <button
          className="btn"
          style={{
            height: 50, fontSize: 14, borderRadius: 'var(--radius-lg)',
            background: 'rgba(139,92,246,0.08)', color: 'var(--purple)',
            border: '1px solid rgba(139,92,246,0.2)',
          }}
          onClick={() => onTabChange('schedule')}
        >
          <Calendar size={18} /> 予定を追加
        </button>
      </div>

      {/* Today's schedules */}
      {todaySchedules.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={15} style={{ color: 'var(--purple)' }} />
              今日の予定
            </h3>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onTabChange('schedule')}>
              すべて見る <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todaySchedules.map((s) => (
              <div key={s.id} className="card" style={{
                padding: '10px 14px',
                borderLeft: `3px solid ${s.color || 'var(--purple)'}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</p>
                  {!s.allDay && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(s.startAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                {s.category && <span className="chip" style={{ fontSize: 10, padding: '2px 7px', flexShrink: 0 }}>{s.category}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming alarms */}
      {upcomingAlarms.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Bell size={15} style={{ color: 'var(--danger)' }} />
            次のアラーム
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingAlarms.map((a) => (
              <div key={a.id} style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Bell size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(a.scheduledAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pinned notes */}
      {pinnedNotes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            📌 ピン留めのメモ
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pinnedNotes.map((n) => (
              <NotePreviewCard
                key={n.id}
                note={n}
                isSelected={selectedNoteIds.has(n.id)}
                onClick={() => {
                  if (selectedNoteIds.size > 0) {
                    setSelectedNoteIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
                      return next;
                    });
                  } else {
                    onOpenNote(n);
                  }
                }}
                onLongPress={() => {
                  setSelectedNoteIds((prev) => {
                    const next = new Set(prev);
                    next.add(n.id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent notes */}
      {recentNotes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} style={{ color: 'var(--accent)' }} />
              最近のメモ
            </h3>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onTabChange('notes')}>
              すべて見る <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentNotes.map((n) => (
              <NotePreviewCard
                key={n.id}
                note={n}
                isSelected={selectedNoteIds.has(n.id)}
                onClick={() => {
                  if (selectedNoteIds.size > 0) {
                    setSelectedNoteIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
                      return next;
                    });
                  } else {
                    onOpenNote(n);
                  }
                }}
                onLongPress={() => {
                  setSelectedNoteIds((prev) => {
                    const next = new Set(prev);
                    next.add(n.id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Selected multi-select action bar */}
      {selectedNoteIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)',
          left: 16, right: 16, zIndex: 100,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {selectedNoteIds.size}件 選択中
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onFlowShare && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '6px 14px', gap: 6 }}
                onClick={() => {
                  const selNotes = notes.filter((n) => selectedNoteIds.has(n.id));
                  onFlowShare(selNotes);
                  setSelectedNoteIds(new Set());
                }}
              >
                <Share2 size={14} /> Flow Share
              </button>
            )}
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setSelectedNoteIds(new Set())}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {notes.length === 0 && schedules.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Sparkles size={48} style={{ margin: '0 auto 16px', color: 'var(--accent)', opacity: 0.5 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Flow を始めましょう！</p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>メモやスケジュールを作成してみてください</p>
          <button className="btn btn-primary" onClick={onNewNote}>
            <Plus size={16} /> 最初のメモを作成
          </button>
        </div>
      )}
    </div>
  );
}

function NotePreviewCard({ note, isSelected, onClick, onLongPress }: { note: Note; isSelected?: boolean; onClick: () => void; onLongPress?: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      if (onLongPress) onLongPress();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const preview = note.blocks.map((b) => {
    if ('text' in b && typeof b.text === 'string') return b.text;
    if (b.type === 'checklist') return b.items.map((i) => i.text).join(' ');
    return '';
  }).join(' ').slice(0, 80);

  return (
    <div className="card card-hover" style={{
      padding: '12px 14px',
      borderLeft: note.color ? `3px solid ${note.color}` : '1px solid var(--border)',
      background: note.color ? `linear-gradient(135deg, ${note.color}08, var(--bg-surface))` : 'var(--bg-surface)',
      outline: isSelected ? '2px solid var(--accent)' : 'none',
      cursor: 'pointer',
      position: 'relative',
    }}
    onClick={onClick}
    onTouchStart={handleTouchStart}
    onTouchEnd={handleTouchEnd}
    onTouchMove={handleTouchEnd}
    onMouseDown={handleTouchStart}
    onMouseUp={handleTouchEnd}
    onMouseLeave={handleTouchEnd}
    >
      {isSelected && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }} className="truncate">
        {note.title || '（タイトルなし）'}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }} className="truncate">
        {note.locked ? '🔒 ロックされています' : preview || '（内容なし）'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {new Date(note.updatedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        {note.favorite && <Star size={10} style={{ color: 'var(--warning)' }} />}
        {note.alarms.some((a) => !a.fired) && <Bell size={10} style={{ color: 'var(--danger)' }} />}
      </div>
    </div>
  );
}

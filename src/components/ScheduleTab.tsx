'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Bell, MapPin, Link, Repeat, Users, Clock, Tag, AlignLeft, Star, Palette, Share2, Trash2 } from 'lucide-react';
import { getSchedules, saveSchedule, deleteSchedule, createSchedule, type Schedule } from '@/lib/db';
import { scheduleAlarm, generateId as alarmId } from '@/lib/notifications';

type CalView = 'month' | 'week' | 'day';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const CATEGORIES = ['個人', '仕事', '家族', '健康', '趣味', 'その他'];
const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316'];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

interface ScheduleFormProps {
  schedule?: Schedule;
  initialDate?: Date;
  onSave: (s: Schedule) => void;
  onClose: () => void;
  onDelete?: () => void;
}

function ScheduleForm({ schedule, initialDate, onSave, onClose, onDelete }: ScheduleFormProps) {
  const base = schedule || createSchedule({ startAt: initialDate?.getTime() || Date.now() });

  const [title, setTitle] = useState(base.title);
  const [notifTitle, setNotifTitle] = useState(base.notificationTitle || '');
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(base.startAt);
    return d.toISOString().slice(0, 16);
  });
  const [endAt, setEndAt] = useState(() => {
    const d = base.endAt ? new Date(base.endAt) : new Date(base.startAt + 3600000);
    return d.toISOString().slice(0, 16);
  });
  const [allDay, setAllDay] = useState(base.allDay || false);
  const [description, setDescription] = useState(base.description || '');
  const [location, setLocation] = useState(base.location || '');
  const [url, setUrl] = useState(base.url || '');
  const [attendees, setAttendees] = useState(base.attendees?.join(', ') || '');
  const [reminderMin, setReminderMin] = useState(base.reminders?.[0]?.toString() || '10');
  const [repeat, setRepeat] = useState<Schedule['repeat']>(base.repeat || 'none');
  const [category, setCategory] = useState(base.category || '個人');
  const [priority, setPriority] = useState<Schedule['priority']>(base.priority || 'medium');
  const [color, setColor] = useState(base.color || '#3b82f6');
  const [status, setStatus] = useState<Schedule['status']>(base.status || 'confirmed');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    const s: Schedule = {
      ...base,
      title: title.trim(),
      notificationTitle: notifTitle,
      startAt: new Date(startAt).getTime(),
      endAt: endAt ? new Date(endAt).getTime() : undefined,
      allDay,
      description,
      location,
      url,
      attendees: attendees.split(',').map((a) => a.trim()).filter(Boolean),
      reminders: reminderMin ? [parseInt(reminderMin)] : [],
      repeat,
      category,
      priority,
      color,
      status,
      updatedAt: Date.now(),
    };
    onSave(s);
    setIsSaving(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {schedule ? 'スケジュールを編集' : '新しいスケジュール'}
            </h3>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Color picker */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 26, height: 26, borderRadius: '50%', background: c,
                border: color === c ? `3px solid var(--text-primary)` : '2px solid transparent',
                cursor: 'pointer',
              }} />
            ))}
          </div>

          <input className="input" placeholder="タイトル *" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 10, borderLeft: `3px solid ${color}` }} autoFocus />
          <input className="input" placeholder="通知タイトル" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} style={{ marginBottom: 10 }} />

          {/* Date/Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <label className="toggle">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>終日</span>
          </div>

          {!allDay && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>開始</label>
                <input className="input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={{ fontSize: 13, padding: '8px 10px' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>終了</label>
                <input className="input" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} style={{ fontSize: 13, padding: '8px 10px' }} />
              </div>
            </div>
          )}
          {allDay && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>開始日</label>
                <input className="input" type="date" value={startAt.slice(0, 10)} onChange={(e) => setStartAt(e.target.value + 'T00:00')} style={{ fontSize: 13, padding: '8px 10px' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>終了日</label>
                <input className="input" type="date" value={endAt.slice(0, 10)} onChange={(e) => setEndAt(e.target.value + 'T23:59')} style={{ fontSize: 13, padding: '8px 10px' }} />
              </div>
            </div>
          )}

          {/* Details row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>カテゴリ</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '8px 10px', fontSize: 13 }}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>優先度</label>
              <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Schedule['priority'])} style={{ padding: '8px 10px', fontSize: 13 }}>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>繰り返し</label>
              <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value as Schedule['repeat'])} style={{ padding: '8px 10px', fontSize: 13 }}>
                <option value="none">なし</option>
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
                <option value="monthly">毎月</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ステータス</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value as Schedule['status'])} style={{ padding: '8px 10px', fontSize: 13 }}>
                <option value="confirmed">確定</option>
                <option value="tentative">仮</option>
                <option value="cancelled">キャンセル</option>
              </select>
            </div>
          </div>

          <input className="input" placeholder="📍 場所" value={location} onChange={(e) => setLocation(e.target.value)} style={{ marginBottom: 8, fontSize: 14 }} />
          <input className="input" placeholder="🔗 URL" value={url} onChange={(e) => setUrl(e.target.value)} style={{ marginBottom: 8, fontSize: 14 }} type="url" />
          <input className="input" placeholder="👥 参加者（カンマ区切り）" value={attendees} onChange={(e) => setAttendees(e.target.value)} style={{ marginBottom: 8, fontSize: 14 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Bell size={15} style={{ color: 'var(--text-muted)' }} />
            <select className="select" value={reminderMin} onChange={(e) => setReminderMin(e.target.value)} style={{ fontSize: 13, padding: '8px 10px' }}>
              <option value="">リマインドなし</option>
              <option value="5">5分前</option>
              <option value="10">10分前</option>
              <option value="30">30分前</option>
              <option value="60">1時間前</option>
              <option value="1440">1日前</option>
            </select>
          </div>

          <textarea className="input" placeholder="📝 メモ" value={description} onChange={(e) => setDescription(e.target.value)} style={{ marginBottom: 16, resize: 'none', minHeight: 60, fontSize: 14 }} rows={2} />

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {schedule && onDelete && (
              <button className="btn btn-danger btn-icon" onClick={onDelete} style={{ width: 44, height: 44 }}>
                <Trash2 size={16} />
              </button>
            )}
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={!title.trim() || isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ScheduleTabProps {
  onFlowShare: (schedules: Schedule[]) => void;
  refreshKey: number;
}

export default function ScheduleTab({ onFlowShare, refreshKey }: ScheduleTabProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [view, setView] = useState<CalView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadSchedules = useCallback(async () => {
    const all = await getSchedules();
    setSchedules(all);
  }, []);

  useEffect(() => { loadSchedules(); }, [loadSchedules, refreshKey]);

  const handleSave = async (s: Schedule) => {
    await saveSchedule(s);
    if (s.reminders && s.reminders.length > 0 && s.notificationTitle) {
      const remMs = s.reminders[0] * 60000;
      const alarm = {
        id: alarmId(),
        noteId: s.id,
        text: s.title,
        title: s.notificationTitle || s.title,
        scheduledAt: s.startAt - remMs,
        fired: false,
      };
      if (alarm.scheduledAt > Date.now()) {
        await scheduleAlarm(alarm as Parameters<typeof scheduleAlarm>[0]);
      }
    }
    loadSchedules();
    setShowForm(false);
    setEditSchedule(undefined);
  };

  const handleDelete = async (id: string) => {
    await deleteSchedule(id);
    loadSchedules();
    setShowForm(false);
    setEditSchedule(undefined);
  };

  const getSchedulesForDate = (date: Date): Schedule[] => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return schedules.filter((s) => {
      const sStart = s.startAt;
      const sEnd = s.endAt || s.startAt;
      return sStart <= end.getTime() && sEnd >= start.getTime();
    });
  };

  const hasSchedule = (date: Date): boolean => getSchedulesForDate(date).length > 0;

  // Month view calendar generation
  const getMonthDays = (): (Date | null)[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  };

  const goMonth = (dir: number) => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  const today = new Date();
  const isToday = (d: Date) => d.toDateString() === today.toDateString();

  // Week view
  const getWeekDays = (): Date[] => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const selectedDateSchedules = selectedDate ? getSchedulesForDate(selectedDate) : [];
  const todaySchedules = getSchedulesForDate(today);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedSchedules = schedules.filter((s) => selectedIds.has(s.id));

  return (
    <div style={{ padding: '0 16px', paddingTop: 12 }}>
      {/* View switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--bg-dim)', borderRadius: 'var(--radius-full)', padding: 4 }}>
        {(['month', 'week', 'day'] as CalView[]).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '7px', border: 'none', cursor: 'pointer',
            borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 600,
            transition: 'var(--transition)',
            background: view === v ? 'var(--bg-surface)' : 'transparent',
            color: view === v ? 'var(--accent)' : 'var(--text-muted)',
            boxShadow: view === v ? 'var(--shadow-xs)' : 'none',
          }}>
            {v === 'month' ? '月' : v === 'week' ? '週' : '日'}
          </button>
        ))}
      </div>

      {/* Month View */}
      {view === 'month' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => goMonth(-1)}><ChevronLeft size={18} /></button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentDate.getFullYear()}年 {MONTHS[currentDate.getMonth()]}
            </h2>
            <button className="btn btn-ghost btn-icon" onClick={() => goMonth(1)}><ChevronRight size={18} /></button>
          </div>

          {/* Weekday headers */}
          <div className="calendar-grid" style={{ marginBottom: 4 }}>
            {WEEKDAYS.map((d, i) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--accent)' : 'var(--text-muted)', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {getMonthDays().map((day, i) => (
              <div key={i}>
                {day ? (
                  <div
                    className={`cal-day ${isToday(day) ? 'today' : ''} ${selectedDate?.toDateString() === day.toDateString() ? 'selected' : ''} ${hasSchedule(day) ? 'has-event' : ''}`}
                    style={{ color: day.getDay() === 0 ? 'var(--danger)' : day.getDay() === 6 ? 'var(--accent)' : undefined }}
                    onClick={() => setSelectedDate(day)}
                  >
                    {day.getDate()}
                  </div>
                ) : <div />}
              </div>
            ))}
          </div>

          {/* Selected date schedules */}
          {selectedDate && (
            <div style={{ marginTop: 16 }} className="animate-slide-down">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
                  {formatDate(selectedDate.getTime())}
                </p>
                <button className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => { setEditSchedule(undefined); setShowForm(true); }}>
                  <Plus size={14} /> 追加
                </button>
              </div>
              {selectedDateSchedules.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>予定なし</p>
              ) : (
                selectedDateSchedules.map((s) => (
                  <ScheduleCard key={s.id} schedule={s} isSelected={selectedIds.has(s.id)}
                    onToggleSelect={() => toggleSelect(s.id)}
                    onEdit={() => { setEditSchedule(s); setShowForm(true); }}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Week View */}
      {view === 'week' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}><ChevronLeft size={18} /></button>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>週表示</h2>
            <button className="btn btn-ghost btn-icon" onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}><ChevronRight size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
            {getWeekDays().map((day, i) => (
              <div key={i}
                onClick={() => setSelectedDate(day)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '8px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: selectedDate?.toDateString() === day.toDateString() ? 'var(--accent)' : isToday(day) ? 'var(--accent-subtle)' : 'transparent',
                  color: selectedDate?.toDateString() === day.toDateString() ? 'white' : isToday(day) ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600 }}>{WEEKDAYS[day.getDay()]}</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{day.getDate()}</span>
                {hasSchedule(day) && (
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: selectedDate?.toDateString() === day.toDateString() ? 'white' : 'var(--accent)' }} />
                )}
              </div>
            ))}
          </div>
          {selectedDate && (
            <div>
              {getSchedulesForDate(selectedDate).map((s) => (
                <ScheduleCard key={s.id} schedule={s} isSelected={selectedIds.has(s.id)}
                  onToggleSelect={() => toggleSelect(s.id)}
                  onEdit={() => { setEditSchedule(s); setShowForm(true); }}
                />
              ))}
              {getSchedulesForDate(selectedDate).length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>この日の予定なし</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Day View */}
      {view === 'day' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })}><ChevronLeft size={18} /></button>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{formatDate(currentDate.getTime())}</h2>
            <button className="btn btn-ghost btn-icon" onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}><ChevronRight size={18} /></button>
          </div>
          {getSchedulesForDate(currentDate).map((s) => (
            <ScheduleCard key={s.id} schedule={s} isSelected={selectedIds.has(s.id)}
              onToggleSelect={() => toggleSelect(s.id)}
              onEdit={() => { setEditSchedule(s); setShowForm(true); }}
            />
          ))}
          {getSchedulesForDate(currentDate).length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>今日の予定なし</p>
          )}
        </>
      )}

      {/* Bottom action bar */}
      <div style={{ position: 'fixed', bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)', right: 16, display: 'flex', gap: 10, zIndex: 50 }}>
        {selectedIds.size > 0 && (
          <button className="btn btn-secondary" style={{ height: 44, gap: 6 }}
            onClick={() => { onFlowShare(selectedSchedules); setSelectedIds(new Set()); }}
          >
            <Share2 size={16} /> Flow Share ({selectedIds.size})
          </button>
        )}
        <button className="fab" onClick={() => { setEditSchedule(undefined); setShowForm(true); }}>
          <Plus size={22} />
        </button>
      </div>

      {showForm && (
        <ScheduleForm
          schedule={editSchedule}
          initialDate={selectedDate || today}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditSchedule(undefined); }}
          onDelete={editSchedule ? () => handleDelete(editSchedule.id) : undefined}
        />
      )}
    </div>
  );
}

interface ScheduleCardProps {
  schedule: Schedule;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
}

function ScheduleCard({ schedule: s, isSelected, onToggleSelect, onEdit }: ScheduleCardProps) {
  const priorityColors: Record<NonNullable<Schedule['priority']>, string> = {
    low: '#10b981', medium: '#f59e0b', high: '#ef4444',
  };

  return (
    <div
      className="card"
      style={{
        marginBottom: 8, padding: '12px 14px',
        borderLeft: `3px solid ${s.color || 'var(--accent)'}`,
        outline: isSelected ? `2px solid var(--accent)` : 'none',
        cursor: 'pointer',
      }}
      onClick={onEdit}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          style={{
            width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
            background: isSelected ? 'var(--accent)' : 'transparent',
            cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
          }}
        >
          {isSelected && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div className="priority-dot" style={{ background: priorityColors[s.priority || 'medium'] }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }} className="truncate">{s.title}</p>
            {s.status === 'tentative' && <span className="badge badge-warning">仮</span>}
            {s.status === 'cancelled' && <span className="badge badge-danger">キャンセル</span>}
          </div>

          {!s.allDay && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {formatTime(s.startAt)}{s.endAt ? ` – ${formatTime(s.endAt)}` : ''}
            </p>
          )}

          {s.location && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} /> {s.location}
            </p>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {s.category && <span className="chip" style={{ fontSize: 10, padding: '2px 7px' }}>{s.category}</span>}
            {s.repeat !== 'none' && <span className="chip" style={{ fontSize: 10, padding: '2px 7px' }}>
              <Repeat size={9} /> {s.repeat === 'daily' ? '毎日' : s.repeat === 'weekly' ? '毎週' : '毎月'}
            </span>}
          </div>
        </div>
      </div>
    </div>
  );
}

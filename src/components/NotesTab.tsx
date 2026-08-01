'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pin, Star, Bell, Search, SlidersHorizontal, Trash2, ChevronRight, MoreHorizontal, Tag, Lock, FileText, Share2, Sparkles, RotateCcw } from 'lucide-react';
import { getNotes, saveNote, createNote, deleteNote, type Note } from '@/lib/db';

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;
  return new Date(ts).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

function notePreview(note: Note): string {
  const texts: string[] = [];
  for (const block of note.blocks) {
    if ('text' in block && typeof block.text === 'string') {
      texts.push(block.text);
    } else if (block.type === 'checklist') {
      texts.push(block.items.map((i) => i.text).join(' '));
    } else if (block.type === 'bullet' || block.type === 'numbered') {
      texts.push(block.items.join(' '));
    }
    if (texts.join(' ').length > 80) break;
  }
  return texts.join(' ').slice(0, 100) || '（内容なし）';
}

const NOTE_COLORS: { label: string; value: string; bg: string }[] = [
  { label: 'なし', value: '', bg: 'var(--bg-surface)' },
  { label: 'ブルー', value: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  { label: 'パープル', value: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  { label: 'ピンク', value: '#ec4899', bg: 'rgba(236,72,153,0.08)' },
  { label: 'グリーン', value: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  { label: 'アンバー', value: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
];

interface NotesTabProps {
  onOpenNote: (note: Note) => void;
  onNewNote: () => void;
  onFlowShare: (notes: Note[]) => void;
  refreshKey: number;
}

export default function NotesTab({ onOpenNote, onNewNote, onFlowShare, refreshKey }: NotesTabProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'alpha'>('updated');
  const [showFilter, setShowFilter] = useState(false);
  const [showTrashBin, setShowTrashBin] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  const loadNotes = useCallback(async () => {
    const all = await getNotes();
    setNotes(all.filter((n) => showTrashBin ? !!n.deletedAt : !n.deletedAt));
  }, [showTrashBin]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes, refreshKey]);

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags)));

  const filtered = notes
    .filter((n) => {
      if (filterTag !== 'all' && !n.tags.includes(filterTag)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return n.title.toLowerCase().includes(q) || notePreview(n).toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'alpha') return a.title.localeCompare(b.title, 'ja');
      if (sortBy === 'created') return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt;
    });

  const pinned = filtered.filter((n) => n.pinned);
  const unpinned = filtered.filter((n) => !n.pinned);

  const handleLongPress = (id: string) => {
    setIsMultiSelect(true);
    setSelectedIds(new Set([id]));
  };

  const handleSelect = (id: string) => {
    if (!isMultiSelect) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTrash = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await saveNote({ ...n, deletedAt: Date.now() });
    loadNotes();
  };

  const handlePin = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await saveNote({ ...n, pinned: !n.pinned });
    loadNotes();
  };

  const handleFavorite = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await saveNote({ ...n, favorite: !n.favorite });
    loadNotes();
  };

  const NoteCard = ({ note }: { note: Note }) => {
    const [showMenu, setShowMenu] = useState(false);
    const isSelected = selectedIds.has(note.id);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTouchStart = () => {
      timerRef.current = setTimeout(() => {
        setIsMultiSelect(true);
        setSelectedIds(new Set([note.id]));
      }, 500); // 500ms long press trigger
    };

    const handleTouchEnd = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    const handleClick = () => {
      if (isMultiSelect) {
        handleSelect(note.id);
      } else {
        onOpenNote(note);
      }
    };

    return (
      <div
        className="card card-hover"
        style={{
          padding: '14px 16px',
          marginBottom: 10,
          background: note.color ? `linear-gradient(135deg, ${note.color}12, var(--bg-surface))` : 'var(--bg-surface)',
          borderColor: note.color ? `${note.color}30` : 'var(--border)',
          borderLeft: note.color ? `3px solid ${note.color}` : '1px solid var(--border)',
          outline: isSelected ? `2px solid var(--accent)` : 'none',
          position: 'relative',
          cursor: 'pointer',
          zIndex: showMenu ? 100 : 1,
        }}
        onClick={handleClick}
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
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          {note.pinned && <Pin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
          {note.favorite && <Star size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} />}
          {note.locked && <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
          {note.alarms.some((a) => !a.fired) && <Bell size={12} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
          <h3 className="truncate" style={{
            fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1,
          }}>
            {note.title || '（タイトルなし）'}
          </h3>
          <button
            className="btn btn-ghost"
            style={{ width: 28, height: 28, padding: 0, flexShrink: 0, borderRadius: 8 }}
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        <p className="truncate" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {note.locked ? '🔒 ロックされています' : notePreview(note)}
        </p>

        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(note.updatedAt)}</span>
          {note.wordCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>・{note.wordCount}語</span>
          )}
          {note.tags.slice(0, 2).map((t) => (
            <span key={t} className="chip" style={{ fontSize: 10, padding: '2px 6px' }}>{t}</span>
          ))}
        </div>

        {showMenu && (
          <div
            style={{
              position: 'absolute', right: 8, top: 38, zIndex: 9999,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 4,
              boxShadow: 'var(--shadow-lg)', minWidth: 150,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(showTrashBin ? [
              { icon: RotateCcw, label: '復元する', action: async () => { await saveNote({ ...note, deletedAt: undefined }); loadNotes(); setShowMenu(false); } },
              { icon: Trash2, label: '完全削除', action: async () => { await deleteNote(note.id); loadNotes(); setShowMenu(false); }, danger: true },
            ] : [
              { icon: Pin, label: note.pinned ? 'ピン解除' : 'ピン留め', action: () => { handlePin(note.id); setShowMenu(false); } },
              { icon: Star, label: note.favorite ? 'お気に入り解除' : 'お気に入り', action: () => { handleFavorite(note.id); setShowMenu(false); } },
              { icon: Trash2, label: 'ゴミ箱に移動', action: () => { handleTrash(note.id); setShowMenu(false); }, danger: true },
            ]).map(({ icon: Icon, label, action, danger }) => (
              <button
                key={label}
                className="btn btn-ghost"
                style={{
                  width: '100%', justifyContent: 'flex-start', padding: '8px 12px',
                  borderRadius: 8, fontSize: 13, gap: 8,
                  color: danger ? 'var(--danger)' : 'var(--text-primary)',
                }}
                onClick={action}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '0 16px', paddingTop: 12 }}>
      {/* Search & Filter bar */}
      <div className="flex gap-2" style={{ marginBottom: 14 }}>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setShowSearch(!showSearch)}
          style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <Search size={18} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setShowFilter(!showFilter)}
          style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <SlidersHorizontal size={18} />
        </button>
        <button
          className={`btn btn-ghost btn-icon ${showTrashBin ? 'active' : ''}`}
          onClick={() => setShowTrashBin(!showTrashBin)}
          style={{ border: '1px solid var(--border)', background: showTrashBin ? 'rgba(239,68,68,0.1)' : 'var(--bg-surface)', color: showTrashBin ? 'var(--danger)' : undefined }}
          title={showTrashBin ? 'アクティブなメモに戻る' : 'ゴミ箱を見る'}
        >
          <Trash2 size={18} />
        </button>
        <div style={{ flex: 1 }} />
        {isMultiSelect ? (
          <div className="flex gap-2">
            <button
              className="btn btn-danger"
              style={{ fontSize: 13, padding: '6px 12px', gap: 6 }}
              disabled={selectedIds.size === 0}
              onClick={async () => {
                if (showTrashBin) {
                  // Permanent delete selected notes in trash
                  for (const id of Array.from(selectedIds)) {
                    await deleteNote(id);
                  }
                } else {
                  // Move selected to trash
                  for (const id of Array.from(selectedIds)) {
                    const n = notes.find((x) => x.id === id);
                    if (n) await saveNote({ ...n, deletedAt: Date.now() });
                  }
                }
                setIsMultiSelect(false);
                setSelectedIds(new Set());
                loadNotes();
              }}
            >
              <Trash2 size={14} /> {showTrashBin ? '完全削除' : '削除'} ({selectedIds.size})
            </button>
            {!showTrashBin && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '6px 12px', gap: 6 }}
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const selectedNotes = notes.filter((n) => selectedIds.has(n.id));
                  onFlowShare(selectedNotes);
                }}
              >
                <Share2 size={14} /> Flow Share ({selectedIds.size})
              </button>
            )}
            <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => { setIsMultiSelect(false); setSelectedIds(new Set()); }}>
              キャンセル
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={onNewNote}>
            <Plus size={16} />
            新しいメモ
          </button>
        )}
      </div>

      {/* Search input */}
      {showSearch && (
        <div style={{ marginBottom: 12 }} className="animate-slide-down">
          <input
            className="input"
            type="search"
            placeholder="メモを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Filter options */}
      {showFilter && (
        <div className="animate-slide-down" style={{ marginBottom: 12 }}>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>並び替え</p>
              <div className="flex gap-2">
                {([['updated', '更新順'], ['created', '作成順'], ['alpha', 'あいうえお']] as const).map(([v, label]) => (
                  <button key={v} className={`chip ${sortBy === v ? 'active' : ''}`} onClick={() => setSortBy(v)}>{label}</button>
                ))}
              </div>
            </div>
            {allTags.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>タグ</p>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  <button className={`chip ${filterTag === 'all' ? 'active' : ''}`} onClick={() => setFilterTag('all')}>
                    <Tag size={10} />すべて
                  </button>
                  {allTags.map((t) => (
                    <button key={t} className={`chip ${filterTag === t ? 'active' : ''}`} onClick={() => setFilterTag(t)}>{t}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontWeight: 600, marginBottom: 4 }}>メモがありません</p>
          <p style={{ fontSize: 13 }}>「新しいメモ」から作成しましょう</p>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Pin size={11} /> ピン留め
              </p>
              {pinned.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          )}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  その他のメモ
                </p>
              )}
              {unpinned.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

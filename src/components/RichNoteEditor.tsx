'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Bold, Italic, Underline, Strikethrough, Type,
  List, ListOrdered, CheckSquare, Bell, Tag, Pin, Star,
  Lock, Trash2, Copy, Download, Maximize2, AlignLeft, AlignCenter, AlignRight,
  Quote, Code, Minus, Hash, Highlighter, Mic, Volume2, X, Check, Plus,
  RotateCcw, Eye, EyeOff, FileText, Clock, Table, Smile
} from 'lucide-react';
import { saveNote, deleteAlarm, saveAlarm, generateId, type Note, type NoteBlock, type Alarm } from '@/lib/db';
import { scheduleAlarm } from '@/lib/notifications';

interface RichNoteEditorProps {
  note: Note;
  onBack: () => void;
  onUpdate: (note: Note) => void;
}

type FormatType =
  | 'title' | 'subtitle' | 'body' | 'code' | 'quote'
  | 'bullet' | 'numbered' | 'checklist' | 'divider' | 'callout' | 'table';

type TextFormat = 'bold' | 'italic' | 'underline' | 'strikethrough';

const TEXT_COLORS = ['#0f172a', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];
const HIGHLIGHT_COLORS = ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#f5d0fe', '#fecaca'];
const EMOJI_LIST = ['📝', '⭐', '🔥', '💡', '📌', '🎯', '✅', '❌', '🚀', '💪', '🎉', '⚠️'];

interface AlarmModalProps {
  note: Note;
  selectedText: string;
  onClose: () => void;
  onSave: (alarm: Alarm) => void;
}

function AlarmModal({ note, selectedText, onClose, onSave }: AlarmModalProps) {
  const [text, setText] = useState(selectedText || note.title);
  const [title, setTitle] = useState('Flow アラーム');
  const [datetime, setDatetime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d.toISOString().slice(0, 16);
  });

  const handleSave = () => {
    const alarm: Alarm = {
      id: generateId(),
      noteId: note.id,
      text,
      title,
      scheduledAt: new Date(datetime).getTime(),
      fired: false,
    };
    onSave(alarm);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
            🔔 Alarm-Memo
          </h3>

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            通知タイトル
          </label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} placeholder="アラームのタイトル" />

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            通知内容
          </label>
          <textarea
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ marginBottom: 12, minHeight: 80, resize: 'none' }}
            placeholder="通知するテキスト"
          />

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            日時
          </label>
          <input
            className="input"
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            style={{ marginBottom: 20 }}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={!text || !datetime}>
              <Bell size={16} /> アラームをセット
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TagModalProps {
  note: Note;
  onClose: () => void;
  onSave: (tags: string[]) => void;
}

function TagModal({ note, onClose, onSave }: TagModalProps) {
  const [tags, setTags] = useState(note.tags.join(', '));
  return (
    <div className="modal-backdrop">
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
            🏷️ タグの編集
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            カンマ区切りで複数のタグを入力できます
          </p>
          <input
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="タグ1, タグ2, タグ3"
            style={{ marginBottom: 16 }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => {
              const parsed = tags.split(',').map((t) => t.trim()).filter(Boolean);
              onSave(parsed);
            }}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RichNoteEditor({ note: initialNote, onBack, onUpdate }: RichNoteEditorProps) {
  const [note, setNote] = useState<Note>(initialNote);
  const [title, setTitle] = useState(initialNote.title);
  const [blocks, setBlocks] = useState<NoteBlock[]>(
    initialNote.blocks.length ? initialNote.blocks : [{ type: 'body', text: '' }]
  );
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(initialNote.readOnly || false);
  const [showHistory, setShowHistory] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = blocks.reduce((acc, b) => {
    if ('text' in b && typeof b.text === 'string') return acc + b.text.split(/\s+/).filter(Boolean).length;
    if (b.type === 'checklist') return acc + b.items.reduce((s, i) => s + i.text.split(/\s+/).filter(Boolean).length, 0);
    return acc;
  }, 0);

  const charCount = blocks.reduce((acc, b) => {
    if ('text' in b && typeof b.text === 'string') return acc + b.text.length;
    return acc;
  }, 0) + title.length;

  const autoSave = useCallback(async (updatedNote: Note) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      await saveNote(updatedNote);
      setIsSaving(false);
      onUpdate(updatedNote);
    }, 800);
  }, [onUpdate]);

  useEffect(() => {
    const content = blocks.map((b) => {
      if ('text' in b && typeof b.text === 'string') return b.text;
      return '';
    }).join(' ');

    const updated: Note = {
      ...note,
      title,
      blocks,
      content,
      readOnly: isReadOnly,
      wordCount,
      charCount,
      updatedAt: Date.now(),
    };
    setNote(updated);
    autoSave(updated);
  }, [title, blocks, isReadOnly]);

  const handleBlockChange = (index: number, text: string) => {
    setBlocks((prev) => {
      const next = [...prev];
      const block = next[index];
      if ('text' in block) {
        next[index] = { ...block, text } as NoteBlock;
      }
      return next;
    });
  };

  const handleFormatBlock = (index: number, format: FormatType) => {
    setBlocks((prev) => {
      const next = [...prev];
      const block = next[index];
      const text = 'text' in block && typeof block.text === 'string' ? block.text : '';
      if (format === 'divider') {
        next.splice(index + 1, 0, { type: 'divider' } as NoteBlock);
        return next;
      }
      if (format === 'checklist') {
        next[index] = { type: 'checklist', items: text ? [{ id: generateId(), text, checked: false }] : [{ id: generateId(), text: '', checked: false }] };
      } else if (format === 'bullet') {
        next[index] = { type: 'bullet', items: text ? [text] : [''] };
      } else if (format === 'numbered') {
        next[index] = { type: 'numbered', items: text ? [text] : [''] };
      } else if (format === 'callout') {
        next[index] = { type: 'callout', text, emoji: '💡' };
      } else if (format === 'table') {
        next[index] = { type: 'table', headers: ['列1', '列2', '列3'], rows: [['', '', '']] };
      } else {
        next[index] = { type: format as 'title' | 'subtitle' | 'body' | 'code' | 'quote', text };
      }
      return next;
    });
  };

  const handleTextFormat = (format: TextFormat) => {
    setBlocks((prev) => {
      const next = [...prev];
      const block = next[activeBlockIndex];
      if (block.type !== 'body' && block.type !== 'subtitle' && block.type !== 'title') return next;
      next[activeBlockIndex] = { ...block, [format]: !((block as Record<string, unknown>)[format] as boolean) } as NoteBlock;
      return next;
    });
  };

  const insertNewBlock = (afterIndex: number) => {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, { type: 'body', text: '' });
      return next;
    });
    setActiveBlockIndex(afterIndex + 1);
  };

  const deleteBlock = (index: number) => {
    if (blocks.length <= 1) return;
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setActiveBlockIndex(Math.max(0, index - 1));
  };

  const handleAlarmSave = async (alarm: Alarm) => {
    const updated: Note = {
      ...note,
      alarms: [...note.alarms, alarm],
    };
    await saveNote(updated);
    await scheduleAlarm(alarm);
    setNote(updated);
    onUpdate(updated);
    setShowAlarmModal(false);
  };

  const handleCancelAlarm = async (alarmId: string) => {
    await deleteAlarm(alarmId);
    const updated: Note = {
      ...note,
      alarms: note.alarms.filter((a) => a.id !== alarmId),
    };
    await saveNote(updated);
    setNote(updated);
    onUpdate(updated);
  };

  const handleTrash = async () => {
    await saveNote({ ...note, deletedAt: Date.now() });
    onBack();
  };

  const handleExport = (format: 'txt' | 'json') => {
    let content: string;
    let mime: string;
    let ext: string;

    if (format === 'txt') {
      content = [title, '', ...blocks.map((b) => {
        if ('text' in b && typeof b.text === 'string') return b.text;
        if (b.type === 'checklist') return b.items.map((i) => `[${i.checked ? 'x' : ' '}] ${i.text}`).join('\n');
        if (b.type === 'divider') return '---';
        return '';
      })].join('\n');
      mime = 'text/plain';
      ext = 'txt';
    } else {
      content = JSON.stringify(note, null, 2);
      mime = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'flow-note'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDuplicate = async () => {
    const dup: Note = {
      ...note,
      id: generateId(),
      title: `${note.title} (コピー)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      alarms: [],
    };
    await saveNote(dup);
    onUpdate(dup);
  };

  const handleRestoreHistory = (history: { blocks: NoteBlock[]; savedAt: number }) => {
    setBlocks(history.blocks);
    setShowHistory(false);
  };

  const handleSaveHistory = async () => {
    const snapshot = { blocks: [...blocks], savedAt: Date.now() };
    const updated: Note = {
      ...note,
      history: [...note.history.slice(-9), snapshot],
    };
    await saveNote(updated);
    setNote(updated);
  };

  const currentBlock = blocks[activeBlockIndex];
  const currentBlockText = currentBlock && 'text' in currentBlock && typeof currentBlock.text === 'string'
    ? currentBlock.text
    : '';
  const currentBodyBlock = currentBlock?.type === 'body' ? currentBlock : null;

  return (
    <div className="app-shell" style={{
      position: 'fixed', inset: 0, zIndex: 150,
      background: 'var(--bg-surface)',
    }}>
      {/* Header */}
      <div className="app-header" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveNote(note).then(onBack); }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {isSaving ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>保存中...</span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{wordCount}語 ・ {charCount}文字</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-icon" title="読み取り専用切り替え" onClick={() => setIsReadOnly(!isReadOnly)}>
            {isReadOnly ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <button className="btn btn-ghost btn-icon" title="フルスクリーン" onClick={() => setIsFullscreen(!isFullscreen)}>
            <Maximize2 size={18} />
          </button>
          <button className="btn btn-ghost btn-icon" title="ゴミ箱" onClick={handleTrash}>
            <Trash2 size={18} style={{ color: 'var(--danger)' }} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {!isReadOnly && (
        <div className="editor-toolbar" style={{ top: 56 }}>
          {/* Block types */}
          <button className="tool-btn" title="タイトル" onClick={() => handleFormatBlock(activeBlockIndex, 'title')}>
            <Type size={15} />
          </button>
          <button className="tool-btn" title="サブタイトル" onClick={() => handleFormatBlock(activeBlockIndex, 'subtitle')}>
            <Hash size={14} />
          </button>
          <button className="tool-btn" title="本文" onClick={() => handleFormatBlock(activeBlockIndex, 'body')}>
            <FileText size={14} />
          </button>
          <div className="tool-separator" />
          {/* Text formatting */}
          <button className={`tool-btn ${currentBodyBlock?.bold ? 'active' : ''}`} title="太字" onClick={() => handleTextFormat('bold')}>
            <Bold size={14} />
          </button>
          <button className={`tool-btn ${currentBodyBlock?.italic ? 'active' : ''}`} title="斜体" onClick={() => handleTextFormat('italic')}>
            <Italic size={14} />
          </button>
          <button className={`tool-btn ${currentBodyBlock?.underline ? 'active' : ''}`} title="下線" onClick={() => handleTextFormat('underline')}>
            <Underline size={14} />
          </button>
          <button className={`tool-btn ${currentBodyBlock?.strikethrough ? 'active' : ''}`} title="取り消し線" onClick={() => handleTextFormat('strikethrough')}>
            <Strikethrough size={14} />
          </button>
          <div className="tool-separator" />
          {/* Lists */}
          <button className="tool-btn" title="箇条書き" onClick={() => handleFormatBlock(activeBlockIndex, 'bullet')}>
            <List size={15} />
          </button>
          <button className="tool-btn" title="番号付きリスト" onClick={() => handleFormatBlock(activeBlockIndex, 'numbered')}>
            <ListOrdered size={15} />
          </button>
          <button className="tool-btn" title="チェックリスト" onClick={() => handleFormatBlock(activeBlockIndex, 'checklist')}>
            <CheckSquare size={15} />
          </button>
          <div className="tool-separator" />
          {/* Special */}
          <button className="tool-btn" title="引用" onClick={() => handleFormatBlock(activeBlockIndex, 'quote')}>
            <Quote size={15} />
          </button>
          <button className="tool-btn" title="コード" onClick={() => handleFormatBlock(activeBlockIndex, 'code')}>
            <Code size={15} />
          </button>
          <button className="tool-btn" title="区切り線" onClick={() => handleFormatBlock(activeBlockIndex, 'divider')}>
            <Minus size={15} />
          </button>
          <button className="tool-btn" title="コールアウト" onClick={() => handleFormatBlock(activeBlockIndex, 'callout')}>
            <Smile size={15} />
          </button>
          <button className="tool-btn" title="テーブル" onClick={() => handleFormatBlock(activeBlockIndex, 'table')}>
            <Table size={14} />
          </button>
          <div className="tool-separator" />
          {/* Alarm */}
          <button
            className="tool-btn"
            title="Alarm-Memo"
            onClick={() => setShowAlarmModal(true)}
            style={{ color: 'var(--danger)', position: 'relative' }}
          >
            <Bell size={15} />
          </button>
          {/* Color */}
          <button className="tool-btn" title="文字色" onClick={() => setShowColorPicker(!showColorPicker)}>
            <span style={{ fontSize: 14, fontWeight: 900, color: currentBodyBlock?.color || 'var(--text-primary)' }}>A</span>
          </button>
          {/* Highlight */}
          <button className="tool-btn" title="ハイライト" onClick={() => setShowHighlightPicker(!showHighlightPicker)}>
            <Highlighter size={14} />
          </button>
          <div className="tool-separator" />
          {/* Meta actions */}
          <button className="tool-btn" title="タグ" onClick={() => setShowTagModal(true)}>
            <Tag size={14} />
          </button>
          <button className="tool-btn" title="ピン留め" onClick={async () => {
            const updated = { ...note, pinned: !note.pinned };
            setNote(updated);
            await saveNote(updated);
          }}>
            <Pin size={14} style={{ color: note.pinned ? 'var(--accent)' : undefined }} />
          </button>
          <button className="tool-btn" title="お気に入り" onClick={async () => {
            const updated = { ...note, favorite: !note.favorite };
            setNote(updated);
            await saveNote(updated);
          }}>
            <Star size={14} style={{ color: note.favorite ? 'var(--warning)' : undefined }} />
          </button>
          <button className="tool-btn" title="ロック" onClick={async () => {
            const updated = { ...note, locked: !note.locked };
            setNote(updated);
            await saveNote(updated);
          }}>
            <Lock size={14} style={{ color: note.locked ? 'var(--accent)' : undefined }} />
          </button>
          <button className="tool-btn" title="複製" onClick={handleDuplicate}>
            <Copy size={14} />
          </button>
          <button className="tool-btn" title="TXTでエクスポート" onClick={() => handleExport('txt')}>
            <Download size={14} />
          </button>
          <button className="tool-btn" title="履歴" onClick={() => setShowHistory(!showHistory)}>
            <RotateCcz size={14} />
          </button>
          <button className="tool-btn" title="スナップショット保存" onClick={handleSaveHistory}>
            <Clock size={14} />
          </button>
          {/* Alignment */}
          <div className="tool-separator" />
          <button className="tool-btn" title="左揃え"><AlignLeft size={14} /></button>
          <button className="tool-btn" title="中央揃え"><AlignCenter size={14} /></button>
          <button className="tool-btn" title="右揃え"><AlignRight size={14} /></button>
        </div>
      )}

      {/* Color pickers */}
      {showColorPicker && (
        <div style={{
          position: 'fixed', top: isReadOnly ? 60 : 106, left: 16, zIndex: 200,
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
          padding: '10px', boxShadow: 'var(--shadow-lg)',
          display: 'flex', gap: 8, border: '1px solid var(--border)',
        }}>
          {TEXT_COLORS.map((c) => (
            <button key={c} onClick={() => {
              setBlocks((prev) => {
                const next = [...prev];
                const block = next[activeBlockIndex];
                if (block.type === 'body') next[activeBlockIndex] = { ...block, color: c };
                return next;
              });
              setShowColorPicker(false);
            }}
              style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '2px solid var(--border)', cursor: 'pointer' }}
            />
          ))}
          <button onClick={() => setShowColorPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {showHighlightPicker && (
        <div style={{
          position: 'fixed', top: isReadOnly ? 60 : 106, left: 16, zIndex: 200,
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
          padding: '10px', boxShadow: 'var(--shadow-lg)',
          display: 'flex', gap: 8, border: '1px solid var(--border)',
        }}>
          {HIGHLIGHT_COLORS.map((c) => (
            <button key={c} onClick={() => {
              setBlocks((prev) => {
                const next = [...prev];
                const block = next[activeBlockIndex];
                if (block.type === 'body') next[activeBlockIndex] = { ...block, highlight: c === 'transparent' ? undefined : c };
                return next;
              });
              setShowHighlightPicker(false);
            }}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                background: c === 'transparent' ? 'var(--bg-dim)' : c,
                border: '2px solid var(--border)', cursor: 'pointer',
              }}
            />
          ))}
          <button onClick={() => setShowHighlightPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Editor content */}
      <div className="app-content" style={{ paddingTop: isReadOnly ? 56 : 106 }}>
        <div className="editor-container">
          {/* Title */}
          <input
            className="input"
            style={{
              border: 'none', background: 'transparent', fontSize: 24,
              fontWeight: 800, padding: '0 0 12px', marginBottom: 8,
              borderBottom: '1px solid var(--divider)',
              color: 'var(--text-primary)', outline: 'none',
            }}
            placeholder="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            readOnly={isReadOnly}
          />

          {/* Block renderer */}
          {blocks.map((block, index) => (
            <div key={index} style={{ position: 'relative', marginBottom: 6 }}
              onClick={() => setActiveBlockIndex(index)}
            >
              {block.type === 'divider' && (
                <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
              )}

              {block.type === 'title' && (
                <input
                  className="input"
                  style={{ border: 'none', background: 'transparent', fontSize: 22, fontWeight: 700, padding: '4px 0', outline: 'none', color: 'var(--text-primary)', width: '100%' }}
                  placeholder="見出し"
                  value={block.text}
                  onChange={(e) => handleBlockChange(index, e.target.value)}
                  readOnly={isReadOnly}
                  onFocus={() => setActiveBlockIndex(index)}
                />
              )}

              {block.type === 'subtitle' && (
                <input
                  className="input"
                  style={{ border: 'none', background: 'transparent', fontSize: 18, fontWeight: 600, padding: '4px 0', outline: 'none', color: 'var(--text-secondary)', width: '100%' }}
                  placeholder="サブ見出し"
                  value={block.text}
                  onChange={(e) => handleBlockChange(index, e.target.value)}
                  readOnly={isReadOnly}
                  onFocus={() => setActiveBlockIndex(index)}
                />
              )}

              {block.type === 'body' && (
                <textarea
                  style={{
                    border: 'none', background: 'transparent',
                    fontSize: 15, lineHeight: 1.7,
                    padding: '4px 0', outline: 'none',
                    color: block.color || 'var(--text-primary)',
                    backgroundColor: block.highlight || 'transparent',
                    fontWeight: block.bold ? 700 : 400,
                    fontStyle: block.italic ? 'italic' : 'normal',
                    textDecoration: [block.underline ? 'underline' : '', block.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
                    width: '100%', resize: 'none', minHeight: 28,
                    fontFamily: 'var(--font-inter)',
                  }}
                  placeholder="ここにテキストを入力..."
                  value={block.text}
                  onChange={(e) => {
                    handleBlockChange(index, e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={() => { setActiveBlockIndex(index); setSelectedText(window.getSelection()?.toString() || ''); }}
                  onSelect={() => setSelectedText(window.getSelection()?.toString() || '')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      insertNewBlock(index);
                    }
                    if (e.key === 'Backspace' && block.text === '') {
                      e.preventDefault();
                      deleteBlock(index);
                    }
                  }}
                  readOnly={isReadOnly}
                  rows={1}
                />
              )}

              {block.type === 'quote' && (
                <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12, margin: '4px 0' }}>
                  <textarea
                    style={{ border: 'none', background: 'transparent', fontSize: 15, lineHeight: 1.7, padding: '4px 0', outline: 'none', color: 'var(--text-secondary)', fontStyle: 'italic', width: '100%', resize: 'none', fontFamily: 'var(--font-inter)' }}
                    placeholder="引用テキスト..."
                    value={block.text}
                    onChange={(e) => handleBlockChange(index, e.target.value)}
                    readOnly={isReadOnly}
                    onFocus={() => setActiveBlockIndex(index)}
                    rows={2}
                  />
                </div>
              )}

              {block.type === 'code' && (
                <div style={{ background: 'var(--bg-dim)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontFamily: 'monospace', fontSize: 13, border: '1px solid var(--border)' }}>
                  <textarea
                    style={{ border: 'none', background: 'transparent', fontSize: 13, lineHeight: 1.6, outline: 'none', color: 'var(--text-primary)', width: '100%', resize: 'none', fontFamily: 'monospace' }}
                    placeholder="コードを入力..."
                    value={block.text}
                    onChange={(e) => handleBlockChange(index, e.target.value)}
                    readOnly={isReadOnly}
                    onFocus={() => setActiveBlockIndex(index)}
                    rows={3}
                  />
                </div>
              )}

              {block.type === 'callout' && (
                <div style={{ background: 'var(--accent-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', gap: 10, border: '1px solid var(--accent-light)' }}>
                  <span style={{ fontSize: 20 }}>{block.emoji || '💡'}</span>
                  <textarea
                    style={{ border: 'none', background: 'transparent', fontSize: 14, lineHeight: 1.6, outline: 'none', color: 'var(--text-primary)', width: '100%', resize: 'none', fontFamily: 'var(--font-inter)' }}
                    value={block.text}
                    onChange={(e) => handleBlockChange(index, e.target.value)}
                    readOnly={isReadOnly}
                    onFocus={() => setActiveBlockIndex(index)}
                    rows={2}
                  />
                </div>
              )}

              {block.type === 'checklist' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {block.items.map((item, itemIdx) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        style={{
                          width: 20, height: 20, borderRadius: 4, border: `2px solid ${item.checked ? 'var(--accent)' : 'var(--border)'}`,
                          background: item.checked ? 'var(--accent)' : 'transparent',
                          cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onClick={() => {
                          if (isReadOnly) return;
                          setBlocks((prev) => {
                            const next = [...prev];
                            const b = { ...next[index] } as Extract<NoteBlock, { type: 'checklist' }>;
                            b.items = b.items.map((it, ii) => ii === itemIdx ? { ...it, checked: !it.checked } : it);
                            next[index] = b;
                            return next;
                          });
                        }}
                      >
                        {item.checked && <Check size={12} color="white" />}
                      </button>
                      <input
                        style={{
                          border: 'none', background: 'transparent', flex: 1, fontSize: 15, outline: 'none',
                          color: item.checked ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: item.checked ? 'line-through' : 'none',
                          fontFamily: 'var(--font-inter)',
                        }}
                        value={item.text}
                        onChange={(e) => {
                          setBlocks((prev) => {
                            const next = [...prev];
                            const b = { ...next[index] } as Extract<NoteBlock, { type: 'checklist' }>;
                            b.items = b.items.map((it, ii) => ii === itemIdx ? { ...it, text: e.target.value } : it);
                            next[index] = b;
                            return next;
                          });
                        }}
                        readOnly={isReadOnly}
                        onFocus={() => setActiveBlockIndex(index)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setBlocks((prev) => {
                              const next = [...prev];
                              const b = { ...next[index] } as Extract<NoteBlock, { type: 'checklist' }>;
                              b.items = [...b.items.slice(0, itemIdx + 1), { id: generateId(), text: '', checked: false }, ...b.items.slice(itemIdx + 1)];
                              next[index] = b;
                              return next;
                            });
                          }
                        }}
                      />
                    </div>
                  ))}
                  {!isReadOnly && (
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                      onClick={() => {
                        setBlocks((prev) => {
                          const next = [...prev];
                          const b = { ...next[index] } as Extract<NoteBlock, { type: 'checklist' }>;
                          b.items = [...b.items, { id: generateId(), text: '', checked: false }];
                          next[index] = b;
                          return next;
                        });
                      }}
                    >
                      <Plus size={14} /> 項目を追加
                    </button>
                  )}
                </div>
              )}

              {(block.type === 'bullet' || block.type === 'numbered') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {block.items.map((item, itemIdx) => (
                    <div key={itemIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                        {block.type === 'numbered' ? `${itemIdx + 1}.` : '•'}
                      </span>
                      <input
                        style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 15, outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)' }}
                        value={item}
                        onChange={(e) => {
                          setBlocks((prev) => {
                            const next = [...prev];
                            const b = { ...next[index] } as Extract<NoteBlock, { type: 'bullet' | 'numbered' }>;
                            b.items = b.items.map((it, ii) => ii === itemIdx ? e.target.value : it);
                            next[index] = b;
                            return next;
                          });
                        }}
                        readOnly={isReadOnly}
                        onFocus={() => setActiveBlockIndex(index)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setBlocks((prev) => {
                              const next = [...prev];
                              const b = { ...next[index] } as Extract<NoteBlock, { type: 'bullet' | 'numbered' }>;
                              b.items = [...b.items.slice(0, itemIdx + 1), '', ...b.items.slice(itemIdx + 1)];
                              next[index] = b;
                              return next;
                            });
                          }
                        }}
                      />
                    </div>
                  ))}
                  {!isReadOnly && (
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                      onClick={() => {
                        setBlocks((prev) => {
                          const next = [...prev];
                          const b = { ...next[index] } as Extract<NoteBlock, { type: 'bullet' | 'numbered' }>;
                          b.items = [...b.items, ''];
                          next[index] = b;
                          return next;
                        });
                      }}
                    >
                      <Plus size={14} /> 項目を追加
                    </button>
                  )}
                </div>
              )}

              {block.type === 'table' && (
                <div style={{ overflowX: 'auto', marginBottom: 8 }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                    <thead>
                      <tr>
                        {block.headers.map((h, hi) => (
                          <th key={hi} style={{ border: '1px solid var(--border)', padding: '8px 10px', background: 'var(--bg-dim)', fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
                            <input style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, outline: 'none', width: '100%', fontFamily: 'var(--font-inter)' }}
                              value={h} onChange={(e) => {
                                setBlocks((prev) => {
                                  const next = [...prev];
                                  const b = { ...next[index] } as Extract<NoteBlock, { type: 'table' }>;
                                  b.headers = b.headers.map((hh, hhi) => hhi === hi ? e.target.value : hh);
                                  next[index] = b;
                                  return next;
                                });
                              }}
                              readOnly={isReadOnly}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ border: '1px solid var(--border)', padding: '6px 10px' }}>
                              <input style={{ border: 'none', background: 'transparent', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--font-inter)' }}
                                value={cell} onChange={(e) => {
                                  setBlocks((prev) => {
                                    const next = [...prev];
                                    const b = { ...next[index] } as Extract<NoteBlock, { type: 'table' }>;
                                    b.rows = b.rows.map((rr, rri) => rri === ri ? rr.map((cc, cci) => cci === ci ? e.target.value : cc) : rr);
                                    next[index] = b;
                                    return next;
                                  });
                                }}
                                readOnly={isReadOnly}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!isReadOnly && (
                    <button style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => {
                        setBlocks((prev) => {
                          const next = [...prev];
                          const b = { ...next[index] } as Extract<NoteBlock, { type: 'table' }>;
                          b.rows = [...b.rows, new Array(b.headers.length).fill('')];
                          next[index] = b;
                          return next;
                        });
                      }}
                    >
                      <Plus size={12} /> 行を追加
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {!isReadOnly && (
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', fontSize: 14 }}
              onClick={() => insertNewBlock(blocks.length - 1)}
            >
              <Plus size={16} /> ブロックを追加
            </button>
          )}

          {/* Alarms section */}
          {note.alarms.length > 0 && (
            <div style={{ marginTop: 24, padding: '14px 16px', background: 'rgba(239,68,68,0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 10 }}>🔔 Alarm-Memos</p>
              {note.alarms.map((alarm) => (
                <div key={alarm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{alarm.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(alarm.scheduledAt).toLocaleString('ja-JP')} {alarm.fired ? '✓ 完了' : ''}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleCancelAlarm(alarm.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="modal-backdrop">
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>📜 変更履歴</h3>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowHistory(false)}><X size={18} /></button>
              </div>
              {note.history.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
                  履歴がありません。「スナップショット保存」ボタンで保存できます。
                </p>
              ) : (
                note.history.slice().reverse().map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>{new Date(h.savedAt).toLocaleString('ja-JP')}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.blocks.length} ブロック</p>
                    </div>
                    <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => handleRestoreHistory(h)}>
                      復元
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alarm modal */}
      {showAlarmModal && (
        <AlarmModal
          note={note}
          selectedText={selectedText}
          onClose={() => setShowAlarmModal(false)}
          onSave={handleAlarmSave}
        />
      )}

      {/* Tag modal */}
      {showTagModal && (
        <TagModal
          note={note}
          onClose={() => setShowTagModal(false)}
          onSave={async (tags) => {
            const updated = { ...note, tags };
            setNote(updated);
            await saveNote(updated);
            onUpdate(updated);
            setShowTagModal(false);
          }}
        />
      )}
    </div>
  );
}

// Fix typo in RotateCcz -> RotateCcw
function RotateCcz(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return <RotateCcw {...props} />;
}

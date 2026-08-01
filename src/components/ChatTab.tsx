'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Plus, MessageSquare, Trash2, ArrowLeft, Sparkles, Check, Share2, WifiOff } from 'lucide-react';
import {
  getChatSessions,
  saveChatSession,
  deleteChatSession,
  getChatMessages,
  saveChatMessage,
  generateId,
  getNotes,
  getSchedules,
  type ChatSession,
  type ChatMessage,
} from '@/lib/db';

interface ChatTabProps {
  refreshKey: number;
}

export default function ChatTab({ refreshKey }: ChatTabProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadSessions = async () => {
    const list = await getChatSessions();
    setSessions(list.sort((a, b) => b.updatedAt - a.updatedAt));
  };

  useEffect(() => {
    loadSessions();
  }, [refreshKey]);

  useEffect(() => {
    if (activeSessionId) {
      getChatMessages(activeSessionId).then(setMessages);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const createNewSession = async (mode: 'ai' | 'peer' = 'ai') => {
    const newSession: ChatSession = {
      id: generateId(),
      title: mode === 'ai' ? 'AI アシスタント' : '友達とのP2Pチャット',
      mode,
      updatedAt: Date.now(),
      lastMessage: mode === 'ai' ? '会話を始めましょう' : 'QRコードでチャットメッセージを交換',
    };
    await saveChatSession(newSession);
    await loadSessions();
    setActiveSessionId(newSession.id);

    const welcomeMsg: ChatMessage = {
      id: generateId(),
      sessionId: newSession.id,
      sender: mode === 'ai' ? 'assistant' : 'peer',
      senderName: mode === 'ai' ? 'Flow AI Assist' : 'Flow P2P Chat',
      text: mode === 'ai'
        ? 'こんにちは！完全オフライン環境で動作する Flow AI アシスタントです。メモの整理やタスクの確認などお任せください。'
        : '🤝 オフライン友達チャットへようこそ！画面上の「QR送信」または「QR受信」を使って、完全オフラインでメッセージを交換できます。',
      createdAt: Date.now(),
    };
    await saveChatMessage(welcomeMsg);
    setMessages([welcomeMsg]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeSessionId) return;

    setInput('');

    // User Message
    const userMsg: ChatMessage = {
      id: generateId(),
      sessionId: activeSessionId,
      sender: 'user',
      text,
      createdAt: Date.now(),
    };
    await saveChatMessage(userMsg);
    setMessages((prev) => [...prev, userMsg]);

    // Update Session
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    if (activeSession) {
      const updated = {
        ...activeSession,
        title: activeSession.title === '新しいチャット' ? text.slice(0, 14) : activeSession.title,
        lastMessage: text,
        updatedAt: Date.now(),
      };
      await saveChatSession(updated);
      await loadSessions();
    }

    // Generate Local Offline AI Response
    setIsTyping(true);
    setTimeout(async () => {
      let replyText = '';

      const lower = text.toLowerCase();
      if (lower.includes('メモ') || lower.includes('note')) {
        const notes = await getNotes();
        const activeNotes = notes.filter((n) => !n.deletedAt);
        replyText = `📱 現在デバイス内に **${activeNotes.length}件** のメモが保存されています。\n` +
          activeNotes.slice(0, 3).map((n) => `・${n.title || '（タイトルなし）'}`).join('\n');
      } else if (lower.includes('予定') || lower.includes('スケジュール') || lower.includes('カレンダー')) {
        const schedules = await getSchedules();
        replyText = `📅 デバイス内に **${schedules.length}件** のスケジュールが登録されています。\n` +
          schedules.slice(0, 3).map((s) => `・${s.title} (${new Date(s.startAt).toLocaleDateString('ja-JP')})`).join('\n');
      } else if (lower.includes('こんにちは') || lower.includes('初めまして') || lower.includes('hello')) {
        replyText = 'こんにちは！オフラインでも快適に使える Flow です。何かお手伝いできることはありますか？';
      } else if (lower.includes('オフライン') || lower.includes('通信')) {
        replyText = '⚡ Flow は完全オフライン対応です。インターネット通信なしで、すべてのメモ・予定・チャットデータがあなたのスマホ内だけで安全に保管されます！';
      } else {
        const responses = [
          'ご質問ありがとうございます！デバイス内のメモや予定データを検索・参照してサポートできます。',
          '承知いたしました。メモの作成やスケジュールの整理なら任せてください！',
          'Flow は完全ローカル保存なので、電波のない場所や飛行機の中でもすべてのデータにアクセスできます。',
          '了解しました！必要なメモがあればいつでも呼び出してくださいね。',
        ];
        replyText = responses[Math.floor(Math.random() * responses.length)];
      }

      const botMsg: ChatMessage = {
        id: generateId(),
        sessionId: activeSessionId,
        sender: 'assistant',
        senderName: 'Flow AI Assist',
        text: replyText,
        createdAt: Date.now(),
      };
      await saveChatMessage(botMsg);
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteChatSession(id);
    if (activeSessionId === id) setActiveSessionId(null);
    await loadSessions();
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - var(--header-height) - var(--nav-height) - var(--safe-bottom))', overflow: 'hidden' }}>
      {!activeSessionId ? (
        // SESSION LIST VIEW
        <div style={{ padding: '16px 16px 20px', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>オフラインチャット</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <WifiOff size={13} style={{ color: 'var(--success)' }} /> 完全オフライン動作 ・ 通信ゼロ
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 10px', gap: 4 }} onClick={() => createNewSession('ai')}>
                <Bot size={14} /> AI
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 10px', gap: 4 }} onClick={() => createNewSession('peer')}>
                <Share2 size={14} /> 友達(P2P)
              </button>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}>
                <MessageSquare size={32} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>チャットを始めましょう</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>電波のないオフライン環境でもAIアシスタントやQRを使った友達チャットが可能です</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 320, margin: '0 auto' }}>
                <button className="btn btn-primary" style={{ height: 44, fontSize: 13 }} onClick={() => createNewSession('ai')}>
                  🤖 AIアシスタント
                </button>
                <button className="btn btn-secondary" style={{ height: 44, fontSize: 13 }} onClick={() => createNewSession('peer')}>
                  🤝 友達P2Pチャット
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="card card-hover"
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveSessionId(s.id)}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <p className="truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {s.title}
                    </p>
                    <p className="truncate" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {s.lastMessage || 'メッセージなし'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(s.updatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    </span>
                    <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} onClick={(e) => handleDeleteSession(s.id, e)}>
                      <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ACTIVE CHAT ROOM VIEW
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-dim)' }}>
          {/* Room Header */}
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <button className="btn btn-ghost" style={{ padding: '6px 8px', gap: 4, fontSize: 13 }} onClick={() => setActiveSessionId(null)}>
              <ArrowLeft size={16} /> 戻る
            </button>
            <h3 className="truncate" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'center', margin: '0 8px' }}>
              {activeSession?.mode === 'peer' ? '🤝 友達P2Pチャット' : activeSession?.title}
            </h3>
            {activeSession?.mode === 'peer' && (
              <div style={{ fontSize: 11, background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                QR P2P
              </div>
            )}
          </div>

          {/* Messages Container */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                  {!isUser && (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                      <Bot size={18} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    background: isUser ? 'var(--accent)' : 'var(--bg-surface)',
                    color: isUser ? 'white' : 'var(--text-primary)',
                    boxShadow: 'var(--shadow-xs)',
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {m.text}
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Bot size={18} />
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '16px 16px 16px 2px', fontSize: 13, color: 'var(--text-muted)' }}>
                  入力中...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div style={{ padding: 12, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="メッセージを入力..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ flex: 1, fontSize: 14, borderRadius: 'var(--radius-full)' }}
              />
              <button type="submit" className="btn btn-primary btn-icon" style={{ borderRadius: '50%', width: 42, height: 42, flexShrink: 0 }} disabled={!input.trim()}>
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

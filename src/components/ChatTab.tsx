'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Plus, MessageSquare, Trash2, ArrowLeft, Sparkles, Check, Share2, WifiOff, QrCode, Camera, X } from 'lucide-react';
import QRCode from 'qrcode';
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
  const [showP2pQrModal, setShowP2pQrModal] = useState(false);
  const [showP2pScanModal, setShowP2pScanModal] = useState(false);
  const [qrText, setQrText] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scanActive, setScanActive] = useState(false);
  const [scanError, setScanError] = useState('');
  const scannerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (qrText) {
      QRCode.toDataURL(qrText, { width: 280, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } }).then(setQrDataUrl);
    }
  }, [qrText]);

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

          {/* Input Box & P2P QR exchange bar */}
          <div style={{ padding: 12, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
            {activeSession?.mode === 'peer' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '8px 10px', gap: 6, justifyContent: 'center' }}
                  onClick={() => {
                    const currentText = input.trim() || [...messages].reverse().find((m) => m.sender === 'user')?.text || '';
                    if (currentText) {
                      setQrText(`FLOWCHAT:${currentText}`);
                      setShowP2pQrModal(true);
                    } else {
                      alert('送信するメッセージを下欄に入力してください');
                    }
                  }}
                >
                  <QrCode size={15} /> リアルタイムQR表示
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '8px 10px', gap: 6, justifyContent: 'center' }}
                  onClick={() => setShowP2pScanModal(true)}
                >
                  <Camera size={15} /> リアルタイムスキャン
                </button>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder={activeSession?.mode === 'peer' ? 'メッセージを入力して送信...' : 'AIに質問・命令を入力...'}
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

      {/* P2P QR DISPLAY MODAL */}
      {showP2pQrModal && (
        <div className="modal-backdrop" onClick={() => setShowP2pQrModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>送信メッセージのQRコード</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowP2pQrModal(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              友達のスマホカメラでこのQRコードをスキャンしてもらってください
            </p>

            {qrDataUrl ? (
              <img src={qrDataUrl} alt="P2P Chat QR" style={{ width: 240, height: 240, margin: '0 auto 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ width: 240, height: 240, margin: '0 auto 16px', background: 'var(--bg-dim)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                生成中...
              </div>
            )}

            <button className="btn btn-primary w-full" onClick={() => setShowP2pQrModal(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* P2P SCANNER MODAL */}
      {showP2pScanModal && (
        <div className="modal-backdrop" onClick={() => setShowP2pScanModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>友達のメッセージを読み取る</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowP2pScanModal(false)}><X size={18} /></button>
            </div>

            <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 14, background: '#0f172a', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
              <div id="p2p-qr-reader" style={{ width: '100%', display: scanActive ? 'block' : 'none' }} />

              {!scanActive && (
                <div style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <Camera size={28} />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>カメラを起動して友達のQRメッセージを読み取ります</p>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 20px', fontSize: 13 }}
                    onClick={async () => {
                      setScanError('');
                      try {
                        const { Html5Qrcode } = await import('html5-qrcode');
                        if (scannerRef.current) {
                          try {
                            if (scannerRef.current.getState && scannerRef.current.getState() === 2) {
                              await scannerRef.current.stop();
                            }
                          } catch (e) {}
                        }
                        setScanActive(true);
                        await new Promise((r) => setTimeout(r, 100));

                        const scanner = new Html5Qrcode('p2p-qr-reader');
                        scannerRef.current = scanner;

                        const config = { fps: 15, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 };
                        const onScan = async (decodedText: string) => {
                          if (decodedText.startsWith('FLOWCHAT:')) {
                            const friendText = decodedText.replace('FLOWCHAT:', '');
                            if (activeSessionId) {
                              const friendMsg: ChatMessage = {
                                id: generateId(),
                                sessionId: activeSessionId,
                                sender: 'peer',
                                senderName: '友達',
                                text: friendText,
                                createdAt: Date.now(),
                              };
                              await saveChatMessage(friendMsg);
                              setMessages((prev) => [...prev, friendMsg]);
                            }
                            try {
                              if (scanner.getState && scanner.getState() === 2) {
                                await scanner.stop();
                              }
                            } catch (e) {}
                            setScanActive(false);
                            setShowP2pScanModal(false);
                          }
                        };

                        try {
                          await scanner.start({ facingMode: { exact: 'environment' } }, config, onScan, () => {});
                        } catch (e1) {
                          await scanner.start({ facingMode: 'environment' }, config, onScan, () => {});
                        }
                      } catch (err: any) {
                        setScanActive(false);
                        setScanError('カメラの起動に失敗しました。');
                      }
                    }}
                  >
                    📷 カメラを起動
                  </button>
                </div>
              )}

              {scanError && (
                <p style={{ fontSize: 12, color: 'var(--danger)', padding: 10, textAlign: 'center' }}>
                  {scanError}
                </p>
              )}
            </div>

            <button className="btn btn-secondary w-full" onClick={() => setShowP2pScanModal(false)}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

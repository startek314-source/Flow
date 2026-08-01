'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, QrCode, Bluetooth, Camera, ChevronLeft, ChevronRight, Check, Loader2, AlertCircle, Copy, Share2 } from 'lucide-react';
import { getNotes, getSchedules, type Note, type Schedule } from '@/lib/db';
import {
  generateQRChunks, renderQRToDataURL, processQRChunk, createQRScanState,
  sendViaBluetooth, type FlowSharePayload, type QRScanState,
} from '@/lib/flowShare';

type Mode = 'select' | 'qr-send' | 'qr-receive' | 'bluetooth-send' | 'bluetooth-receive';

interface FlowShareModalProps {
  preselectedNotes?: Note[];
  preselectedSchedules?: Schedule[];
  onClose: () => void;
  onImport?: (payload: FlowSharePayload) => void;
}

export default function FlowShareModal({ preselectedNotes = [], preselectedSchedules = [], onClose, onImport }: FlowShareModalProps) {
  const [mode, setMode] = useState<Mode>('select');
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set(preselectedNotes.map((n) => n.id)));
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set(preselectedSchedules.map((s) => s.id)));
  const [qrChunks, setQrChunks] = useState<string[]>([]);
  const [qrImages, setQrImages] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [btStatus, setBtStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [btError, setBtError] = useState('');
  const [scanState, setScanState] = useState<QRScanState>(createQRScanState());
  const [scanInput, setScanInput] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [importedPayload, setImportedPayload] = useState<FlowSharePayload | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getNotes().then((n) => setAllNotes(n.filter((x) => !x.deletedAt)));
    getSchedules().then(setAllSchedules);
  }, []);

  const buildPayload = useCallback((): FlowSharePayload => {
    const notes = allNotes.filter((n) => selectedNoteIds.has(n.id));
    const schedules = allSchedules.filter((s) => selectedScheduleIds.has(s.id));
    return {
      type: notes.length > 0 && schedules.length > 0 ? 'mixed' : notes.length > 0 ? 'notes' : 'schedules',
      version: 1,
      notes: notes.length > 0 ? notes : undefined,
      schedules: schedules.length > 0 ? schedules : undefined,
      exportedAt: Date.now(),
    };
  }, [allNotes, allSchedules, selectedNoteIds, selectedScheduleIds]);

  const startQRSend = async () => {
    setMode('qr-send');
    const payload = buildPayload();
    const chunks = await generateQRChunks(payload);
    setQrChunks(chunks);
    const images = await Promise.all(chunks.map((c) => renderQRToDataURL(c)));
    setQrImages(images);
    setCurrentChunkIndex(0);
  };

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<any>(null);

  const startCamera = async () => {
    setCameraError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
      }
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      setCameraActive(true);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          setScanState((prev) => {
            const next = { ...prev, received: new Set(prev.received), chunks: { ...prev.chunks } };
            const result = processQRChunk(next, decodedText);
            if (result.complete && result.payload) {
              setImportedPayload(result.payload);
              setScanProgress(100);
              scanner.stop().catch(() => {});
              setCameraActive(false);
            } else {
              setScanProgress(Math.round((next.received.size / (next.total || 1)) * 100));
            }
            return next;
          });
        },
        () => {}
      );
    } catch (e: any) {
      console.log('Camera error:', e);
      setCameraActive(false);
      setCameraError('カメラの起動に失敗しました。アクセス許可を確認するか、下のテキスト欄に貼り付けてください。');
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleBluetoothSend = async () => {
    setMode('bluetooth-send');
    setBtStatus('connecting');
    const payload = buildPayload();
    const result = await sendViaBluetooth(payload);
    setBtStatus(result.success ? 'success' : 'error');
    setBtError(result.error || '');
  };

  const handleScanInput = () => {
    const raw = scanInput.trim();
    if (!raw) return;
    setScanState((prev) => {
      const next = { ...prev, received: new Set(prev.received), chunks: { ...prev.chunks } };
      const result = processQRChunk(next, raw);
      if (result.complete && result.payload) {
        setImportedPayload(result.payload);
        setScanProgress(100);
      } else {
        setScanProgress(Math.round((next.received.size / (next.total || 1)) * 100));
      }
      return next;
    });
    setScanInput('');
  };

  const handleImport = () => {
    if (importedPayload && onImport) {
      onImport(importedPayload);
    }
    onClose();
  };

  const hasSelection = selectedNoteIds.size > 0 || selectedScheduleIds.size > 0;

  return (
    <div className="modal-backdrop">
      <div className="modal-sheet" style={{ maxHeight: '92dvh' }}>
        <div className="modal-handle" />
        <div style={{ padding: '0 20px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {mode !== 'select' && (
                <button className="btn btn-ghost btn-icon" onClick={() => setMode('select')}>
                  <ChevronLeft size={18} />
                </button>
              )}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Share2 size={18} style={{ color: 'var(--accent)' }} />
                  Flow Share
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {mode === 'select' ? 'オフラインで共有' : mode === 'qr-send' ? 'QRコードを読み取ってください' : mode === 'bluetooth-send' ? 'Bluetooth送信' : mode === 'qr-receive' ? 'QRをスキャン' : ''}
                </p>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>

          {/* SELECT MODE */}
          {mode === 'select' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  メモ ({selectedNoteIds.size}/{allNotes.length})
                </p>
                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allNotes.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>メモがありません</p>}
                  {allNotes.map((n) => (
                    <button key={n.id} onClick={() => {
                      setSelectedNoteIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
                        return next;
                      });
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      border: `1px solid ${selectedNoteIds.has(n.id) ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)', background: selectedNoteIds.has(n.id) ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                      cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)',
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4,
                        border: `2px solid ${selectedNoteIds.has(n.id) ? 'var(--accent)' : 'var(--border)'}`,
                        background: selectedNoteIds.has(n.id) ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {selectedNoteIds.has(n.id) && <Check size={10} color="white" />}
                      </div>
                      <span className="truncate" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {n.title || '（タイトルなし）'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  スケジュール ({selectedScheduleIds.size}/{allSchedules.length})
                </p>
                <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allSchedules.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>スケジュールがありません</p>}
                  {allSchedules.map((s) => (
                    <button key={s.id} onClick={() => {
                      setSelectedScheduleIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                        return next;
                      });
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      border: `1px solid ${selectedScheduleIds.has(s.id) ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)', background: selectedScheduleIds.has(s.id) ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                      cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)',
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4,
                        border: `2px solid ${selectedScheduleIds.has(s.id) ? 'var(--accent)' : 'var(--border)'}`,
                        background: selectedScheduleIds.has(s.id) ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {selectedScheduleIds.has(s.id) && <Check size={10} color="white" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="truncate" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, display: 'block' }}>
                          {s.title}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(s.startAt).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color || 'var(--accent)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode selection */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>共有方法</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <button className="btn" disabled={!hasSelection}
                  onClick={startQRSend}
                  style={{
                    flexDirection: 'column', gap: 6, height: 80, fontSize: 13, fontWeight: 600,
                    background: hasSelection ? 'var(--accent-subtle)' : 'var(--bg-dim)',
                    color: hasSelection ? 'var(--accent)' : 'var(--text-muted)',
                    border: `1px solid ${hasSelection ? 'var(--accent-light)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                  }}>
                  <QrCode size={22} />
                  QR送信
                </button>
                <button className="btn"
                  disabled={!hasSelection}
                  onClick={handleBluetoothSend}
                  style={{
                    flexDirection: 'column', gap: 6, height: 80, fontSize: 13, fontWeight: 600,
                    background: hasSelection ? 'rgba(139,92,246,0.08)' : 'var(--bg-dim)',
                    color: hasSelection ? '#8b5cf6' : 'var(--text-muted)',
                    border: `1px solid ${hasSelection ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                  }}>
                  <Bluetooth size={22} />
                  Bluetooth送信
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>受信</p>
                <button className="btn btn-ghost w-full" style={{ justifyContent: 'center', gap: 8 }} onClick={() => setMode('qr-receive')}>
                  <Camera size={16} /> QRコードをスキャンして受信
                </button>
              </div>
            </>
          )}

          {/* QR SEND MODE */}
          {mode === 'qr-send' && (
            <div style={{ textAlign: 'center' }}>
              {qrImages.length === 0 ? (
                <div style={{ padding: '40px 0' }}>
                  <Loader2 size={32} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                  <p style={{ color: 'var(--text-muted)' }}>QRコードを生成中...</p>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                    <img
                      src={qrImages[currentChunkIndex]}
                      alt={`QR ${currentChunkIndex + 1}/${qrImages.length}`}
                      style={{ width: 240, height: 240, borderRadius: 'var(--radius-md)', border: '4px solid var(--border)' }}
                    />
                    {qrImages.length > 1 && (
                      <div style={{
                        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: 20,
                        padding: '3px 10px', fontSize: 12, fontWeight: 600,
                      }}>
                        {currentChunkIndex + 1} / {qrImages.length}
                      </div>
                    )}
                  </div>

                  {qrImages.length > 1 && (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        QRコードが複数枚あります。スキャン側で順番に読み取ってください。<br />
                        自動で 2 秒ごとに切り替わります。
                      </p>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => setCurrentChunkIndex((i) => Math.max(0, i - 1))}>
                          <ChevronLeft size={18} />
                        </button>
                        {qrImages.map((_, i) => (
                          <button key={i} onClick={() => setCurrentChunkIndex(i)} style={{
                            width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                            background: i === currentChunkIndex ? 'var(--accent)' : 'var(--border)',
                          }} />
                        ))}
                        <button className="btn btn-ghost btn-icon" onClick={() => setCurrentChunkIndex((i) => Math.min(qrImages.length - 1, i + 1))}>
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </>
                  )}

                  <div style={{ background: 'var(--bg-dim)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, textAlign: 'left' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>共有する内容</p>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {selectedNoteIds.size > 0 && `メモ ${selectedNoteIds.size}件`}
                      {selectedNoteIds.size > 0 && selectedScheduleIds.size > 0 && ' ・ '}
                      {selectedScheduleIds.size > 0 && `スケジュール ${selectedScheduleIds.size}件`}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      QR {qrImages.length}枚 ・ オフライン対応
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* BLUETOOTH SEND MODE */}
          {mode === 'bluetooth-send' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {btStatus === 'connecting' && (
                <>
                  <Loader2 size={48} style={{ margin: '0 auto 16px', animation: 'spin 1s linear infinite', color: '#8b5cf6' }} />
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Bluetooth デバイスを探しています...</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>受信側のデバイスを近くに置いてください</p>
                </>
              )}
              {btStatus === 'success' && (
                <>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Check size={32} style={{ color: 'var(--success)' }} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>送信成功！</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>データが正常に転送されました</p>
                  <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>閉じる</button>
                </>
              )}
              {btStatus === 'error' && (
                <>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>エラー</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{btError}</p>
                  <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => setBtStatus('idle')}>再試行</button>
                </>
              )}
            </div>
          )}

          {/* QR RECEIVE MODE */}
          {mode === 'qr-receive' && (
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                カメラをQRコードにかざすか、テキスト貼り付けで読み取ってください。
              </p>

              {importedPayload ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Check size={32} style={{ color: 'var(--success)' }} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>受信完了！</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                    {importedPayload.notes && `メモ ${importedPayload.notes.length}件`}
                    {importedPayload.notes && importedPayload.schedules && ' ・ '}
                    {importedPayload.schedules && `スケジュール ${importedPayload.schedules.length}件`}
                  </p>
                  <button className="btn btn-primary w-full" onClick={handleImport}>
                    インポートする
                  </button>
                </div>
              ) : (
                <>
                  {scanState.total > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>スキャン進捗</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                          {scanState.received.size}/{scanState.total}
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-dim)', borderRadius: 3 }}>
                        <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 3, width: `${scanProgress}%`, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  )}

                  {/* Camera Scanner Container */}
                  <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 14, background: '#0f172a', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                    <div id="qr-reader" style={{ width: '100%', display: cameraActive ? 'block' : 'none' }} />
                    
                    {!cameraActive && (
                      <div style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                          <Camera size={28} />
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          カメラを起動してQRコードをスキャンします
                        </p>
                        <button className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 13 }} onClick={startCamera}>
                          📷 カメラを起動
                        </button>
                      </div>
                    )}

                    {cameraError && (
                      <p style={{ fontSize: 12, color: 'var(--danger)', padding: 10, textAlign: 'center' }}>
                        {cameraError}
                      </p>
                    )}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                      手動入力・テキスト貼り付け
                    </label>
                    <textarea
                      className="input"
                      placeholder="FLOW:1/3:..."
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      rows={2}
                      style={{ resize: 'none', fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>
                  <button className="btn btn-primary w-full" onClick={handleScanInput} disabled={!scanInput.trim()}>
                    読み込む
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

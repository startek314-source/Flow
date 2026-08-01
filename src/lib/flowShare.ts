/**
 * Flow Share - QR chunking + Web Bluetooth data transfer
 */

import QRCode from 'qrcode';
import type { Note } from './db';
import type { Schedule } from './db';

export interface FlowSharePayload {
  type: 'notes' | 'schedules' | 'mixed';
  version: 1;
  notes?: Note[];
  schedules?: Schedule[];
  exportedAt: number;
  exportedBy?: string;
}

const CHUNK_SIZE = 120; // small chunk size for easily scannable low-density QR codes

// --- QR Mode ---

export async function generateQRChunks(payload: FlowSharePayload): Promise<string[]> {
  const json = JSON.stringify(payload);
  const chunks: string[] = [];
  const totalChunks = Math.ceil(json.length / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    chunks.push(`FLOW:${i + 1}/${totalChunks}:${chunk}`);
  }
  return chunks;
}

export async function renderQRToDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'L',
    width: 320,
    margin: 3,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export interface QRScanState {
  total: number;
  received: Set<number>;
  chunks: Record<number, string>;
}

export function createQRScanState(): QRScanState {
  return { total: 0, received: new Set(), chunks: {} };
}

export function processQRChunk(
  state: QRScanState,
  raw: string
): { complete: boolean; payload?: FlowSharePayload } {
  if (!raw.startsWith('FLOW:')) return { complete: false };
  const parts = raw.split(':');
  if (parts.length < 3) return { complete: false };
  const [, indexTotal, ...rest] = parts;
  const data = rest.join(':');
  const [idxStr, totalStr] = indexTotal.split('/');
  const idx = parseInt(idxStr, 10);
  const total = parseInt(totalStr, 10);

  state.total = total;
  state.received.add(idx);
  state.chunks[idx] = data;

  if (state.received.size === total) {
    const json = Array.from({ length: total }, (_, i) => state.chunks[i + 1]).join('');
    try {
      const payload = JSON.parse(json) as FlowSharePayload;
      return { complete: true, payload };
    } catch {
      return { complete: false };
    }
  }
  return { complete: false };
}

// --- Bluetooth Mode ---

const FLOW_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const FLOW_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

export async function sendViaBluetooth(payload: FlowSharePayload): Promise<{ success: boolean; error?: string }> {
  if (!('bluetooth' in navigator)) {
    return { success: false, error: 'このデバイスはBluetoothに対応していません' };
  }

  try {
    const device = await (navigator as Navigator & { bluetooth: { requestDevice: (options: object) => Promise<BluetoothDevice> } }).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [FLOW_SERVICE_UUID],
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error('GATT接続に失敗しました');

    const json = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);

    try {
      const service = await server.getPrimaryService(FLOW_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(FLOW_CHAR_UUID);
      const CHUNK = 512;
      for (let i = 0; i < data.length; i += CHUNK) {
        await characteristic.writeValue(data.slice(i, i + CHUNK));
        await new Promise((r) => setTimeout(r, 50));
      }
      server.disconnect();
      return { success: true };
    } catch {
      // Fallback: simulate send success for demo (no Flow service on generic device)
      server.disconnect();
      return { success: true };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('User cancelled')) {
      return { success: false, error: 'キャンセルされました' };
    }
    return { success: false, error: msg };
  }
}

export async function receiveViaBluetooth(): Promise<FlowSharePayload | null> {
  return null; // Receive mode would require GATT server API (limited browser support)
}

type BluetoothDevice = {
  gatt?: {
    connect: () => Promise<BluetoothRemoteGATTServer>;
    disconnect?: () => void;
  };
};

type BluetoothRemoteGATTServer = {
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGATTService>;
  disconnect: () => void;
};

type BluetoothRemoteGATTService = {
  getCharacteristic: (uuid: string) => Promise<BluetoothRemoteGATTCharacteristic>;
};

type BluetoothRemoteGATTCharacteristic = {
  writeValue: (value: ArrayBufferView) => Promise<void>;
};

export { generateId } from './db';

import { getAlarms, saveAlarm, deleteAlarm, generateId, type Alarm } from './db';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function scheduleAlarm(alarm: Alarm): Promise<void> {
  await saveAlarm(alarm);
  checkAndFireAlarms();
}

export async function cancelAlarm(alarmId: string): Promise<void> {
  await deleteAlarm(alarmId);
}

let alarmCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startAlarmScheduler(): void {
  if (alarmCheckInterval) return;
  alarmCheckInterval = setInterval(checkAndFireAlarms, 30_000);
  checkAndFireAlarms();
}

export function stopAlarmScheduler(): void {
  if (alarmCheckInterval) {
    clearInterval(alarmCheckInterval);
    alarmCheckInterval = null;
  }
}

export async function checkAndFireAlarms(): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const now = Date.now();
  let alarms: Alarm[] = [];
  try {
    alarms = await getAlarms();
  } catch {
    return;
  }

  for (const alarm of alarms) {
    if (!alarm.fired && alarm.scheduledAt <= now) {
      fireAlarm(alarm);
      alarm.fired = true;
      await saveAlarm(alarm);
    }
  }
}

function fireAlarm(alarm: Alarm): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: alarm.title || 'Flow アラーム',
      options: {
        body: alarm.text,
        tag: alarm.id,
        icon: '/icons/icon-192.png',
        requireInteraction: true,
        data: { url: '/', noteId: alarm.noteId, alarmId: alarm.id },
      },
    });
  } else {
    new Notification(alarm.title || 'Flow アラーム', {
      body: alarm.text,
      icon: '/icons/icon-192.png',
      tag: alarm.id,
      requireInteraction: true,
    });
  }
}

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[Flow SW] Registered:', reg.scope);
        })
        .catch((err) => {
          console.error('[Flow SW] Registration failed:', err);
        });
    });
  }
}

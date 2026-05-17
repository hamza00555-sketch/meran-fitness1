import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

self.skipWaiting();
self.__WB_DISABLE_DEV_LOGS = true;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

const TIPS = [
  'قاعدة 50/30/20: 50% للاحتياجات، 30% للرغبات، 20% للادخار',
  'ابنِ صندوق طوارئ يكفي 3-6 أشهر من مصروفك',
  'المبلغ الصغير يتراكم مع الزمن — وفّر 100 ريال كل شهر وشوف النتيجة',
  'راجع التزاماتك كل 3 أشهر وشيل اللي ماتحتاجه',
  'خصص للادخار أول ما ينزل راتبك، مو من اللي يتبقى',
  'قبل أي شراء اسأل نفسك: هل أحتاجه فعلاً أم أريده فقط؟',
  'الاشتراكات الصغيرة تتراكم — راجعها دورياً وألغِ اللي ماتستخدمه',
  'ضع هدفاً مالياً واضحاً والتزم بخطة ادخار شهرية لتحقيقه',
  'تجنب القروض للكماليات — ادفع للمستقبل مو للماضي',
  'زد مساهمتك الشهرية في هدف التوفير ولو 50 ريال كل شهر',
  'لا تقارن نفسك بغيرك — الاستقرار المالي أهم من المظاهر',
  'التخطيط المسبق يوفر عليك كثيراً — خطط لمصروفك قبل ما يجي',
];

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(handlePeriodicSync());
  }
});

async function handlePeriodicSync() {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    if (clients.length > 0) return;

    const db = await openIDB();
    const commitments = await getAllFromStore(db, 'commitments');
    const today = new Date().getDate();
    const tomorrow = today + 1;

    for (const c of commitments) {
      if (c.active === false) continue;
      if (Number(c.dayOfMonth) === today) {
        await self.registration.showNotification('تذكير: التزام مستحق اليوم 📅', {
          body: `${c.name} — ${c.amount} ريال`,
          icon: '/assets/icons/app-icon.png',
          badge: '/icon-192.png',
          tag: `commitment-${c.id}-${today}`,
          data: { type: 'commitment' },
        });
      } else if (Number(c.dayOfMonth) === tomorrow) {
        await self.registration.showNotification('تذكير: التزام مستحق غداً ⏰', {
          body: `${c.name} — ${c.amount} ريال`,
          icon: '/assets/icons/app-icon.png',
          badge: '/icon-192.png',
          tag: `commitment-tomorrow-${c.id}`,
          data: { type: 'commitment' },
        });
      }
    }

    const now = new Date();
    const hour = now.getHours();
    const todayStr = now.toISOString().split('T')[0];
    let slot;
    if (hour >= 8 && hour < 13) slot = 0;
    else if (hour >= 13 && hour < 19) slot = 1;
    else if (hour >= 19) slot = 2;

    if (slot !== undefined) {
      const tipKey = `tip-${todayStr}-${slot}`;
      const lastTipKey = await getMetaValue(tipKey);
      if (!lastTipKey) {
        const usedKeys = await Promise.all([0, 1, 2].map(s => getMetaValue(`tip-${todayStr}-${s}`)));
        const used = usedKeys.filter(Boolean).map(Number);
        let idx;
        do { idx = Math.floor(Math.random() * TIPS.length); } while (used.includes(idx));
        await self.registration.showNotification('نصيحة مالية 💡', {
          body: TIPS[idx],
          icon: '/assets/icons/app-icon.png',
          badge: '/icon-192.png',
          tag: `financial-tip-${slot}`,
        });
        await setMetaValue(tipKey, String(idx));
      }
    }
  } catch {}
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('/');
    })
  );
});

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ratebi-db', 3);
    req.onupgradeneeded = e => {
      const database = e.target.result;
      const old = e.oldVersion;
      if (old < 1) {
        database.createObjectStore('settings', { keyPath: 'key' });
        database.createObjectStore('commitments', { keyPath: 'id' });
        database.createObjectStore('goals', { keyPath: 'id' });
        database.createObjectStore('expenses', { keyPath: 'id' });
        database.createObjectStore('monthlyRecords', { keyPath: 'month' });
      }
      if (old < 2) database.createObjectStore('banks', { keyPath: 'id' });
      if (old < 3) {
        database.createObjectStore('debts', { keyPath: 'id' });
        database.createObjectStore('extraIncome', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllFromStore(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function openMetaDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ratebi-meta', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('meta', { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getMetaValue(key) {
  try {
    const db = await openMetaDB();
    return new Promise((resolve) => {
      const tx = db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function setMetaValue(key, value) {
  try {
    const db = await openMetaDB();
    return new Promise((resolve) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key, value });
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {}
}

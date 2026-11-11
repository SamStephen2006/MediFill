// Minimal service worker: lets mobile browsers show MediFill notifications
// (Chrome on Android doesn't support `new Notification()` from a page).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Tapping a notification opens the screen it was sent for (e.g. a refill
// reminder opens /pharmacy) in the open MediFill tab, or in a new one.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          return client.focus().then(c => ('navigate' in c ? c.navigate(url) : c));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

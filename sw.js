/* sw.js - Service Worker */
// Этот файл может быть пустым или содержать базовый обработчик
// Мы добавляем только событие 'install', чтобы браузер его распознал
self.addEventListener('install', (event) => {
  console.log('Service Worker установлен');
});

self.addEventListener('fetch', (event) => {
  // Вы можете добавить сюда логику кэширования, но для активации PWA достаточно оставить пустой.
});
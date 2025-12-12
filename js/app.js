// TODO: Добавить кэширование ответов API
// INFO: Эта функция временная, будет удалена в v2.0
// WARN: Не использовать в продакшене, есть проблемы с памятью
// ERROR: Известная проблема с IE11

// INFO: URL ВЕБ-ПРИЛОЖЕНИЯ
const API_URL = "https://script.google.com/macros/s/AKfycbwR8kXMqCgK4u8ViZUVjWSYMWYFgh6tDPfil2cEH8H-_-qdt0QTnOVmLIN_8Hu6PqA0/exec";

// INFO: --- ЛОГИКА АВТОРИЗАЦИИ ---
const SESSION_KEY = 'guild_crafter_session';
const SESSION_DURATION = 30 * 60 * 1000; // 30 минут

function getSession() {
  const sessionStr = localStorage.getItem(SESSION_KEY);
  if (!sessionStr) return null;

  const session = JSON.parse(sessionStr);
  const now = new Date().getTime();

  if (now > session.expiry) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

function saveSession(user, token) {
  const now = new Date().getTime();
  const session = {
    user: user,
    token: token,
    expiry: now + SESSION_DURATION
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// Получаем параметры URL (для режима редактирования)
const urlParams = new URLSearchParams(window.location.search);
const urlUser = urlParams.get('user');
const urlToken = urlParams.get('token');

// Работа с сессией
const session = getSession();
let sessionUser = session ? session.user : null;
let sessionToken = session ? session.token : null;

// Если в URL есть параметры - обновляем сессию
if (urlUser && urlToken) {
  saveSession(urlUser, urlToken);
  sessionUser = urlUser;
  sessionToken = urlToken;
}

// Режим редактирования: ТОЛЬКО если есть параметры в URL
const isEditMode = !!(urlUser && urlToken);
// Данные для редактирования берем из URL
const currentUser = urlUser;
const currentToken = urlToken;

// INFO: --- НАЧАЛО DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {

  setupAuthUI();
  loadData();

  // Слушатели фильтров
  const professionFilter = document.getElementById('professionFilter');
  const searchInput = document.getElementById('searchInput');
  const clearSearchButton = document.getElementById('clearSearch');

  // При изменении фильтра сначала обновляется стиль, потом таблица
  if (professionFilter) {
    professionFilter.addEventListener('change', () => {
      updateProfessionFilterStyle();
      renderTable();
    });
  }

  // Отслеживаем ввод и показываем/скрываем крестик
  if (searchInput && clearSearchButton) {
    searchInput.addEventListener('input', () => {
      if (searchInput.value.length > 0) {
        clearSearchButton.style.display = 'block';
      } else {
        clearSearchButton.style.display = 'none';
      }
      renderTable(); // Обновляем таблицу при вводе
    });

    // Обработка клика по крестику
    clearSearchButton.addEventListener('click', () => {
      searchInput.value = ''; // Очищаем поле
      clearSearchButton.style.display = 'none'; // Скрываем крестик
      renderTable(); // Обновляем таблицу, сбрасывая фильтр поиска
      searchInput.focus(); // Для удобства можно вернуть фокус
    });
  }

  // INFO: --- ЛОГИКА IMAGE GALLERY & IMAGE MODAL (Скриншот) ---

  // Получение элементов галереи
  const galleryContainer = document.getElementById('galleryContainer');
  const heroImage = document.getElementById('heroImage');
  const prevImageBtn = document.getElementById('prevImage');
  const nextImageBtn = document.getElementById('nextImage');
  const ragnarosImageContainer = document.getElementById('ragnarosImage'); // Клик по картинке

  // Получение данных о картинках
  let images = [];
  let currentIndex = 0;
  const PRELOAD_COUNT = 3; // Количество картинок для предзагрузки в каждую сторону

  if (galleryContainer) {
    try {
      images = JSON.parse(galleryContainer.getAttribute('data-images'));
      currentIndex = parseInt(galleryContainer.getAttribute('data-modal-image-index')) || 0;
    } catch (e) {
      console.error("Ошибка парсинга списка изображений:", e);
    }

    // Начальная предзагрузка
    preloadImages();
  }

  // Функция для агрессивной предварительной загрузки соседних изображений (в обе стороны). Загрузка происходит в фоновом режиме, используя браузерный кэш.
  function preloadImages() {
    if (images.length <= 1) return;

    for (let i = 1; i <= PRELOAD_COUNT; i++) {
      // Загрузка вперед
      const nextIndex = (currentIndex + i) % images.length;
      const nextImg = new Image();
      nextImg.src = images[nextIndex];

      // Загрузка назад
      const prevIndex = (currentIndex - i + images.length) % images.length;
      const prevImg = new Image();
      prevImg.src = images[prevIndex];
    }
  }

  // Функция для обновления картинки с ожиданием загрузки (для устранения задержки)
  function updateImage(index) {
    if (images.length === 0) return;

    // Циклическое листание
    let newIndex = index;
    if (newIndex >= images.length) {
      newIndex = 0;
    } else if (newIndex < 0) {
      newIndex = images.length - 1;
    }

    const newSrc = images[newIndex];

    // 1. Создаем временный объект Image для проверки загрузки
    const tempImg = new Image();

    // 2. Снимаем класс fade-in и добавляем fade-out, чтобы запустить затухание
    heroImage.classList.remove('fade-in');
    heroImage.classList.add('fade-out');
    // Затухание происходит мгновенно благодаря transition в CSS, но смена src еще не произошла.

    // Задержка на время, пока длится CSS-переход (0.3s)
    setTimeout(() => {
      tempImg.onload = () => {
        // 4. Как только изображение загружено/декодировано, меняем src основного элемента
        heroImage.src = newSrc;

        // 5. Убираем fade-out и добавляем fade-in, чтобы запустить плавное появление
        heroImage.classList.remove('fade-out');
        heroImage.classList.add('fade-in');

        // 6. Обновляем текущий индекс и атрибуты
        currentIndex = newIndex;
        galleryContainer.setAttribute('data-modal-image-index', currentIndex);

        // 7. Вызываем предзагрузку, чтобы загрузить НОВЫХ соседей
        preloadImages();
      };

      // 3. Запускаем загрузку
      tempImg.src = newSrc;
    }, 300); // 300ms соответствует 0.3s transition в CSS
  }

  // ЛОГИКА СТРЕЛОК
  if (prevImageBtn) {
    prevImageBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Предотвращаем срабатывание клика по самой картинке
      updateImage(currentIndex - 1);
    });
  }

  if (nextImageBtn) {
    nextImageBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Предотвращаем срабатывание клика по самой картинке
      updateImage(currentIndex + 1);
    });
  }

  // ЛОГИКА ОТКРЫТИЯ МОДАЛКИ (Открывает текущую картинку)
  const imageModal = document.getElementById('imageModal');
  const closeImageModal = document.getElementById('closeImageModal');
  const fullImage = document.getElementById('fullImage');

  if (ragnarosImageContainer) {
    ragnarosImageContainer.addEventListener('click', function () {
      if (images.length > 0) {
        // Устанавливаем текущий URL в полноразмерную модалку
        fullImage.src = images[currentIndex];
        imageModal.classList.add('is-open');
        enableZoom();
      }
    });
  }

  // ЛОГИКА ЗАКРЫТИЯ МОДАЛКИ
  if (closeImageModal) {
    closeImageModal.addEventListener('click', function () {
      imageModal.classList.remove('is-open');
      disableZoom();
    });
  }

  if (imageModal) {
    window.addEventListener('click', function (event) {
      if (event.target === imageModal) {
        imageModal.classList.remove('is-open');
        disableZoom();
      }
    });
  }

  // INFO: --- МОДАЛЬНОЕ ОКНО (СПИСОК КРАФТЕРОВ) ---
  const craftersModal = document.getElementById('craftersModal');
  const loginModal = document.getElementById('loginModal');
  // Используем querySelectorAll, так как у нас теперь несколько крестиков
  const closeBtns = document.querySelectorAll('.close-modal');

  closeBtns.forEach(btn => {
    btn.onclick = function () {
      if (craftersModal) craftersModal.style.display = "none";
      if (loginModal) loginModal.style.display = "none";
    }
  });

  window.onclick = (event) => {
    if (event.target == craftersModal) {
      craftersModal.style.display = "none";
    }
    if (event.target == loginModal) {
      loginModal.style.display = "none";
    }
  };

  // INFO: --- ЛОГИКА МОДАЛЬНОГО ОКНА НАБОРА В ГИЛЬДИЮ ---
  const recruitmentModal = document.getElementById('recruitmentModal');
  const openRecruitmentLink = document.getElementById('openRecruitmentLink');
  const closeRecruitmentModal = document.getElementById('closeRecruitmentModal');

  // 1. ЛОГИКА ЗАКРЫТИЯ
  if (recruitmentModal && closeRecruitmentModal) {
    // Закрытие по крестику
    closeRecruitmentModal.addEventListener('click', () => {
      recruitmentModal.style.display = "none";
    });

    // Закрытие по клику вне модального окна
    // Используем event.target, чтобы не конфликтовать с window.onclick для других модалок
    window.addEventListener('click', (e) => {
      if (e.target === recruitmentModal) {
        recruitmentModal.style.display = "none";
      }
    });
  }

  // 2. ЛОГИКА ОТКРЫТИЯ ПО ССЫЛКЕ (РАБОТАЕТ ТОЛЬКО НА INDEX.HTML)
  if (recruitmentModal && openRecruitmentLink) {
    // Открытие модального окна
    openRecruitmentLink.addEventListener('click', (e) => {
      e.preventDefault();
      recruitmentModal.style.display = "block";
    });
  }

  // INFO: --- БАННЕР "НАБОР В ГИЛЬДИЮ" (Справа внизу) ---
  const recruitmentBanner = document.getElementById('recruitmentBanner');

  // Проверяем, есть ли баннер и модалка на странице
  if (recruitmentBanner && recruitmentModal) {

    // 1. Показываем баннер через 2 секунды после загрузки сайта
    setTimeout(() => {
      recruitmentBanner.classList.add('show');
    }, 2000);

    // 2. Скрываем баннер автоматически через 10 секунд (2 сек задержка + 8 сек показ)
    setTimeout(() => {
      recruitmentBanner.classList.remove('show');
    }, 10000);

    // 3. Обработка клика
    recruitmentBanner.addEventListener('click', () => {
      // Скрываем баннер
      recruitmentBanner.classList.remove('show');
      // Открываем модальное окно (recruitmentModal уже объявлен выше в твоем коде)
      recruitmentModal.style.display = "block";
    });
  }

  // INFO: --- PWA ЛОГИКА УСТАНОВКИ ---
  let deferredPrompt;
  const installBtn = document.getElementById('installAppBtn');
  // Добавляем переменную для управления таймером скрытия
  let hideTimer;

  window.addEventListener('beforeinstallprompt', (e) => {
    // 1. Предотвращаем автоматическое появление
    e.preventDefault();
    // 2. Сохраняем событие
    deferredPrompt = e;

    if (installBtn) {
      // Очищаем предыдущий таймер на всякий случай
      clearTimeout(hideTimer);
      // 3. Показываем нашу кнопку/баннер (CSS сделает ее видимой и анимирует)
      // ВАЖНО: На ПК эта кнопка скрыта через CSS Media Query.
      installBtn.classList.add('show-install-banner');

      console.log('Пойман beforeinstallprompt, баннер показан.');

      // 4. Скрываем баннер через 5 секунд (5000 мс)
      hideTimer = setTimeout(() => {
        if (installBtn && deferredPrompt) {
          // Если пользователь не нажал, убираем баннер, плавно уезжая вверх
          installBtn.classList.remove('show-install-banner');
          console.log('Баннер скрыт по таймауту.');
        }
      }, 5000);
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      // 4.1. Сразу убираем таймер и скрываем баннер
      clearTimeout(hideTimer);
      installBtn.classList.remove('show-install-banner');
      // 5. Показываем системный промпт
      deferredPrompt.prompt();
      // 6. Ждем выбора пользователя
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Пользователь выбрал: ${outcome}`);
      // 7. Обнуляем переменную
      deferredPrompt = null;
    });
  }

  // Опционально: слушаем, если приложение уже установлено
  window.addEventListener('appinstalled', () => {
    console.log('Приложение установлено');
    if (installBtn) {
      // 8. Убираем баннер, если он был виден
      clearTimeout(hideTimer);
      installBtn.classList.remove('show-install-banner');
    }
  });

  // Логика рандомного цвета для футера
  const footerLink = document.querySelector('.footer a');

  if (footerLink) {
    // Событие: Мышь наведена
    footerLink.addEventListener('mouseenter', () => {
      // Генерируем новый цвет
      const newColor = getRandomLightColor();

      // Применяем новый цвет как inline-стиль.
      // Это переопределяет старый цвет, если он был
      footerLink.style.color = newColor;
    });
  }

  // INFO: --- МОБИЛЬНОЕ МЕНЮ (БУРГЕР) ---
  const burgerBtn = document.getElementById('burgerBtn');
  const navLinks = document.getElementById('navLinks');
  const navElement = document.querySelector('nav'); // <--- Находим сам навбар

  if (burgerBtn && navLinks && navElement) {
    burgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      burgerBtn.classList.toggle('active');
      navLinks.classList.toggle('active');
      navElement.classList.toggle('menu-open'); // <--- Переключаем класс на nav
    });

    // Закрытие меню при клике вне его области
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('active') && !navLinks.contains(e.target)) {
        burgerBtn.classList.remove('active');
        navLinks.classList.remove('active');
        navElement.classList.remove('menu-open'); // <--- Убираем класс с nav
      }
    });

    // Закрытие меню при клике на ссылку
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burgerBtn.classList.remove('active');
        navLinks.classList.remove('active');
        navElement.classList.remove('menu-open'); // <--- Убираем класс с nav
      });
    });
  }

});
// INFO: --- КОНЕЦ DOMContentLoaded ---

// Устанавливает viewport, который разрешает масштабирование (для модального окна).
function enableZoom() {
  const metaTag = document.getElementById('viewport-meta');
  if (metaTag) {
    // Разрешаем масштабирование и не ограничиваем максимальный масштаб
    metaTag.setAttribute('content', 'width=device-width, initial-scale=1.0');
    console.log('Zoom ENABLED');
  }
}

// Устанавливает viewport, который запрещает масштабирование (стандартное состояние).
function disableZoom() {
  const metaTag = document.getElementById('viewport-meta');
  if (metaTag) {
    // Запрещаем масштабирование и ограничиваем максимальный масштаб 1.0
    metaTag.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    console.log('Zoom DISABLED');
  }
}

// Функция авторизации
function setupAuthUI() {
  const loginLink = document.getElementById('loginLink');
  if (!loginLink) return;

  const logoutBtn = document.getElementById('logoutBtn');
  const loginModal = document.getElementById('loginModal');
  const performLoginBtn = document.getElementById('performLogin');

  // Получаем поля ввода для авторизации (используются ниже)
  const loginUser = document.getElementById('loginUser');
  const loginToken = document.getElementById('loginToken');

  // Если есть активная сессия (sessionUser)
  if (sessionUser) {
    loginLink.textContent = sessionUser + ' (Вы)';
    // Ссылка ведет на страницу с параметрами (режим редактирования)
    loginLink.href = `recipes.html?user=${sessionUser}&token=${sessionToken}`;
    loginLink.title = "Нажмите, чтобы перейти в режим редактирования";

    // Показываем кнопку выхода
    if (logoutBtn) {
      logoutBtn.style.display = 'inline-block';
      logoutBtn.onclick = () => {
        localStorage.removeItem(SESSION_KEY);
        // Редирект на чистую страницу
        window.location.href = 'recipes.html';
      };
    }

    // При клике на имя обновляем сессию
    loginLink.onclick = (e) => {
      saveSession(sessionUser, sessionToken);
    };
  } else {
    // Если не авторизованы
    loginLink.textContent = "ВОЙТИ";
    loginLink.href = "#";
    loginLink.title = "Войти в систему";

    if (logoutBtn) logoutBtn.style.display = 'none';

    loginLink.onclick = (e) => {
      e.preventDefault();
      if (loginModal) loginModal.style.display = "block";
    };
  }

  // Обработка входа через клавишу ENTER
  const handleEnterKey = (event) => {
    // Проверяем, была ли нажата клавиша Enter
    if (event.key === 'Enter') {
      event.preventDefault();
      // Имитируем нажатие на кнопку "Войти"
      performLoginBtn.click();
    }
  };

  if (loginUser) {
    loginUser.addEventListener('keypress', handleEnterKey);
  }
  if (loginToken) {
    loginToken.addEventListener('keypress', handleEnterKey);
  }

  // Обработка входа через кнопку
  if (performLoginBtn && loginUser && loginToken) {
    performLoginBtn.onclick = () => {
      const user = loginUser.value.trim();
      const token = loginToken.value.trim();

      if (user && token) {
        saveSession(user, token);
        // Перезагружаем страницу с параметрами
        window.location.href = `recipes.html?user=${user}&token=${token}`;
      } else {
        alert("Пожалуйста, введите логин и токен");
      }
    };
  }
}

let globalData = { headers: [], rows: [], userColumns: [] }; // Обновляем структуру данных
let globalAliases = {}; // <--- Хранилище для алиасов

async function loadData() {
  const loader = document.getElementById('loader');
  if (!loader) return;

  try {
    const response = await fetch(API_URL);
    const json = await response.json(); // Сначала получаем "сырой" JSON

    let data;

    // Если пришел новый формат с алиасами (объект с полями tableData и userAliases)
    if (json.tableData) {
      data = json.tableData;            // Сама таблица рецептов
      globalAliases = json.userAliases || {}; // Сохраняем красивые имена
    } else {
      // Если пришел старый формат (просто массив, на всякий случай)
      data = json;
      globalAliases = {};
    }

    if (json.error) {
      throw new Error(json.error);
    }

    globalData.headers = data[0];
    globalData.rows = data.slice(1);

    // Обработка числовых заголовков и учет новой колонки URL
    globalData.userColumns = [];
    globalData.headers.forEach((colName, index) => {
      // Приводим к строке, чтобы избежать ошибки .trim() на числах
      const name = String(colName || '').trim();

      // Колонка считается "игроком" если:
      // 1. Индекс >= 3 (после Профессии (0), Рецепта (1) и Ссылки (2))
      // 2. Заголовок (name) не пустой
      if (index >= 3 && name !== '') {
        globalData.userColumns.push({
          name: name,
          index: index // Индекс в массиве row[]
        });
      }
    });

    populateProfessionFilter();
    updateProfessionFilterStyle();
    renderTable();
    loader.style.display = 'none';

  } catch (error) {
    loader.innerHTML = "Не удалось загрузить базу данных: " + error.message;
    console.error(error);
  }
}

function updateProfessionFilterStyle() {
  const select = document.getElementById('professionFilter');
  if (!select) return;

  if (select.value === 'All') {
    // Добавляем класс, когда выбрана опция по умолчанию
    select.classList.add('placeholder-style');
  } else {
    // Удаляем класс, когда выбрана конкретная профессия
    select.classList.remove('placeholder-style');
  }
}

function populateProfessionFilter() {
  const select = document.getElementById('professionFilter');
  if (!select) return;

  const professions = [...new Set(globalData.rows.map(row => row[0]))].filter(p => p && !p.startsWith('---'));

  professions.forEach(prof => {
    const option = document.createElement('option');
    option.value = prof;
    option.textContent = prof;
    select.appendChild(option);
  });
}

function renderTable() {
  const tbody = document.querySelector('#recipeTable tbody');
  const thead = document.querySelector('#recipeTable thead');
  if (!tbody || !thead) return;

  const filterProf = document.getElementById('professionFilter').value;
  const filterText = document.getElementById('searchInput').value.toLowerCase();

  // 1. Отрисовка шапки
  thead.innerHTML = '';
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `<th>Название рецепта</th>`;

  if (isEditMode) {
    globalData.userColumns.forEach(userCol => {
      if (userCol.name.toLowerCase() === currentUser.toLowerCase()) {
        headerRow.innerHTML += `<th>${userCol.name} (Вы)</th>`;
      }
    });
  } else {
    headerRow.innerHTML += `<th class="th-center">Кто крафтит</th>`;
  }
  thead.appendChild(headerRow);

  // 2. Отрисовка тела
  tbody.innerHTML = '';

  globalData.rows.forEach((row, rowIndex) => {
    const profession = row[0];
    const recipeName = row[1];
    const recipeLink = row[2]; // <--- Получаем ссылку по индексу 2

    const isCategory = recipeName && recipeName.startsWith('---') && recipeName.endsWith('---');

    // Фильтрация
    if (filterProf !== 'All' && profession !== filterProf) return;

    // Скрытие категорий при поиске
    if (filterText) {
      // Если есть поиск, и это категория - пропускаем
      if (isCategory) return;

      // Если есть поиск, но рецепт не найден - пропускаем
      if (!recipeName.toLowerCase().includes(filterText)) return;
    }

    const tr = document.createElement('tr');

    // Проверка на заголовок категории (---[Prof] Type---)
    if (isCategory) {
      tr.className = 'category-row';

      // Удаляем только --- в начале и конце строки для формата ---[Prof] Type---
      let cleanName = recipeName.replace(/^---|---$/g, '').trim();

      // colspan: 1 (Рецепт) + 1 (Колонка действий/игрока)
      tr.innerHTML = `<td colspan="2">${cleanName}</td>`;
      tbody.appendChild(tr);
      return;
    }

    // Пропускаем пустые строки, которые не являются категориями
    if (!recipeName && !profession) return;


    // Обычная строка (КОНТЕЙНЕР РЕЦЕПТА)
    let recipeCellHtml = '';

    // Логика для ссылки-смайлика
    if (recipeLink && String(recipeLink).startsWith('http')) {
      // Если есть ссылка, создаем flex-контейнер и иконку
      const linkIconHtml = `<a href="${recipeLink}" target="_blank" class="link-icon" title="Открыть ссылку">🌐</a>`;
      recipeCellHtml = `<td class="recipe-cell">
                                <span>${recipeName}</span>
                                ${linkIconHtml}
                            </td>`;
    } else {
      // Если ссылки нет, просто выводим название
      recipeCellHtml = `<td>${recipeName}</td>`;
    }

    let rowHtml = recipeCellHtml; // Первая ячейка

    if (isEditMode) {
      // Режим редактирования: показываем слайдер только для текущего пользователя
      const userCol = globalData.userColumns.find(col => col.name.toLowerCase() === currentUser.toLowerCase());
      if (userCol) {
        const hasRecipe = row[userCol.index] === true;
        const checked = hasRecipe ? 'checked' : '';
        const uniqueId = `slider-${rowIndex}`;

        rowHtml += `
                    <td class="action-cell">
                        <div class="slider-container">
                            <div class="slider">
                                <input type="checkbox" id="${uniqueId}" class="slider-checkbox" ${checked}
                                    onchange="updateRecipe('${profession}', '${recipeName}', this.checked)">
                                <label class="slider-label" for="${uniqueId}">
                                    <span class="slider-inner"></span>
                                </label>
                            </div>
                        </div>
                    </td>`;
      } else {
        rowHtml += `<td>Пользователь не найден</td>`;
      }
    } else {
      // Режим просмотра: собираем список крафтеров
      const crafters = [];
      globalData.userColumns.forEach(userCol => {
        if (row[userCol.index] === true) {

          // --- ПОДСТАНОВКА АЛИАСА ---
          const loginLower = userCol.name.toLowerCase();
          // Если есть алиас в базе - берем его, если нет - берем логин из заголовка
          const displayName = globalAliases[loginLower] ? globalAliases[loginLower] : userCol.name;

          crafters.push(displayName);
        }
      });

      const count = crafters.length;
      const btnText = count > 0 ? `<span class="btn-emoji">👁️</span> Показать (${count})` : `<span class="btn-emoji">🚫</span> Никого`;
      const btnClass = count > 0 ? '' : 'style="opacity: 0.5; cursor: default;"';
      const onClick = count > 0 ? 'onclick="openCraftersModal(this)"' : '';
      const btnTitle = count > 0 ? 'Показать список' : 'Никто не умеет крафтить этот предмет';

      // Экранируем кавычки для JSON
      const dataCrafters = JSON.stringify(crafters).replace(/"/g, '&quot;');

      rowHtml += `
                <td class="action-cell">
                    <button class="crafters-btn"
                        ${btnClass}
                        title="${btnTitle}"
                        data-recipe="${recipeName.replace(/"/g, '&quot;')}"
                        data-crafters="${dataCrafters}"
                        ${onClick}>
                        ${btnText}
                    </button>
                </td>`;
    }

    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });
}

// Отправка данных на сервер с обработкой ошибок
async function updateRecipe(profession, recipeName, isChecked) {
  if (!isEditMode) return;

  const checkbox = event.target; // Сохраняем ссылку на чекбокс

  try {
    // Мы используем 'text/plain', чтобы избежать CORS Preflight (OPTIONS) запроса.
    // Google Apps Script все равно прочитает тело как строку и распарсит JSON.
    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: "follow",
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        user: currentUser,
        token: currentToken,
        profession: profession,
        recipe: recipeName,
        value: isChecked
      })
    });

    const result = await response.json();

    // Проверка ответа сервера
    if (result.status === 'error') {
      // Если ошибка - откатываем галочку
      checkbox.checked = !isChecked;

      // Показываем уведомление
      alert(`Не удалось сохранить: ${result.message}`);
      console.error('Server error:', result.message);
    } else {
      console.log(`Успешно обновлено: ${recipeName} -> ${isChecked}`);
    }

  } catch (err) {
    // Если вообще не дошло до сервера - откатываем галочку
    checkbox.checked = !isChecked;
    alert('Ошибка соединения с сервером');
    console.error('Fetch error:', err);
  }
}

function openCraftersModal(btn) {
  const recipeName = btn.dataset.recipe;
  const crafters = JSON.parse(btn.dataset.crafters || '[]');

  const modal = document.getElementById('craftersModal');
  const title = document.getElementById('modalRecipeTitle');
  const list = document.getElementById('craftersList');

  title.textContent = recipeName;
  list.innerHTML = '';

  if (crafters.length === 0) {
    const li = document.createElement('li');
    li.textContent = "Никто не умеет крафтить этот предмет";
    li.style.fontStyle = 'italic';
    list.appendChild(li);
  } else {
    crafters.forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      list.appendChild(li);
    });
  }

  modal.style.display = "block";
}

// Вспомогательная функция для генерации светлого цвета

/**
 * Преобразует HSL (Hue, Saturation, Lightness) в HEX-цвет.
 * Это нужно для контроля Светлоты (L), чтобы цвет был ярким на темном фоне.
 */
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Генерирует случайный светлый цвет (L=75%) для темного фона.
 */
function getRandomLightColor() {
  const h = Math.floor(Math.random() * 360); // Случайный Оттенок (0-359)
  const s = 100; // Полная Насыщенность
  const l = 75;  // Высокая Светлота (L>70% отлично видно на черном/темно-сером)
  return hslToHex(h, s, l);
}

// URL ВЕБ-ПРИЛОЖЕНИЯ
const API_URL = "https://script.google.com/macros/s/AKfycbwR8kXMqCgK4u8ViZUVjWSYMWYFgh6tDPfil2cEH8H-_-qdt0QTnOVmLIN_8Hu6PqA0/exec"; // Твой URL

// Получаем параметры URL (для режима редактирования)
const urlParams = new URLSearchParams(window.location.search);
const currentUser = urlParams.get('user');
const currentToken = urlParams.get('token');
const isEditMode = currentUser && currentToken;

document.addEventListener('DOMContentLoaded', () => {
    // Вставляем заглушку для обложки (потом ты заменишь URL в CSS)
    const coverArea = document.querySelector('.cover-area');
    if (coverArea) {
        // Установка стандартного фона, пока ты не заменишь
        coverArea.style.background = 'url("https://images.unsplash.com/photo-1542838132-7561848a605f?fit=crop&w=1400&h=250") center center / cover no-repeat';
    }

    loadData();

    // Слушатели фильтров
    document.getElementById('professionFilter').addEventListener('change', renderTable);
    document.getElementById('searchInput').addEventListener('input', renderTable);
});

let globalData = {headers: [], rows: [], userColumns: []}; // Обновляем структуру данных

async function loadData() {
    const loader = document.getElementById('loader');
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        globalData.headers = data[0];
        globalData.rows = data.slice(1);
        
        // --- ИСПРАВЛЕНИЕ 1: Обработка числовых заголовков ---
        globalData.userColumns = [];
        globalData.headers.forEach((colName, index) => {
            // Приводим к строке, чтобы избежать ошибки .trim() на числах
            const name = String(colName || '').trim();
            
            // Колонка считается "игроком" если: 
            // 1. Индекс >= 2 (после Профессии и Рецепта)
            // 2. Заголовок (name) не пустой
            if (index >= 2 && name !== '') {
                globalData.userColumns.push({
                    name: name,
                    index: index // Индекс в массиве row[]
                });
            }
        });
        // ---------------------------------------------------

        populateProfessionFilter();
        renderTable();
        loader.style.display = 'none';
        
    } catch (error) {
        loader.innerHTML = "Ошибка загрузки данных: " + error.message;
        console.error(error);
    }
}

function populateProfessionFilter() {
    const select = document.getElementById('professionFilter');
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
    const filterProf = document.getElementById('professionFilter').value;
    const filterText = document.getElementById('searchInput').value.toLowerCase();

    // 1. Отрисовка Шапки
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th>Название рецепта</th>`;
    
    globalData.userColumns.forEach(userCol => {
        // В режиме редактирования показываем только колонку текущего юзера
        if (isEditMode) {
            if (userCol.name === currentUser) {
                headerRow.innerHTML += `<th>${userCol.name} (Вы)</th>`;
            }
        } else {
            // В режиме просмотра показываем всех найденных юзеров
            headerRow.innerHTML += `<th>${userCol.name}</th>`;
        }
    });
    thead.appendChild(headerRow);

    // 2. Отрисовка Тела
    tbody.innerHTML = '';
    
    globalData.rows.forEach(row => {
        const profession = row[0];
        const recipeName = row[1];
        
        const isCategory = recipeName && recipeName.startsWith('---') && recipeName.endsWith('---');

        // Фильтрация
        if (filterProf !== 'All' && profession !== filterProf) return;
        
        // --- ИСПРАВЛЕНИЕ 2: Скрытие категорий при поиске ---
        if (filterText) {
            // Если есть поиск, и это категория - пропускаем
            if (isCategory) return;
            
            // Если есть поиск, но рецепт не найден - пропускаем
            if (!recipeName.toLowerCase().includes(filterText)) return;
        }
        // ----------------------------------------------------

        const tr = document.createElement('tr');

        // Проверка на заголовок категории (---Flasks---)
        if (isCategory) {
            tr.className = 'category-row';
            const cleanName = recipeName.replace(/---/g, '').trim();
            // colspan: 1 (Рецепт) + количество отображаемых колонок игроков
            const colspanCount = 1 + (isEditMode ? 1 : globalData.userColumns.length); 
            tr.innerHTML = `<td colspan="${colspanCount}">${cleanName}</td>`;
            tbody.appendChild(tr);
            return;
        }
        
        // Пропускаем пустые строки, которые не являются категориями
        if (!recipeName && !profession) return;


        // Обычная строка
        let rowHtml = `<td>${recipeName}</td>`;
        
        // Фильтруем колонки игроков, которые нужно отобразить
        const columnsToRender = isEditMode 
            ? globalData.userColumns.filter(col => col.name === currentUser) 
            : globalData.userColumns;

        columnsToRender.forEach(userCol => {
            const hasRecipe = row[userCol.index] === true; // Используем сохраненный индекс
            
            if (isEditMode) {
                // РИСУЕМ ЧЕКБОКС
                const checked = hasRecipe ? 'checked' : '';
                rowHtml += `
                    <td style="text-align: center;">
                        <input type="checkbox" ${checked} 
                            onchange="updateRecipe('${profession}', '${recipeName}', this.checked)">
                    </td>`;
            } else {
                // РИСУЕМ ИКОНКУ (будет кликабельной на следующем шаге)
                const icon = hasRecipe ? '<span class="status-icon has-recipe">✅</span>' : '<span class="status-icon no-recipe">❌</span>';
                rowHtml += `<td style="text-align: center;">${icon}</td>`;
            }
        });

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });
}

// Отправка данных на сервер (остается без изменений)
function updateRecipe(profession, recipeName, isChecked) {
    if (!isEditMode) return;

    console.log(`Sending: ${recipeName} -> ${isChecked}`);

    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user: currentUser,
            token: currentToken,
            profession: profession,
            recipe: recipeName,
            value: isChecked
        })
    }).catch(err => console.error("Ошибка сохранения", err));
}

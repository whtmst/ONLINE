// URL ВЕБ-ПРИЛОЖЕНИЯ
const API_URL = "https://script.google.com/macros/s/AKfycbwR8kXMqCgK4u8ViZUVjWSYMWYFgh6tDPfil2cEH8H-_-qdt0QTnOVmLIN_8Hu6PqA0/exec";

// Получаем параметры URL (для режима редактирования)
const urlParams = new URLSearchParams(window.location.search);
const currentUser = urlParams.get('user');
const currentToken = urlParams.get('token');
const isEditMode = currentUser && currentToken;

document.addEventListener('DOMContentLoaded', () => {

    loadData();

    // Слушатели фильтров
    const professionFilter = document.getElementById('professionFilter');
    const searchInput = document.getElementById('searchInput');
    const clearSearchButton = document.getElementById('clearSearch');

    // При изменении фильтра сначала обновляется стиль, потом таблица
    professionFilter.addEventListener('change', () => {
        updateProfessionFilterStyle(); 
        renderTable();
    });
    
    // Отслеживаем ввод и показываем/скрываем крестик
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
});

let globalData = {headers: [], rows: [], userColumns: []}; // Обновляем структуру данных

async function loadData() {
    const loader = document.getElementById('loader');
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        globalData.headers = data[0];
        globalData.rows = data.slice(1);
        
        // --- Обработка числовых заголовков и учет новой колонки URL ---
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
        // ---------------------------------------------------

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

    // 1. Отрисовка шапки
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

    // 2. Отрисовка тела
    tbody.innerHTML = '';
    
    globalData.rows.forEach(row => {
        const profession = row[0];
        const recipeName = row[1];
        const recipeLink = row[2]; // <--- Получаем ссылку по индексу 2
        
        const isCategory = recipeName && recipeName.startsWith('---') && recipeName.endsWith('---');

        // Фильтрация
        if (filterProf !== 'All' && profession !== filterProf) return;
        
        // --- Скрытие категорий при поиске ---
        if (filterText) {
            // Если есть поиск, и это категория - пропускаем
            if (isCategory) return;
            
            // Если есть поиск, но рецепт не найден - пропускаем
            if (!recipeName.toLowerCase().includes(filterText)) return;
        }
        // ----------------------------------------------------

        const tr = document.createElement('tr');

        // Проверка на заголовок категории (---[Prof] Type---)
        if (isCategory) {
            tr.className = 'category-row';
            
            // Удаляем только --- в начале и конце строки для формата ---[Prof] Type---
            let cleanName = recipeName.replace(/^---|---$/g, '').trim(); 
            
            // colspan: 1 (Рецепт) + количество отображаемых колонок игроков
            const colspanCount = 1 + (isEditMode ? 1 : globalData.userColumns.length); 
            tr.innerHTML = `<td colspan="${colspanCount}">${cleanName}</td>`;
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

        // Собираем строку
        let rowHtml = recipeCellHtml; // Первая ячейка

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
                // РИСУЕМ ИКОНКУ
                const icon = hasRecipe ? '<span class="status-icon has-recipe">✅</span>' : '<span class="status-icon no-recipe">❌</span>';
                rowHtml += `<td style="text-align: center;">${icon}</td>`;
            }
        });

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
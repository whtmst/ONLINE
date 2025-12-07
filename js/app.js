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
    document.getElementById('professionFilter').addEventListener('change', renderTable);
    document.getElementById('searchInput').addEventListener('input', renderTable);
});

let globalData = []; // Храним данные здесь

async function loadData() {
    const loader = document.getElementById('loader');
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // data[0] - это заголовки [PROFESSION, RECIPE, Misha, Titanbeard...]
        // data[1...] - это строки
        globalData = {
            headers: data[0],
            rows: data.slice(1)
        };

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
    // Собираем уникальные профессии
    const professions = [...new Set(globalData.rows.map(row => row[0]))].filter(p => p);
    
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
    
    // Колонка Рецепт
    headerRow.innerHTML = `<th>Рецепт</th>`;
    
    // Колонки Игроков
    // Если EditMode -> Показываем только текущего юзера. Если нет -> Всех.
    const userColumnsIndices = []; // Индексы колонок, которые будем рисовать
    
    globalData.headers.forEach((colName, index) => {
        // Пропускаем первые 2 колонки (Профа, Рецепт)
        if (index < 2) return; 

        if (isEditMode) {
            if (colName === currentUser) {
                headerRow.innerHTML += `<th>${colName} (Вы)</th>`;
                userColumnsIndices.push(index);
            }
        } else {
            headerRow.innerHTML += `<th>${colName}</th>`;
            userColumnsIndices.push(index);
        }
    });
    thead.appendChild(headerRow);

    // 2. Отрисовка Тела
    tbody.innerHTML = '';
    
    globalData.rows.forEach(row => {
        const profession = row[0];
        const recipeName = row[1];

        // Фильтрация
        if (filterProf !== 'All' && profession !== filterProf) return;
        if (filterText && !recipeName.toLowerCase().includes(filterText)) return;

        const tr = document.createElement('tr');

        // Проверка на заголовок категории (---Flasks---)
        if (recipeName.startsWith('---') && recipeName.endsWith('---')) {
            tr.className = 'category-row';
            // Убираем тире для красоты
            const cleanName = recipeName.replace(/---/g, '').trim();
            // colspan растягиваем на (1 + количество игроков)
            tr.innerHTML = `<td colspan="${1 + userColumnsIndices.length}">${cleanName}</td>`;
            tbody.appendChild(tr);
            return;
        }

        // Обычная строка
        let rowHtml = `<td>${recipeName}</td>`;

        userColumnsIndices.forEach(colIndex => {
            const hasRecipe = row[colIndex] === true;
            
            if (isEditMode) {
                // РИСУЕМ ЧЕКБОКС
                // colIndex - это реальный индекс в массиве данных
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

// Отправка данных на сервер
function updateRecipe(profession, recipeName, isChecked) {
    if (!isEditMode) return;

    // Оптимистичный UI: мы не ждем ответа, чтобы не тупило
    console.log(`Sending: ${recipeName} -> ${isChecked}`);

    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', // Важно для GAS
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

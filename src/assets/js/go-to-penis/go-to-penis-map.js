ymaps.ready(init);
window.addEventListener('error', function(event) {
    console.error('Глобальная ошибка скрипта:', event.message, 'в', event.filename, 'на строке', event.lineno);
});

let randomCoords = {
    latitude: null,
    longitude: null
}

// Функция генерации случайной точки в радиусе radius метров от центра
function getRandomPoint(center, radius) {
    var r = radius / 111320; // приближённо переводим метры в градусы
    var y0 = center[0];
    var x0 = center[1];
    var u = Math.random();
    var v = Math.random();
    var w = r * Math.sqrt(u);
    var t = 2 * Math.PI * v;
    var x = w * Math.cos(t);
    var y = w * Math.sin(t);
    var newLat = y + y0;
    var newLon = x / Math.cos(y0 * Math.PI / 180) + x0;
    return [newLat, newLon];
}

// Общая функция инициализации карты, меток и маршрута
function renderMap(centerCoords, iconPreset) {
    var myMap = new ymaps.Map('map', {
        center: centerCoords,
        zoom: 12,
        controls: []
    }, {
        searchControlProvider: 'yandex#search'
    });

    var ipPlacemark = new ymaps.Placemark(centerCoords, {
        iconContent: iconPreset.text
    }, {
        preset: iconPreset.preset
    });
    myMap.geoObjects.add(ipPlacemark);

    // Генерируем случайные координаты и сохраняем их в глобальный объект
    var generatedCoords = getRandomPoint(centerCoords, 10000);
    randomCoords.latitude = generatedCoords[0];
    randomCoords.longitude = generatedCoords[1];

    var randomPlacemark = new ymaps.Placemark(generatedCoords, {
        iconContent: 'Иди сюда'
    }, {
        preset: iconPreset.randomPreset
    });
    myMap.geoObjects.add(randomPlacemark);

    ymaps.route([centerCoords, generatedCoords]).then(function(route) {
        route.options.set('wayPointVisible', false);
        route.getPaths().options.set({
            strokeColor: '#6EF9C2',
            opacity: 0.7,
            strokeWidth: 4
        });
        myMap.geoObjects.add(route);
    });
}

// Новый упрощённый init
function init() {
    var geolocation = ymaps.geolocation;
    geolocation.get({ provider: ['yandex', 'browser'], mapStateAutoApply: true })
        .then(function(result) {
            var coords = result.geoObjects.get(0).geometry.getCoordinates();
            renderMap(coords, {
                text: 'Ты примерно здесь',
                preset: 'islands#redStretchyIcon',
                randomPreset: 'islands#darkGreenStretchyIcon'
            });
        })
        .catch(function(error) {
            console.warn('Yandex-сервис не доступен, пробуем geolocation браузера...');
            return geolocation.get({ provider: 'browser', mapStateAutoApply: true });
        })
        .then(function(result) {
            if (result) {
                var coords = result.geoObjects.get(0).geometry.getCoordinates();
                renderMap(coords, {
                    text: 'Ты примерно здесь',
                    preset: 'islands#redStretchyIcon',
                    randomPreset: 'islands#darkOrangeStretchyIcon'
                });
            }
        })
        .catch(function(error) {
            console.error('Ошибка при получении геолокации или загрузке скрипта:', error);
        });
}


const coordinates = document.querySelector('#getCoordinates');
const sharing = document.querySelector('#share');

coordinates.addEventListener('click', () => {
alert(`Координаты: ${randomCoords.latitude.toFixed(3)}, ${randomCoords.longitude.toFixed(3)}`);
});

sharing.addEventListener('click', () => {
alert(`Да ну просто отправь ссылку друзьям!`);
});

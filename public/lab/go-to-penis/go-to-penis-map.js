ymaps.ready(init);

window.addEventListener('error', function (event) {
    console.error('Глобальная ошибка скрипта:', event.message, 'в', event.filename, 'на строке', event.lineno);
});

let randomCoords = {
    latitude: null,
    longitude: null
};

let mapRendered = false;

// Москва — дефолтный центр карты, если геолокация недоступна.
const DEFAULT_CENTER = [55.751244, 37.618423];
const GEOLOCATION_TIMEOUT_MS = 4000;

// Случайная точка в радиусе radius метров от центра.
function getRandomPoint(center, radius) {
    var r = radius / 111320;
    var y0 = center[0];
    var x0 = center[1];
    var u = Math.random();
    var v = Math.random();
    var w = r * Math.sqrt(u);
    var t = 2 * Math.PI * v;
    var x = w * Math.cos(t);
    var y = w * Math.sin(t);
    return [y + y0, x / Math.cos(y0 * Math.PI / 180) + x0];
}

function renderMap(centerCoords, iconPreset) {
    if (mapRendered) return;
    mapRendered = true;

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

    var generatedCoords = getRandomPoint(centerCoords, 10000);
    randomCoords.latitude = generatedCoords[0];
    randomCoords.longitude = generatedCoords[1];

    var randomPlacemark = new ymaps.Placemark(generatedCoords, {
        iconContent: 'Иди сюда'
    }, {
        preset: iconPreset.randomPreset
    });
    myMap.geoObjects.add(randomPlacemark);

    ymaps.route([centerCoords, generatedCoords]).then(function (route) {
        route.options.set('wayPointVisible', false);
        route.getPaths().options.set({
            strokeColor: '#6EF9C2',
            opacity: 0.7,
            strokeWidth: 4
        });
        myMap.geoObjects.add(route);
    });
}

function renderWithFallback() {
    renderMap(DEFAULT_CENTER, {
        text: 'Ты примерно здесь',
        preset: 'islands#redStretchyIcon',
        randomPreset: 'islands#darkOrangeStretchyIcon'
    });
}

function init() {
    var fallbackTimer = setTimeout(function () {
        if (!mapRendered) renderWithFallback();
    }, GEOLOCATION_TIMEOUT_MS);

    var geolocation = ymaps.geolocation;
    geolocation.get({ provider: ['yandex', 'browser'], mapStateAutoApply: true })
        .then(function (result) {
            clearTimeout(fallbackTimer);
            if (mapRendered) return;
            var coords = result.geoObjects.get(0).geometry.getCoordinates();
            renderMap(coords, {
                text: 'Ты примерно здесь',
                preset: 'islands#redStretchyIcon',
                randomPreset: 'islands#darkGreenStretchyIcon'
            });
        })
        .catch(function () {
            clearTimeout(fallbackTimer);
            if (mapRendered) return;
            renderWithFallback();
        });
}

const coordinates = document.querySelector('#getCoordinates');
const sharing = document.querySelector('#share');

coordinates.addEventListener('click', function () {
    if (randomCoords.latitude !== null) {
        alert('Координаты: ' + randomCoords.latitude.toFixed(3) + ', ' + randomCoords.longitude.toFixed(3));
    } else {
        alert('Карта ещё не загрузилась, подожди секунду.');
    }
});

sharing.addEventListener('click', function () {
    alert('Да ну просто отправь ссылку друзьям!');
});

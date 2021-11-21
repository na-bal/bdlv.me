ymaps.ready(init);

const myPos = {
    latitude: null,
    longitude: null
},
    newPos = {
    latitude: null,
    longitude: null
}
function init(){

    var geolocation = ymaps.geolocation,
        myMap = new ymaps.Map('map', {
            center: [55.753215, 37.622504],
            zoom: 11,
            controls:[]
        }, {
            searchControlProvider: 'yandex#search'
        });

geolocation.get({
    provider: 'yandex',
    // mapStateAutoApply: true
}).then(function (result) {
    result.geoObjects.options.set('preset', 'islands#redDotIcon');
    result.geoObjects.get(0).properties.set({
        balloonContentBody: 'Мое местоположение'
    });
    myMap.geoObjects.add(result.geoObjects);

    myPos.latitude = result.geoObjects.position[0];
    myPos.longitude = result.geoObjects.position[1];
    const userAddress = result.geoObjects.get(0).properties.get('text');
    // console.log(result);
    // console.log(userAddress);

    newPos.latitude = ((Math.random() < 0.5) ? -1 : 1) * Math.random() * 0.1 + myPos.latitude;
    newPos.longitude = ((Math.random() < 0.5) ? -1 : 1) * Math.random() * 0.1 + myPos.longitude;

    let placemark = new ymaps.Placemark([newPos.latitude, newPos.longitude], {
        balloonContentBody: [
            '<address>',
            '<strong>"Вот сюда" - это вот тут!</strong>',
            '<br/>',
            `Координаты: ${newPos.latitude.toFixed(3)}, ${newPos.longitude.toFixed(3)}`,
            '<br/>',
            `Адрес: ${userAddress}`,
            // 'Подробнее: <a href="https://company.yandex.ru/">https://company.yandex.ru</a>',
            // '<br/>',
            // '<img src="http://mis.mixmarket.biz/r/200/65735/149827303.jpg"/>',
            '</address>'
        ].join(''),
        hintContent: '<strong> Cюда! </strong>'
    }, {
        preset: "islands#blueDotIcon",
        iconColor: '#000000',
    });

    myMap.geoObjects.add(placemark);
    myMap.setCenter([newPos.latitude, newPos.longitude]);
    myMap.setZoom(14, {duration: 1000});
});

// geolocation.get({
//     provider: 'browser',
//     mapStateAutoApply: true
// }).then(function (result) {
//     // Синим цветом пометим положение, полученное через браузер.
//     // Если браузер не поддерживает эту функциональность, метка не будет добавлена на карту.
//     result.geoObjects.options.set('preset', 'islands#blueCircleIcon');
//     myMap.geoObjects.add(result.geoObjects);
// });

}

const coordinates = document.querySelector('#getCoordinates');
const sharing = document.querySelector('#share');

coordinates.addEventListener('click', () => {
alert(`Координаты: ${newPos.latitude.toFixed(3)}, ${newPos.longitude.toFixed(3)}`);
});

sharing.addEventListener('click', () => {
alert(`Да ну просто отправь ссылку друзьям!`);
});


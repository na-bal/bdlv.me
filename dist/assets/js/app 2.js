/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/assets/js/app.js":
/*!******************************!*\
  !*** ./src/assets/js/app.js ***!
  \******************************/
/***/ (function() {

eval("// import {Termynal} from './latest-updates/termynal';\r\n// let termynal = new Termynal;\r\n\r\nymaps.ready(init);\r\n\r\nconst myPos = {\r\n    latitude: null,\r\n    longitude: null\r\n},\r\n    newPos = {\r\n    latitude: null,\r\n    longitude: null\r\n}\r\nfunction init(){\r\n\r\n    var geolocation = ymaps.geolocation,\r\n        myMap = new ymaps.Map('map', {\r\n            center: [55.753215, 37.622504],\r\n            zoom: 11,\r\n            controls:[]\r\n        }, {\r\n            searchControlProvider: 'yandex#search'\r\n        });\r\n\r\ngeolocation.get({\r\n    provider: 'yandex',\r\n    // mapStateAutoApply: true\r\n}).then(function (result) {\r\n    result.geoObjects.options.set('preset', 'islands#redDotIcon');\r\n    result.geoObjects.get(0).properties.set({\r\n        balloonContentBody: 'Мое местоположение'\r\n    });\r\n    myMap.geoObjects.add(result.geoObjects);\r\n\r\n    myPos.latitude = result.geoObjects.position[0];\r\n    myPos.longitude = result.geoObjects.position[1];\r\n    const userAddress = result.geoObjects.get(0).properties.get('text');\r\n    // console.log(result);\r\n    // console.log(userAddress);\r\n\r\n    newPos.latitude = ((Math.random() < 0.5) ? -1 : 1) * Math.random() * 0.1 + myPos.latitude;\r\n    newPos.longitude = ((Math.random() < 0.5) ? -1 : 1) * Math.random() * 0.1 + myPos.longitude;\r\n\r\n    let placemark = new ymaps.Placemark([newPos.latitude, newPos.longitude], {\r\n        balloonContentBody: [\r\n            '<address>',\r\n            '<strong>\"Вот сюда\" - это вот тут!</strong>',\r\n            '<br/>',\r\n            `Координаты: ${newPos.latitude.toFixed(3)}, ${newPos.longitude.toFixed(3)}`,\r\n            '<br/>',\r\n            `Адрес: ${userAddress}`,\r\n            // 'Подробнее: <a href=\"https://company.yandex.ru/\">https://company.yandex.ru</a>',\r\n            // '<br/>',\r\n            // '<img src=\"http://mis.mixmarket.biz/r/200/65735/149827303.jpg\"/>',\r\n            '</address>'\r\n        ].join(''),\r\n        hintContent: '<strong> Cюда! </strong>'\r\n    }, {\r\n        preset: \"islands#blueDotIcon\",\r\n        iconColor: '#000000',\r\n    });\r\n\r\n    myMap.geoObjects.add(placemark);\r\n    myMap.setCenter([newPos.latitude, newPos.longitude]);\r\n    myMap.setZoom(14, {duration: 1000});\r\n});\r\n\r\n// geolocation.get({\r\n//     provider: 'browser',\r\n//     mapStateAutoApply: true\r\n// }).then(function (result) {\r\n//     // Синим цветом пометим положение, полученное через браузер.\r\n//     // Если браузер не поддерживает эту функциональность, метка не будет добавлена на карту.\r\n//     result.geoObjects.options.set('preset', 'islands#blueCircleIcon');\r\n//     myMap.geoObjects.add(result.geoObjects);\r\n// });\r\n\r\n}\r\n\r\nconst coordinates = document.querySelector('#getCoordinates');\r\nconst sharing = document.querySelector('#share');\r\n\r\ncoordinates.addEventListener('click', () => {\r\nalert(`Координаты: ${newPos.latitude.toFixed(3)}, ${newPos.longitude.toFixed(3)}`);\r\n});\r\n\r\nsharing.addEventListener('click', () => {\r\nalert(`Да ну просто отправь ссылку друзьям!`);\r\n});\r\n\r\n\r\n\n\n//# sourceURL=webpack://brainscloud/./src/assets/js/app.js?");

/***/ }),

/***/ "./src/assets/js/file2.js":
/*!********************************!*\
  !*** ./src/assets/js/file2.js ***!
  \********************************/
/***/ (function() {

eval("console.log('file 2');\r\n\n\n//# sourceURL=webpack://brainscloud/./src/assets/js/file2.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	__webpack_modules__["./src/assets/js/app.js"]();
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/assets/js/file2.js"]();
/******/ 	
/******/ })()
;
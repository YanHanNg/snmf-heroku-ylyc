importScripts('https://www.gstatic.com/firebasejs/8.2.2/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.2.2/firebase-messaging.js');

firebase.initializeApp({
    apiKey: "AIzaSyDZM-dKUswjlZ-0loHqiiZVCG99VIT5pl4",
    authDomain: "yourlifeyourchoice-ylyc.firebaseapp.com",
    projectId: "yourlifeyourchoice-ylyc",
    storageBucket: "yourlifeyourchoice-ylyc.appspot.com",
    messagingSenderId: "1051238305349",
    appId: "1:1051238305349:web:7064e74c4b5f8664425d2c",
    measurementId: "G-CQQEZPK664"
});

const messaging = firebase.messaging();


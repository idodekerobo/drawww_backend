"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestoreDb = void 0;
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../../../raffles-44479-firebase-adminsdk-kxxag-39041042c6.json');
// const serviceAccount = require('raffles-44479-firebase-adminsdk-kxxag-39041042c6.json');
initializeApp({
    credential: cert(serviceAccount)
});
exports.firestoreDb = getFirestore();

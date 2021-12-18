"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestoreDb = void 0;
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
// const serviceAccount = require('../../../raffles-44479-firebase-adminsdk-kxxag-39041042c6.json');
initializeApp({
    //   credential: cert(serviceAccount)
    credential: cert({
        "projectId": process.env.FB_CERT_PROJ_ID,
        "private_key": (_a = process.env.FB_CERT_PRIV_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n'),
        "client_email": process.env.FB_CERT_CLIENT_EMAIL,
    })
});
exports.firestoreDb = getFirestore();

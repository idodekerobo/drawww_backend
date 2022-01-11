const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// const serviceAccount = require('../../../raffles-44479-firebase-adminsdk-kxxag-39041042c6.json');
// const testServiceAccount = require('../../../test-dra-app-firebase-adminsdk-ctt8g-04f42cfd6b.json');

const primaryCert = {
   "projectId": process.env.FB_CERT_PROJ_ID,
   "private_key": process.env.FB_CERT_PRIV_KEY?.replace(/\\n/g, '\n'),
   "client_email": process.env.FB_CERT_CLIENT_EMAIL,
}
// const testAppCert = {
//    "projectId": 'process.env.FB_CERT_PROJ_ID',
//    "private_key": 'process.env.FB_CERT_PRIV_KEY?.replace(/\\n/g, '\n')',
//    "client_email": 'process.env.FB_CERT_CLIENT_EMAIL',
// }

initializeApp({
//   credential: cert(serviceAccount)
// credential: cert(testServiceAccount),
  credential: cert(primaryCert),
});

export const firestoreDb = getFirestore();
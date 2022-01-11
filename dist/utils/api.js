"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUsersInFirestorePostTxn = exports.updateDrawInFirestorePostTxn = exports.getUserFromFirestore = exports.getRaffleDataFromFirestore = exports.txnCollectionName = exports.drawCollectionName = void 0;
const firebase_1 = require("./firebase");
const firestore_1 = require("firebase-admin/firestore");
exports.drawCollectionName = 'draws';
const userCollectionName = 'users';
exports.txnCollectionName = 'transactions';
const getRaffleDataFromFirestore = (raffleId) => __awaiter(void 0, void 0, void 0, function* () {
    const raffleRef = firebase_1.firestoreDb.collection(exports.drawCollectionName).doc(raffleId);
    try {
        const raffleDocSnapshot = yield raffleRef.get();
        if (raffleDocSnapshot.exists) {
            const raffleData = raffleDocSnapshot.data();
            return raffleData;
        }
        else {
            console.log('raffle doesn\'t exist');
            return null;
        }
    }
    catch (err) {
        console.log('error getting raffle from firestore');
        return null;
    }
});
exports.getRaffleDataFromFirestore = getRaffleDataFromFirestore;
const getUserFromFirestore = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = firebase_1.firestoreDb.collection(userCollectionName).doc(userId);
    try {
        const userDocSnapshot = yield userRef.get();
        if (userDocSnapshot.exists) {
            const userData = userDocSnapshot.data();
            return userData;
        }
        else {
            console.log('user doesn\'t exist');
            return null;
        }
    }
    catch (err) {
        console.log('error getting user from firestore');
        return null;
    }
});
exports.getUserFromFirestore = getUserFromFirestore;
const updateTicketsRemainingOnRaffleInFirestore = (raffleId, numTicketsLeft) => __awaiter(void 0, void 0, void 0, function* () {
    const raffleRef = firebase_1.firestoreDb.collection(exports.drawCollectionName).doc(raffleId);
    try {
        yield raffleRef.update({
            numRemainingRaffleTickets: numTicketsLeft
        });
    }
    catch (err) {
        console.log('error updating raffle tickets remaining for raffle on firestore');
        console.log(err);
    }
});
const updateDrawInFirestorePostTxn = (txnId, drawId, buyerUserId, ticketsSold, ticketsSoldAlready, ticketsRemaining) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const txnRef = firebase_1.firestoreDb.collection(exports.txnCollectionName).doc(txnId);
        const drawData = yield (0, exports.getRaffleDataFromFirestore)(drawId);
        if (drawData === null || undefined)
            return; // TODO - figure out better error handling if draw data is null or not defined
        // existing tickets obj array
        let newTicketsArr = drawData.tickets;
        let ticketsUpdated = 0;
        for (let i = 0; i < newTicketsArr.length; i++) {
            let checkTicket = newTicketsArr[i];
            if (checkTicket.status === 1)
                continue; // if ticket is sold skip to next iteration
            if (checkTicket.status === 0) {
                checkTicket.status = 1;
                checkTicket.buyerId = buyerUserId;
                checkTicket.transactionId = txnId;
                ticketsUpdated += 1;
            }
            if (ticketsUpdated === ticketsSold)
                break; // if you've updated the needed amount of tickets break for loop
        }
        let addToArr = [];
        for (let i = 0; i < ticketsSold; i++) {
            addToArr.push(buyerUserId);
        }
        const updatedBuyerTicketArr = [...drawData.buyerTickets, ...addToArr];
        const soldRaffleTickets = ticketsSoldAlready + ticketsSold;
        const drawRef = firebase_1.firestoreDb.collection(exports.drawCollectionName).doc(drawId);
        const updateDrawObjectResponse = yield drawRef.update({
            transactions: firestore_1.FieldValue.arrayUnion(txnRef),
            buyerTickets: updatedBuyerTicketArr,
            tickets: newTicketsArr,
            numRemainingRaffleTickets: ticketsRemaining,
            soldRaffleTickets,
        });
        // console.log(updateDrawObjectResponse);
    }
    catch (err) {
        console.log('error updating draw in firestore on server after transaction');
        console.log(err);
    }
});
exports.updateDrawInFirestorePostTxn = updateDrawInFirestorePostTxn;
const updateUsersInFirestorePostTxn = (txnId, buyerUserId, sellerUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const txnRef = firebase_1.firestoreDb.collection(exports.txnCollectionName).doc(txnId);
    try {
        const buyerUserRef = firebase_1.firestoreDb.collection(userCollectionName).doc(buyerUserId);
        const updateBuyerResponse = yield buyerUserRef.update({
            buyerTransactions: firestore_1.FieldValue.arrayUnion(txnRef)
        });
        // console.log(updateBuyerResponse);
        const sellerUserRef = firebase_1.firestoreDb.collection(userCollectionName).doc(sellerUserId);
        const updateSellerResponse = yield sellerUserRef.update({
            sellerTransactions: firestore_1.FieldValue.arrayUnion(txnRef)
        });
        // console.log(updateSellerResponse);
    }
    catch (err) {
        console.log('error updating users post transaction');
        console.log(err);
    }
});
exports.updateUsersInFirestorePostTxn = updateUsersInFirestorePostTxn;

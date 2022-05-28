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
exports.updateUsersInFirestorePostTxn = exports.updateDrawInFirestorePostTxn = exports.updateTicketStatusInFirestore = exports.addTransactionToFirestore = exports.addUserToDrawObjectAfterEnteringDraw = exports.addDrawToUserObject = exports.confirmUserHasPaymentOnFile = exports.updateUserPaymentMethod = exports.getFirestoreDocumentFromReference = exports.getUserFromFirestore = exports.getRaffleDataFromFirestore = exports.ticketCollectionName = exports.txnCollectionName = exports.drawCollectionName = void 0;
const firebase_1 = require("./firebase");
const firestore_1 = require("firebase-admin/firestore");
exports.drawCollectionName = 'draws';
const userCollectionName = 'users';
exports.txnCollectionName = 'transactions';
exports.ticketCollectionName = 'tickets';
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
const getFirestoreDocumentFromReference = (ref) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const firestoreObject = yield ref.get();
        if (firestoreObject.exists) {
            const objectData = firestoreObject.data();
            return objectData;
        }
        else {
            console.log('firestore object does not exist');
            return null;
        }
    }
    catch (err) {
        console.log('error getting firestore object from firestore');
        console.log(err);
        return null;
    }
});
exports.getFirestoreDocumentFromReference = getFirestoreDocumentFromReference;
const updateUserPaymentMethod = (userId, braintreeCustomerId, paymentToken) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = firebase_1.firestoreDb.collection(userCollectionName).doc(userId);
    try {
        const response = yield userRef.set({
            paymentDataOnFile: true,
            paymentData: {
                braintree: {
                    id: braintreeCustomerId,
                    paymentToken,
                },
            },
        }, { merge: true });
    }
    catch (err) {
        console.log('error updating buyer user data with payment method');
        console.log(err);
    }
});
exports.updateUserPaymentMethod = updateUserPaymentMethod;
const confirmUserHasPaymentOnFile = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield (0, exports.getUserFromFirestore)(userId);
    if (!userData)
        return false;
    const paymentDataOnFile = userData.paymentDataOnFile;
    if (paymentDataOnFile) {
        return true;
    }
    else {
        return false;
    }
});
exports.confirmUserHasPaymentOnFile = confirmUserHasPaymentOnFile;
const addDrawToUserObject = (userId, drawId, numberTicketsAcquired) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield (0, exports.getUserFromFirestore)(userId);
    if (userData === null || undefined)
        return; // TODO - figure out better error handling if draw data is null or not defined
    // const usersEnteredDraws = userData.enteredDraws as Map<string, number> | undefined;
    const usersEnteredDraws = userData.enteredDraws;
    // const userRef = firestoreDb.collection(userCollectionName).doc(userId).withConverter(firestoreMapConverter);
    const userRef = firebase_1.firestoreDb.collection(userCollectionName).doc(userId);
    try {
        // if the user entered draws doesn't exist or doesn't have that array id -> add it
        // console.log('entered draws object');
        // console.log(usersEnteredDraws);
        if (!usersEnteredDraws) {
            // console.log('no entered draws');
            const newDrawRecord = {
                [drawId]: numberTicketsAcquired,
            };
            // console.log(newDrawRecord);
            const response = yield userRef.set({
                enteredDraws: newDrawRecord
            }, { merge: true });
        }
        else if (!usersEnteredDraws[drawId]) {
            // console.log('this draw isnt entered');
            // console.log(usersEnteredDraws);
            usersEnteredDraws[drawId] = numberTicketsAcquired;
            // console.log(usersEnteredDraws);
            const response = yield userRef.set({
                enteredDraws: usersEnteredDraws
            }, { merge: true });
        }
        else {
            // console.log('this draw already entered, need to update');
            // console.log(usersEnteredDraws);
            const existingNumberOfTickets = usersEnteredDraws[drawId];
            const newNumberOfTickets = existingNumberOfTickets + numberTicketsAcquired;
            usersEnteredDraws[drawId] = newNumberOfTickets;
            // console.log(usersEnteredDraws);
            const response = yield userRef.set({
                enteredDraws: usersEnteredDraws
            }, { merge: true });
        }
    }
    catch (err) {
        console.log('error adding draw to user profile');
        console.log(err);
    }
});
exports.addDrawToUserObject = addDrawToUserObject;
const addUserToDrawObjectAfterEnteringDraw = (buyerUserId, drawId, numTicketsClaimed, ticketsRemaining) => __awaiter(void 0, void 0, void 0, function* () {
    /*
       1/ update draw ticket array to show the usr has entered and how many tickets
          a/ buyerTickets array
          b/ tickets array of objects
       2/ update num of tickets available on draw
          a/ numTicketsRemaining
       
       * don't update transactions until draw closes
          * when draw closes transactions and num tickets sold will update
          * update transaction id on ticket array
    */
    const drawRef = firebase_1.firestoreDb.collection(exports.drawCollectionName).doc(drawId);
    const drawData = yield (0, exports.getRaffleDataFromFirestore)(drawId);
    if (drawData === null || undefined)
        return; // TODO - figure out better error handling if draw data is null or not defined
    try {
        const buyerTicketMap = drawData.buyerTickets;
        // existing tickets obj array
        let ticketRefArr = drawData.tickets;
        let ticketsUpdated = 0;
        let updatedTicketArr = [];
        // TODO - test that updated changes to ticket collection works
        for (let i = 0; i < ticketRefArr.length; i++) {
            const ticketRef = ticketRefArr[i];
            let currentlyCheckedTicket = yield (0, exports.getFirestoreDocumentFromReference)(ticketRef);
            if (!currentlyCheckedTicket)
                continue; // if ticket is null or undefined continue
            if (currentlyCheckedTicket.status > 0)
                continue; // if ticket is claimed or sold skip to next iteration
            if (currentlyCheckedTicket.status === 0) { // if ticket is available, do stuff
                currentlyCheckedTicket.status = 1;
                currentlyCheckedTicket.buyerUserId = buyerUserId;
                currentlyCheckedTicket.paid = false;
                updatedTicketArr.push(currentlyCheckedTicket.id);
                ticketsUpdated += 1;
                // updating ticket to reflect new status in firestore
                try {
                    const response = yield ticketRef.set(currentlyCheckedTicket);
                }
                catch (err) {
                    console.log('error updating ticket objct after ticket was claimed for ticket id:', currentlyCheckedTicket.id, 'and buyer id: ', currentlyCheckedTicket.buyerUserId);
                }
            }
            if (ticketsUpdated === numTicketsClaimed)
                break; // if you've updated the needed amount of tickets break for loop
        }
        // if the draw doesn't have user, add user and tickets
        if (!(buyerTicketMap[buyerUserId])) {
            buyerTicketMap[buyerUserId] = {
                numTickets: numTicketsClaimed,
                ticketArr: updatedTicketArr
            };
        }
        else {
            // if draw already has the user, update the tickets
            const existingNumTickets = buyerTicketMap[buyerUserId].numTickets;
            const newNumberOfTickets = existingNumTickets + numTicketsClaimed;
            const usersTicketsIds = buyerTicketMap[buyerUserId].ticketArr;
            buyerTicketMap[buyerUserId] = {
                numTickets: newNumberOfTickets,
                ticketArr: [...usersTicketsIds, ...updatedTicketArr]
            };
        }
        // update the draw object with new buyerTicketMap and remaining number of tickets
        const response = yield drawRef.update({
            buyerTickets: buyerTicketMap,
            numRemainingRaffleTickets: ticketsRemaining
        });
    }
    catch (err) {
        console.log(`error updating draw object after user joined`);
        console.log(`draw id ${drawId}`);
        console.log(`user id ${buyerUserId}`);
        console.log(`number of tickets ${numTicketsClaimed}`);
        console.log(err);
    }
});
exports.addUserToDrawObjectAfterEnteringDraw = addUserToDrawObjectAfterEnteringDraw;
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
const addTransactionToFirestore = (drawId, buyerUserId, sellerUserId, pricingObject, numTickets, ticketIds, braintreeCustomerId, braintreeTxnId) => __awaiter(void 0, void 0, void 0, function* () {
    const newTxnRef = firebase_1.firestoreDb.collection(exports.txnCollectionName).doc();
    try {
        const response = yield newTxnRef.set({
            id: newTxnRef.id,
            drawId,
            buyerUserId,
            sellerUserId,
            ticketIds,
            ticketsSold: numTickets,
            subtotalDollarAmount: pricingObject.subtotal,
            taxDollarAmount: pricingObject.tax,
            totalDollarAmount: pricingObject.total,
            braintreeTxnId,
            braintreeCustomerId,
        });
        return newTxnRef;
    }
    catch (err) {
        console.log('error adding transaction to firestore');
        console.log(err);
        return null;
    }
});
exports.addTransactionToFirestore = addTransactionToFirestore;
const updateTicketStatusInFirestore = (ticketId, ticketStatus, paid, transactionId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ticketRef = firebase_1.firestoreDb.collection(exports.ticketCollectionName).doc(ticketId);
        const response = yield ticketRef.update({
            status: ticketStatus,
            paid,
            transactionId
        });
    }
    catch (err) {
        console.log('error updating ticket status for ticket id', ticketId);
        console.log(err);
    }
});
exports.updateTicketStatusInFirestore = updateTicketStatusInFirestore;
const updateDrawInFirestorePostTxn = (drawId, txnRef, ticketsSold, ticketsSoldAlready) => __awaiter(void 0, void 0, void 0, function* () {
    const soldRaffleTickets = ticketsSoldAlready + ticketsSold;
    const drawRef = firebase_1.firestoreDb.collection(exports.drawCollectionName).doc(drawId);
    try {
        const updateDrawObjectResponse = yield drawRef.update({
            transactions: firestore_1.FieldValue.arrayUnion(txnRef),
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

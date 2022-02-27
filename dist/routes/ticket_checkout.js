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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../utils/firebase");
const api_1 = require("../utils/api");
const helpers_1 = require("../utils/helpers");
const router = express_1.default.Router();
router.post('/paypal_checkout/request/:drawId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { drawId } = req.params;
    console.log('hitting checkout request end point for draw', drawId);
    const drawData = yield (0, api_1.getRaffleDataFromFirestore)(drawId);
    const data = req.body;
    const { amountOfTicketsPurchased } = data;
    if (!drawData) {
        console.log('error getting raffle data from firestore');
        res.statusMessage = 'There was an error on our side. Please try again later.';
        // res.status(500).end();
        return res.json({
            valid: false
        });
    }
    if (!(drawData.numRemainingRaffleTickets >= amountOfTicketsPurchased)) {
        console.log('not enough tickets');
        res.statusMessage = 'There are not enough tickets available for purchase.';
        // res.status(400).end();
        return res.json({
            valid: false
        });
    }
    const pricing = (0, helpers_1.getTotalDollarAmountOfPurchase)(amountOfTicketsPurchased, drawData.pricePerRaffleTicket);
    return res.json({
        valid: true,
        totalDollarAmount: pricing.total,
    });
}));
router.post('/paypal_checkout/success', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`hitting fulfillment logic endpoint`);
    const { userOrderData } = req.body;
    const { drawId, ticketsSold, buyerUserId, sellerUserId } = userOrderData;
    const drawData = yield (0, api_1.getRaffleDataFromFirestore)(drawId);
    if (!drawData) {
        res.statusMessage = 'There was an error on our side. Please try again later.';
        res.status(500).send({
            status: 'There was an error retrieving draw from firestore to do post txn logic.'
        });
        return;
    }
    const pricing = (0, helpers_1.getTotalDollarAmountOfPurchase)(ticketsSold, drawData.pricePerRaffleTicket);
    const ticketsAvailable = drawData.numRemainingRaffleTickets;
    const ticketsSoldAlready = drawData.numTotalRaffleTickets - ticketsAvailable;
    const ticketsRemaining = ticketsAvailable - ticketsSold;
    try {
        // create new draw ref and add to firestore
        const newTxnRef = firebase_1.firestoreDb.collection(api_1.txnCollectionName).doc();
        const fullOrderData = Object.assign({ id: newTxnRef.id, dateCompleted: firestore_1.Timestamp.now(), ticketsSold: ticketsSold, subtotalDollarAmount: pricing.subtotal, taxDollarAmount: pricing.tax, totalDollarAmount: pricing.total }, userOrderData);
        console.log(fullOrderData);
        const savingTxnResponse = yield newTxnRef.set(fullOrderData);
        try {
            yield (0, api_1.updateDrawInFirestorePostTxn)(newTxnRef.id, drawId, buyerUserId, ticketsSold, ticketsSoldAlready, ticketsRemaining);
        }
        catch (err) {
            console.log('error running the update draw function at /paypal_checkout/success endpoint');
            console.log(err);
        }
        try {
            yield (0, api_1.updateUsersInFirestorePostTxn)(newTxnRef.id, buyerUserId, sellerUserId);
        }
        catch (err) {
            console.log('error running the update user function at /paypal_checkout/success endpoint');
            console.log(err);
        }
    }
    catch (err) {
        console.log('error creating adding new transaction to the firestore');
    }
    res.send('updated firestore post transaction');
}));
module.exports = router;

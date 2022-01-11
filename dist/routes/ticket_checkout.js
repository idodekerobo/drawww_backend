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
const stripe_publishable_key = process.env.LIVE_STRIPE_PUBLISH_KEY;
const stripe = require('stripe')(process.env.LIVE_STRIPE_SECRET_KEY);
// const stripe = require('stripe')(process.env.TEST_STRIPE_SECRET_KEY)
// const stripe_publishable_key = process.env.TEST_STRIPE_PUBLISH_KEY;
router.post('/checkout/:raffleId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { raffleId } = req.params;
    console.log('hitting checkout end point for draw', raffleId);
    const data = req.body;
    const { amountOfTicketsPurchased, receipt_email } = data;
    const raffleData = yield (0, api_1.getRaffleDataFromFirestore)(raffleId);
    if (!raffleData) {
        console.log('error getting raffle data from firestore');
        res.statusMessage = 'There was an error on our side. Please try again later.';
        res.status(500).end();
        return;
    }
    if (!(raffleData.numRemainingRaffleTickets >= amountOfTicketsPurchased)) {
        console.log('not enough tickets');
        res.statusMessage = 'There are not enough tickets available for purchase.';
        res.status(400).end();
        return;
    }
    ;
    let stripeTotalPrice;
    if (raffleData) {
        const userData = yield (0, api_1.getUserFromFirestore)(raffleData.userUid);
        if (userData) {
            const pricePerTicket = raffleData.pricePerRaffleTicket;
            const pricing = (0, helpers_1.getTotalDollarAmountOfPurchase)(amountOfTicketsPurchased, pricePerTicket);
            stripeTotalPrice = pricing.stripeTotal;
            const sellerStripeConnectId = (_a = userData.stripeAccountData) === null || _a === void 0 ? void 0 : _a.accountId;
            if (sellerStripeConnectId) {
                try {
                    const paymentIntentResponse = yield stripe.paymentIntents.create({
                        payment_method_types: ['card'], amount: stripeTotalPrice, currency: 'usd',
                        application_fee_amount: pricing.applicationFee,
                        receipt_email,
                        transfer_data: {
                            destination: sellerStripeConnectId
                        }
                    });
                    const ticketsAvailable = raffleData.numRemainingRaffleTickets;
                    const ticketsSoldAlready = raffleData.numTotalRaffleTickets - ticketsAvailable;
                    const ticketsRemaining = ticketsAvailable - amountOfTicketsPurchased;
                    return res.json({
                        publishableKey: stripe_publishable_key,
                        id: paymentIntentResponse.id,
                        client_secret: paymentIntentResponse.client_secret,
                        ticketsSoldAlready,
                        newTicketsSold: amountOfTicketsPurchased,
                        sellerStripeAcctId: sellerStripeConnectId,
                        sellerUserId: raffleData.userUid,
                        ticketsRemaining,
                        subtotalDollarAmount: pricing.subtotal,
                        taxDollarAmount: pricing.tax,
                        totalDollarAmount: pricing.total,
                    });
                }
                catch (err) {
                    console.log('err making payment to user');
                    console.log(err);
                    res.statusMessage = 'There was an error on our side. Please try again later.';
                    res.status(500).send({
                        error: err
                    });
                }
            }
            else {
                console.log('seller not on stripe');
                res.statusMessage = 'Seller is not eligible for payouts.';
                res.status(400).end();
            }
        }
    }
}));
router.post('/checkout/:drawIdParam/success', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    const { ticketsSoldAlready, ticketsRemaining } = data;
    const orderData = data.orderData;
    const { drawId, ticketsSold, buyerUserId, sellerUserId } = orderData;
    console.log(`hitting fulfillment endpoint for ${drawId}`);
    try {
        // create new draw ref and add to firestore
        const newTxnRef = firebase_1.firestoreDb.collection(api_1.txnCollectionName).doc();
        const data = Object.assign({ id: newTxnRef.id, dateCompleted: firestore_1.Timestamp.now() }, orderData);
        const savingTxnResponse = yield newTxnRef.set(data);
        // console.log(savingTxnResponse);
        try {
            yield (0, api_1.updateDrawInFirestorePostTxn)(newTxnRef.id, drawId, buyerUserId, ticketsSold, ticketsSoldAlready, ticketsRemaining);
        }
        catch (err) {
            console.log('error running the update draw function at /checkout/draw/success endpoint');
            console.log(err);
        }
        try {
            yield (0, api_1.updateUsersInFirestorePostTxn)(newTxnRef.id, buyerUserId, sellerUserId);
        }
        catch (err) {
            console.log('error running the update user function at /checkout/draw/success endpoint');
            console.log(err);
        }
    }
    catch (err) {
        console.log('error creating adding new transaction to the firestore');
    }
    res.send('updated firestore post transaction');
}));
module.exports = router;

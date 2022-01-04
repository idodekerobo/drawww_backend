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
const router = express_1.default.Router();
const firebase_1 = require("../utils/firebase");
// const stripe_publishable_key = process.env.LIVE_STRIPE_PUBLISH_KEY;
// const stripe = require('stripe')(process.env.LIVE_STRIPE_SECRET_KEY)
const stripe = require('stripe')(process.env.TEST_STRIPE_SECRET_KEY);
const stripe_publishable_key = process.env.TEST_STRIPE_PUBLISH_KEY;
// TODO - take application fee amount
const getRaffleDataFromFirestore = (raffleId) => __awaiter(void 0, void 0, void 0, function* () {
    const raffleRef = firebase_1.firestoreDb.collection('raffles').doc(raffleId);
    try {
        const raffleDocSnapshot = yield raffleRef.get();
        if (raffleDocSnapshot.exists) {
            // return raffleDocSnapshot.data();
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
const getUserFromFirestore = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = firebase_1.firestoreDb.collection('users').doc(userId);
    try {
        const userDocSnapshot = yield userRef.get();
        if (userDocSnapshot.exists) {
            // return userDocSnapshot.data();
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
const updateTicketsRemainingOnRaffleInFirestore = (raffleId, numTicketsLeft) => __awaiter(void 0, void 0, void 0, function* () {
    const raffleRef = firebase_1.firestoreDb.collection('raffles').doc(raffleId);
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
const getTotalDollarAmountOfPurchase = (numTicketsPurchased, pricePerTicket) => {
    const subtotal = numTicketsPurchased * pricePerTicket;
    // TODO - how do i manage tax ???
    const stripeTotal = subtotal * 100;
    const applicationFee = stripeTotal * .05;
    const priceObject = {
        subtotal,
        tax: 0,
        total: subtotal,
        stripeTotal,
        applicationFee,
    };
    return priceObject;
};
router.post('/checkout/:raffleId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { raffleId } = req.params;
    console.log('hitting checkout end point for draw', raffleId);
    const data = req.body;
    const { amountOfTicketsPurchased, receipt_email } = data;
    const raffleData = yield getRaffleDataFromFirestore(raffleId);
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
        const userData = yield getUserFromFirestore(raffleData.userUid);
        if (userData) {
            const pricePerTicket = raffleData.pricePerRaffleTicket;
            const pricing = getTotalDollarAmountOfPurchase(amountOfTicketsPurchased, pricePerTicket);
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
                    const ticketsRemaining = ticketsAvailable - amountOfTicketsPurchased;
                    return res.json({
                        publishableKey: stripe_publishable_key,
                        id: paymentIntentResponse.id,
                        client_secret: paymentIntentResponse.client_secret,
                        ticketsSold: amountOfTicketsPurchased,
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
module.exports = router;

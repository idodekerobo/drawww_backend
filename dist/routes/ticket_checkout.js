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
    const priceObject = {
        subtotal,
        tax: 0,
        total: subtotal,
        stripeTotal,
    };
    return priceObject;
};
router.post('/checkout/:raffleId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { raffleId } = req.params;
    const data = req.body;
    const { amountOfTicketsPurchased } = data;
    const raffleData = yield getRaffleDataFromFirestore(raffleId);
    if (!(raffleData && (raffleData.numRemainingRaffleTickets > amountOfTicketsPurchased))) {
        console.log('not enough tickets');
        res.send({
        // TODO - send something that says there aren't enough raffle tickets???
        });
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
                        /* application_fee_amount: 0, */
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
                    });
                }
                catch (err) {
                    console.log('err making payment to user');
                    console.log(err);
                    return res.status(500).send({
                        error: err
                    });
                }
            }
            else {
                console.log('seller not on stripe');
            }
        }
    }
    // res.send({
    //    publishable_key: 'publishable key',
    //    client_secret: 'client secret',
    //    amountOfTicketsPurchased,
    // })
}));
module.exports = router;

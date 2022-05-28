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
const braintree_1 = require("braintree");
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../utils/firebase");
const api_1 = require("../utils/api");
const helpers_1 = require("../utils/helpers");
const router = express_1.default.Router();
router.get('/braintree_client_token', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (process.env.BRAINTREE_MERCHANT_ID == undefined || process.env.BRAINTREE_PUBLIC_KEY == undefined || process.env.BRAINTREE_PRIVATE_KEY == undefined) {
        return;
    }
    const gateway = new braintree_1.BraintreeGateway({
        environment: braintree_1.Environment.Sandbox,
        merchantId: process.env.BRAINTREE_MERCHANT_ID,
        publicKey: process.env.BRAINTREE_PUBLIC_KEY,
        privateKey: process.env.BRAINTREE_PRIVATE_KEY
    });
    const generateToken = yield gateway.clientToken.generate({});
    const tokenResponse = yield generateToken.clientToken;
    // console.log(tokenResponse);
    res.send({
        token: tokenResponse
    });
}));
router.post('/enter_draw/:drawId/new_customer', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { drawId } = req.params;
    const data = req.body;
    const { firstName, lastName, buyerUserId, paymentData, numberTicketsAcquired } = data;
    // console.log(data);
    if (process.env.BRAINTREE_MERCHANT_ID == undefined || process.env.BRAINTREE_PUBLIC_KEY == undefined || process.env.BRAINTREE_PRIVATE_KEY == undefined) {
        // TODO - handle error getting braintree creds on the server
        return;
    }
    const gateway = new braintree_1.BraintreeGateway({
        environment: braintree_1.Environment.Sandbox,
        merchantId: process.env.BRAINTREE_MERCHANT_ID,
        publicKey: process.env.BRAINTREE_PUBLIC_KEY,
        privateKey: process.env.BRAINTREE_PRIVATE_KEY
    });
    try {
        // 1. add customer to braintree vault
        // a. take buyer's user id and look up email address and add them both to braintree vault
        const buyerUserData = yield (0, api_1.getUserFromFirestore)(buyerUserId);
        if (buyerUserData == null) {
            // TODO - do error logging and return message to user
            return;
        }
        const buyerEmailAddress = buyerUserData === null || buyerUserData === void 0 ? void 0 : buyerUserData.emailAddress;
        console.log('buyer custom fields');
        console.log(buyerUserId);
        console.log(buyerEmailAddress);
        const result = yield gateway.customer.create({
            firstName,
            lastName,
            paymentMethodNonce: paymentData.nonce,
            customFields: {
                drawww_user_id: buyerUserId,
                drawww_email_address: buyerEmailAddress,
            }
        });
        // console.log(result.success);
        // console.log(result);
        const braintreeCustomerId = result.customer.id;
        const paymentMethodArr = result.customer.paymentMethods;
        if (paymentMethodArr == undefined)
            return;
        const paymentMethod = paymentMethodArr[0];
        const paymentToken = paymentMethod.token;
        // 2. edit buyer's firebase object to show they have payment on file and they entererd draw
        // a. add customer braintree id and payment token
        // b. paymentOnFile = true
        (0, api_1.updateUserPaymentMethod)(buyerUserId, braintreeCustomerId, paymentToken); // async function
        const drawData = yield (0, api_1.getRaffleDataFromFirestore)(drawId);
        if (!drawData) {
            res.statusMessage = 'There was an error retrieving draw from firestore to do post update logic.';
            res.status(500).send({
                status: 'There was an error getting your tickets! Please try again later and contact us if the issue continues.',
                success: false,
            });
            return;
        }
        if (drawData.numRemainingRaffleTickets < 1) {
            res.statusMessage = `There aren't any tickets left on this draw!`;
            res.status(200).send({
                status: `There aren't any tickets left on this draw!`,
                success: false
            });
            return;
        }
        // 3. edit user firebase object to show that they entered the draw
        (0, api_1.addDrawToUserObject)(buyerUserId, drawId, numberTicketsAcquired); // async function
        // 4. edit draw's firebase object to show that this user has entered the draw
        const ticketsAvailable = drawData.numRemainingRaffleTickets;
        const ticketsRemaining = ticketsAvailable - numberTicketsAcquired;
        (0, api_1.addUserToDrawObjectAfterEnteringDraw)(buyerUserId, drawId, numberTicketsAcquired, ticketsRemaining);
        return res.json({
            success: result.success,
        });
    }
    catch (e) {
        console.log('error creating a customer');
        console.log(e);
        return res.json({
            success: false
        });
    }
}));
router.post('/enter_draw/:drawId/existing_customer', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // NO NEED TO DO ANYTHING WITH BRAINTREE SINCE CUSTOMER HAS PAYMENT ON FILE
    const { drawId } = req.params;
    const data = req.body;
    const { firstName, lastName, buyerUserId, numberTicketsAcquired } = data;
    try {
        // 1. confirm that user has payment on file 
        const userHasPaymentOnFile = yield (0, api_1.confirmUserHasPaymentOnFile)(buyerUserId);
        if (!userHasPaymentOnFile) {
            return res.json({
                success: false
            });
        }
        const drawData = yield (0, api_1.getRaffleDataFromFirestore)(drawId);
        if (!drawData) {
            res.statusMessage = 'There was an error retrieving draw from firestore to do post update logic.';
            res.status(500).send({
                status: 'There was an error getting your tickets! Please try again later and contact us if the issue continues.',
                success: false,
            });
            return res.json({
                success: false
            });
        }
        if (drawData.numRemainingRaffleTickets < 1) {
            res.statusMessage = `There aren't any tickets left on this draw!`;
            res.status(200).send({
                status: `There aren't any tickets left on this draw!`,
                success: false
            });
            return;
        }
        // 2. edit user firebase object to show that they entered the draw
        (0, api_1.addDrawToUserObject)(buyerUserId, drawId, numberTicketsAcquired); // async function
        // 3. edit draw's firebase object to show that this user has entered the draw
        const ticketsAvailable = drawData.numRemainingRaffleTickets;
        const ticketsRemaining = ticketsAvailable - numberTicketsAcquired;
        (0, api_1.addUserToDrawObjectAfterEnteringDraw)(buyerUserId, drawId, numberTicketsAcquired, ticketsRemaining);
        return res.json({
            success: true
        });
    }
    catch (err) {
        console.log(err);
        return res.json({
            success: false
        });
    }
}));
router.post('/close_draw/:drawId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { drawId } = req.params;
    console.log('closing draw endpoint');
    const drawData = yield (0, api_1.getRaffleDataFromFirestore)(drawId);
    if (!drawData) {
        res.statusMessage = 'There was an error and the draw was not found.';
        return res.json({
            success: false,
            result: 'draw not found'
        });
    }
    if (process.env.BRAINTREE_MERCHANT_ID == undefined || process.env.BRAINTREE_PUBLIC_KEY == undefined || process.env.BRAINTREE_PRIVATE_KEY == undefined) {
        // TODO - handle error getting braintree creds on the server
        res.statusMessage = 'There was an error getting payment gateway information.';
        return res.json({
            success: false,
            result: 'error getting payment gateway information'
        });
    }
    const gateway = new braintree_1.BraintreeGateway({
        environment: braintree_1.Environment.Sandbox,
        merchantId: process.env.BRAINTREE_MERCHANT_ID,
        publicKey: process.env.BRAINTREE_PUBLIC_KEY,
        privateKey: process.env.BRAINTREE_PRIVATE_KEY
    });
    const buyerTicketMapObject = drawData.buyerTickets;
    for (const buyerUserId in buyerTicketMapObject) {
        // console.log(`${buyerUserId}`)
        // console.log(buyerTicketMapObject[buyerUserId]);
        const userData = yield (0, api_1.getUserFromFirestore)(buyerUserId);
        if (!userData) {
            console.log(`user data for user ${buyerUserId} not found`);
            continue;
        }
        if (!userData.paymentDataOnFile) {
            console.log(`user ${buyerUserId} doesn't have payment data on file`);
            // TODO - need to do somthing if user doesn't have payment data on file
            continue;
        }
        if (!userData.paymentData) {
            continue;
        }
        const braintreePaymentObject = userData.paymentData.braintree;
        const braintreeCustomerId = braintreePaymentObject.id;
        const braintreePaymentMethodToken = braintreePaymentObject.paymentToken;
        const numTicketsBought = buyerTicketMapObject[buyerUserId].numTickets;
        const userClaimedTicketArr = buyerTicketMapObject[buyerUserId].ticketArr;
        const pricing = (0, helpers_1.getTotalDollarAmountOfPurchase)(numTicketsBought, drawData.pricePerRaffleTicket);
        const total = pricing.total;
        // 1. make transaction for total amount of tickets
        const txnResult = yield gateway.transaction.sale({
            // amount: ``,
            // paymentMethodToken: '',
            amount: `${total}`,
            paymentMethodToken: braintreePaymentMethodToken,
            options: {
                submitForSettlement: true,
            }
        });
        if (txnResult.success) {
            // 2. make a transaction data object for firestore
            const braintreeTxnId = txnResult.transaction.id;
            const txnReference = yield (0, api_1.addTransactionToFirestore)(drawId, buyerUserId, drawData.sellerUserId, pricing, numTicketsBought, userClaimedTicketArr, braintreeCustomerId, braintreeTxnId);
            // 3. edit ticket data
            for (let i = 0; i < userClaimedTicketArr.length; i++) {
                const ticketId = userClaimedTicketArr[i];
                yield (0, api_1.updateTicketStatusInFirestore)(ticketId, 2, true, txnReference === null || txnReference === void 0 ? void 0 : txnReference.id);
            }
            // 4. update amount of tickets sold on draw and transaction ref to draw
            if (txnReference) {
                yield (0, api_1.updateDrawInFirestorePostTxn)(drawId, txnReference, numTicketsBought, drawData.soldRaffleTickets);
            }
            else {
                console.log('txn reference is null');
            }
        }
        else {
            // tell server the txn wasn't successful
            return res.json({
                success: false,
            });
        }
    }
    return res.json({
        success: true,
    });
}));
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
            status: 'There was an error retrieving draw from firestore to do post upd logic.'
        });
        return;
    }
    const ticketsAvailable = drawData.numRemainingRaffleTickets;
    const ticketsSoldAlready = drawData.numTotalRaffleTickets - ticketsAvailable;
    const ticketsRemaining = ticketsAvailable - ticketsSold;
    const pricing = (0, helpers_1.getTotalDollarAmountOfPurchase)(ticketsSold, drawData.pricePerRaffleTicket);
    try {
        // create new draw ref and add to firestore
        const newTxnRef = firebase_1.firestoreDb.collection(api_1.txnCollectionName).doc();
        const fullOrderData = Object.assign({ id: newTxnRef.id, dateCompleted: firestore_1.Timestamp.now(), ticketsSold: ticketsSold, subtotalDollarAmount: pricing.subtotal, taxDollarAmount: pricing.tax, totalDollarAmount: pricing.total }, userOrderData);
        console.log(fullOrderData);
        const savingTxnResponse = yield newTxnRef.set(fullOrderData);
        try {
            // await updateDrawInFirestorePostTxn(newTxnRef.id, drawId, buyerUserId, ticketsSold, ticketsSoldAlready, ticketsRemaining);
        }
        catch (err) {
            // console.log('error running the update draw function at /paypal_checkout/success endpoint')
            // console.log(err);
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

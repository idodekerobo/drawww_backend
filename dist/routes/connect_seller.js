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
router.get('/connect_seller/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    try {
        const account = yield stripe.accounts.create({
            type: 'express',
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            }
        });
        const stripeAccountId = account.id;
        const accountLink = yield stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: 'http://localhost:3000/',
            return_url: 'http://localhost:3000/',
            type: 'account_onboarding',
        });
        const userRef = firebase_1.firestoreDb.collection('users').doc(userId);
        yield userRef.update({
            stripeAccountData: {
                accountId: stripeAccountId
            }
        });
        res.redirect(accountLink.url);
    }
    catch (err) {
        console.log('error onboarding user to stripe connect');
        console.log(err);
        // res.status(500).send({
        //    error: err.message,
        // })
    }
}));
module.exports = router;

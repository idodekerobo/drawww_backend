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
const bodyParser = require('body-parser');
const path = require("path");
require('dotenv').config();
const app = (0, express_1.default)();
const PORT = process.env.PORT;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send('yessssiiiirrrrrr');
}));
const ConnectSellerRoutes = require('./routes/connect_seller');
const CheckoutRoutes = require('./routes/ticket_checkout');
const EmailListRoutes = require('./routes/email_list');
// Building Proxy Server for CORS Error requesting api from front-end
// https://medium.com/@dtkatz/3-ways-to-fix-the-cors-error-and-how-access-control-allow-origin-works-d97d55946d9
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    // const allowedOrigins = [process.env.STORE_DOMAIN, process.env.LANDING_DOMAIN]
    // const origin = req.headers.origin;
    // if (allowedOrigins.includes(origin)) {
    //    res.header('Access-Control-Allow-Origin', origin);
    // }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
    next();
});
app.use('/', ConnectSellerRoutes);
app.use('/', CheckoutRoutes);
app.use('/', EmailListRoutes);
app.listen(PORT, () => {
    console.log('app listening on port', PORT);
});

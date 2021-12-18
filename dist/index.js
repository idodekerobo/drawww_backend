"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path = require("path");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => {
    console.log('app running');
    res.send('yessssiiiirrrrrr');
});
// import * as ConnectSeller from './routes/connect_seller'
const ConnectSeller = require('./routes/connect_seller');
app.use('/', ConnectSeller);
// app.get('/')
app.listen(PORT, () => {
    console.log('app listening on port', PORT);
});

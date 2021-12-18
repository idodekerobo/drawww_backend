"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// const stripe = require('stripe')
router.get('/connect_seller', (req, res) => {
    res.send('connecting the seller to stripe');
});
exports.default = router;

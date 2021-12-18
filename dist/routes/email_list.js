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
const { Client } = require("@notionhq/client");
const router = express_1.default.Router();
const notion = new Client({
    auth: process.env.NOTION_RAFFLE_EMAIL_TOKEN,
});
router.post('/addEmail', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(req.body.emailAddress);
    try {
        yield notion.pages.create({
            parent: {
                database_id: '2ead84131c3f4ff8823cc41dbd31f903'
            },
            properties: {
                email: {
                    title: [
                        { text: { content: req.body.emailAddress }, },
                    ]
                },
            },
        });
        res.send({
            success: 'yes',
        });
    }
    catch (err) {
        console.log('error adding email');
        console.log(err);
        res.send({
            success: 'no',
        });
    }
}));
module.exports = router;

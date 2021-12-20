import express, { Request, Response, NextFunction } from "express";
const bodyParser = require('body-parser');
const path = require("path");
require('dotenv').config();
const app = express();
const PORT = process.env.PORT;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.get('/', async (req: Request, res: Response) => {
   res.send('yessssiiiirrrrrr welcome to drawww');
});

const ConnectSellerRoutes = require('./routes/connect_seller');
const CheckoutRoutes = require('./routes/ticket_checkout');
const EmailListRoutes = require('./routes/email_list');


// Building Proxy Server for CORS Error requesting api from front-end
// https://medium.com/@dtkatz/3-ways-to-fix-the-cors-error-and-how-access-control-allow-origin-works-d97d55946d9
app.use((req: Request, res: Response, next: NextFunction) => {
   // res.header('Access-Control-Allow-Origin', 'http://localhost:3000'); 
   const allowedOrigins = [ process.env.LANDING_DOMAIN, process.env.HEROKU_DOMAIN ]
   const origin = req.headers.origin;
   if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
   }
   res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
   res.header('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
   next();
});

app.use('/', ConnectSellerRoutes);
app.use('/', CheckoutRoutes);
app.use('/', EmailListRoutes);

app.listen(PORT, () => {
   console.log('app listening on port', PORT)
})
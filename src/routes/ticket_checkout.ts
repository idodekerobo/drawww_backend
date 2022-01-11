import express, { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { firestoreDb } from '../utils/firebase';
import { txnCollectionName, getRaffleDataFromFirestore, getUserFromFirestore, updateDrawInFirestorePostTxn, updateUsersInFirestorePostTxn } from '../utils/api';
import { getTotalDollarAmountOfPurchase } from '../utils/helpers';
import { IUserTransactionObject, ITransactionFirestoreObject } from '../utils/types';
const router = express.Router();

const stripe_publishable_key = process.env.LIVE_STRIPE_PUBLISH_KEY;
const stripe = require('stripe')(process.env.LIVE_STRIPE_SECRET_KEY)
// const stripe = require('stripe')(process.env.TEST_STRIPE_SECRET_KEY)
// const stripe_publishable_key = process.env.TEST_STRIPE_PUBLISH_KEY;

router.post('/checkout/:raffleId', async (req: Request, res: Response) => {
   const { raffleId } = req.params;
   console.log('hitting checkout end point for draw', raffleId);
   const data = req.body;
   const { amountOfTicketsPurchased, receipt_email } = data;

   const raffleData = await getRaffleDataFromFirestore(raffleId);

   if (!raffleData) {
      console.log('error getting raffle data from firestore');
      res.statusMessage = 'There was an error on our side. Please try again later.';
      res.status(500).end();
      return;
   }
   if ( !(raffleData.numRemainingRaffleTickets >= amountOfTicketsPurchased) ) {
      console.log('not enough tickets');
      res.statusMessage = 'There are not enough tickets available for purchase.'
      res.status(400).end();
      return;
   };

   let stripeTotalPrice: number;
   if (raffleData) {
      const userData = await getUserFromFirestore(raffleData.userUid);
      if (userData) {
         const pricePerTicket = raffleData.pricePerRaffleTicket;
         const pricing = getTotalDollarAmountOfPurchase(amountOfTicketsPurchased, pricePerTicket);
         stripeTotalPrice = pricing.stripeTotal;


         const sellerStripeConnectId = userData.stripeAccountData?.accountId;
         if (sellerStripeConnectId) {
            try {
               const paymentIntentResponse = await stripe.paymentIntents.create({
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
               
            } catch (err) {
               console.log('err making payment to user');
               console.log(err);
               res.statusMessage = 'There was an error on our side. Please try again later.'
               res.status(500).send({
                  error: err
               });
            }
         } else {
            console.log('seller not on stripe');
            res.statusMessage = 'Seller is not eligible for payouts.'
            res.status(400).end();
         }
      }
   }

})

router.post('/checkout/:drawIdParam/success', async (req: Request, res: Response) => { 
   const data = req.body;
   const { ticketsSoldAlready, ticketsRemaining } = data;
   const orderData: IUserTransactionObject = data.orderData;
   const { drawId, ticketsSold, buyerUserId, sellerUserId } = orderData;
   console.log(`hitting fulfillment endpoint for ${drawId}`)

   try {
      // create new draw ref and add to firestore
      const newTxnRef  = firestoreDb.collection(txnCollectionName).doc();
      const data: ITransactionFirestoreObject = {
         id: newTxnRef.id,
         dateCompleted: Timestamp.now(),
         ...orderData
      }
      const savingTxnResponse = await newTxnRef.set(data);
      // console.log(savingTxnResponse);

      try {
         await updateDrawInFirestorePostTxn(newTxnRef.id, drawId, buyerUserId, ticketsSold, ticketsSoldAlready, ticketsRemaining);
      } catch (err) {
         console.log('error running the update draw function at /checkout/draw/success endpoint')
         console.log(err);
      }

      try {
         await updateUsersInFirestorePostTxn(newTxnRef.id, buyerUserId, sellerUserId)
      } catch (err) {
         console.log('error running the update user function at /checkout/draw/success endpoint')
         console.log(err);
      }

   } catch (err) {
      console.log('error creating adding new transaction to the firestore')
   }

   res.send('updated firestore post transaction');
})

module.exports = router;
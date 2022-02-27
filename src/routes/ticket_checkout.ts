import express, { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { firestoreDb } from '../utils/firebase';
import { txnCollectionName, getRaffleDataFromFirestore, updateDrawInFirestorePostTxn, updateUsersInFirestorePostTxn } from '../utils/api';
import { getTotalDollarAmountOfPurchase } from '../utils/helpers';
import { IPaypalTransactionFirestoreObject } from '../utils/types';
const router = express.Router();

router.post('/paypal_checkout/request/:drawId',  async(req: Request, res: Response) => {
   const { drawId } = req.params;
   console.log('hitting checkout request end point for draw', drawId);

   const drawData = await getRaffleDataFromFirestore(drawId);
   const data = req.body;
   const { amountOfTicketsPurchased } = data;

   if (!drawData) {
      console.log('error getting raffle data from firestore');
      res.statusMessage = 'There was an error on our side. Please try again later.';
      // res.status(500).end();
      return res.json({
         valid: false
      })
   }

   if ( !(drawData.numRemainingRaffleTickets >= amountOfTicketsPurchased) ) {
      console.log('not enough tickets');
      res.statusMessage = 'There are not enough tickets available for purchase.'
      // res.status(400).end();
      return res.json({
         valid: false
      })
   }

   const pricing = getTotalDollarAmountOfPurchase(amountOfTicketsPurchased, drawData.pricePerRaffleTicket);
   return res.json({
      valid: true,
      totalDollarAmount: pricing.total,
   })
})

router.post('/paypal_checkout/success', async (req: Request, res: Response) => {
   console.log(`hitting fulfillment logic endpoint`)
   const { userOrderData } = req.body;
   const { drawId, ticketsSold, buyerUserId, sellerUserId } = userOrderData;

   const drawData = await getRaffleDataFromFirestore(drawId);

   if (!drawData) {
      res.statusMessage = 'There was an error on our side. Please try again later.'
      res.status(500).send({
         status: 'There was an error retrieving draw from firestore to do post txn logic.'
      });
      return;
   }
   const pricing = getTotalDollarAmountOfPurchase(ticketsSold, drawData.pricePerRaffleTicket);
   const ticketsAvailable = drawData.numRemainingRaffleTickets;
   const ticketsSoldAlready = drawData.numTotalRaffleTickets - ticketsAvailable;
   const ticketsRemaining = ticketsAvailable - ticketsSold;

   try {
      // create new draw ref and add to firestore
      const newTxnRef  = firestoreDb.collection(txnCollectionName).doc();

      const fullOrderData: IPaypalTransactionFirestoreObject = {
         id: newTxnRef.id,
         dateCompleted: Timestamp.now(),
         ticketsSold: ticketsSold,
         subtotalDollarAmount: pricing.subtotal,
         taxDollarAmount: pricing.tax,
         totalDollarAmount: pricing.total,
         ...userOrderData
      }
      console.log(fullOrderData);
      const savingTxnResponse = await newTxnRef.set(fullOrderData);

      try {
         await updateDrawInFirestorePostTxn(newTxnRef.id, drawId, buyerUserId, ticketsSold, ticketsSoldAlready, ticketsRemaining);
      } catch (err) {
         console.log('error running the update draw function at /paypal_checkout/success endpoint')
         console.log(err);
      }

      try {
         await updateUsersInFirestorePostTxn(newTxnRef.id, buyerUserId, sellerUserId)
      } catch (err) {
         console.log('error running the update user function at /paypal_checkout/success endpoint')
         console.log(err);
      }

   } catch (err) {
      console.log('error creating adding new transaction to the firestore')
   }

   res.send('updated firestore post transaction');
})

module.exports = router;
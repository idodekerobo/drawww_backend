import express, { Request, Response } from 'express';
import { BraintreeGateway, Environment, ValidatedResponse,ClientToken, ServerError } from 'braintree';

import { Timestamp } from 'firebase-admin/firestore';
import { firestoreDb } from '../utils/firebase';
import { getUserFromFirestore, txnCollectionName, getRaffleDataFromFirestore, updateDrawInFirestorePostTxn,
   updateUsersInFirestorePostTxn, updateUserPaymentMethod, addDrawToUserObject, addUserToDrawObjectAfterEnteringDraw,
   confirmUserHasPaymentOnFile, getFirestoreDocumentFromReference, addTransactionToFirestore, updateTicketStatusInFirestore } from '../utils/api';
import { getTotalDollarAmountOfPurchase } from '../utils/helpers';
import { IPaypalTransactionFirestoreObject } from '../utils/types';
const router = express.Router();


router.get('/braintree_client_token', async (req: Request, res: Response) => {
   if (process.env.BRAINTREE_MERCHANT_ID == undefined || process.env.BRAINTREE_PUBLIC_KEY == undefined || process.env.BRAINTREE_PRIVATE_KEY == undefined) {
      return;
   }
   const gateway = new BraintreeGateway({
      environment: Environment.Sandbox,
      merchantId: process.env.BRAINTREE_MERCHANT_ID,
      publicKey: process.env.BRAINTREE_PUBLIC_KEY,
      privateKey: process.env.BRAINTREE_PRIVATE_KEY
   });

   const generateToken = await gateway.clientToken.generate({})
   const tokenResponse = await generateToken.clientToken;
   // console.log(tokenResponse);
   
   res.send({
      token: tokenResponse
   })
})

router.post('/enter_draw/:drawId/new_customer', async (req: Request, res: Response) => {
   const { drawId } = req.params;
   const data = req.body;
   const { firstName, lastName, buyerUserId, paymentData, numberTicketsAcquired } = data;
   // console.log(data);

   if (process.env.BRAINTREE_MERCHANT_ID == undefined || process.env.BRAINTREE_PUBLIC_KEY == undefined || process.env.BRAINTREE_PRIVATE_KEY == undefined) {
      // TODO - handle error getting braintree creds on the server
      return;
   }
   const gateway = new BraintreeGateway({
      environment: Environment.Sandbox,
      merchantId: process.env.BRAINTREE_MERCHANT_ID,
      publicKey: process.env.BRAINTREE_PUBLIC_KEY,
      privateKey: process.env.BRAINTREE_PRIVATE_KEY
   })
   
   try {
      // 1. add customer to braintree vault
      // a. take buyer's user id and look up email address and add them both to braintree vault
      const buyerUserData = await getUserFromFirestore(buyerUserId);
      if (buyerUserData == null) {
         // TODO - do error logging and return message to user
         return
      }
      const buyerEmailAddress = buyerUserData?.emailAddress

      console.log('buyer custom fields');
      console.log(buyerUserId);
      console.log(buyerEmailAddress);

      const result = await gateway.customer.create({
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

      const paymentMethodArr = result.customer.paymentMethods
      if (paymentMethodArr == undefined) return;
      const paymentMethod = paymentMethodArr[0];
      const paymentToken = paymentMethod.token;

      // 2. edit buyer's firebase object to show they have payment on file and they entererd draw
      // a. add customer braintree id and payment token
      // b. paymentOnFile = true
      updateUserPaymentMethod(buyerUserId, braintreeCustomerId, paymentToken); // async function

      const drawData = await getRaffleDataFromFirestore(drawId);
      if (!drawData) {
         res.statusMessage = 'There was an error retrieving draw from firestore to do post update logic.'
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
      addDrawToUserObject(buyerUserId, drawId, numberTicketsAcquired); // async function
      
      // 4. edit draw's firebase object to show that this user has entered the draw
      const ticketsAvailable = drawData.numRemainingRaffleTickets;
      const ticketsRemaining = ticketsAvailable - numberTicketsAcquired;
      addUserToDrawObjectAfterEnteringDraw(buyerUserId, drawId, numberTicketsAcquired, ticketsRemaining);

      return res.json({
         success: result.success,
      })

   } catch (e) {
      console.log('error creating a customer');
      console.log(e);
      return res.json({
         success: false
      })
   }
   
});

router.post('/enter_draw/:drawId/existing_customer', async (req: Request, res: Response) => {
   
   // NO NEED TO DO ANYTHING WITH BRAINTREE SINCE CUSTOMER HAS PAYMENT ON FILE

   const { drawId } = req.params;
   const data = req.body;
   const { firstName, lastName, buyerUserId, numberTicketsAcquired } = data;
   try {
      // 1. confirm that user has payment on file 
      const userHasPaymentOnFile = await confirmUserHasPaymentOnFile(buyerUserId);
      if (!userHasPaymentOnFile) {
         return res.json({
            success: false
         })  
      }
      
      const drawData = await getRaffleDataFromFirestore(drawId);
      if (!drawData) {
         res.statusMessage = 'There was an error retrieving draw from firestore to do post update logic.'
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
      addDrawToUserObject(buyerUserId, drawId, numberTicketsAcquired); // async function
      
      // 3. edit draw's firebase object to show that this user has entered the draw
      const ticketsAvailable = drawData.numRemainingRaffleTickets;
      const ticketsRemaining = ticketsAvailable - numberTicketsAcquired;
      addUserToDrawObjectAfterEnteringDraw(buyerUserId, drawId, numberTicketsAcquired, ticketsRemaining);

      return res.json({
         success: true
      })

   } catch (err) {
      console.log(err);
      return res.json({
         success: false
      });
   }
});

router.post('/close_draw/:drawId', async (req: Request, res: Response) => {
   const { drawId } = req.params;
   console.log('closing draw endpoint');
   const drawData = await getRaffleDataFromFirestore(drawId);

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
   const gateway = new BraintreeGateway({
      environment: Environment.Sandbox,
      merchantId: process.env.BRAINTREE_MERCHANT_ID,
      publicKey: process.env.BRAINTREE_PUBLIC_KEY,
      privateKey: process.env.BRAINTREE_PRIVATE_KEY
   })
   
   const buyerTicketMapObject = drawData.buyerTickets;
   for (const buyerUserId in buyerTicketMapObject) {
      // console.log(`${buyerUserId}`)
      // console.log(buyerTicketMapObject[buyerUserId]);

      const userData = await getUserFromFirestore(buyerUserId);
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
      const pricing = getTotalDollarAmountOfPurchase(numTicketsBought, drawData.pricePerRaffleTicket);
      const total = pricing.total;

      // 1. make transaction for total amount of tickets
      const txnResult = await gateway.transaction.sale({
         // amount: ``,
         // paymentMethodToken: '',
         amount: `${total}`,
         paymentMethodToken: braintreePaymentMethodToken,
         options: {
            submitForSettlement: true,
         }
      })  
      // console.log(txnResult.success)
      // console.log(txnResult);

      if (txnResult.success) {
         // console.log('txn is successful - do stuff');
         
         // 2. make a transaction data object for firestore
         const braintreeTxnId = txnResult.transaction.id;
         const txnReference = await addTransactionToFirestore(drawId, buyerUserId, drawData.sellerUserId, pricing, numTicketsBought, userClaimedTicketArr, braintreeCustomerId, braintreeTxnId);

         // 3. edit ticket data
         for (let i=0; i < userClaimedTicketArr.length; i++) {
            const ticketId = userClaimedTicketArr[i];
            await updateTicketStatusInFirestore(ticketId, 2, true, txnReference?.id)
         }

         // 4. update amount of tickets sold on draw and transaction ref to draw
         if (txnReference) {
            await updateDrawInFirestorePostTxn(drawId, txnReference, numTicketsBought, drawData.soldRaffleTickets)
         } else {
            console.log('txn reference is null');
         }
      } else {
         // tell server the txn wasn't successful
         return res.json({
            success: false,
         })
      }
   }

   return res.json({
      success: true,
   })
})

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
         status: 'There was an error retrieving draw from firestore to do post upd logic.'
      });
      return;
   }
   const ticketsAvailable = drawData.numRemainingRaffleTickets;
   const ticketsSoldAlready = drawData.numTotalRaffleTickets - ticketsAvailable;
   const ticketsRemaining = ticketsAvailable - ticketsSold;
   const pricing = getTotalDollarAmountOfPurchase(ticketsSold, drawData.pricePerRaffleTicket);

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
         // await updateDrawInFirestorePostTxn(newTxnRef.id, drawId, buyerUserId, ticketsSold, ticketsSoldAlready, ticketsRemaining);
      } catch (err) {
         // console.log('error running the update draw function at /paypal_checkout/success endpoint')
         // console.log(err);
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
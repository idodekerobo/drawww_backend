import express, { Request, Response } from 'express';
const router = express.Router();
import { firestoreDb } from '../utils/firebase';
import { IDrawDataFromFirestoreType, IUserData, IPricingObject } from '../utils/types';

// const stripe_publishable_key = process.env.LIVE_STRIPE_PUBLISH_KEY;
// const stripe = require('stripe')(process.env.LIVE_STRIPE_SECRET_KEY)
const stripe = require('stripe')(process.env.TEST_STRIPE_SECRET_KEY)
const stripe_publishable_key = process.env.TEST_STRIPE_PUBLISH_KEY;

// TODO - take application fee amount
const getRaffleDataFromFirestore = async (raffleId: string): Promise<IDrawDataFromFirestoreType | null> => {
   const raffleRef = firestoreDb.collection('raffles').doc(raffleId);
   try {
      const raffleDocSnapshot = await raffleRef.get();
      if (raffleDocSnapshot.exists) {
         // return raffleDocSnapshot.data();
         const raffleData = raffleDocSnapshot.data() as IDrawDataFromFirestoreType
         return raffleData;
      } else {
         console.log('raffle doesn\'t exist');
         return null;
      }
   } catch (err) {
      console.log('error getting raffle from firestore')
      return null;
   }
}
const getUserFromFirestore = async (userId: string): Promise<IUserData | null> => {
   const userRef = firestoreDb.collection('users').doc(userId);
   try {
      const userDocSnapshot = await userRef.get();
      if (userDocSnapshot.exists) {
         // return userDocSnapshot.data();
         const userData = userDocSnapshot.data() as IUserData;
         return userData;
      } else {
         console.log('user doesn\'t exist');
         return null;
      }
   } catch (err) {
      console.log('error getting user from firestore')
      return null;
   }
}
const updateTicketsRemainingOnRaffleInFirestore = async (raffleId: string, numTicketsLeft: number) => {
   const raffleRef = firestoreDb.collection('raffles').doc(raffleId);
   try {
      await raffleRef.update({
         numRemainingRaffleTickets: numTicketsLeft
      });
   } catch (err) {
      console.log('error updating raffle tickets remaining for raffle on firestore');
      console.log(err);
   }
}
const getTotalDollarAmountOfPurchase = (numTicketsPurchased: number, pricePerTicket: number): IPricingObject => {
   const subtotal = numTicketsPurchased * pricePerTicket;
   // TODO - how do i manage tax ???
   const stripeTotal = subtotal*100
   const applicationFee = stripeTotal*.05

   const priceObject = {
      subtotal, 
      tax: 0,
      total: subtotal,
      stripeTotal,
      applicationFee,
   }
   return priceObject;
}
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
               const ticketsRemaining = ticketsAvailable - amountOfTicketsPurchased;
               return res.json({
                  publishableKey: stripe_publishable_key,
                  id: paymentIntentResponse.id,
                  client_secret: paymentIntentResponse.client_secret,
                  ticketsSold: amountOfTicketsPurchased,
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

module.exports = router;
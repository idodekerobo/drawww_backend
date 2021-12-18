import express, { Request, Response } from 'express';
const router = express.Router();
import { firestoreDb } from '../utils/firebase';
// import { DocumentSnapshot } from 'firebase-admin/firestore'
import { IDrawDataFromFirestoreType, IUserData, IPricingObject } from '../utils/types';

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

   const priceObject = {
      subtotal, 
      tax: 0,
      total: subtotal,
      stripeTotal,
   }
   return priceObject;
}
router.post('/checkout/:raffleId', async (req: Request, res: Response) => {
   const { raffleId } = req.params;
   const data = req.body;
   const { amountOfTicketsPurchased } = data;

   const raffleData = await getRaffleDataFromFirestore(raffleId);

   if (!(raffleData && (raffleData.numRemainingRaffleTickets > amountOfTicketsPurchased))) {
      console.log('not enough tickets');
      res.send({
         // TODO - send something that says there aren't enough raffle tickets???
      })
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
                  /* application_fee_amount: 0, */
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
               });
               
            } catch (err) {
               console.log('err making payment to user');
               console.log(err);
               return res.status(500).send({
                  error: err
               });
            }
         } else {
            console.log('seller not on stripe');
         }
   
         
      }
   }
   
   

   // res.send({
   //    publishable_key: 'publishable key',
   //    client_secret: 'client secret',
   //    amountOfTicketsPurchased,
   // })
})

module.exports = router;
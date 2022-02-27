import express, { Request, Response } from 'express';
const router = express.Router();
import { firestoreDb } from '../utils/firebase';

// const stripe = require('stripe')(process.env.TEST_STRIPE_SECRET_KEY)
const stripe = require('stripe')(process.env.LIVE_STRIPE_SECRET_KEY);

// TODO - deprecate stripe logic
router.get('/connect_seller/:userId', async (req: Request, res: Response) => {
   const { userId } = req.params;
   try {
      const account = await stripe.accounts.create({
         type: 'express',
         capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
         },
         settings: {
            payouts: {
               schedule: { interval: 'manual', } // manually make payouts to sellers
            }
         }
      });
      const stripeAccountId = account.id;
      
      const accountLink = await stripe.accountLinks.create({
         account: stripeAccountId,
         refresh_url: process.env.HOMEPAGE_DOMAIN, // refresh url if user doesn't finish onboard
         return_url: process.env.HOMEPAGE_DOMAIN, // return url when complete
         // refresh_url: 'http://localhost:3000/', // refresh url if user doesn't finish onboard
         // return_url: 'http://localhost:3000/', // return url when complete
         type: 'account_onboarding',
      });

      const userRef = firestoreDb.collection('users').doc(userId);
      await userRef.update({
         stripeAccountData: {
            accountId: stripeAccountId
         }
      })
      res.redirect(accountLink.url);
   } catch (err) {
      console.log('error onboarding user to stripe connect');
      console.log(err);
      res.statusMessage = "There was an error connecting to Stripe for seller onboarding.";
      res.status(500).send({
         error: err,
      })
   }
})

module.exports = router;
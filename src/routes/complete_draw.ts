import express, { Request, Response } from 'express';
const router = express.Router();

// const stripe = require('stripe')(process.env.TEST_STRIPE_SECRET_KEY)
const stripe = require('stripe')(process.env.LIVE_STRIPE_SECRET_KEY)

router.post('/:drawId/complete', async (req: Request, res: Response) => {

})
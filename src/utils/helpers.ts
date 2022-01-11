import { IPricingObject } from './types';

export const getTotalDollarAmountOfPurchase = (numTicketsPurchased: number, pricePerTicket: number): IPricingObject => {
   const subtotal = numTicketsPurchased * pricePerTicket;
   // TODO - how do i manage tax ???
   const stripeTotal = subtotal * 100
   const applicationFee = stripeTotal * .05

   const priceObject = {
      subtotal,
      tax: 0,
      total: subtotal,
      stripeTotal,
      applicationFee,
   }
   return priceObject;
}
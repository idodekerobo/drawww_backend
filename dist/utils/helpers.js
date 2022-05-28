"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTotalDollarAmountOfPurchase = void 0;
const getTotalDollarAmountOfPurchase = (numTicketsPurchased, pricePerTicket) => {
    const subtotal = numTicketsPurchased * pricePerTicket;
    // TODO - how do i manage tax ???
    // const stripeTotal = subtotal * 100
    // const applicationFee = stripeTotal * .05
    const priceObject = {
        subtotal,
        tax: 0,
        total: subtotal,
        // stripeTotal,
        // applicationFee,
    };
    return priceObject;
};
exports.getTotalDollarAmountOfPurchase = getTotalDollarAmountOfPurchase;

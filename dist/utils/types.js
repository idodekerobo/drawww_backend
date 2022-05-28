"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITicketStatus = exports.SellerStripeOnboardingStatus = void 0;
// braintree data to add
// customer id
// token ? ?
var SellerStripeOnboardingStatus;
(function (SellerStripeOnboardingStatus) {
    SellerStripeOnboardingStatus[SellerStripeOnboardingStatus["not_onboarded"] = 0] = "not_onboarded";
    SellerStripeOnboardingStatus[SellerStripeOnboardingStatus["partially_onboarded"] = 1] = "partially_onboarded";
    SellerStripeOnboardingStatus[SellerStripeOnboardingStatus["completely_onboarded"] = 2] = "completely_onboarded";
})(SellerStripeOnboardingStatus = exports.SellerStripeOnboardingStatus || (exports.SellerStripeOnboardingStatus = {}));
var SneakerGender;
(function (SneakerGender) {
    SneakerGender[SneakerGender["mens"] = 0] = "mens";
    SneakerGender[SneakerGender["womens"] = 1] = "womens";
})(SneakerGender || (SneakerGender = {}));
var ITicketStatus;
(function (ITicketStatus) {
    ITicketStatus[ITicketStatus["available"] = 0] = "available";
    ITicketStatus[ITicketStatus["claimed"] = 1] = "claimed";
    ITicketStatus[ITicketStatus["sold"] = 2] = "sold";
})(ITicketStatus = exports.ITicketStatus || (exports.ITicketStatus = {}));

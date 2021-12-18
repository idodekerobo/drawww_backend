import { Timestamp } from "firebase-admin/firestore";

export interface IUserData {
   name: string,
   phoneNum: string,
   city: string,
   state: string,
   zipCode: string,
   emailAddress?: string,
   sellerOnboardedToStripe?: SellerStripeOnboardingStatus,
   stripeAccountData?: IStripeUserData
}
export enum SellerStripeOnboardingStatus {
   NotOnboarded = 0,
   PartiallyOnboarded = 1,
   CompletelyOnboarded = 2
}
export interface IStripeUserData {
   accountId: string,
   // the rest of the parameters are optional because of partial onboarding
   email?: string,
   business?: string,
   country?: string,
   defaultCurrency?: string,
   statementDescriptor?: string,
}
enum SneakerGender {
   Mens,
   Womens
}
export interface IUserDrawData {
   userUid: string,
   sneakerGender: SneakerGender,
   raffleSneakerBrand: string,
   raffleSneakerName: string,
   raffleSneakerSize: string,
   raffleDuration: number,
   numTotalRaffleTickets: number,
   pricePerRaffleTicket: number,
}
export interface IDrawDataFromFirestoreType extends IUserDrawData {
   id: string,
   active: boolean,
   numRemainingRaffleTickets: number,
   soldRaffleTickets: number,
   raffleType: string,
   timeRaffleCreated: Timestamp,
   raffleExpirationDate: Timestamp,
   raffleImageStoragePath: string,
   raffleImageDownloadUrls: string[],
}
export interface IPricingObject {
   subtotal: number, 
   tax: number,
   total: number,
   stripeTotal: number,
}
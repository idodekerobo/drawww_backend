import { firestoreDb } from './firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { IDrawDataFromFirestoreType, IUserData } from './types';

export const drawCollectionName = 'draws';
const userCollectionName = 'users';
export const txnCollectionName = 'transactions';

export const getRaffleDataFromFirestore = async (raffleId: string): Promise<IDrawDataFromFirestoreType | null> => {
   const raffleRef = firestoreDb.collection(drawCollectionName).doc(raffleId);
   try {
      const raffleDocSnapshot = await raffleRef.get();
      if (raffleDocSnapshot.exists) {
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

export const getUserFromFirestore = async (userId: string): Promise<IUserData | null> => {
   const userRef = firestoreDb.collection(userCollectionName).doc(userId);
   try {
      const userDocSnapshot = await userRef.get();
      if (userDocSnapshot.exists) {
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
   const raffleRef = firestoreDb.collection(drawCollectionName).doc(raffleId);
   try {
      await raffleRef.update({
         numRemainingRaffleTickets: numTicketsLeft
      });
   } catch (err) {
      console.log('error updating raffle tickets remaining for raffle on firestore');
      console.log(err);
   }
}

export const updateDrawInFirestorePostTxn = async (txnId: string, drawId: string, buyerUserId: string, ticketsSold: number, ticketsSoldAlready: number, ticketsRemaining: number) => {
   
   try {
      const txnRef = firestoreDb.collection(txnCollectionName).doc(txnId);

      const drawData = await getRaffleDataFromFirestore(drawId);
      if (drawData === null || undefined) return; // TODO - figure out better error handling if draw data is null or not defined
      
      // existing tickets obj array
      let newTicketsArr = drawData.tickets;
      let ticketsUpdated = 0;
      
      for (let i=0; i < newTicketsArr.length; i++) {
         let checkTicket = newTicketsArr[i];
         if (checkTicket.status === 1) continue; // if ticket is sold skip to next iteration

         if (checkTicket.status === 0) {
            checkTicket.status = 1;
            checkTicket.buyerId = buyerUserId;
            checkTicket.transactionId = txnId;
            ticketsUpdated += 1;
         }
         if (ticketsUpdated === ticketsSold) break; // if you've updated the needed amount of tickets break for loop
      }

      let addToArr: string[] = [];
      for (let i=0; i < ticketsSold; i++) {
         addToArr.push(buyerUserId);
      }
      const updatedBuyerTicketArr = [ ...drawData.buyerTickets, ...addToArr ]

      const soldRaffleTickets = ticketsSoldAlready + ticketsSold;

      const drawRef = firestoreDb.collection(drawCollectionName).doc(drawId);
      const updateDrawObjectResponse = await drawRef.update({
         transactions: FieldValue.arrayUnion(txnRef),
         buyerTickets: updatedBuyerTicketArr,
         tickets: newTicketsArr,
         numRemainingRaffleTickets: ticketsRemaining,
         soldRaffleTickets,
      })
      // console.log(updateDrawObjectResponse);
   } catch (err) {
      console.log('error updating draw in firestore on server after transaction');
      console.log(err);
   }
}

export const updateUsersInFirestorePostTxn = async (txnId: string, buyerUserId: string, sellerUserId: string) => {
   const txnRef = firestoreDb.collection(txnCollectionName).doc(txnId);
   try {
      const buyerUserRef = firestoreDb.collection(userCollectionName).doc(buyerUserId);
      const updateBuyerResponse = await buyerUserRef.update({
         buyerTransactions: FieldValue.arrayUnion(txnRef)
      })
      // console.log(updateBuyerResponse);
      
      const sellerUserRef = firestoreDb.collection(userCollectionName).doc(sellerUserId);
      const updateSellerResponse = await sellerUserRef.update({
         sellerTransactions: FieldValue.arrayUnion(txnRef)
      })
      // console.log(updateSellerResponse);

   } catch (err) {
      console.log('error updating users post transaction');
      console.log(err);
   }
}
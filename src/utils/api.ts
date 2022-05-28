import { firestoreDb } from './firebase';
import { DocumentData, FieldValue, DocumentReference } from 'firebase-admin/firestore';
import { IDrawDataFromFirestoreType, IUserData, IDrawTicket, IPricingObject, ITicketStatus } from './types';

export const drawCollectionName = 'draws';
const userCollectionName = 'users';
export const txnCollectionName = 'transactions';
export const ticketCollectionName = 'tickets';

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
export const getFirestoreDocumentFromReference = async (ref: DocumentReference): Promise<DocumentData | null> => {
   try {
      const firestoreObject = await ref.get();
      if (firestoreObject.exists) {
         const objectData = firestoreObject.data() as IDrawTicket;
         return objectData;
      } else {
         console.log('firestore object does not exist');
         return null;
      }
   } catch (err) {
      console.log('error getting firestore object from firestore');
      console.log(err);
      return null;
   }
}
export const updateUserPaymentMethod = async (userId: string, braintreeCustomerId: string, paymentToken: string) => {
   const userRef = firestoreDb.collection(userCollectionName).doc(userId);
   try {
      const response = await userRef.set({
         paymentDataOnFile: true,
         paymentData: {
            braintree: {
               id: braintreeCustomerId,
               paymentToken,
            },
         },
      }, { merge: true })
   } catch (err) {
      console.log('error updating buyer user data with payment method')
      console.log(err);
   }
}
export const confirmUserHasPaymentOnFile = async (userId: string): Promise<boolean> => {
   const userData = await getUserFromFirestore(userId);
   if (!userData) return false;
   const paymentDataOnFile = userData.paymentDataOnFile;
   if (paymentDataOnFile) {
      return true;
   } else {
      return false;
   }
}

export const addDrawToUserObject = async (userId: string, drawId: string, numberTicketsAcquired: number) => {
   const userData = await getUserFromFirestore(userId);
   if (userData === null || undefined) return; // TODO - figure out better error handling if draw data is null or not defined
   // const usersEnteredDraws = userData.enteredDraws as Map<string, number> | undefined;
   const usersEnteredDraws = userData.enteredDraws;
   // const userRef = firestoreDb.collection(userCollectionName).doc(userId).withConverter(firestoreMapConverter);
   const userRef = firestoreDb.collection(userCollectionName).doc(userId);

   try {
      // if the user entered draws doesn't exist or doesn't have that array id -> add it
      // console.log('entered draws object');
      // console.log(usersEnteredDraws);

      if (!usersEnteredDraws) {
         
         // console.log('no entered draws');
         const newDrawRecord = {
            [drawId]: numberTicketsAcquired,
         }
         // console.log(newDrawRecord);
         const response = await userRef.set({
            enteredDraws: newDrawRecord
         }, { merge: true })
         
      } else if (!usersEnteredDraws[drawId]) {
         
         // console.log('this draw isnt entered');

         // console.log(usersEnteredDraws);
         usersEnteredDraws[drawId] = numberTicketsAcquired
         // console.log(usersEnteredDraws);

         const response = await userRef.set({
            enteredDraws: usersEnteredDraws
         }, { merge: true })

      } else {
         // console.log('this draw already entered, need to update');
         // console.log(usersEnteredDraws);
         const existingNumberOfTickets = usersEnteredDraws[drawId];
         const newNumberOfTickets = existingNumberOfTickets + numberTicketsAcquired
         usersEnteredDraws[drawId] = newNumberOfTickets;
         // console.log(usersEnteredDraws);
         const response = await userRef.set({
            enteredDraws: usersEnteredDraws
         }, { merge: true })

      }
   } catch (err) {
      console.log('error adding draw to user profile')
      console.log(err);
   }
}

export const addUserToDrawObjectAfterEnteringDraw = async (buyerUserId: string, drawId: string, numTicketsClaimed: number, ticketsRemaining: number) => {
   /*
      1/ update draw ticket array to show the usr has entered and how many tickets
         a/ buyerTickets array
         b/ tickets array of objects
      2/ update num of tickets available on draw
         a/ numTicketsRemaining
      
      * don't update transactions until draw closes
         * when draw closes transactions and num tickets sold will update
         * update transaction id on ticket array
   */
   const drawRef = firestoreDb.collection(drawCollectionName).doc(drawId);
   const drawData = await getRaffleDataFromFirestore(drawId);
   if (drawData === null || undefined) return; // TODO - figure out better error handling if draw data is null or not defined

   try {
      const buyerTicketMap = drawData.buyerTickets;

      // existing tickets obj array
      let ticketRefArr = drawData.tickets;
      let ticketsUpdated = 0;
      let updatedTicketArr: string[] = []
      
      // TODO - test that updated changes to ticket collection works
      for (let i=0; i < ticketRefArr.length; i++) {
         const ticketRef = ticketRefArr[i];
         let currentlyCheckedTicket = await getFirestoreDocumentFromReference(ticketRef) as IDrawTicket | null;
         if (!currentlyCheckedTicket) continue; // if ticket is null or undefined continue
         if (currentlyCheckedTicket.status > 0) continue; // if ticket is claimed or sold skip to next iteration

         if (currentlyCheckedTicket.status === 0) { // if ticket is available, do stuff
            currentlyCheckedTicket.status = 1;
            currentlyCheckedTicket.buyerUserId = buyerUserId;
            currentlyCheckedTicket.paid = false;
            updatedTicketArr.push(currentlyCheckedTicket.id);
            ticketsUpdated += 1;

            // console.log('new ticket data for ticket id:', currentlyCheckedTicket.id);
            // console.log(currentlyCheckedTicket);

            // updating ticket to reflect new status in firestore
            try {
               const response = await ticketRef.set(currentlyCheckedTicket)
            } catch (err) {
               console.log('error updating ticket objct after ticket was claimed for ticket id:', currentlyCheckedTicket.id, 'and buyer id: ', currentlyCheckedTicket.buyerUserId);
            }
         }
         if (ticketsUpdated === numTicketsClaimed) break; // if you've updated the needed amount of tickets break for loop
      }

      // if the draw doesn't have user, add user and tickets
      if ( !(buyerTicketMap[buyerUserId]) ) {
         buyerTicketMap[buyerUserId] = {
            numTickets: numTicketsClaimed,
            ticketArr: updatedTicketArr
         }
      } else {
         // if draw already has the user, update the tickets
         const existingNumTickets = buyerTicketMap[buyerUserId].numTickets;
         const newNumberOfTickets = existingNumTickets + numTicketsClaimed;
         const usersTicketsIds = buyerTicketMap[buyerUserId].ticketArr;
         buyerTicketMap[buyerUserId] = {
            numTickets: newNumberOfTickets,
            ticketArr: [...usersTicketsIds, ...updatedTicketArr]
         }
      }
      
      // update the draw object with new buyerTicketMap and remaining number of tickets
      const response = await drawRef.update({
         buyerTickets: buyerTicketMap,
         numRemainingRaffleTickets: ticketsRemaining
      })
   } catch (err) {
      console.log(`error updating draw object after user joined`);
      console.log(`draw id ${drawId}`);
      console.log(`user id ${buyerUserId}`);
      console.log(`number of tickets ${numTicketsClaimed}`);
      console.log(err);
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

export const addTransactionToFirestore = async (drawId: string, buyerUserId: string, sellerUserId: string, pricingObject: IPricingObject, numTickets: number, ticketIds: string[], braintreeCustomerId: string, braintreeTxnId: string): Promise<DocumentReference | null> => {
   const newTxnRef = firestoreDb.collection(txnCollectionName).doc();
   try {
      const response = await newTxnRef.set({
         id: newTxnRef.id,
         drawId,
         buyerUserId,
         sellerUserId,
         ticketIds,
         ticketsSold: numTickets,
         subtotalDollarAmount: pricingObject.subtotal,
         taxDollarAmount: pricingObject.tax,
         totalDollarAmount: pricingObject.total,
         braintreeTxnId,
         braintreeCustomerId,
      })
      return newTxnRef;
   } catch (err) {
      console.log('error adding transaction to firestore');
      console.log(err);
      return null;
   }
}

export const updateTicketStatusInFirestore = async (ticketId: string, ticketStatus: ITicketStatus, paid: boolean, transactionId?: string) => {
   try {
      const ticketRef = firestoreDb.collection(ticketCollectionName).doc(ticketId);
      const response = await ticketRef.update({
         status: ticketStatus,
         paid,
         transactionId
      })
   } catch (err) {
      console.log('error updating ticket status for ticket id', ticketId);
      console.log(err);
   }
}

export const updateDrawInFirestorePostTxn = async (drawId: string, txnRef: DocumentReference, ticketsSold: number, ticketsSoldAlready: number,) => {
   const soldRaffleTickets = ticketsSoldAlready + ticketsSold;
   const drawRef = firestoreDb.collection(drawCollectionName).doc(drawId);
   try {
      const updateDrawObjectResponse = await drawRef.update({
         transactions: FieldValue.arrayUnion(txnRef),
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
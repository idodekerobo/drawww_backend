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
const firestoreMapConverter = {
   toFirestore: (mapObj: { drawId: string, enteredDraws: Map<string, number> }) => {
      console.log()
      console.log('map object');
      console.log(mapObj);

      console.log()
      console.log('entered draws')
      console.log(mapObj.enteredDraws);
      
      console.log()
      const { drawId } = mapObj;
      console.log('get drawId', drawId)
      console.log(mapObj.enteredDraws.get(drawId));
      
      return {
         drawId: mapObj.enteredDraws.get(drawId),
         // numberOfTickets: mapObj.get('numberOfTickets'),
      }
   },
   fromFirestore: (
      // snapshot:firestoreDb.QueryDocumentSnapshot,
      // options: firestoreDb.SnapshotOptions
      snapshot: any,
      options: any
      ) => {
      const data = snapshot.data(options);
      return new Map<string, number>(Object.entries(data));
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

// TODO - need to make sure that users are only adding the difference and not incremental when updating tickets
export const addUserToDrawObject = async (buyerUserId: string, drawId: string, numTicketsSold: number, ticketsRemaining: number) => {
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
      
      let addToArr: string[] = [];
      for (let i=0; i < numTicketsSold; i++) {
         addToArr.push(buyerUserId);
      }
      const updatedBuyerTicketArr = [ ...drawData.buyerTickets, ...addToArr ]

      // existing tickets obj array
      let newTicketsArr = drawData.tickets;
      let ticketsUpdated = 0;
      
      for (let i=0; i < newTicketsArr.length; i++) {
         let checkTicket = newTicketsArr[i];
         if (checkTicket.status === 1) continue; // if ticket is sold skip to next iteration

         if (checkTicket.status === 0) {
            checkTicket.status = 1;
            checkTicket.buyerId = buyerUserId;
            // checkTicket.paid = false;
            // checkTicket.transactionId = txnId;
            ticketsUpdated += 1;
         }
         if (ticketsUpdated === numTicketsSold) break; // if you've updated the needed amount of tickets break for loop
      }

      const response = await drawRef.update({
         buyerTickets: updatedBuyerTicketArr,
         tickets: newTicketsArr,
         numRemainingRaffleTickets: ticketsRemaining
      })
   } catch (err) {
      console.log(`error updating draw object after user joined`);
      console.log(`draw id ${drawId}`);
      console.log(`user id ${buyerUserId}`);
      console.log(`number of tickets ${numTicketsSold}`);
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
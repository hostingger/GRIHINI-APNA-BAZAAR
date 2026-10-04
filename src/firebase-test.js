import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  query,
} from "firebase/firestore";

console.log("🔥 Firebase DB:", db);

async function testFirebase() {
  try {
    const productsRef = collection(db, "products");

    const q = query(
      productsRef,
      limit(1)
    );

    const snapshot = await getDocs(q);

    console.log("✅ FIREBASE CONNECTED");
    console.log(
      "Products found:",
      snapshot.size
    );
  } catch (error) {
    console.error(
      "❌ FIREBASE ERROR:",
      error
    );
  }
}

testFirebase();
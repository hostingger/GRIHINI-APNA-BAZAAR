import { db } from "./firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

export async function testFirebaseConnection() {
  try {
    const testQuery = query(
      collection(db, "products"),
      limit(1)
    );

    const snapshot = await getDocs(testQuery);

    console.log(
      "✅ FIREBASE CONNECTED"
    );

    console.log(
      "Products found:",
      snapshot.size
    );

    return true;
  } catch (error) {
    console.error(
      "❌ FIREBASE CONNECTION FAILED"
    );

    console.error(error);

    return false;
  }
}
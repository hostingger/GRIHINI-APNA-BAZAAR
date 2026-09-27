/*
========================================================
 GRIHINI APNA BAZAAR
 MARG → FIRESTORE BULK IMPORT
========================================================
*/

const fs = require("fs");
const path = require("path");

const { initializeApp, cert } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

// ======================================================
// PATHS
// ======================================================

const PROJECT_ROOT = path.resolve(__dirname, "..");

const PRODUCTS_FILE = path.join(
  PROJECT_ROOT,
  "data",
  "products.js"
);

const SERVICE_ACCOUNT_FILE = path.join(
  PROJECT_ROOT,
  "firebase-private",
  "grihiniapnabazaar-firebase-adminsdk-fbsvc-1187282860.json"
);

const STATE_FILE = path.join(
  PROJECT_ROOT,
  "data",
  "firestore-import-state.json"
);

// ======================================================
// SETTINGS
// ======================================================

const COLLECTION_NAME = "products";

// Firestore max batch = 500.
// We use 400 for safety.
const BATCH_SIZE = 400;

// ======================================================
// CHECK SERVICE ACCOUNT
// ======================================================

if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
  console.error("");
  console.error("❌ SERVICE ACCOUNT JSON NOT FOUND");
  console.error("");
  console.error(SERVICE_ACCOUNT_FILE);
  console.error("");
  process.exit(1);
}

// ======================================================
// LOAD SERVICE ACCOUNT
// ======================================================

let serviceAccount;

try {
  serviceAccount = JSON.parse(
    fs.readFileSync(
      SERVICE_ACCOUNT_FILE,
      "utf8"
    )
  );
} catch (error) {
  console.error("");
  console.error(
    "❌ SERVICE ACCOUNT JSON COULD NOT BE READ"
  );
  console.error("");
  console.error(error.message);
  console.error("");
  process.exit(1);
}

// ======================================================
// FIREBASE ADMIN INITIALIZATION
// ======================================================

try {
  initializeApp({
    credential: cert(serviceAccount),
  });
} catch (error) {
  console.error("");
  console.error(
    "❌ FIREBASE ADMIN INITIALIZATION FAILED"
  );
  console.error("");
  console.error(error);
  console.error("");
  process.exit(1);
}

const db = getFirestore();

// ======================================================
// SAFE STRING
// ======================================================

function cleanString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

// ======================================================
// LOAD PRODUCTS.JS
// ======================================================

function loadProducts() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error("");
    console.error("❌ products.js NOT FOUND");
    console.error("");
    console.error(PRODUCTS_FILE);
    console.error("");
    process.exit(1);
  }

  try {
    const source = fs.readFileSync(
      PRODUCTS_FILE,
      "utf8"
    );

    /*
    ------------------------------------------------------
    products.js structure:

    export const products = [
      {
        ...
      }
    ]

    We don't execute the file.

    We extract only the array between the first "[" and
    the last "]", then parse it as JSON.
    ------------------------------------------------------
    */

    const firstBracket =
      source.indexOf("[");

    const lastBracket =
      source.lastIndexOf("]");

    if (
      firstBracket === -1 ||
      lastBracket === -1 ||
      lastBracket <= firstBracket
    ) {
      throw new Error(
        "Could not find products array in products.js."
      );
    }

    const arrayText =
      source.slice(
        firstBracket,
        lastBracket + 1
      );

    const products =
      JSON.parse(arrayText);

    if (
      !Array.isArray(products)
    ) {
      throw new Error(
        "products.js array is not valid."
      );
    }

    return products;
  } catch (error) {
    console.error("");
    console.error(
      "❌ FAILED TO LOAD products.js"
    );
    console.error("");
    console.error(error);
    console.error("");
    process.exit(1);
  }
}

// ======================================================
// DOCUMENT ID
// ======================================================

function makeDocumentId(
  product,
  index
) {
  const code =
    cleanString(
      product.code
    );

  if (code) {
    return (
      "marg-" +
      code.replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      )
    );
  }

  const existingId =
    cleanString(
      product.id
    );

  if (existingId) {
    return existingId.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );
  }

  return (
    "marg-import-" +
    (index + 1)
  );
}

// ======================================================
// IMAGE CHECK
// ======================================================

function hasValidImage(product) {
  if (
    Array.isArray(
      product.images
    )
  ) {
    const image =
      product.images.find(
        (item) =>
          typeof item ===
            "string" &&
          item.trim() !== ""
      );

    if (image) {
      return true;
    }
  }

  return (
    cleanString(
      product.mainImage
    ) !== ""
  );
}

// ======================================================
// CONVERT PRODUCT
// ======================================================

function convertProduct(
  product,
  index
) {
  const documentId =
    makeDocumentId(
      product,
      index
    );

  const category =
    cleanString(
      product.category
    ) || "Other";

  const subcategory =
    cleanString(
      product.subcategory
    );

  const images =
    Array.isArray(
      product.images
    )
      ? product.images.filter(
          (image) =>
            typeof image ===
              "string" &&
            image.trim() !== ""
        )
      : [];

  const mainImage =
    cleanString(
      product.mainImage
    ) ||
    images[0] ||
    "";

  const imageReady =
    hasValidImage(product);

  const stock =
    cleanString(
      product.stock
    );

  const stockNumber =
    Number(stock);

  const stockStatus =
    stock !== "" &&
    Number.isFinite(
      stockNumber
    ) &&
    stockNumber > 0
      ? "in-stock"
      : "out-of-stock";

  return {
    id: documentId,

    localId:
      cleanString(
        product.id
      ) || documentId,

    margCode:
      cleanString(
        product.code
      ),

    code:
      cleanString(
        product.code
      ),

    name:
      cleanString(
        product.name
      ),

    brand:
      cleanString(
        product.brand
      ),

    company:
      cleanString(
        product.company
      ),

    manufacturer:
      cleanString(
        product.manufacturer
      ),

    category,

    subcategory,

    unit:
      cleanString(
        product.unit
      ),

    packSize:
      cleanString(
        product.packSize
      ),

    stock,

    stockValue:
      cleanString(
        product.stockValue
      ),

    stockStatus,

    cost:
      cleanString(
        product.cost
      ),

    purchaseRate:
      cleanString(
        product.purchaseRate
      ),

    mrp:
      cleanString(
        product.mrp
      ),

    salePrice:
      cleanString(
        product.salePrice
      ),

    websitePrice:
      cleanString(
        product.websitePrice
      ),

    offerPrice:
      cleanString(
        product.offerPrice
      ),

    blinkitReferencePrice:
      cleanString(
        product.blinkitReferencePrice
      ),

    barcode:
      cleanString(
        product.barcode
      ),

    rackNo:
      cleanString(
        product.rackNo
      ),

    deal:
      cleanString(
        product.deal
      ),

    free:
      cleanString(
        product.free
      ),

    purchaseDeal:
      cleanString(
        product.purchaseDeal
      ),

    purchaseFree:
      cleanString(
        product.purchaseFree
      ),

    images,

    mainImage,

    video:
      cleanString(
        product.video
      ),

    description:
      cleanString(
        product.description
      ),

    // Image readiness
    hasImage:
      imageReady,

    imageReady,

    liveReady:
      imageReady &&
      cleanString(
        product.name
      ) !== "",

    /*
    IMPORTANT:
    MARG products are NOT automatically live.
    */

    isLive: false,

    isActive:
      product.isActive !== false,

    // Admin flags
    isFeatured:
      product.isFeatured === true,

    isBestSeller:
      product.isBestSeller === true,

    isNewArrival:
      product.isNewArrival === true,

    isOffer:
      product.isOffer === true,

    isDeleted: false,

    // Source
    source: "MARG",

    importedFrom:
      "MARG PRODUCTS DATABASE",

    importVersion: 1,

    // Firebase timestamps
    importedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
  };
}

// ======================================================
// LOAD IMPORT STATE
// ======================================================

function loadState() {
  if (
    !fs.existsSync(
      STATE_FILE
    )
  ) {
    return {
      nextIndex: 0,
      imported: 0,
      skipped: 0,
    };
  }

  try {
    const state =
      JSON.parse(
        fs.readFileSync(
          STATE_FILE,
          "utf8"
        )
      );

    return {
      nextIndex:
        Number(
          state.nextIndex
        ) || 0,

      imported:
        Number(
          state.imported
        ) || 0,

      skipped:
        Number(
          state.skipped
        ) || 0,
    };
  } catch {
    return {
      nextIndex: 0,
      imported: 0,
      skipped: 0,
    };
  }
}

// ======================================================
// SAVE IMPORT STATE
// ======================================================

function saveState(state) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      state,
      null,
      2
    ),
    "utf8"
  );
}

// ======================================================
// MAIN IMPORT
// ======================================================

async function runImport() {
  console.log("");
  console.log(
    "================================================"
  );
  console.log(
    " GRIHINI APNA BAZAAR"
  );
  console.log(
    " MARG → FIRESTORE IMPORT"
  );
  console.log(
    "================================================"
  );
  console.log("");

  // Load products
  const products =
    loadProducts();

  console.log(
    `📦 Products found: ${products.length}`
  );

  console.log("");

  let state =
    loadState();

  let index =
    state.nextIndex;

  let imported =
    state.imported;

  let skipped =
    state.skipped;

  if (index > 0) {
    console.log(
      "🔄 RESUME MODE"
    );

    console.log(
      `Starting from product: ${
        index + 1
      }`
    );

    console.log(
      `Previously imported: ${
        imported
      }`
    );

    console.log(
      `Previously skipped: ${
        skipped
      }`
    );

    console.log("");
  }

  const startTime =
    Date.now();

  // ====================================================
  // BATCH LOOP
  // ====================================================

  while (
    index <
    products.length
  ) {
    const batch =
      db.batch();

    let batchCount = 0;

    const batchStartIndex =
      index;

    // -----------------------------------------------
    // CREATE BATCH
    // -----------------------------------------------

    while (
      index <
        products.length &&
      batchCount <
        BATCH_SIZE
    ) {
      const product =
        products[index];

      const name =
        cleanString(
          product.name
        );

      // Skip blank product names
      if (!name) {
        skipped++;
        index++;
        continue;
      }

      const documentId =
        makeDocumentId(
          product,
          index
        );

      const productData =
        convertProduct(
          product,
          index
        );

      const productRef =
        db
          .collection(
            COLLECTION_NAME
          )
          .doc(documentId);

      /*
      merge:true:

      Existing product:
        update

      New product:
        create

      Duplicate:
        no duplicate document
      */

      batch.set(
        productRef,
        productData,
        {
          merge: true,
        }
      );

      batchCount++;
      index++;
    }

    // -----------------------------------------------
    // NO WRITES
    // -----------------------------------------------

    if (
      batchCount === 0
    ) {
      saveState({
        nextIndex: index,
        imported,
        skipped,
      });

      continue;
    }

    // -----------------------------------------------
    // COMMIT
    // -----------------------------------------------

    try {
      await batch.commit();

      imported +=
        batchCount;

      saveState({
        nextIndex: index,
        imported,
        skipped,
      });

      const percent =
        (
          (index /
            products.length) *
          100
        ).toFixed(2);

      const elapsed =
        (
          (Date.now() -
            startTime) /
          1000
        ).toFixed(1);

      console.log(
        `✅ ${index}/${products.length} | ${percent}% | batch ${batchCount} | imported ${imported} | skipped ${skipped} | ${elapsed}s`
      );
    } catch (error) {
      console.error("");
      console.error(
        "❌ FIRESTORE BATCH FAILED"
      );
      console.error("");

      console.error(
        `Failed batch starts at product: ${
          batchStartIndex + 1
        }`
      );

      console.error(
        `Batch size: ${batchCount}`
      );

      console.error("");

      console.error(
        error
      );

      console.error("");

      /*
      Retry this batch on next run.
      */

      saveState({
        nextIndex:
          batchStartIndex,

        imported,

        skipped,
      });

      console.error(
        "💾 Import position saved."
      );

      console.error(
        "Run the same command again to retry."
      );

      process.exit(1);
    }
  }

  // ====================================================
  // FINISHED
  // ====================================================

  saveState({
    nextIndex:
      products.length,

    imported,

    skipped,
  });

  const totalTime =
    (
      (Date.now() -
        startTime) /
      1000
    ).toFixed(1);

  console.log("");

  console.log(
    "================================================"
  );

  console.log(
    " ✅ IMPORT FINISHED"
  );

  console.log(
    "================================================"
  );

  console.log("");

  console.log(
    `📦 Source products: ${products.length}`
  );

  console.log(
    `✅ Imported/updated: ${imported}`
  );

  console.log(
    `⚠️ Skipped: ${skipped}`
  );

  console.log(
    `⏱️ Time: ${totalTime} seconds`
  );

  console.log("");

  console.log(
    "🔥 Firestore collection: products"
  );

  console.log("");

  console.log(
    "ℹ️ Products are NOT LIVE automatically."
  );

  console.log(
    "ℹ️ Products without images remain NOT READY."
  );

  console.log("");
}

// ======================================================
// START
// ======================================================

runImport()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("");
    console.error(
      "❌ IMPORT ERROR"
    );
    console.error("");

    console.error(
      error
    );

    console.error("");

    process.exit(1);
  });
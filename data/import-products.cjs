const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "stock.xlsx");
const outputFile = path.join(__dirname, "products.js");

console.log("=================================");
console.log("GRIHINI APNA BAZAAR");
console.log("MARG PRODUCT IMPORT");
console.log("=================================");

if (!fs.existsSync(inputFile)) {
  console.error("❌ stock.xlsx नहीं मिला");
  console.error(`Expected file: ${inputFile}`);
  process.exit(1);
}

try {
  const workbook = XLSX.readFile(inputFile, {
    cellDates: true,
    raw: false,
  });

  console.log("Excel sheets:", workbook.SheetNames);

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  console.log("Total Excel rows:", rows.length);

  if (rows.length === 0) {
    console.error("❌ Excel में कोई data नहीं मिला");
    process.exit(1);
  }

  const normalizeKey = (key) => {
    return String(key)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  };

  const cleanValue = (value) => {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  };

  const getValue = (row, ...keys) => {
    const normalizedRow = {};

    Object.keys(row).forEach((key) => {
      normalizedRow[normalizeKey(key)] = cleanValue(row[key]);
    });

    for (const key of keys) {
      const value = normalizedRow[normalizeKey(key)];

      if (value !== undefined && value !== "") {
        return value;
      }
    }

    return "";
  };

  console.log("");
  console.log("First Excel row:");
  console.log(rows[0]);

  const products = rows
    .map((row, index) => {
      const code = getValue(row, "code");

      const name = getValue(
        row,
        "name",
        "itemdescri",
        "item_description",
        "itemdescription",
        "product_name",
        "product",
        "item"
      );

      const unit = getValue(
        row,
        "unit",
        "packing",
        "pack",
        "pack_size"
      );

      const stock = getValue(
        row,
        "stock",
        "current_stock",
        "qty",
        "quantity"
      );

      const cost = getValue(
        row,
        "cost",
        "cost_price"
      );

      const value = getValue(row, "value");

      const mrp = getValue(
        row,
        "mrp",
        "m.r.p.",
        "m.r.p"
      );

      const purchaseRate = getValue(
        row,
        "pur_rate",
        "purchase_rate",
        "purchase",
        "purchase_price"
      );

      const salePrice = getValue(
        row,
        "rate",
        "sale_price",
        "sales_price",
        "sales_rate",
        "selling_price"
      );

      const company = getValue(
        row,
        "company",
        "brand"
      );

      const manufacturer = getValue(
        row,
        "manufact",
        "manufacturer"
      );

      const rackNo = getValue(
        row,
        "rackno",
        "rack_no",
        "rack"
      );

      const barcode = getValue(
        row,
        "barcode",
        "bar_code",
        "ean",
        "upc"
      );

      const deal = getValue(
        row,
        "deal",
        "sales_scheme"
      );

      const free = getValue(row, "free");

      const purchaseDeal = getValue(
        row,
        "pur_deal",
        "purchase_scheme"
      );

      const purchaseFree = getValue(
        row,
        "pur_free"
      );

      if (!name) {
        return null;
      }

      return {
        id: code ? `marg-${code}` : `marg-${index + 1}`,

        code,
        name,

        brand: company,
        company,
        manufacturer,

        category: "",
        subcategory: "",

        unit,
        packSize: unit,

        stock,
        cost,
        stockValue: value,

        mrp,
        purchaseRate,
        salePrice,

        websitePrice: "",
        offerPrice: "",
        blinkitReferencePrice: "",

        barcode,
        rackNo,

        deal,
        free,
        purchaseDeal,
        purchaseFree,

        images: [],
        video: "",
        mainImage: "",

        description: "",

        isActive: true,
        isLive: false,

        isFeatured: false,
        isBestSeller: false,
        isNewArrival: false,
        isOffer: false,

        source: "MARG",
        sourceFile: "stock.xlsx",

        mediaReady: false,

        lastUpdated: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  const seen = new Set();

  const uniqueProducts = products.filter((product) => {
    const uniqueKey =
      product.barcode ||
      product.code ||
      product.id;

    if (seen.has(uniqueKey)) {
      return false;
    }

    seen.add(uniqueKey);
    return true;
  });

  const output = `// ============================================
// GRIHINI APNA BAZAAR
// MARG PRODUCT DATABASE
// AUTO-GENERATED FILE
// ============================================

export const products = ${JSON.stringify(
    uniqueProducts,
    null,
    2
  )};

export default products;
`;

  fs.writeFileSync(
    outputFile,
    output,
    "utf8"
  );

  console.log("");
  console.log("=================================");
  console.log("✅ IMPORT SUCCESSFUL");
  console.log("=================================");
  console.log("Excel rows:", rows.length);
  console.log("Products imported:", uniqueProducts.length);
  console.log(
    "Products skipped:",
    rows.length - uniqueProducts.length
  );
  console.log("Output:", outputFile);
  console.log("=================================");
  console.log("");
} catch (error) {
  console.error("");
  console.error("=================================");
  console.error("❌ IMPORT FAILED");
  console.error("=================================");
  console.error(error);
  process.exit(1);
}
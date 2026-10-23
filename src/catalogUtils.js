export const normalizeSearchText = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-IN').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
const FRESH_PRODUCE_NAMES = new Set([
  'tomato', 'tomatoes', 'tamatar', 'टमाटर', 'potato', 'potatoes', 'aloo', 'आलू',
  'onion', 'onions', 'pyaz', 'pyaaz', 'प्याज', 'spinach', 'palak', 'पालक',
  'cabbage', 'patta gobhi', 'पत्ता गोभी', 'cauliflower', 'phool gobhi', 'फूल गोभी',
  'brinjal', 'baingan', 'बैंगन', 'eggplant', 'okra', 'bhindi', 'भिंडी', 'ladyfinger',
  'cucumber', 'kheera', 'खीरा', 'carrot', 'carrots', 'gajar', 'गाजर', 'capsicum',
  'shimla mirch', 'शिमला मिर्च', 'coriander leaves', 'dhania patta', 'धनिया पत्ता',
  'lettuce', 'mooli', 'मूली', 'lauki', 'लौकी', 'karela', 'करेला', 'tinda', 'तिंडा',
  'kaddu', 'कद्दू', 'green peas', 'हरी मटर', 'matar', 'मटर', 'lemon', 'nimbu', 'नींबू',
  'garlic', 'lahsun', 'लहसुन', 'ginger', 'adrak', 'अदरक', 'green chilli', 'hari mirch',
  'हरी मिर्च', 'mint leaves', 'pudina', 'पुदीना', 'sweet corn', 'corn on the cob',
  'makka', 'मक्का', 'radish', 'turnip', 'शलजम', 'beetroot', 'चुकंदर', 'drumstick',
  'सहजन', 'ivy gourd', 'kundru', 'कुंदरू', 'bottle gourd', 'ridge gourd', 'tori',
  'तोरई', 'snake gourd', 'parwal', 'parval', 'परवल', 'beans', 'green beans', 'peas',
  'pumpkin', 'कद्दू', 'raw banana', 'कच्चा केला'
].map(normalizeSearchText));

const FRESH_PRODUCE_CATEGORIES = new Set([
  'vegetable', 'vegetables', 'sabzi', 'sabji', 'fruits', 'fruit', 'fresh produce', 'produce',
  'सब्जी', 'सब्जियां', 'सब्जियाँ', 'फल'
].map(normalizeSearchText));

// Keep packaged grocery products such as tomato ketchup/sauce, garlic paste and cornflakes.
export const isFreshProduce = (product = {}) => {
  const category = normalizeSearchText(product.category);
  if (FRESH_PRODUCE_CATEGORIES.has(category) || /\b(fresh produce|vegetables?|fruits?)\b/.test(category)) return true;
  const name = normalizeSearchText(product.name);
  if (!name) return false;
  if (/\b(ketchup|sauce|paste|pickle|powder|masala|chips|flakes|noodles|soup|juice|canned|frozen|ready to eat|seasoning)\b/.test(name)) return false;
  return FRESH_PRODUCE_NAMES.has(name);
};
// Keep barcode values as strings: numeric conversion can silently remove leading zeroes.
export const PRODUCT_CODE_FIELDS = [
  'barcode', 'barcodeNumber', 'barcode_number', 'barcodeValue', 'barcode_value', 'barcodeId', 'barcode_id', 'barCode', 'ean', 'ean8', 'ean13', 'ean14',
  'upc', 'upca', 'upce', 'gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14', 'sku',
  'productCode', 'product_code', 'itemCode', 'item_code', 'itemNumber', 'item_number',
  'articleCode', 'article_code', 'scanCode', 'scan_code', 'jan', 'isbn'
];

export const getProductCodes = (product = {}) => {
  const knownValues = PRODUCT_CODE_FIELDS.map((field) => product?.[field]);
  // Also preserve legacy/dataset-specific variants such as barcode_value or item_code.
  const dynamicValues = Object.entries(product || {})
    .filter(([key]) => /^(?:barcode[_-]?(?:number|value|id)?|ean(?:8|13|14)?|upc(?:a|e)?|gtin(?:8|12|13|14)?|sku|product[_-]?code|item[_-]?(?:code|number)|article[_-]?code|scan[_-]?code|jan|isbn)$/i.test(key))
    .map(([, value]) => value);
  const nestedValues = ['identifiers', 'codes'].flatMap((key) => {
    const object = product?.[key];
    return object && typeof object === 'object' ? Object.values(object) : [];
  });
  return [...new Set([...knownValues, ...dynamicValues, ...nestedValues]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
    .map((value) => String(value).trim()))];
};

export const compactSearchCode = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('en-IN')
  .replace(/[^a-z0-9]/g, '');

const normalizeProductSearchText = (value) => normalizeSearchText(value).replace(/(\p{N})\s+(?=\p{L})/gu, '$1');

/** Search text fields token-by-token; search barcode/SKU codes separately to avoid short-number false matches. */
export const matchesProductSearch = (product = {}, query = '') => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) return true;

  const codes = getProductCodes(product);
  const textFields = [
    product.name, product.category, product.size, product.tag, product.brand,
    product.description, product.id, product.price, product.mrp, product.stock
  ];
  const searchable = normalizeProductSearchText(textFields
    .filter((value) => value !== null && value !== undefined)
    .join(' '));
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length && terms.every((term) => searchable.includes(term))) return true;

  const compactQuery = compactSearchCode(query);
  // Scanner lookup usually supplies the whole code; require 4+ compact characters
  // so searching a short number like "497" does not match any barcode by accident.
  return compactQuery.length >= 4 && codes.some((code) => compactSearchCode(code).includes(compactQuery));
};

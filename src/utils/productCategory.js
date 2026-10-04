export const PRODUCT_CATEGORIES = [
  "Atta, Rice & Dal",
  "Oil & Ghee",
  "Masala & Spices",
  "Biscuits & Bakery",
  "Snacks",
  "Noodles & Pasta",
  "Tea & Coffee",
  "Dairy & Breakfast",
  "Personal Care",
  "Home Care",
  "Baby Care",
  "Puja & Household",
  "Other",
];

function textOf(product) {
  return [
    product.name,
    product.productName,
    product.itemName,
    product.brand,
    product.company,
    product.companyName,
    product.manufacturer,
    product.manufact,
    product.category,
    product.categoryName,
    product.productCategory,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const RULES = [
  {
    category: "Baby Care",
    words: [
      "baby",
      "pampers",
      "diaper",
      "diapers",
      "huggies",
      "mamy poko",
      "mamypoko",
      "baby wipes",
      "johnson baby",
      "cerelac",
      "baby food",
      "baby soap",
      "baby shampoo",
      "baby lotion",
    ],
  },

  {
    category: "Personal Care",
    words: [
      "shampoo",
      "conditioner",
      "soap",
      "toothpaste",
      "tooth brush",
      "toothbrush",
      "face wash",
      "facewash",
      "face cream",
      "moisturizer",
      "lotion",
      "deodorant",
      "perfume",
      "body spray",
      "shaving",
      "razor",
      "hair oil",
      "hair colour",
      "hair color",
      "sanitary",
      "sanitary pad",
      "lip balm",
      "cosmetic",
      "cream",
      "handwash",
      "hand wash",
    ],
  },

  {
    category: "Home Care",
    words: [
      "detergent",
      "washing powder",
      "washing soap",
      "surf",
      "ariel",
      "rin",
      "tide",
      "wheel",
      "vim",
      "dishwash",
      "dish wash",
      "dish washer",
      "harpic",
      "lizol",
      "domex",
      "phenyl",
      "phenyle",
      "floor cleaner",
      "toilet cleaner",
      "bathroom cleaner",
      "glass cleaner",
      "surface cleaner",
      "cleaner",
      "cleaning",
      "hit",
      "mortein",
      "good knight",
      "all out",
      "mosquito",
      "naphthalene",
      "broom",
      "jhadu",
      "mop",
      "pocha",
      "scrubber",
      "dustbin",
      "garbage bag",
      "garbage bags",
      "tissue",
      "napkin",
      "toilet",
      "phenyl",
      "platform cleaner",
      "floor wash",
      "toilet wash",
    ],
  },

  {
    category: "Oil & Ghee",
    words: [
      "cooking oil",
      "mustard oil",
      "sarso oil",
      "sarson oil",
      "refined oil",
      "sunflower oil",
      "soyabean oil",
      "soya oil",
      "rice bran oil",
      "groundnut oil",
      "peanut oil",
      "palm oil",
      "olive oil",
      "oil",
      "ghee",
      "desi ghee",
      "cow ghee",
      "buffalo ghee",
    ],
  },

  {
    category: "Masala & Spices",
    words: [
      "masala",
      "spice",
      "spices",
      "haldi",
      "turmeric",
      "mirchi",
      "mirch",
      "chilli",
      "red chilli",
      "dhania",
      "coriander",
      "jeera",
      "cumin",
      "garam masala",
      "chaat masala",
      "sabji masala",
      "chicken masala",
      "meat masala",
      "paneer masala",
      "kitchen king",
      "hing",
      "elaichi",
      "cardamom",
      "dalchini",
      "cinnamon",
      "laung",
      "clove",
      "kali mirch",
      "black pepper",
      "pepper",
      "tejpatta",
      "bay leaf",
      "ajwain",
      "saunf",
      "methi",
      "kasuri methi",
    ],
  },

  {
    category: "Biscuits & Bakery",
    words: ["biscuit", "biscuits", "cookie", "cookies", "rusk", "cake", "bakery", "bread", "toast"],
  },

  {
    category: "Noodles & Pasta",
    words: ["maggi", "noodles", "pasta", "vermicelli", "seviyan", "spaghetti", "macaroni"],
  },

  {
    category: "Tea & Coffee",
    words: ["tea", "chai", "coffee", "green tea", "health drink", "boost", "horlicks", "bournvita"],
  },

  {
    category: "Snacks",
    words: [
      "biscuit",
      "biscuits",
      "cookie",
      "cookies",
      "chips",
      "kurkure",
      "lays",
      "namkeen",
      "bhujia",
      "mixture",
      "mixtures",
      "wafer",
      "wafers",
      "popcorn",
      "toffee",
      "candy",
      "chocolate",
      "chocolates",
      "noodles",
      "pasta",
      "maggi",
      "atta noodles",
      "snack",
      "snacks",
      "rusk",
      "papad",
    ],
  },

  {
    category: "Dairy & Breakfast",
    words: [
      "milk",
      "dudh",
      "doodh",
      "curd",
      "dahi",
      "lassi",
      "chhach",
      "butter",
      "paneer",
      "cheese",
      "cream",
      "bread",
      "brown bread",
      "milk bread",
      "jam",
      "cornflakes",
      "corn flake",
      "oats",
      "muesli",
      "breakfast",
      "peda",
      "khoa",
      "khoya",
      "milk powder",
    ],
  },

  {
    category: "Puja & Household",
    words: ["agarbatti", "dhoop", "camphor", "kapoor", "puja", "pooja", "diya", "cotton wick", "matchbox"],
  },

  {
    category: "Atta, Rice & Dal",
    words: [
      "atta",
      "aata",
      "wheat flour",
      "flour",
      "maida",
      "suji",
      "sooji",
      "rice",
      "chawal",
      "basmati",
      "dal",
      "dhal",
      "masoor",
      "moong",
      "urad",
      "chana dal",
      "toor dal",
      "arhar",
      "rajma",
      "kabuli chana",
      "chana",
      "besan",
      "sattu",
      "poha",
      "chiwda",
      "chivda",
      "daliya",
      "pulses",
    ],
  },
];

export function getProductCategory(product) {
  const explicit = String(
    product?.category ||
      product?.categoryName ||
      product?.productCategory ||
      ""
  ).trim();

  if (
    PRODUCT_CATEGORIES.includes(
      explicit
    )
  ) {
    return explicit;
  }

  const text = textOf(product);

  for (const rule of RULES) {
    for (const word of rule.words) {
      if (
        text.includes(
          word.toLowerCase()
        )
      ) {
        return rule.category;
      }
    }
  }

  return "Other";
}

export function isProductInCategory(
  product,
  category
) {
  if (!category) {
    return true;
  }

  return (
    getProductCategory(product) ===
    category
  );
}
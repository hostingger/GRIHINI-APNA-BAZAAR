import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

import Header from "./components/Header";
import LightRays from "./components/LightRays";
import { db } from "./firebase";

import "./App.css";

const categories = [
  {
    name: "Atta, Rice & Dal",
    image: "/categories/atta-rice-dal.jpg",
  },
  {
    name: "Oil & Ghee",
    image: "/categories/oil-ghee.jpg",
  },
  {
    name: "Masala & Spices",
    image: "/categories/masala-spices.jpg",
  },
  {
    name: "Snacks",
    image: "/categories/snacks.jpg",
  },
  {
    name: "Dairy & Breakfast",
    image: "/categories/dairy-breakfast.jpg",
  },
  {
    name: "Personal Care",
    image: "/categories/personal-care.jpg",
  },
  {
    name: "Home Care",
    image: "/categories/home-care.jpg",
  },
  {
    name: "Baby Care",
    image: "/categories/baby-care.jpg",
  },
];

function getName(product) {
  return (
    product.productName ||
    product.name ||
    product.itemName ||
    "Unnamed Product"
  );
}

function getBrand(product) {
  return (
    product.brand ||
    product.company ||
    product.companyName ||
    product.manufact ||
    ""
  );
}

function getStock(product) {
  const value = Number(
    product.stock ??
      product.stockQuantity ??
      product.quantity ??
      0
  );

  return Number.isFinite(value) ? value : 0;
}

function getMRP(product) {
  const value = Number(
    product.mrp ??
      product.MRP ??
      product.mrpPrice ??
      0
  );

  return Number.isFinite(value) ? value : 0;
}

function getPrice(product) {
  const value = Number(
    product.finalOnlinePrice ??
      product.onlinePrice ??
      product.salePrice ??
      product.rate ??
      product.currentRate ??
      0
  );

  return Number.isFinite(value) ? value : 0;
}

function getImage(product) {
  if (product.mainImage) return product.mainImage;

  if (product.image) return product.image;

  if (Array.isArray(product.images) && product.images.length) {
    const first = product.images[0];

    if (typeof first === "string") {
      return first;
    }

    if (first?.url) {
      return first.url;
    }

    if (first?.src) {
      return first.src;
    }
  }

  return "";
}

function getCategory(product) {
  return (
    product.category ||
    product.categoryName ||
    product.productCategory ||
    ""
  );
}

function ProductCard({ product }) {
  const name = getName(product);
  const brand = getBrand(product);
  const stock = getStock(product);
  const mrp = getMRP(product);
  const price = getPrice(product);
  const image = getImage(product);

  const discount =
    mrp > price && price > 0
      ? Math.round(((mrp - price) / mrp) * 100)
      : 0;

  return (
    <article className="customer-product-card">
      <div className="customer-product-image">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
          />
        ) : (
          <div className="customer-product-no-image">
            <span>📦</span>
            <small>No Image</small>
          </div>
        )}

        {discount > 0 && (
          <span className="customer-discount">
            {discount}% OFF
          </span>
        )}
      </div>

      <div className="customer-product-content">
        {brand && (
          <div className="customer-product-brand">
            {brand}
          </div>
        )}

        <h3 title={name}>{name}</h3>

        <div className="customer-product-price-row">
          <strong>
            ₹{price.toFixed(2)}
          </strong>

          {mrp > price && (
            <span className="customer-product-mrp">
              ₹{mrp.toFixed(2)}
            </span>
          )}
        </div>

        <div className="customer-product-stock">
          {stock > 0 ? (
            <span className="in-stock">
              ✓ In Stock
            </span>
          ) : (
            <span className="out-stock">
              Out of Stock
            </span>
          )}
        </div>

        <button
          type="button"
          className="customer-add-button"
          disabled={!image || stock <= 0 || price <= 0}
        >
          {!image
            ? "Image Required"
            : stock <= 0
              ? "Out of Stock"
              : "Add to Cart"}
        </button>
      </div>
    </article>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] =
    useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const productsQuery = query(
          collection(db, "products"),
          where("isLive", "==", true),
          limit(24)
        );

        const snapshot = await getDocs(
          productsQuery
        );

        if (!mounted) return;

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts(data);
      } catch (err) {
        console.error(
          "Product loading error:",
          err
        );

        if (mounted) {
          setError(
            "Products load nahi ho pa rahe hain."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory) {
      const selected =
        selectedCategory.toLowerCase();

      result = result.filter((product) => {
        const category =
          getCategory(product).toLowerCase();

        return (
          category.includes(selected) ||
          selected.includes(category)
        );
      });
    }

    const searchText =
      search.trim().toLowerCase();

    if (searchText) {
      result = result.filter((product) => {
        const name =
          getName(product).toLowerCase();

        const brand =
          getBrand(product).toLowerCase();

        const barcode = String(
          product.barcode || ""
        ).toLowerCase();

        const code = String(
          product.code || ""
        ).toLowerCase();

        return (
          name.includes(searchText) ||
          brand.includes(searchText) ||
          barcode.includes(searchText) ||
          code.includes(searchText)
        );
      });
    }

    return result;
  }, [
    products,
    selectedCategory,
    search,
  ]);

  const scrollTo = (id) => {
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  const handleCategory = (name) => {
    setSelectedCategory(name);

    setTimeout(() => {
      scrollTo("products");
    }, 100);
  };

  const handleViewAll = () => {
    setSelectedCategory("");
    scrollTo("products");
  };

  return (
    <main className="app">
      <Header
        searchValue={search}
        onSearchChange={setSearch}
      />

      {/* HERO */}
      <section
        id="home"
        className="hero-section"
      >
        <div className="light-rays-background">
          <LightRays
            raysOrigin="top-center"
            raysColor="#35ffb0"
            raysSpeed={0.65}
            lightSpread={0.95}
            rayLength={2.8}
            pulsating={true}
            fadeDistance={1.2}
            saturation={1.2}
            followMouse={true}
            mouseInfluence={0.12}
            noiseAmount={0.015}
            distortion={0.015}
          />
        </div>

        <div className="hero-content">
          <span className="hero-badge">
            GRIHINI APNA BAZAAR
          </span>

          <h1>
            Everyday Shopping,
            <br />
            Simplified.
          </h1>

          <p>
            Quality groceries • Best prices •
            Easy shopping
          </p>

          <button
            type="button"
            className="shop-button"
            onClick={() => scrollTo("categories")}
          >
            Shop Now →
          </button>
        </div>
      </section>

      {/* CATEGORIES */}
      <section
        id="categories"
        className="categories-section"
      >
        <div className="section-heading">
          <div>
            <span className="section-label">
              SHOP BY CATEGORY
            </span>

            <h2>Categories</h2>
          </div>

          <button
            type="button"
            className="view-all-button"
            onClick={handleViewAll}
          >
            View All →
          </button>
        </div>

        <div className="category-grid">
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              className={
                selectedCategory ===
                category.name
                  ? "category-card selected"
                  : "category-card"
              }
              onClick={() =>
                handleCategory(
                  category.name
                )
              }
            >
              <div className="category-icon">
                <img
                  src={category.image}
                  alt={category.name}
                  loading="lazy"
                />
              </div>

              <span className="category-name">
                {category.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* AD */}
      <section className="advertisement-section">
        <div className="advertisement-card">
          <div className="ad-content">
            <span className="ad-label">
              GRIHINI APNA BAZAAR
            </span>

            <h2>
              Daily shopping,
              <br />
              made simple.
            </h2>

            <p>
              Aapki daily shopping, ab ghar
              baithe.
            </p>

            <button
              type="button"
              className="ad-button"
              onClick={() =>
                scrollTo("products")
              }
            >
              Start Shopping →
            </button>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section
        id="products"
        className="products-section"
      >
        <div className="section-heading">
          <div>
            <span className="section-label">
              OUR COLLECTION
            </span>

            <h2>
              {selectedCategory ||
                "Popular Products"}
            </h2>
          </div>

          {selectedCategory && (
            <button
              type="button"
              className="view-all-button"
              onClick={() =>
                setSelectedCategory("")
              }
            >
              View All →
            </button>
          )}
        </div>

        {loading && (
          <div className="products-status-box">
            <div className="products-loading-spinner" />
            <h3>Products loading...</h3>
            <p>
              Catalogue load ho raha hai.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="products-status-box products-error">
            <div className="placeholder-icon">
              ⚠️
            </div>

            <h3>
              Products load nahi hue
            </h3>

            <p>{error}</p>
          </div>
        )}

        {!loading &&
          !error &&
          filteredProducts.length > 0 && (
            <div className="customer-product-grid">
              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                )
              )}
            </div>
          )}

        {!loading &&
          !error &&
          filteredProducts.length === 0 && (
            <div className="products-placeholder">
              <div className="placeholder-icon">
                🛍️
              </div>

              <h3>
                {search ||
                selectedCategory
                  ? "No products found"
                  : "Products coming soon"}
              </h3>

              <p>
                {search
                  ? "Search ko change karke dobara try karein."
                  : "Admin se product LIVE hone ke baad yahan dikhenge."}
              </p>
            </div>
          )}
      </section>

      {/* OFFERS */}
      <section
        id="offers"
        className="info-section"
      >
        <div className="info-section-inner">
          <span className="section-label">
            OFFERS
          </span>

          <h2>Special Offers</h2>

          <p>
            Special offers yahan show honge.
          </p>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        className="info-section"
      >
        <div className="info-section-inner">
          <span className="section-label">
            CONTACT
          </span>

          <h2>
            Grihini Apna Bazaar
          </h2>

          <p>
            Old G.T. Road, Aurangabad,
            Bihar – 824101
          </p>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <strong>
            Grihini Apna Bazaar
          </strong>

          <span>
            Everyday shopping, simplified.
          </span>
        </div>

        <div className="footer-copy">
          © 2026 Grihini Apna Bazaar
        </div>
      </footer>
    </main>
  );
}

export default App;
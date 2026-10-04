import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import productsData from "../../data/products.js";
import { db } from "../firebase";

const PRODUCTS_PER_PAGE = 50;

const CATEGORIES = [
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

function number(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function price(value) {
  const n = number(value);

  if (n <= 0) return "—";

  return `₹${n.toFixed(2)}`;
}

function imageList(product) {
  if (!Array.isArray(product?.images)) {
    return [];
  }

  return product.images.filter(
    (image) =>
      typeof image === "string" &&
      image.trim() !== ""
  );
}

function brand(product) {
  return (
    product?.brand ||
    product?.company ||
    product?.manufacturer ||
    "—"
  );
}

function normalizeProduct(product = {}) {
  const id =
    product.id ||
    product.firestoreId ||
    product.localId ||
    `product_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  return {
    ...product,

    id,

    firestoreId:
      product.firestoreId || id,

    name: product.name || "",

    code: product.code || "",

    barcode: product.barcode || "",

    brand: product.brand || "",

    company: product.company || "",

    manufacturer:
      product.manufacturer || "",

    category:
      product.category || "Other",

    subcategory:
      product.subcategory || "",

    unit: product.unit || "PCS",

    packSize:
      product.packSize || "",

    stock:
      product.stock ?? 0,

    purchaseRate:
      product.purchaseRate ??
      product.cost ??
      "",

    mrp: product.mrp ?? "",

    salePrice:
      product.salePrice ??
      product.websitePrice ??
      product.offerPrice ??
      "",

    websitePrice:
      product.websitePrice ?? "",

    offerPrice:
      product.offerPrice ?? "",

    images: imageList(product),

    mainImage:
      product.mainImage ||
      imageList(product)[0] ||
      "",

    video: product.video || "",

    description:
      product.description || "",

    isActive:
      product.isActive !== false,

    isLive:
      product.isLive === true,

    isFeatured:
      product.isFeatured === true,

    isBestSeller:
      product.isBestSeller === true,

    isNewArrival:
      product.isNewArrival === true,

    isOffer:
      product.isOffer === true,

    isDeleted:
      product.isDeleted === true,
  };
}

function cleanProduct(product) {
  const normalized =
    normalizeProduct(product);

  const images = imageList(
    normalized
  ).filter(
    (image) =>
      !image.startsWith("blob:") &&
      !image.startsWith("data:")
  );

  let video =
    normalized.video || "";

  if (
    video.startsWith("blob:") ||
    video.startsWith("data:")
  ) {
    video = "";
  }

  return {
    ...normalized,

    images,

    mainImage:
      normalized.mainImage ||
      images[0] ||
      "",

    video,

    updatedAt:
      new Date().toISOString(),
  };
}

export default function AdminProducts() {
  const [products, setProducts] =
    useState(() =>
      Array.isArray(productsData)
        ? productsData.map(
            normalizeProduct
          )
        : []
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState(
      "Loading Firebase products..."
    );

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [editing, setEditing] =
    useState(null);

  /* =====================================================
     FIREBASE LOAD
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);

      try {
        const snapshot =
          await getDocs(
            collection(
              db,
              "products"
            )
          );

        if (cancelled) return;

        const firebaseProducts =
          snapshot.docs.map(
            (item) =>
              normalizeProduct({
                id: item.id,
                firestoreId:
                  item.id,
                ...item.data(),
              })
          );

        /*
         * Firebase products first.
         * Local products fill missing products.
         */

        const map =
          new Map();

        firebaseProducts.forEach(
          (product) => {
            map.set(
              product.id,
              product
            );

            if (
              product.firestoreId
            ) {
              map.set(
                product.firestoreId,
                product
              );
            }

            if (product.code) {
              map.set(
                `code:${product.code}`,
                product
              );
            }
          }
        );

        const merged = [];

        const added =
          new Set();

        const localProducts =
          Array.isArray(productsData)
            ? productsData.map(
                normalizeProduct
              )
            : [];

        localProducts.forEach(
          (local) => {
            const firebaseProduct =
              map.get(local.id) ||
              map.get(
                local.firestoreId
              ) ||
              (local.code
                ? map.get(
                    `code:${local.code}`
                  )
                : null);

            const finalProduct =
              normalizeProduct(
                firebaseProduct
                  ? {
                      ...local,
                      ...firebaseProduct,
                    }
                  : local
              );

            if (
              !added.has(
                finalProduct.id
              )
            ) {
              merged.push(
                finalProduct
              );

              added.add(
                finalProduct.id
              );
            }
          }
        );

        firebaseProducts.forEach(
          (product) => {
            if (
              !added.has(
                product.id
              )
            ) {
              merged.push(
                product
              );

              added.add(
                product.id
              );
            }
          }
        );

        setProducts(merged);

        setMessage(
          `Firebase connected • ${firebaseProducts.length.toLocaleString(
            "en-IN"
          )} saved products`
        );
      } catch (error) {
        console.error(
          "Admin products load error:",
          error
        );

        /*
         * Firebase unavailable होने पर
         * local catalogue फिर भी दिखेगा।
         */

        const local =
          Array.isArray(productsData)
            ? productsData.map(
                normalizeProduct
              )
            : [];

        setProducts(local);

        setMessage(
          local.length
            ? "Firebase unavailable • Showing local catalogue"
            : `Firebase error: ${
                error?.message ||
                "Unknown error"
              }`
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =====================================================
     STATS
  ===================================================== */

  const stats = useMemo(() => {
    const total =
      products.filter(
        (p) => !p.isDeleted
      ).length;

    const live =
      products.filter(
        (p) =>
          !p.isDeleted &&
          p.isLive === true
      ).length;

    const images =
      products.filter(
        (p) =>
          !p.isDeleted &&
          imageList(p).length === 0
      ).length;

    const lowStock =
      products.filter(
        (p) =>
          !p.isDeleted &&
          number(p.stock) <= 5
      ).length;

    return {
      total,
      live,
      images,
      lowStock,
    };
  }, [products]);

  /* =====================================================
     FILTER
  ===================================================== */

  const filteredProducts =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          if (
            product.isDeleted ===
            true
          ) {
            return false;
          }

          const searchable =
            [
              product.name,
              product.brand,
              product.company,
              product.manufacturer,
              product.code,
              product.barcode,
              product.category,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          if (
            text &&
            !searchable.includes(
              text
            )
          ) {
            return false;
          }

          if (
            category &&
            String(
              product.category || ""
            ).toLowerCase() !==
              category.toLowerCase()
          ) {
            return false;
          }

          if (
            status === "live" &&
            product.isLive !== true
          ) {
            return false;
          }

          if (
            status === "hidden" &&
            product.isLive === true
          ) {
            return false;
          }

          if (
            status === "no-image" &&
            imageList(product).length >
              0
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      products,
      search,
      category,
      status,
    ]);

  /* =====================================================
     PAGINATION
  ===================================================== */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredProducts.length /
          PRODUCTS_PER_PAGE
      )
    );

  const safePage =
    Math.min(
      page,
      totalPages
    );

  const start =
    (safePage - 1) *
    PRODUCTS_PER_PAGE;

  const visibleProducts =
    filteredProducts.slice(
      start,
      start + PRODUCTS_PER_PAGE
    );

  /* =====================================================
     NEW PRODUCT
  ===================================================== */

  function newProduct() {
    const id =
      `product_${Date.now()}`;

    return {
      id,

      firestoreId: id,

      name: "",

      code: "",

      barcode: "",

      brand: "",

      company: "",

      manufacturer: "",

      category: "Other",

      subcategory: "",

      unit: "PCS",

      packSize: "",

      stock: 0,

      purchaseRate: "",

      mrp: "",

      salePrice: "",

      websitePrice: "",

      offerPrice: "",

      images: [],

      mainImage: "",

      video: "",

      description: "",

      isActive: true,

      isLive: false,

      isFeatured: false,

      isBestSeller: false,

      isNewArrival: false,

      isOffer: false,

      isDeleted: false,
    };
  }

  /* =====================================================
     SAVE
  ===================================================== */

  async function saveProduct() {
    if (!editing) return;

    if (
      !editing.name.trim()
    ) {
      setMessage(
        "Product name is required."
      );

      return;
    }

    setSaving(true);

    try {
      const cleaned =
        cleanProduct(
          editing
        );

      /*
       * Image இல்லாமல் live செய்ய
       * allow नहीं करेंगे.
       */

      if (
        cleaned.isLive &&
        cleaned.images.length === 0
      ) {
        cleaned.isLive = false;
      }

      const id =
        cleaned.firestoreId ||
        cleaned.id;

      await setDoc(
        doc(
          db,
          "products",
          id
        ),
        {
          ...cleaned,
          id,
          firestoreId: id,
        },
        {
          merge: true,
        }
      );

      setProducts(
        (current) => {
          const exists =
            current.some(
              (product) =>
                product.id === id ||
                product.firestoreId ===
                  id
            );

          if (!exists) {
            return [
              {
                ...cleaned,
                id,
                firestoreId: id,
              },
              ...current,
            ];
          }

          return current.map(
            (product) =>
              product.id === id ||
              product.firestoreId === id
                ? {
                    ...product,
                    ...cleaned,
                    id,
                    firestoreId:
                      id,
                  }
                : product
          );
        }
      );

      setEditing(null);

      setMessage(
        "✅ Product saved successfully"
      );
    } catch (error) {
      console.error(
        "Product save error:",
        error
      );

      setMessage(
        `❌ Save failed: ${
          error?.message ||
          "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  /* =====================================================
     DELETE / HIDE
  ===================================================== */

  async function toggleLive(
    product
  ) {
    const updated = {
      ...product,
      isLive:
        product.isLive !== true,
    };

    /*
     * Live product should have image.
     */

    if (
      updated.isLive &&
      imageList(updated).length ===
        0
    ) {
      setMessage(
        "पहले product image add करो."
      );

      return;
    }

    setEditing(updated);

    /*
     * Direct save without opening editor.
     */

    try {
      setSaving(true);

      const cleaned =
        cleanProduct(
          updated
        );

      await setDoc(
        doc(
          db,
          "products",
          cleaned.firestoreId ||
            cleaned.id
        ),
        cleaned,
        {
          merge: true,
        }
      );

      setProducts(
        (current) =>
          current.map(
            (item) =>
              item.id ===
                product.id
                ? cleaned
                : item
          )
      );

      setMessage(
        cleaned.isLive
          ? "✅ Product is LIVE"
          : "Product hidden"
      );

      setEditing(null);
    } catch (error) {
      console.error(error);

      setMessage(
        `❌ Status update failed: ${
          error?.message ||
          "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  /* =====================================================
     FIELD UPDATE
  ===================================================== */

  function updateField(
    field,
    value
  ) {
    setEditing(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function addImage() {
    const url =
      window.prompt(
        "Product image URL paste करें:"
      );

    if (!url) return;

    setEditing(
      (current) => {
        const images =
          imageList(
            current
          );

        return {
          ...current,

          images: [
            ...images,
            url.trim(),
          ],

          mainImage:
            current.mainImage ||
            url.trim(),
        };
      }
    );
  }

  function removeImage(
    index
  ) {
    setEditing(
      (current) => {
        const images =
          imageList(
            current
          ).filter(
            (_, i) =>
              i !== index
          );

        return {
          ...current,

          images,

          mainImage:
            images[0] || "",
        };
      }
    );
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <section className="products-admin">
      {/* HEADER */}

      <div className="products-admin-header">
        <div>
          <span className="admin-section-label">
            PRODUCT MANAGEMENT
          </span>

          <h2>
            All Products
          </h2>

          <p>
            Manage products, MRP,
            selling price, stock,
            images and live status.
          </p>

          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {loading
              ? "Loading..."
              : message}
          </div>
        </div>

        <button
          type="button"
          className="add-product-button"
          onClick={() =>
            setEditing(
              newProduct()
            )
          }
        >
          + Add Product
        </button>
      </div>

      {/* STATS */}

      <div className="product-stats">
        <div className="product-stat-card">
          <span>
            Total Products
          </span>

          <strong>
            {stats.total.toLocaleString(
              "en-IN"
            )}
          </strong>
        </div>

        <div className="product-stat-card">
          <span>
            Live Products
          </span>

          <strong>
            {stats.live.toLocaleString(
              "en-IN"
            )}
          </strong>
        </div>

        <div className="product-stat-card">
          <span>
            Needs Image
          </span>

          <strong>
            {stats.images.toLocaleString(
              "en-IN"
            )}
          </strong>
        </div>

        <div className="product-stat-card">
          <span>
            Low Stock
          </span>

          <strong>
            {stats.lowStock.toLocaleString(
              "en-IN"
            )}
          </strong>
        </div>
      </div>

      {/* FILTERS */}

      <div className="products-toolbar">
        <div className="product-search">
          <span>⌕</span>

          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(
                event.target.value
              );

              setPage(1);
            }}
            placeholder="Search product, brand, barcode, code..."
          />
        </div>

        <select
          value={category}
          onChange={(event) => {
            setCategory(
              event.target.value
            );

            setPage(1);
          }}
        >
          <option value="">
            All Categories
          </option>

          {CATEGORIES.map(
            (item) => (
              <option
                value={item}
                key={item}
              >
                {item}
              </option>
            )
          )}
        </select>

        <select
          value={status}
          onChange={(event) => {
            setStatus(
              event.target.value
            );

            setPage(1);
          }}
        >
          <option value="">
            All Status
          </option>

          <option value="live">
            Live
          </option>

          <option value="hidden">
            Hidden
          </option>

          <option value="no-image">
            No Image
          </option>
        </select>
      </div>

      {/* TABLE */}

      <div className="products-table-card">
        <div className="products-table-top">
          <div>
            <strong>
              {filteredProducts.length.toLocaleString(
                "en-IN"
              )}
            </strong>

            <span>
              {" "}
              products
            </span>
          </div>

          <div>
            Page{" "}
            {safePage} /{" "}
            {totalPages}
          </div>
        </div>

        {visibleProducts.length ===
        0 ? (
          <div className="products-no-results">
            <h3>
              No products found
            </h3>

            <p>
              Search/filter change
              करके फिर try करें.
            </p>
          </div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>
                    Product
                  </th>

                  <th>
                    Brand
                  </th>

                  <th>
                    Stock
                  </th>

                  <th>
                    MRP
                  </th>

                  <th>
                    Purchase
                  </th>

                  <th>
                    Sale
                  </th>

                  <th>
                    Image
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleProducts.map(
                  (product) => {
                    const images =
                      imageList(
                        product
                      );

                    const live =
                      product.isLive ===
                      true;

                    return (
                      <tr
                        key={
                          product.id
                        }
                      >
                        <td>
                          <div className="admin-product-name">
                            <div className="admin-product-image">
                              {images[0] ? (
                                <img
                                  src={
                                    images[0]
                                  }
                                  alt=""
                                />
                              ) : (
                                "📦"
                              )}
                            </div>

                            <div>
                              <strong>
                                {product.name ||
                                  "Unnamed Product"}
                              </strong>

                              <small>
                                Code:{" "}
                                {product.code ||
                                  "—"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          {brand(
                            product
                          )}
                        </td>

                        <td>
                          {number(
                            product.stock
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        <td>
                          {price(
                            product.mrp
                          )}
                        </td>

                        <td>
                          {price(
                            product.purchaseRate
                          )}
                        </td>

                        <td>
                          {price(
                            product.salePrice ||
                              product.websitePrice ||
                              product.offerPrice
                          )}
                        </td>

                        <td>
                          {images.length}
                        </td>

                        <td>
                          <span
                            className={
                              live
                                ? "product-status live"
                                : "product-status hidden"
                            }
                          >
                            {live
                              ? "LIVE"
                              : "HIDDEN"}
                          </span>
                        </td>

                        <td>
                          <div
                            style={{
                              display:
                                "flex",
                              gap: 6,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="edit-product-button"
                              onClick={() =>
                                setEditing(
                                  {
                                    ...product,
                                    images:
                                      imageList(
                                        product
                                      ),
                                  }
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="edit-product-button"
                              onClick={() =>
                                toggleLive(
                                  product
                                )
                              }
                            >
                              {live
                                ? "Hide"
                                : "Live"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}

        {filteredProducts.length >
          0 && (
          <div className="products-pagination">
            <div>
              Showing{" "}
              {start + 1}–
              {Math.min(
                start +
                  PRODUCTS_PER_PAGE,
                filteredProducts.length
              )}{" "}
              of{" "}
              {filteredProducts.length}
            </div>

            <div className="pagination-buttons">
              <button
                type="button"
                disabled={
                  safePage ===
                  1
                }
                onClick={() =>
                  setPage(
                    (p) =>
                      Math.max(
                        1,
                        p - 1
                      )
                  )
                }
              >
                ← Previous
              </button>

              <span>
                {safePage}
              </span>

              <button
                type="button"
                disabled={
                  safePage ===
                  totalPages
                }
                onClick={() =>
                  setPage(
                    (p) =>
                      Math.min(
                        totalPages,
                        p + 1
                      )
                  )
                }
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================================================
          PRODUCT EDITOR
      ================================================= */}

      {editing && (
        <div
          className="admin-editor-overlay"
          onClick={() =>
            !saving &&
            setEditing(null)
          }
        >
          <div
            className="admin-editor-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="admin-editor-header">
              <div>
                <span className="admin-section-label">
                  PRODUCT EDITOR
                </span>

                <h2>
                  {editing.name ||
                    "Add Product"}
                </h2>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setEditing(null)
                }
              >
                ×
              </button>
            </div>

            <div className="admin-editor-grid">
              <label>
                Product Name
                <input
                  value={
                    editing.name
                  }
                  onChange={(event) =>
                    updateField(
                      "name",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Brand
                <input
                  value={
                    editing.brand
                  }
                  onChange={(event) =>
                    updateField(
                      "brand",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Company
                <input
                  value={
                    editing.company
                  }
                  onChange={(event) =>
                    updateField(
                      "company",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Product Code
                <input
                  value={
                    editing.code
                  }
                  onChange={(event) =>
                    updateField(
                      "code",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Barcode
                <input
                  value={
                    editing.barcode
                  }
                  onChange={(event) =>
                    updateField(
                      "barcode",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Category
                <select
                  value={
                    editing.category
                  }
                  onChange={(event) =>
                    updateField(
                      "category",
                      event.target.value
                    )
                  }
                >
                  {CATEGORIES.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Unit
                <input
                  value={
                    editing.unit
                  }
                  onChange={(event) =>
                    updateField(
                      "unit",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Pack Size
                <input
                  value={
                    editing.packSize
                  }
                  onChange={(event) =>
                    updateField(
                      "packSize",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Stock
                <input
                  type="number"
                  min="0"
                  value={
                    editing.stock
                  }
                  onChange={(event) =>
                    updateField(
                      "stock",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Purchase Rate
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    editing.purchaseRate
                  }
                  onChange={(event) =>
                    updateField(
                      "purchaseRate",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                MRP
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    editing.mrp
                  }
                  onChange={(event) =>
                    updateField(
                      "mrp",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Selling Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    editing.salePrice
                  }
                  onChange={(event) =>
                    updateField(
                      "salePrice",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Website Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    editing.websitePrice
                  }
                  onChange={(event) =>
                    updateField(
                      "websitePrice",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Offer Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    editing.offerPrice
                  }
                  onChange={(event) =>
                    updateField(
                      "offerPrice",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="admin-editor-full">
                Description
                <textarea
                  rows="4"
                  value={
                    editing.description
                  }
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="admin-editor-full">
                Main Image URL
                <input
                  value={
                    editing.mainImage
                  }
                  onChange={(event) =>
                    updateField(
                      "mainImage",
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                />
              </label>
            </div>

            {/* IMAGES */}

            <div className="admin-media-box">
              <div className="admin-media-title">
                <strong>
                  Product Images
                </strong>

                <button
                  type="button"
                  onClick={addImage}
                >
                  + Add Image URL
                </button>
              </div>

              {imageList(
                editing
              ).length === 0 ? (
                <p>
                  No product image
                  added.
                </p>
              ) : (
                <div className="admin-image-list">
                  {imageList(
                    editing
                  ).map(
                    (
                      image,
                      index
                    ) => (
                      <div
                        key={`${image}-${index}`}
                        className="admin-image-item"
                      >
                        <img
                          src={image}
                          alt=""
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removeImage(
                              index
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* FLAGS */}

            <div className="admin-switches">
              <label>
                <input
                  type="checkbox"
                  checked={
                    editing.isActive
                  }
                  onChange={(event) =>
                    updateField(
                      "isActive",
                      event.target
                        .checked
                    )
                  }
                />

                Active
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    editing.isFeatured
                  }
                  onChange={(event) =>
                    updateField(
                      "isFeatured",
                      event.target
                        .checked
                    )
                  }
                />

                Featured
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    editing.isBestSeller
                  }
                  onChange={(event) =>
                    updateField(
                      "isBestSeller",
                      event.target
                        .checked
                    )
                  }
                />

                Best Seller
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    editing.isNewArrival
                  }
                  onChange={(event) =>
                    updateField(
                      "isNewArrival",
                      event.target
                        .checked
                    )
                  }
                />

                New Arrival
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    editing.isOffer
                  }
                  onChange={(event) =>
                    updateField(
                      "isOffer",
                      event.target
                        .checked
                    )
                  }
                />

                Offer
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    editing.isLive
                  }
                  onChange={(event) =>
                    updateField(
                      "isLive",
                      event.target
                        .checked
                    )
                  }
                />

                Live on Website
              </label>
            </div>

            {/* ACTIONS */}

            <div className="admin-editor-actions">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setEditing(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                className="add-product-button"
                onClick={saveProduct}
              >
                {saving
                  ? "Saving..."
                  : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
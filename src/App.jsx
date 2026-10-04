import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
  googleProvider,
} from "./firebase";

import {
  getProductCategory,
} from "./utils/productCategory";

import "./App.css";


/* =========================================================
   CONFIG
========================================================= */

const STORE_NAME =
  "Grihini Apna Bazaar";

const STORE_ADDRESS =
  "Old G.T. Road, Aurangabad, Bihar – 824101";

const DELIVERY_MINUTES = 15;


const CATEGORIES = [
  [
    "Atta, Rice & Dal",
    "/categories/atta-rice-dal.jpg",
  ],
  [
    "Oil & Ghee",
    "/categories/oil-ghee.jpg",
  ],
  [
    "Masala & Spices",
    "/categories/masala-spices.jpg",
  ],
  [
    "Biscuits & Bakery",
    "/categories/snacks.jpg",
  ],
  [
    "Snacks",
    "/categories/snacks.jpg",
  ],
  [
    "Noodles & Pasta",
    "/categories/snacks.jpg",
  ],
  [
    "Tea & Coffee",
    "/categories/dairy-breakfast.jpg",
  ],
  [
    "Dairy & Breakfast",
    "/categories/dairy-breakfast.jpg",
  ],
  [
    "Personal Care",
    "/categories/personal-care.jpg",
  ],
  [
    "Home Care",
    "/categories/home-care.jpg",
  ],
  [
    "Baby Care",
    "/categories/baby-care.jpg",
  ],
  [
    "Puja & Household",
    "/categories/home-care.jpg",
  ],
];


/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  const n = Number(value);

  return Number.isFinite(n) && n > 0
    ? n
    : 0;
}


function productName(product) {
  return (
    product?.name ||
    product?.productName ||
    product?.itemName ||
    "Unnamed Product"
  );
}


function productPrice(product) {
  return (
    money(product?.websitePrice) ||
    money(product?.offerPrice) ||
    money(product?.finalOnlinePrice) ||
    money(product?.salePrice) ||
    money(product?.rate) ||
    money(product?.mrp)
  );
}


function productMrp(product) {
  return (
    money(product?.mrp) ||
    productPrice(product)
  );
}


function productStock(product) {
  return Math.max(
    0,
    Number(
      product?.stock ??
      product?.stockQuantity ??
      0
    ) || 0
  );
}


function productImage(product) {
  if (
    typeof product?.mainImage ===
    "string" &&
    product.mainImage
  ) {
    return product.mainImage;
  }

  if (
    Array.isArray(product?.images) &&
    typeof product.images[0] ===
      "string"
  ) {
    return product.images[0];
  }

  return "";
}


function normalizeProduct(product) {
  return {
    ...product,

    id:
      product?.id ||
      product?.firestoreId ||
      product?.code ||
      `local-${Math.random()
        .toString(36)
        .slice(2)}`,

    name:
      productName(product),

    category:
      getProductCategory(product),

    stock:
      productStock(product),
  };
}


function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Date(
      value
    ).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return "";
  }
}


/* =========================================================
   LOCAL CATALOG
========================================================= */

async function loadLocalProducts() {
  try {
    const response =
      await fetch(
        "/data/products.json",
        {
          cache:
            "no-cache",
        }
      );

    if (!response.ok) {
      throw new Error(
        "Local product file unavailable"
      );
    }

    const data =
      await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(
      normalizeProduct
    );
  } catch {
    return [];
  }
}


/* =========================================================
   LOGIN SCREEN
========================================================= */

function LoginScreen() {
  const [
    loginMode,
    setLoginMode,
  ] = useState("phone");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    otp,
    setOtp,
  ] = useState("");

  const [
    confirmation,
    setConfirmation,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const recaptchaRef =
    useRef(null);


  async function googleLogin() {
    setLoading(true);
    setError("");

    try {
      await signInWithPopup(
        auth,
        googleProvider
      );
    } catch (err) {
      setError(
        err?.message ||
          "Google login failed."
      );
    } finally {
      setLoading(false);
    }
  }


  function setupRecaptcha() {
    if (
      recaptchaRef.current
    ) {
      return recaptchaRef.current;
    }

    const verifier =
      new RecaptchaVerifier(
        auth,
        "gab-recaptcha",
        {
          size: "normal",
        }
      );

    recaptchaRef.current =
      verifier;

    return verifier;
  }


  async function sendOtp() {
    setError("");

    const cleanPhone =
      phone.replace(
        /\D/g,
        ""
      );

    if (
      cleanPhone.length !==
      10
    ) {
      setError(
        "10 digit mobile number enter karein."
      );

      return;
    }

    setLoading(true);

    try {
      const verifier =
        setupRecaptcha();

      const result =
        await signInWithPhoneNumber(
          auth,
          `+91${cleanPhone}`,
          verifier
        );

      setConfirmation(result);

      setError("");

    } catch (err) {

      console.error(
        err
      );

      try {
        if (
          recaptchaRef.current
        ) {
          await recaptchaRef.current
            .clear();
        }
      } catch {}

      recaptchaRef.current =
        null;

      setError(
        err?.message ||
          "OTP send nahi hua."
      );

    } finally {
      setLoading(false);
    }
  }


  async function verifyOtp() {
    if (
      !confirmation
    ) {
      return;
    }

    if (
      otp.trim().length !==
      6
    ) {
      setError(
        "6 digit OTP enter karein."
      );

      return;
    }

    setLoading(true);
    setError("");

    try {
      await confirmation.confirm(
        otp.trim()
      );
    } catch (err) {
      setError(
        err?.message ||
          "OTP galat hai."
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="login-page">

      <div className="watercolor-leaf leaf-one" />
      <div className="watercolor-leaf leaf-two" />
      <div className="watercolor-leaf leaf-three" />

      <section className="login-card">

        <div className="login-logo">
          🛒
        </div>

        <div className="login-brand">
          {STORE_NAME}
        </div>

        <p className="login-subtitle">
          Fresh groceries
          <br />
          delivered to your doorstep
        </p>


        {!confirmation ? (
          <>
            <h1>
              Welcome Back
            </h1>

            <p className="login-help">
              Login karke shopping
              start karein.
            </p>


            <div className="login-tabs">

              <button
                type="button"
                className={
                  loginMode ===
                  "phone"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setLoginMode(
                    "phone"
                  )
                }
              >
                Mobile
              </button>

              <button
                type="button"
                className={
                  loginMode ===
                  "google"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setLoginMode(
                    "google"
                  )
                }
              >
                Google
              </button>

            </div>


            {loginMode ===
            "phone" ? (
              <>

                <label className="field-label">
                  Mobile Number
                </label>

                <div className="phone-field">

                  <span>
                    +91
                  </span>

                  <input
                    value={phone}
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="Enter mobile number"
                    onChange={(e) =>
                      setPhone(
                        e.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                  />

                </div>


                <div
                  id="gab-recaptcha"
                  className="recaptcha-box"
                />


                <button
                  id="gab-send-otp"
                  className="login-primary"
                  type="button"
                  disabled={
                    loading
                  }
                  onClick={
                    sendOtp
                  }
                >
                  {loading
                    ? "Sending OTP..."
                    : "Continue with Mobile"}
                </button>

              </>
            ) : (

              <button
                className="google-login"
                type="button"
                disabled={
                  loading
                }
                onClick={
                  googleLogin
                }
              >
                <span>
                  G
                </span>

                {loading
                  ? "Connecting..."
                  : "Continue with Google"}

              </button>

            )}


            <div className="login-note">
              By continuing, you agree to
              our Terms of Service &
              Privacy Policy.
            </div>

          </>
        ) : (

          <>

            <h1>
              Verify Your Number
            </h1>

            <p className="login-help">
              OTP has been sent to
              <br />
              <strong>
                +91 {phone}
              </strong>
            </p>


            <input
              className="otp-input"
              value={otp}
              maxLength={6}
              inputMode="numeric"
              placeholder="Enter 6-digit OTP"
              onChange={(e) =>
                setOtp(
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
            />


            <button
              className="login-primary"
              type="button"
              disabled={
                loading
              }
              onClick={
                verifyOtp
              }
            >
              {loading
                ? "Verifying..."
                : "Verify & Continue"}
            </button>


            <button
              className="back-login"
              type="button"
              onClick={() => {
                setConfirmation(
                  null
                );
                setOtp("");
              }}
            >
              ← Change Number
            </button>

          </>
        )}


        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

      </section>

    </main>
  );
}


/* =========================================================
   PRODUCT CARD
========================================================= */

function ProductCard({
  product,
  onAdd,
  onOpen,
  wished,
  onWish,
}) {
  const price =
    productPrice(product);

  const mrp =
    productMrp(product);

  const stock =
    productStock(product);

  const image =
    productImage(product);

  const discount =
    mrp > price &&
    price > 0
      ? Math.round(
          ((mrp - price) /
            mrp) *
            100
        )
      : 0;


  return (
    <article className="product-card">

      <div
        className="product-image-box"
        onClick={() =>
          onOpen(product)
        }
      >

        {discount > 0 && (
          <span className="discount-badge">
            {discount}% OFF
          </span>
        )}


        <button
          className={
            wished
              ? "wishlist active"
              : "wishlist"
          }
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onWish(product);
          }}
        >
          {wished
            ? "♥"
            : "♡"}
        </button>


        {image ? (
          <img
            src={image}
            alt={productName(
              product
            )}
            loading="lazy"
          />
        ) : (
          <div className="product-placeholder">
            🛒
          </div>
        )}

      </div>


      <div className="product-info">

        <span className="product-brand">
          {product?.brand ||
            product?.company ||
            "Grocery"}
        </span>


        <h3>
          {productName(
            product
          )}
        </h3>


        <small>
          {product?.packSize ||
            product?.unit ||
            ""}
        </small>


        <div className="product-price">

          <strong>
            ₹
            {price.toFixed(
              2
            )}
          </strong>

          {mrp > price && (
            <del>
              ₹
              {mrp.toFixed(
                2
              )}
            </del>
          )}

        </div>


        <span
          className={
            stock > 0
              ? "stock in"
              : "stock out"
          }
        >
          {stock > 0
            ? `${stock} in stock`
            : "Out of stock"}
        </span>


        <button
          className="add-button"
          disabled={
            !price ||
            stock <= 0
          }
          type="button"
          onClick={() =>
            onAdd(product)
          }
        >
          {stock > 0
            ? "Add to Cart"
            : "Out of Stock"}
        </button>

      </div>

    </article>
  );
}


/* =========================================================
   CART
========================================================= */

function CartDrawer({
  cart,
  onClose,
  onQty,
  subtotal,
  discount,
  delivery,
  total,
  coupon,
  setCoupon,
  onCheckout,
}) {
  return (
    <div
      className="overlay"
      onClick={onClose}
    >

      <aside
        className="cart-panel"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        <div className="panel-header">

          <div>
            <span>
              MY CART
            </span>

            <h2>
              Your Items
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <div className="cart-scroll">

          {!cart.length ? (
            <div className="empty-state">

              <div>
                🛒
              </div>

              <h3>
                Your cart is empty
              </h3>

              <p>
                Add products to
                continue shopping.
              </p>

            </div>
          ) : (
            cart.map(
              ({
                product,
                qty,
              }) => (

                <div
                  className="cart-row"
                  key={
                    product.id
                  }
                >

                  <div className="cart-product-image">

                    {productImage(
                      product
                    ) ? (
                      <img
                        src={productImage(
                          product
                        )}
                        alt=""
                      />
                    ) : (
                      "🛒"
                    )}

                  </div>


                  <div className="cart-product-info">

                    <strong>
                      {productName(
                        product
                      )}
                    </strong>

                    <span>
                      ₹
                      {productPrice(
                        product
                      ).toFixed(
                        2
                      )}
                    </span>


                    <div className="quantity-control">

                      <button
                        type="button"
                        onClick={() =>
                          onQty(
                            product.id,
                            -1
                          )
                        }
                      >
                        −
                      </button>

                      <b>
                        {qty}
                      </b>

                      <button
                        type="button"
                        onClick={() =>
                          onQty(
                            product.id,
                            1
                          )
                        }
                      >
                        +
                      </button>

                    </div>

                  </div>

                </div>

              )
            )
          )}

        </div>


        {cart.length > 0 && (

          <div className="cart-bottom">

            <div className="coupon-field">

              <input
                placeholder="Promo code"
                value={coupon}
                onChange={(e) =>
                  setCoupon(
                    e.target.value
                  )
                }
              />

              <button
                type="button"
              >
                Apply
              </button>

            </div>


            <div className="summary-line">
              <span>
                Subtotal
              </span>

              <strong>
                ₹
                {subtotal.toFixed(
                  2
                )}
              </strong>
            </div>


            <div className="summary-line">
              <span>
                Discount
              </span>

              <strong className="green-text">
                −₹
                {discount.toFixed(
                  2
                )}
              </strong>
            </div>


            <div className="summary-line">
              <span>
                Delivery
              </span>

              <strong>
                {delivery ===
                0
                  ? "FREE"
                  : `₹${delivery.toFixed(
                      2
                    )}`}
              </strong>
            </div>


            <div className="summary-total">
              <span>
                Total
              </span>

              <strong>
                ₹
                {total.toFixed(
                  2
                )}
              </strong>
            </div>


            <button
              className="primary-wide"
              type="button"
              onClick={
                onCheckout
              }
            >
              Proceed to Checkout →
            </button>

          </div>

        )}

      </aside>

    </div>
  );
}


/* =========================================================
   CHECKOUT
========================================================= */

function Checkout({
  user,
  total,
  cart,
  onClose,
  onPlace,
}) {
  const [
    form,
    setForm,
  ] = useState({
    name:
      user?.displayName ||
      "",

    phone:
      user?.phoneNumber
        ?.replace(
          "+91",
          ""
        ) ||
      "",

    address: "",

    pincode: "",

    paymentMethod:
      "COD",
  });


  const [
    busy,
    setBusy,
  ] = useState(false);


  const valid =
    form.name.trim() &&
    form.phone.trim() &&
    form.address.trim() &&
    form.pincode.trim()
      .length >= 6;


  async function submit(
    e
  ) {
    e.preventDefault();

    if (
      !valid ||
      busy
    ) {
      return;
    }

    setBusy(true);

    try {
      await onPlace(
        form
      );
    } finally {
      setBusy(false);
    }
  }


  return (
    <div
      className="overlay center"
      onClick={onClose}
    >

      <form
        className="checkout-card"
        onClick={(e) =>
          e.stopPropagation()
        }
        onSubmit={submit}
      >

        <div className="checkout-title">

          <div>
            <span>
              CHECKOUT
            </span>

            <h2>
              Delivery Details
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <div className="delivery-estimate">

          <span className="estimate-icon">
            🚚
          </span>

          <div>

            <strong>
              Express Delivery
            </strong>

            <p>
              Estimated delivery:
              <b>
                10–15 minutes
              </b>
            </p>

          </div>

        </div>


        <div className="checkout-form">

          <label>
            Full Name

            <input
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name:
                    e.target.value,
                })
              }
              placeholder="Your name"
            />

          </label>


          <label>
            Mobile Number

            <input
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone:
                    e.target.value,
                })
              }
              placeholder="10 digit mobile"
              inputMode="tel"
            />

          </label>


          <label className="full">
            Delivery Address

            <textarea
              value={
                form.address
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  address:
                    e.target.value,
                })
              }
              placeholder="House, street, area, landmark"
            />

          </label>


          <label>
            Pincode

            <input
              value={
                form.pincode
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  pincode:
                    e.target.value.replace(
                      /\D/g,
                      ""
                    ),
                })
              }
              maxLength={6}
              inputMode="numeric"
              placeholder="824101"
            />

          </label>


          <label>
            Payment

            <select
              value={
                form.paymentMethod
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentMethod:
                    e.target.value,
                })
              }
            >
              <option value="COD">
                Cash on Delivery
              </option>

              <option value="ONLINE">
                Online Payment
              </option>
            </select>

          </label>

        </div>


        <div className="checkout-footer">

          <div>

            <span>
              Total Amount
            </span>

            <strong>
              ₹
              {total.toFixed(
                2
              )}
            </strong>

          </div>


          <button
            className="primary-wide"
            disabled={
              !valid ||
              busy
            }
            type="submit"
          >
            {busy
              ? "Placing Order..."
              : "Place Order →"}
          </button>

        </div>

      </form>

    </div>
  );
}


/* =========================================================
   ORDER DETAILS
========================================================= */

function OrderDetails({
  order,
  onClose,
}) {
  if (!order) {
    return null;
  }


  const items =
    Array.isArray(
      order.items
    )
      ? order.items
      : [];


  const status =
    order.status ||
    "Pending";


  const steps = [
    "Pending",
    "Confirmed",
    "Packed",
    "Out for Delivery",
    "Delivered",
  ];


  const currentIndex =
    Math.max(
      0,
      steps.findIndex(
        (item) =>
          item.toLowerCase() ===
          status.toLowerCase()
      )
    );


  return (
    <div
      className="overlay center"
      onClick={onClose}
    >

      <div
        className="order-card"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        <div className="order-top">

          <div>

            <span>
              ORDER DETAILS
            </span>

            <h2>
              #{order.orderId}
            </h2>

            <small>
              {formatDate(
                order.createdAt
              )}
            </small>

          </div>


          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <div className="tracking-box">

          <div className="tracking-title">

            <strong>
              {status}
            </strong>

            <span>
              Estimated:
              10–15 minutes
            </span>

          </div>


          <div className="tracking-line">

            {steps.map(
              (
                step,
                index
              ) => (

                <div
                  key={step}
                  className={
                    index <=
                    currentIndex
                      ? "tracking-step done"
                      : "tracking-step"
                  }
                >

                  <div className="tracking-dot">
                    {index <
                    currentIndex
                      ? "✓"
                      : index ===
                        currentIndex
                        ? "●"
                        : ""}
                  </div>

                  <span>
                    {step}
                  </span>

                </div>

              )
            )}

          </div>

        </div>


        <div className="detail-section">

          <div className="detail-section-title">
            Delivery Address
          </div>

          <div className="address-box">

            <strong>
              {order.customer
                ?.name ||
                "Customer"}
            </strong>

            <span>
              {order.customer
                ?.address ||
                "Address not available"}
            </span>

            <span>
              {order.customer
                ?.pincode ||
                ""}
            </span>

            <span>
              📞{" "}
              {order.customer
                ?.phone ||
                ""}
            </span>

          </div>

        </div>


        <div className="detail-section">

          <div className="detail-section-title">

            Items (
            {items.length}
            )

          </div>


          <div className="order-items">

            {items.map(
              (
                item,
                index
              ) => {

                const price =
                  money(
                    item.price
                  ) ||
                  productPrice(
                    item
                  );

                const qty =
                  Number(
                    item.qty
                  ) || 1;


                return (
                  <div
                    className="order-item"
                    key={
                      item.id ||
                      index
                    }
                  >

                    <div className="order-item-image">

                      {productImage(
                        item
                      ) ? (
                        <img
                          src={productImage(
                            item
                          )}
                          alt=""
                        />
                      ) : (
                        "🛒"
                      )}

                    </div>


                    <div className="order-item-text">

                      <strong>
                        {productName(
                          item
                        )}
                      </strong>

                      <span>
                        {item.packSize ||
                          item.unit ||
                          ""}
                      </span>

                      <small>
                        ₹
                        {price.toFixed(
                          2
                        )}{" "}
                        ×{" "}
                        {qty}
                      </small>

                    </div>


                    <strong>
                      ₹
                      {(
                        price *
                        qty
                      ).toFixed(
                        2
                      )}
                    </strong>

                  </div>
                );
              }
            )}

          </div>

        </div>


        <div className="bill-box">

          <div>
            <span>
              Subtotal
            </span>

            <strong>
              ₹
              {Number(
                order.subtotal ||
                  0
              ).toFixed(2)}
            </strong>
          </div>


          <div>
            <span>
              Discount
            </span>

            <strong className="green-text">
              −₹
              {Number(
                order.discount ||
                  0
              ).toFixed(2)}
            </strong>
          </div>


          <div>
            <span>
              Delivery
            </span>

            <strong>
              {Number(
                order.delivery ||
                  0
              ) === 0
                ? "FREE"
                : `₹${Number(
                    order.delivery
                  ).toFixed(2)}`}
            </strong>
          </div>


          <div className="bill-total">

            <span>
              Total Amount
            </span>

            <strong>
              ₹
              {Number(
                order.total ||
                  0
              ).toFixed(2)}
            </strong>

          </div>

        </div>


        <div className="payment-info">

          <span>
            Payment
          </span>

          <strong>
            {order.paymentMethod ||
              "COD"}
          </strong>

          <span>
            Status
          </span>

          <strong>
            {order.paymentStatus ||
              "Pending"}
          </strong>

        </div>


        <button
          className="primary-wide"
          type="button"
          onClick={onClose}
        >
          Done
        </button>

      </div>

    </div>
  );
}


/* =========================================================
   ORDER SUCCESS
========================================================= */

function OrderSuccess({
  order,
  onDetails,
  onClose,
}) {
  return (
    <div
      className="overlay center"
      onClick={onClose}
    >

      <div
        className="success-card"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        <div className="success-check">
          ✓
        </div>


        <span className="success-label">
          ORDER CONFIRMED
        </span>


        <h2>
          Order Placed
          Successfully!
        </h2>


        <p>
          Your order ID is
        </p>


        <strong className="success-order-id">
          #{order.orderId}
        </strong>


        <div className="success-delivery">

          <span>
            🚚
          </span>

          <div>

            <small>
              Estimated Delivery
            </small>

            <strong>
              10–15 minutes
            </strong>

          </div>

        </div>


        <div className="success-items">

          <strong>
            {order.items?.length ||
              0}{" "}
            items ordered
          </strong>

          <span>
            {order.items
              ?.slice(
                0,
                3
              )
              .map(
                (item) =>
                  productName(
                    item
                  )
              )
              .join(
                " • "
              )}
          </span>

        </div>


        <button
          className="primary-wide"
          type="button"
          onClick={
            onDetails
          }
        >
          View Order Details
        </button>


        <button
          className="secondary-wide"
          type="button"
          onClick={
            onClose
          }
        >
          Continue Shopping
        </button>

      </div>

    </div>
  );
}


/* =========================================================
   APP
========================================================= */

export default function App() {

  const [
    user,
    setUser,
  ] = useState(undefined);


  const [
    products,
    setProducts,
  ] = useState([]);


  const [
    search,
    setSearch,
  ] = useState("");


  const [
    category,
    setCategory,
  ] = useState("");


  const [
    loadingProducts,
    setLoadingProducts,
  ] = useState(true);


  const [
    productModal,
    setProductModal,
  ] = useState(null);


  const [
    cartOpen,
    setCartOpen,
  ] = useState(false);


  const [
    checkoutOpen,
    setCheckoutOpen,
  ] = useState(false);


  const [
    orders,
    setOrders,
  ] = useState([]);


  const [
    orderSuccess,
    setOrderSuccess,
  ] = useState(null);


  const [
    orderDetails,
    setOrderDetails,
  ] = useState(null);


  const [
    wishlist,
    setWishlist,
  ] = useState([]);


  const [
    cart,
    setCart,
  ] = useState([]);


  const [
    coupon,
    setCoupon,
  ] = useState("");


  const [
    toast,
    setToast,
  ] = useState("");


  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);


  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {

    return onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(
          currentUser
        );
      }
    );

  }, []);


  /* =======================================================
     USER STORAGE
  ======================================================= */

  useEffect(() => {

    if (!user) {
      return;
    }


    try {

      setCart(
        JSON.parse(
          localStorage.getItem(
            `gab-cart-${user.uid}`
          ) || "[]"
        )
      );


      setWishlist(
        JSON.parse(
          localStorage.getItem(
            `gab-wishlist-${user.uid}`
          ) || "[]"
        )
      );


      setOrders(
        JSON.parse(
          localStorage.getItem(
            `gab-orders-${user.uid}`
          ) || "[]"
        )
      );

    } catch {

      setCart([]);
      setWishlist([]);
      setOrders([]);

    }

  }, [user]);


  useEffect(() => {

    if (!user) {
      return;
    }

    localStorage.setItem(
      `gab-cart-${user.uid}`,
      JSON.stringify(cart)
    );

  }, [cart, user]);


  useEffect(() => {

    if (!user) {
      return;
    }

    localStorage.setItem(
      `gab-wishlist-${user.uid}`,
      JSON.stringify(
        wishlist
      )
    );

  }, [wishlist, user]);


  useEffect(() => {

    if (!user) {
      return;
    }

    localStorage.setItem(
      `gab-orders-${user.uid}`,
      JSON.stringify(
        orders
      )
    );

  }, [orders, user]);


  /* =======================================================
     PRODUCTS
  ======================================================= */

  useEffect(() => {

    if (!user) {
      return;
    }


    let cancelled =
      false;


    async function loadProducts() {

      setLoadingProducts(
        true
      );


      try {

        const snapshot =
          await getDocs(
            query(
              collection(
                db,
                "products"
              ),
              where(
                "isLive",
                "==",
                true
              ),
              limit(500)
            )
          );


        const live =
          snapshot.docs.map(
            (doc) =>
              normalizeProduct({
                id:
                  doc.id,
                ...doc.data(),
              })
          );


        if (
          live.length
        ) {

          if (!cancelled) {
            setProducts(
              live
            );
          }

        } else {

          const local =
            await loadLocalProducts();


          if (!cancelled) {
            setProducts(
              local
            );
          }

        }

      } catch {

        const local =
          await loadLocalProducts();


        if (!cancelled) {
          setProducts(
            local
          );
        }

      } finally {

        if (!cancelled) {
          setLoadingProducts(
            false
          );
        }

      }

    }


    loadProducts();


    return () => {
      cancelled = true;
    };

  }, [user]);


  /* =======================================================
     ORDERS FROM FIRESTORE
  ======================================================= */

  useEffect(() => {

    if (!user) {
      return;
    }


    let cancelled =
      false;


    async function loadOrders() {

      try {

        const snapshot =
          await getDocs(
            query(
              collection(
                db,
                "orders"
              ),
              where(
                "customerUid",
                "==",
                user.uid
              ),
              limit(100)
            )
          );


        if (cancelled) {
          return;
        }


        const remote =
          snapshot.docs
            .map(
              (doc) => ({
                id:
                  doc.id,

                ...doc.data(),
              })
            )
            .sort(
              (a, b) =>
                new Date(
                  b.createdAt
                ) -
                new Date(
                  a.createdAt
                )
            );


        if (
          remote.length
        ) {

          setOrders(
            remote
          );

        }

      } catch {
        /* local orders remain available */
      }

    }


    loadOrders();


    return () => {
      cancelled = true;
    };

  }, [user]);


  /* =======================================================
     FILTER
  ======================================================= */

  const filteredProducts =
    useMemo(() => {

      const q =
        search
          .trim()
          .toLowerCase();


      let result =
        products;


      if (q) {

        result =
          result.filter(
            (product) =>
              [
                productName(
                  product
                ),

                product?.brand,

                product?.company,

                product?.code,

                product?.barcode,

                product?.category,
              ]
                .filter(
                  Boolean
                )
                .join(" ")
                .toLowerCase()
                .includes(q)
          );

      }


      if (category) {

        result =
          result.filter(
            (product) =>
              getProductCategory(
                product
              ) ===
              category
          );

      }


      return result.slice(
        0,
        120
      );

    }, [
      products,
      search,
      category,
    ]);


  /* =======================================================
     CART TOTALS
  ======================================================= */

  const cartCount =
    cart.reduce(
      (sum, item) =>
        sum +
        Number(
          item.qty || 0
        ),
      0
    );


  const subtotal =
    cart.reduce(
      (sum, item) =>
        sum +
        productPrice(
          item.product
        ) *
          Number(
            item.qty || 0
          ),
      0
    );


  const couponDiscount =
    coupon
      .trim()
      .toUpperCase() ===
      "WELCOME50" &&
    subtotal >= 499
      ? 50
      : coupon
            .trim()
            .toUpperCase() ===
          "SAVE10"
        ? Math.min(
            100,
            subtotal * 0.1
          )
        : 0;


  const delivery =
    subtotal === 0
      ? 0
      : subtotal -
          couponDiscount >=
        499
        ? 0
        : 20;


  const total =
    Math.max(
      0,
      subtotal -
        couponDiscount +
        delivery
    );


  /* =======================================================
     CART FUNCTIONS
  ======================================================= */

  function addToCart(product) {

    setCart(
      (current) => {

        const existing =
          current.find(
            (item) =>
              item.product.id ===
              product.id
          );


        if (existing) {

          return current.map(
            (item) =>
              item.product.id ===
              product.id
                ? {
                    ...item,

                    qty:
                      item.qty +
                      1,
                  }
                : item
          );

        }


        return [
          ...current,

          {
            product,
            qty: 1,
          },
        ];

      }
    );


    setToast(
      `${productName(
        product
      )} added`
    );


    setTimeout(
      () =>
        setToast(""),
      1800
    );

  }


  function updateQty(
    id,
    delta
  ) {

    setCart(
      (current) =>
        current
          .map(
            (item) =>
              item.product.id ===
              id
                ? {
                    ...item,

                    qty:
                      item.qty +
                      delta,
                  }
                : item
          )
          .filter(
            (item) =>
              item.qty > 0
          )
    );

  }


  function toggleWishlist(
    product
  ) {

    setWishlist(
      (current) =>
        current.some(
          (item) =>
            item.id ===
            product.id
        )
          ? current.filter(
              (item) =>
                item.id !==
                product.id
            )
          : [
              ...current,
              product,
            ]
    );

  }


  /* =======================================================
     PLACE ORDER
  ======================================================= */

  async function placeOrder(
    form
  ) {

    if (
      !cart.length ||
      !user
    ) {
      return;
    }


    const order = {

      orderId:
        `GAB${Date.now()
          .toString()
          .slice(-8)}`,

      customerUid:
        user.uid,

      customer: {
        uid:
          user.uid,

        name:
          form.name.trim(),

        phone:
          form.phone.trim(),

        address:
          form.address.trim(),

        pincode:
          form.pincode.trim(),
      },


      items:
        cart.map(
          (item) => ({
            ...item.product,

            qty:
              Number(
                item.qty
              ) || 1,

            price:
              productPrice(
                item.product
              ),
          })
        ),


      subtotal,

      discount:
        couponDiscount,

      delivery,

      total,

      paymentMethod:
        form.paymentMethod,

      paymentStatus:
        "Pending",

      status:
        "Pending",

      estimatedMinutes:
        DELIVERY_MINUTES,

      createdAt:
        new Date().toISOString(),

    };


    setOrders(
      (current) => [
        order,
        ...current,
      ]
    );


    try {

      await addDoc(
        collection(
          db,
          "orders"
        ),
        order
      );

    } catch (err) {

      console.warn(
        "Order saved locally; Firestore sync failed.",
        err
      );

    }


    setCart([]);

    setCoupon("");

    setCheckoutOpen(
      false
    );

    setCartOpen(
      false
    );

    setOrderSuccess(
      order
    );

  }


  /* =======================================================
     NAVIGATION
  ======================================================= */

  function scrollTo(
    id
  ) {

    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior:
          "smooth",
        block:
          "start",
      });

  }


  /* =======================================================
     LOGOUT
  ======================================================= */

  async function logout() {

    try {
      await signOut(
        auth
      );
    } catch (err) {
      console.error(
        err
      );
    }

  }


  /* =======================================================
     AUTH LOADING
  ======================================================= */

  if (
    user ===
    undefined
  ) {

    return (
      <div className="app-loading">
        <div className="loading-logo">
          🛒
        </div>

        <strong>
          {STORE_NAME}
        </strong>

        <span>
          Loading...
        </span>
      </div>
    );

  }


  /* =======================================================
     LOGIN REQUIRED
  ======================================================= */

  if (!user) {

    return (
      <LoginScreen />
    );

  }


  /* =======================================================
     MAIN WEBSITE
  ======================================================= */

  return (
    <main className="app">


      {/* HEADER */}

      <header className="site-header">

        <div className="header-inner">

          <button
            className="brand"
            type="button"
            onClick={() =>
              scrollTo(
                "home"
              )
            }
          >

            <span className="brand-icon">
              🛒
            </span>

            <span>

              <strong>
                Grihini Apna Bazaar
              </strong>

              <small>
                FRESH • FAST • LOCAL
              </small>

            </span>

          </button>


          <nav className="desktop-nav">

            <button
              type="button"
              onClick={() =>
                scrollTo(
                  "home"
                )
              }
            >
              Home
            </button>

            <button
              type="button"
              onClick={() =>
                scrollTo(
                  "categories"
                )
              }
            >
              Categories
            </button>

            <button
              type="button"
              onClick={() =>
                scrollTo(
                  "products"
                )
              }
            >
              Products
            </button>

            <button
              type="button"
              onClick={() =>
                scrollTo(
                  "offers"
                )
              }
            >
              Offers
            </button>

            <button
              type="button"
              onClick={() =>
                scrollTo(
                  "orders"
                )
              }
            >
              Orders
            </button>

          </nav>


          <div className="header-right">

            <div className="header-search">

              <span>
                ⌕
              </span>

              <input
                value={search}
                onChange={(e) => {
                  setSearch(
                    e.target.value
                  );

                  setCategory("");
                }}
                placeholder="Search for products..."
              />

            </div>


            <button
              className="profile-button"
              type="button"
              onClick={() =>
                setProfileOpen(
                  true
                )
              }
            >
              {(
                user.displayName ||
                user.phoneNumber ||
                "U"
              )
                .charAt(0)
                .toUpperCase()}
            </button>


            <button
              className="cart-button"
              type="button"
              onClick={() =>
                setCartOpen(
                  true
                )
              }
            >

              🛒

              {cartCount >
                0 && (
                <b>
                  {cartCount}
                </b>
              )}

            </button>

          </div>

        </div>

      </header>


      {/* HERO */}

      <section
        id="home"
        className="hero"
      >

        <div className="hero-watercolor" />

        <div className="hero-text">

          <span>
            GRIHINI APNA BAZAAR
          </span>

          <h1>
            Fresh Groceries
            <br />
            Delivered to
            <br />
            Your Doorstep
          </h1>

          <p>
            Quality products,
            fast delivery
            and best prices
            every day.
          </p>

          <button
            type="button"
            onClick={() =>
              scrollTo(
                "products"
              )
            }
          >
            Shop Now →
          </button>

        </div>


        <div className="hero-basket">
          🥬🥕🍅
          <br />
          🥛🍞🥦
        </div>

      </section>


      {/* CATEGORIES */}

      <section
        id="categories"
        className="section"
      >

        <div className="section-head">

          <div>

            <span>
              SHOP BY CATEGORY
            </span>

            <h2>
              Grocery Categories
            </h2>

          </div>

          <button
            type="button"
            onClick={() => {
              setCategory("");
              scrollTo(
                "products"
              );
            }}
          >
            View All →
          </button>

        </div>


        <div className="category-scroll">

          {CATEGORIES.map(
            ([
              name,
              image,
            ]) => (

              <button
                className={
                  category ===
                  name
                    ? "category-card selected"
                    : "category-card"
                }
                type="button"
                key={name}
                onClick={() => {
                  setCategory(
                    name
                  );

                  setSearch(
                    ""
                  );

                  scrollTo(
                    "products"
                  );
                }}
              >

                <div className="category-image">

                  <img
                    src={image}
                    alt={name}
                  />

                </div>

                <strong>
                  {name}
                </strong>

              </button>

            )
          )}

        </div>

      </section>


      {/* DEAL */}

      <section className="deal-banner">

        <div>

          <span>
            DAILY SAVINGS
          </span>

          <h2>
            Fresh essentials,
            better prices.
          </h2>

          <p>
            Free delivery on
            eligible orders.
          </p>

        </div>


        <button
          type="button"
          onClick={() =>
            scrollTo(
              "products"
            )
          }
        >
          Shop Now →
        </button>

      </section>


      {/* PRODUCTS */}

      <section
        id="products"
        className="section products-section"
      >

        <div className="section-head">

          <div>

            <span>
              {search
                ? "SEARCH RESULTS"
                : "POPULAR PRODUCTS"}
            </span>

            <h2>
              {search
                ? `Results for "${search}"`
                : category ||
                  "Everyday Essentials"}
            </h2>

          </div>

          <small>
            {filteredProducts.length} products
          </small>

        </div>


        {loadingProducts ? (

          <div className="loading-products">

            <div className="spinner" />

            <strong>
              Loading products...
            </strong>

          </div>

        ) : filteredProducts.length ? (

          <div className="product-grid">

            {filteredProducts.map(
              (product) => (

                <ProductCard
                  key={
                    product.id
                  }
                  product={
                    product
                  }
                  onAdd={
                    addToCart
                  }
                  onOpen={
                    setProductModal
                  }
                  wished={wishlist.some(
                    (item) =>
                      item.id ===
                      product.id
                  )}
                  onWish={
                    toggleWishlist
                  }
                />

              )
            )}

          </div>

        ) : (

          <div className="empty-products">

            <span>
              🔎
            </span>

            <h3>
              No products found
            </h3>

            <p>
              Search another product
              or category.
            </p>

          </div>

        )}

      </section>


      {/* OFFERS */}

      <section
        id="offers"
        className="offers"
      >

        <span>
          OFFERS & COUPONS
        </span>

        <h2>
          Save More on Every Order
        </h2>


        <div className="offer-grid">

          <div className="offer-card">

            <strong>
              ₹50 OFF
            </strong>

            <b>
              WELCOME50
            </b>

            <small>
              On orders ₹499+
            </small>

          </div>


          <div className="offer-card">

            <strong>
              10% OFF
            </strong>

            <b>
              SAVE10
            </b>

            <small>
              Up to ₹100 discount
            </small>

          </div>


          <div className="offer-card">

            <strong>
              FREE DELIVERY
            </strong>

            <b>
              ₹499+
            </b>

            <small>
              Local delivery
            </small>

          </div>

        </div>

      </section>


      {/* ORDERS */}

      <section
        id="orders"
        className="section orders-section"
      >

        <div className="section-head">

          <div>

            <span>
              MY ACCOUNT
            </span>

            <h2>
              My Orders
            </h2>

          </div>

          <small>
            {orders.length} orders
          </small>

        </div>


        {orders.length ? (

          <div className="orders-list">

            {orders.map(
              (order) => (

                <button
                  className="order-list-card"
                  type="button"
                  key={
                    order.orderId
                  }
                  onClick={() =>
                    setOrderDetails(
                      order
                    )
                  }
                >

                  <div className="order-list-icon">
                    🛍️
                  </div>


                  <div className="order-list-main">

                    <strong>
                      #{order.orderId}
                    </strong>

                    <span>
                      {formatDate(
                        order.createdAt
                      )}
                    </span>

                    <small>
                      {order.items?.length ||
                        0}{" "}
                      items
                    </small>

                  </div>


                  <div className="order-list-right">

                    <strong>
                      ₹
                      {Number(
                        order.total ||
                          0
                      ).toFixed(
                        2
                      )}
                    </strong>

                    <span>
                      {order.status ||
                        "Pending"}
                    </span>

                  </div>


                  <b>
                    →
                  </b>

                </button>

              )
            )}

          </div>

        ) : (

          <div className="no-orders">

            <span>
              📦
            </span>

            <h3>
              No orders yet
            </h3>

            <p>
              Your orders will
              appear here.
            </p>

            <button
              type="button"
              onClick={() =>
                scrollTo(
                  "products"
                )
              }
            >
              Start Shopping
            </button>

          </div>

        )}

      </section>


      {/* STORE */}

      <section className="store-section">

        <div>

          <span>
            YOUR LOCAL STORE
          </span>

          <h2>
            {STORE_NAME}
          </h2>

          <p>
            {STORE_ADDRESS}
          </p>

        </div>


        <div className="store-delivery">

          🚚

          <div>

            <strong>
              Fast Local Delivery
            </strong>

            <span>
              Estimated 10–15 minutes
            </span>

          </div>

        </div>

      </section>


      {/* FOOTER */}

      <footer className="footer">

        <div>

          <strong>
            {STORE_NAME}
          </strong>

          <span>
            {STORE_ADDRESS}
          </span>

        </div>

        <span>
          © 2026 Grihini
          Apna Bazaar
        </span>

      </footer>


      {/* CART */}

      {cartOpen && (

        <CartDrawer
          cart={cart}
          onClose={() =>
            setCartOpen(
              false
            )
          }
          onQty={
            updateQty
          }
          subtotal={
            subtotal
          }
          discount={
            couponDiscount
          }
          delivery={
            delivery
          }
          total={
            total
          }
          coupon={
            coupon
          }
          setCoupon={
            setCoupon
          }
          onCheckout={() =>
            setCheckoutOpen(
              true
            )
          }
        />

      )}


      {/* PRODUCT */}

      {productModal && (

        <div
          className="overlay center"
          onClick={() =>
            setProductModal(
              null
            )
          }
        >

          <div
            className="product-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-button"
              type="button"
              onClick={() =>
                setProductModal(
                  null
                )
              }
            >
              ×
            </button>


            <div className="modal-product-image">

              {productImage(
                productModal
              ) ? (
                <img
                  src={productImage(
                    productModal
                  )}
                  alt=""
                />
              ) : (
                "🛒"
              )}

            </div>


            <div className="modal-product-info">

              <span>
                {productModal.brand ||
                  productModal.company ||
                  "Grocery"}
              </span>

              <h2>
                {productName(
                  productModal
                )}
              </h2>

              <p>
                {productModal.description ||
                  "Fresh quality product from Grihini Apna Bazaar."}
              </p>


              <div className="modal-price">

                ₹
                {productPrice(
                  productModal
                ).toFixed(2)}

                {productMrp(
                  productModal
                ) >
                  productPrice(
                    productModal
                  ) && (
                  <del>
                    ₹
                    {productMrp(
                      productModal
                    ).toFixed(2)}
                  </del>
                )}

              </div>


              <div className="modal-delivery">
                🚚 Delivered in
                <strong>
                  10–15 minutes
                </strong>
              </div>


              <button
                className="primary-wide"
                type="button"
                onClick={() => {
                  addToCart(
                    productModal
                  );

                  setProductModal(
                    null
                  );

                  setCartOpen(
                    true
                  );
                }}
              >
                Add to Cart
              </button>

            </div>

          </div>

        </div>

      )}


      {/* CHECKOUT */}

      {checkoutOpen && (

        <Checkout
          user={user}
          total={total}
          cart={cart}
          onClose={() =>
            setCheckoutOpen(
              false
            )
          }
          onPlace={
            placeOrder
          }
        />

      )}


      {/* ORDER SUCCESS */}

      {orderSuccess && (

        <OrderSuccess
          order={
            orderSuccess
          }
          onDetails={() => {
            setOrderDetails(
              orderSuccess
            );

            setOrderSuccess(
              null
            );
          }}
          onClose={() =>
            setOrderSuccess(
              null
            )
          }
        />

      )}


      {/* ORDER DETAILS */}

      {orderDetails && (

        <OrderDetails
          order={
            orderDetails
          }
          onClose={() =>
            setOrderDetails(
              null
            )
          }
        />

      )}


      {/* PROFILE */}

      {profileOpen && (

        <div
          className="overlay center"
          onClick={() =>
            setProfileOpen(
              false
            )
          }
        >

          <div
            className="profile-card"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-button"
              type="button"
              onClick={() =>
                setProfileOpen(
                  false
                )
              }
            >
              ×
            </button>


            <div className="profile-avatar">
              {(
                user.displayName ||
                user.phoneNumber ||
                "U"
              )
                .charAt(0)
                .toUpperCase()}
            </div>


            <h2>
              Hello,
              <br />
              {user.displayName ||
                "Customer"}
            </h2>


            <p>
              {user.phoneNumber ||
                user.email ||
                ""}
            </p>


            <button
              type="button"
              onClick={() => {
                setProfileOpen(
                  false
                );

                scrollTo(
                  "orders"
                );
              }}
            >
              📦 My Orders
            </button>


            <button
              type="button"
              onClick={() =>
                setProfileOpen(
                  false
                )
              }
            >
              📍 Delivery Address
            </button>


            <button
              type="button"
              onClick={() =>
                setProfileOpen(
                  false
                )
              }
            >
              🎟️ Offers & Coupons
            </button>


            <button
              className="logout-button"
              type="button"
              onClick={
                logout
              }
            >
              ↪ Logout
            </button>

          </div>

        </div>

      )}


      {/* TOAST */}

      {toast && (

        <div className="toast">

          <span>
            ✓
          </span>

          {toast}

        </div>

      )}

    </main>
  );
}
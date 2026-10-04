import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

import { db } from "../firebase";
import AdminProducts from "./AdminProducts";

import "./AdminDashboard.css";

const MENU = [
  ["dashboard", "📊", "Dashboard"],
  ["products", "📦", "Products"],
  ["orders", "🛒", "Orders"],
  ["customers", "👥", "Customers"],
  ["categories", "🗂️", "Categories"],
  ["offers", "🏷️", "Offers & Coupons"],
  ["banners", "🖼️", "Banners"],
  ["delivery", "🚚", "Delivery Areas"],
  ["settings", "⚙️", "Settings"],
];

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Packed",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const CATEGORIES = [
  "Atta, Rice & Dal",
  "Oil & Ghee",
  "Masala & Spices",
  "Snacks",
  "Dairy & Breakfast",
  "Personal Care",
  "Home Care",
  "Baby Care",
  "Other",
];

function money(value) {
  const n = Number(value || 0);

  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function customerFromOrder(order) {
  const customer = order?.customer || {};

  return {
    name:
      customer.name ||
      customer.fullName ||
      order?.customerName ||
      "Guest Customer",

    mobile:
      customer.mobile ||
      customer.phone ||
      customer.phoneNumber ||
      order?.mobile ||
      order?.phone ||
      "—",

    email:
      customer.email ||
      order?.email ||
      "—",

    address:
      customer.address ||
      customer.fullAddress ||
      order?.address ||
      "—",

    landmark:
      customer.landmark ||
      order?.landmark ||
      "—",

    city:
      customer.city ||
      order?.city ||
      "Aurangabad",

    pincode:
      customer.pincode ||
      customer.pinCode ||
      order?.pincode ||
      "—",
  };
}

function getOrderDate(order) {
  const value =
    order?.createdAt ||
    order?.date ||
    order?.timestamp;

  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getOrderItemsCount(order) {
  if (!Array.isArray(order?.items)) {
    return 0;
  }

  return order.items.reduce(
    (total, item) =>
      total + Number(item?.qty || 1),
    0
  );
}

function getCustomerKey(customer) {
  const mobile = String(
    customer.mobile || ""
  ).trim();

  if (mobile) {
    return `mobile:${mobile}`;
  }

  const email = String(
    customer.email || ""
  ).trim()
    .toLowerCase();

  if (email) {
    return `email:${email}`;
  }

  return `name:${String(
    customer.name || "Guest"
  ).toLowerCase()}`;
}

export default function AdminDashboard() {
  const [section, setSection] =
    useState("dashboard");

  const [orders, setOrders] = useState([]);

  const [customers, setCustomers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  const [orderSearch, setOrderSearch] =
    useState("");

  const [orderFilter, setOrderFilter] =
    useState("All");

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [mobileSidebar, setMobileSidebar] =
    useState(false);

  async function loadOrders() {
    setLoading(true);
    setMessage("");

    try {
      const snapshot = await getDocs(
        collection(db, "orders")
      );

      const list = snapshot.docs
        .map((item) => ({
          firestoreId: item.id,
          id: item.id,
          ...item.data(),
        }))
        .sort((a, b) => {
          const da = new Date(
            a.createdAt || 0
          ).getTime();

          const db = new Date(
            b.createdAt || 0
          ).getTime();

          return db - da;
        });

      setOrders(list);

      const customerMap = new Map();

      list.forEach((order) => {
        const customer =
          customerFromOrder(order);

        const key =
          getCustomerKey(customer);

        const existing =
          customerMap.get(key);

        if (existing) {
          existing.orderCount += 1;

          existing.totalSpent +=
            Number(order.total || 0);

          existing.lastOrder =
            order.createdAt ||
            existing.lastOrder;
        } else {
          customerMap.set(key, {
            ...customer,
            orderCount: 1,
            totalSpent: Number(
              order.total || 0
            ),
            lastOrder:
              order.createdAt || "",
          });
        }
      });

      setCustomers(
        Array.from(customerMap.values())
      );
    } catch (error) {
      console.error(
        "Admin order load failed:",
        error
      );

      setMessage(
        "Orders load नहीं हो पाए। Firestore rules और connection check करें।"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function changeOrderStatus(
    order,
    status
  ) {
    if (!order?.firestoreId) return;

    try {
      await updateDoc(
        doc(
          db,
          "orders",
          order.firestoreId
        ),
        {
          status,
          updatedAt:
            new Date().toISOString(),
        }
      );

      setOrders((current) =>
        current.map((item) =>
          item.firestoreId ===
          order.firestoreId
            ? {
                ...item,
                status,
                updatedAt:
                  new Date().toISOString(),
              }
            : item
        )
      );

      setSelectedOrder((current) =>
        current?.firestoreId ===
        order.firestoreId
          ? {
              ...current,
              status,
            }
          : current
      );

      setMessage(
        `Order ${order.orderId || order.id} → ${status}`
      );
    } catch (error) {
      console.error(
        "Status update failed:",
        error
      );

      setMessage(
        "Order status update नहीं हुआ।"
      );
    }
  }

  const stats = useMemo(() => {
    const totalSales = orders.reduce(
      (sum, order) =>
        sum + Number(order.total || 0),
      0
    );

    const pending = orders.filter(
      (order) =>
        !order.status ||
        order.status === "Pending"
    ).length;

    const confirmed = orders.filter(
      (order) =>
        order.status === "Confirmed"
    ).length;

    const delivered = orders.filter(
      (order) =>
        order.status === "Delivered"
    ).length;

    const cancelled = orders.filter(
      (order) =>
        order.status === "Cancelled"
    ).length;

    return {
      orders: orders.length,
      customers: customers.length,
      totalSales,
      pending,
      confirmed,
      delivered,
      cancelled,
    };
  }, [orders, customers]);

  const filteredOrders = useMemo(() => {
    const query =
      orderSearch.trim().toLowerCase();

    return orders.filter((order) => {
      const customer =
        customerFromOrder(order);

      const searchable = [
        order.orderId,
        order.id,
        customer.name,
        customer.mobile,
        customer.email,
        customer.address,
        customer.pincode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch =
        !query ||
        searchable.includes(query);

      const statusMatch =
        orderFilter === "All" ||
        (order.status || "Pending") ===
          orderFilter;

      return searchMatch && statusMatch;
    });
  }, [
    orders,
    orderSearch,
    orderFilter,
  ]);

  const filteredCustomers =
    useMemo(() => {
      const query =
        customerSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return customers;
      }

      return customers.filter(
        (customer) =>
          [
            customer.name,
            customer.mobile,
            customer.email,
            customer.address,
            customer.city,
            customer.pincode,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
      );
    }, [customers, customerSearch]);

  function selectMenu(name) {
    setSection(name);
    setMobileSidebar(false);
    setMessage("");
  }

  return (
    <div className="admin-dashboard">

      {/* SIDEBAR */}

      <aside
        className={`admin-sidebar ${
          mobileSidebar
            ? "mobile-open"
            : ""
        }`}
      >
        <div className="admin-brand">
          <div className="admin-brand-icon">
            🛒
          </div>

          <div>
            <strong>
              Grihini Apna Bazaar
            </strong>

            <span>
              ADMIN CONTROL PANEL
            </span>
          </div>
        </div>

        <nav className="admin-nav">
          {MENU.map(
            ([id, icon, label]) => (
              <button
                key={id}
                type="button"
                className={
                  section === id
                    ? "active"
                    : ""
                }
                onClick={() =>
                  selectMenu(id)
                }
              >
                <span>{icon}</span>
                <b>{label}</b>
              </button>
            )
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <span>
            Grihini Apna Bazaar
          </span>

          <small>
            Aurangabad, Bihar
          </small>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}

      {mobileSidebar && (
        <div
          className="admin-mobile-overlay"
          onClick={() =>
            setMobileSidebar(false)
          }
        />
      )}

      {/* MAIN */}

      <main className="admin-main">

        <header className="admin-topbar">
          <div className="admin-top-left">
            <button
              type="button"
              className="admin-mobile-menu"
              onClick={() =>
                setMobileSidebar(true)
              }
            >
              ☰
            </button>

            <div>
              <span className="admin-top-label">
                ADMIN
              </span>

              <h1>
                {MENU.find(
                  ([id]) =>
                    id === section
                )?.[2] ||
                  "Dashboard"}
              </h1>
            </div>
          </div>

          <div className="admin-top-actions">
            <button
              type="button"
              onClick={loadOrders}
            >
              ↻ Refresh
            </button>

            <div className="admin-user">
              <div className="admin-user-avatar">
                A
              </div>

              <div>
                <strong>Administrator</strong>
                <span>Store Manager</span>
              </div>
            </div>
          </div>
        </header>

        {message && (
          <div className="admin-notice">
            {message}
          </div>
        )}

        <div className="admin-content">

          {/* DASHBOARD */}

          {section === "dashboard" && (
            <>
              <div className="admin-welcome">
                <div>
                  <span>
                    GRIHINI APNA BAZAAR
                  </span>

                  <h2>
                    Store Overview
                  </h2>

                  <p>
                    Products, orders,
                    customers और delivery
                    एक ही जगह से manage करें।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    selectMenu("orders")
                  }
                >
                  View Orders →
                </button>
              </div>

              <div className="admin-stat-grid">

                <StatCard
                  icon="🛒"
                  label="Total Orders"
                  value={stats.orders}
                />

                <StatCard
                  icon="👥"
                  label="Customers"
                  value={stats.customers}
                />

                <StatCard
                  icon="₹"
                  label="Total Sales"
                  value={money(
                    stats.totalSales
                  )}
                />

                <StatCard
                  icon="⏳"
                  label="Pending"
                  value={stats.pending}
                />

                <StatCard
                  icon="📦"
                  label="Confirmed"
                  value={stats.confirmed}
                />

                <StatCard
                  icon="🚚"
                  label="Out / Delivery"
                  value={
                    orders.filter(
                      (order) =>
                        order.status ===
                        "Out for Delivery"
                    ).length
                  }
                />

                <StatCard
                  icon="✅"
                  label="Delivered"
                  value={stats.delivered}
                />

                <StatCard
                  icon="❌"
                  label="Cancelled"
                  value={stats.cancelled}
                />

              </div>

              <div className="admin-dashboard-grid">

                <section className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <span>
                        RECENT ORDERS
                      </span>
                      <h3>
                        Latest Orders
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        selectMenu(
                          "orders"
                        )
                      }
                    >
                      View All
                    </button>
                  </div>

                  {orders
                    .slice(0, 6)
                    .map((order) => (
                      <OrderMini
                        key={
                          order.firestoreId
                        }
                        order={order}
                        onClick={() =>
                          setSelectedOrder(
                            order
                          )
                        }
                      />
                    ))}

                  {!orders.length && (
                    <EmptyState
                      text="अभी कोई order नहीं है।"
                    />
                  )}
                </section>

                <section className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <span>
                        QUICK ACTIONS
                      </span>
                      <h3>
                        Manage Store
                      </h3>
                    </div>
                  </div>

                  <div className="quick-actions">

                    <button
                      onClick={() =>
                        selectMenu(
                          "products"
                        )
                      }
                    >
                      <span>📦</span>
                      <b>Products</b>
                      <small>
                        Products & Stock
                      </small>
                    </button>

                    <button
                      onClick={() =>
                        selectMenu(
                          "orders"
                        )
                      }
                    >
                      <span>🛒</span>
                      <b>Orders</b>
                      <small>
                        Manage deliveries
                      </small>
                    </button>

                    <button
                      onClick={() =>
                        selectMenu(
                          "customers"
                        )
                      }
                    >
                      <span>👥</span>
                      <b>Customers</b>
                      <small>
                        Customer details
                      </small>
                    </button>

                    <button
                      onClick={() =>
                        selectMenu(
                          "delivery"
                        )
                      }
                    >
                      <span>🚚</span>
                      <b>Delivery</b>
                      <small>
                        Areas & charges
                      </small>
                    </button>

                  </div>
                </section>

              </div>
            </>
          )}

          {/* PRODUCTS */}

          {section === "products" && (
            <AdminProducts />
          )}

          {/* ORDERS */}

          {section === "orders" && (
            <section className="admin-panel full-panel">

              <div className="admin-section-heading">
                <div>
                  <span>
                    ORDER MANAGEMENT
                  </span>

                  <h2>
                    All Orders
                  </h2>

                  <p>
                    Customer, payment,
                    address और delivery
                    status manage करें।
                  </p>
                </div>

                <button
                  type="button"
                  className="admin-primary-button"
                  onClick={loadOrders}
                >
                  ↻ Refresh Orders
                </button>
              </div>

              <div className="order-filters">

                <input
                  value={orderSearch}
                  onChange={(event) =>
                    setOrderSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search order, name, mobile, address..."
                />

                <select
                  value={orderFilter}
                  onChange={(event) =>
                    setOrderFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="All">
                    All Status
                  </option>

                  {ORDER_STATUSES.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>

              </div>

              {loading ? (
                <EmptyState text="Orders loading..." />
              ) : filteredOrders.length === 0 ? (
                <EmptyState text="कोई order नहीं मिला।" />
              ) : (
                <div className="orders-table-wrap">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Mobile</th>
                        <th>Amount</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredOrders.map(
                        (order) => {
                          const customer =
                            customerFromOrder(
                              order
                            );

                          return (
                            <tr
                              key={
                                order.firestoreId
                              }
                            >
                              <td>
                                <strong>
                                  {order.orderId ||
                                    order.id}
                                </strong>

                                <small>
                                  {getOrderDate(
                                    order
                                  )}
                                </small>
                              </td>

                              <td>
                                <strong>
                                  {customer.name}
                                </strong>

                                <small>
                                  {customer.city}
                                </small>
                              </td>

                              <td>
                                {customer.mobile}
                              </td>

                              <td>
                                <strong>
                                  {money(
                                    order.total
                                  )}
                                </strong>

                                <small>
                                  {
                                    getOrderItemsCount(
                                      order
                                    )
                                  }{" "}
                                  items
                                </small>
                              </td>

                              <td>
                                <strong>
                                  {order.paymentMethod ||
                                    "COD"}
                                </strong>

                                <small>
                                  {order.paymentStatus ||
                                    "Pending"}
                                </small>
                              </td>

                              <td>
                                <StatusBadge
                                  status={
                                    order.status ||
                                    "Pending"
                                  }
                                />
                              </td>

                              <td>
                                <button
                                  className="view-order-button"
                                  type="button"
                                  onClick={() =>
                                    setSelectedOrder(
                                      order
                                    )
                                  }
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </section>
          )}

          {/* CUSTOMERS */}

          {section === "customers" && (
            <section className="admin-panel full-panel">

              <div className="admin-section-heading">
                <div>
                  <span>
                    CUSTOMER MANAGEMENT
                  </span>

                  <h2>
                    Customers
                  </h2>

                  <p>
                    Mobile, address, orders
                    और total spending देखें।
                  </p>
                </div>
              </div>

              <div className="customer-summary">
                <div>
                  <b>{customers.length}</b>
                  <span>Total Customers</span>
                </div>

                <div>
                  <b>{stats.orders}</b>
                  <span>Total Orders</span>
                </div>

                <div>
                  <b>
                    {money(stats.totalSales)}
                  </b>
                  <span>Total Sales</span>
                </div>
              </div>

              <div className="customer-search">
                <input
                  value={customerSearch}
                  onChange={(event) =>
                    setCustomerSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search name, mobile, address, pincode..."
                />
              </div>

              <div className="customer-grid">

                {filteredCustomers.map(
                  (customer) => (
                    <article
                      className="customer-card"
                      key={getCustomerKey(
                        customer
                      )}
                    >
                      <div className="customer-card-top">
                        <div className="customer-avatar">
                          {String(
                            customer.name ||
                              "G"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <h3>
                            {customer.name}
                          </h3>

                          <a
                            href={
                              customer.mobile !==
                              "—"
                                ? `tel:${customer.mobile}`
                                : undefined
                            }
                          >
                            📱{" "}
                            {customer.mobile}
                          </a>
                        </div>
                      </div>

                      <div className="customer-details">

                        <div>
                          <span>
                            Email
                          </span>

                          <b>
                            {customer.email}
                          </b>
                        </div>

                        <div>
                          <span>
                            Address
                          </span>

                          <b>
                            {customer.address}
                          </b>
                        </div>

                        <div>
                          <span>
                            Landmark
                          </span>

                          <b>
                            {customer.landmark}
                          </b>
                        </div>

                        <div>
                          <span>
                            Location
                          </span>

                          <b>
                            {customer.city}
                            {" - "}
                            {customer.pincode}
                          </b>
                        </div>

                      </div>

                      <div className="customer-card-bottom">
                        <span>
                          Orders:{" "}
                          <b>
                            {customer.orderCount}
                          </b>
                        </span>

                        <span>
                          Spent:{" "}
                          <b>
                            {money(
                              customer.totalSpent
                            )}
                          </b>
                        </span>
                      </div>
                    </article>
                  )
                )}

              </div>

              {!filteredCustomers.length && (
                <EmptyState text="Customer data अभी available नहीं है। पहले customer order place करे।" />
              )}

            </section>
          )}

          {/* CATEGORIES */}

          {section === "categories" && (
            <section className="admin-panel full-panel">

              <div className="admin-section-heading">
                <div>
                  <span>
                    CATALOGUE
                  </span>

                  <h2>
                    Categories
                  </h2>

                  <p>
                    Store की product
                    categories.
                  </p>
                </div>
              </div>

              <div className="admin-category-grid">
                {CATEGORIES.map(
                  (category) => (
                    <div
                      className="admin-category-card"
                      key={category}
                    >
                      <div>
                        <span>🗂️</span>
                        <b>{category}</b>
                      </div>

                      <small>
                        Product category
                      </small>
                    </div>
                  )
                )}
              </div>

            </section>
          )}

          {/* OFFERS */}

          {section === "offers" && (
            <ComingSoon
              icon="🏷️"
              title="Offers & Coupons"
              text="WELCOME50, SAVE10 और आगे के promotional coupons यहाँ manage किए जाएंगे।"
            />
          )}

          {/* BANNERS */}

          {section === "banners" && (
            <ComingSoon
              icon="🖼️"
              title="Banners & Ads"
              text="Homepage banners, promotional images और offers यहाँ manage होंगे।"
            />
          )}

          {/* DELIVERY */}

          {section === "delivery" && (
            <section className="admin-panel full-panel">

              <div className="admin-section-heading">
                <div>
                  <span>
                    DELIVERY MANAGEMENT
                  </span>

                  <h2>
                    Delivery Areas
                  </h2>

                  <p>
                    Local delivery area,
                    charge और free delivery
                    threshold.
                  </p>
                </div>
              </div>

              <div className="delivery-settings">

                <div className="setting-box">
                  <span>📍</span>
                  <b>Aurangabad</b>
                  <small>
                    Main delivery area
                  </small>
                </div>

                <div className="setting-box">
                  <span>₹</span>
                  <b>₹20</b>
                  <small>
                    Standard delivery
                  </small>
                </div>

                <div className="setting-box">
                  <span>🎁</span>
                  <b>₹499+</b>
                  <small>
                    Free delivery
                  </small>
                </div>

                <div className="setting-box">
                  <span>⏱️</span>
                  <b>30–60 min</b>
                  <small>
                    Expected delivery
                  </small>
                </div>

              </div>

            </section>
          )}

          {/* SETTINGS */}

          {section === "settings" && (
            <ComingSoon
              icon="⚙️"
              title="Store Settings"
              text="Store name, contact, payment settings, delivery settings और admin preferences यहाँ manage होंगे।"
            />
          )}

        </div>
      </main>

      {/* ORDER DETAIL MODAL */}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() =>
            setSelectedOrder(null)
          }
          onStatusChange={
            changeOrderStatus
          }
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="admin-stat-card">
      <div className="stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function OrderMini({
  order,
  onClick,
}) {
  const customer =
    customerFromOrder(order);

  return (
    <button
      type="button"
      className="order-mini"
      onClick={onClick}
    >
      <div>
        <strong>
          {order.orderId ||
            order.id}
        </strong>

        <span>
          {customer.name} •{" "}
          {customer.mobile}
        </span>
      </div>

      <div>
        <b>
          {money(order.total)}
        </b>

        <StatusBadge
          status={
            order.status ||
            "Pending"
          }
        />
      </div>
    </button>
  );
}

function StatusBadge({ status }) {
  const className = String(
    status || "Pending"
  )
    .toLowerCase()
    .replaceAll(" ", "-");

  return (
    <span
      className={`status-badge status-${className}`}
    >
      {status}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <div className="admin-empty">
      <span>📭</span>
      <p>{text}</p>
    </div>
  );
}

function ComingSoon({
  icon,
  title,
  text,
}) {
  return (
    <section className="admin-coming-soon">
      <div className="coming-icon">
        {icon}
      </div>

      <h2>{title}</h2>

      <p>{text}</p>

      <span>
        Module ready for configuration
      </span>
    </section>
  );
}

function OrderDetailsModal({
  order,
  onClose,
  onStatusChange,
}) {
  const customer =
    customerFromOrder(order);

  const currentStatus =
    order.status || "Pending";

  return (
    <div
      className="admin-modal-backdrop"
      onClick={onClose}
    >
      <section
        className="admin-order-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        <header className="order-modal-header">
          <div>
            <span>
              ORDER DETAILS
            </span>

            <h2>
              {order.orderId ||
                order.id}
            </h2>

            <small>
              {getOrderDate(order)}
            </small>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="order-modal-body">

          {/* CUSTOMER */}

          <section className="order-info-section">
            <h3>
              👤 Customer Details
            </h3>

            <div className="order-info-grid">

              <Info
                label="Name"
                value={
                  customer.name
                }
              />

              <Info
                label="Mobile"
                value={
                  customer.mobile
                }
              />

              <Info
                label="Email"
                value={
                  customer.email
                }
              />

              <Info
                label="Landmark"
                value={
                  customer.landmark
                }
              />

              <Info
                label="City"
                value={
                  customer.city
                }
              />

              <Info
                label="Pincode"
                value={
                  customer.pincode
                }
              />

            </div>

            <div className="full-address">
              <span>
                Delivery Address
              </span>

              <b>
                {customer.address}
              </b>
            </div>
          </section>

          {/* PRODUCTS */}

          <section className="order-info-section">
            <h3>
              📦 Ordered Products
            </h3>

            <div className="order-items-list">
              {Array.isArray(
                order.items
              ) &&
                order.items.map(
                  (item, index) => (
                    <div
                      className="order-item-row"
                      key={
                        item.id ||
                        item.code ||
                        index
                      }
                    >
                      <div>
                        <strong>
                          {item.name ||
                            item.productName ||
                            "Product"}
                        </strong>

                        <small>
                          Qty:{" "}
                          {item.qty ||
                            1}
                        </small>
                      </div>

                      <b>
                        {money(
                          Number(
                            item.price ||
                              item.sellingPrice ||
                              0
                          ) *
                            Number(
                              item.qty ||
                                1
                            )
                        )}
                      </b>
                    </div>
                  )
                )}
            </div>
          </section>

          {/* PAYMENT */}

          <section className="order-info-section">
            <h3>
              💳 Payment
            </h3>

            <div className="order-info-grid">

              <Info
                label="Payment Method"
                value={
                  order.paymentMethod ||
                  "COD"
                }
              />

              <Info
                label="Payment Status"
                value={
                  order.paymentStatus ||
                  "Pending"
                }
              />

              <Info
                label="Subtotal"
                value={money(
                  order.subtotal
                )}
              />

              <Info
                label="Discount"
                value={money(
                  order.discount
                )}
              />

              <Info
                label="Delivery"
                value={money(
                  order.delivery
                )}
              />

              <Info
                label="Total"
                value={money(
                  order.total
                )}
              />

            </div>
          </section>

          {/* STATUS */}

          <section className="order-info-section">
            <h3>
              🚚 Delivery Status
            </h3>

            <div className="status-timeline">
              {ORDER_STATUSES.filter(
                (status) =>
                  status !==
                  "Cancelled"
              ).map(
                (status, index) => {
                  const active =
                    status ===
                    currentStatus;

                  const currentIndex =
                    ORDER_STATUSES.indexOf(
                      currentStatus
                    );

                  const statusIndex =
                    ORDER_STATUSES.indexOf(
                      status
                    );

                  const done =
                    currentStatus !==
                      "Cancelled" &&
                    statusIndex <=
                      currentIndex;

                  return (
                    <div
                      className={`timeline-step ${
                        done
                          ? "done"
                          : ""
                      } ${
                        active
                          ? "current"
                          : ""
                      }`}
                      key={status}
                    >
                      <span>
                        {done
                          ? "✓"
                          : index + 1}
                      </span>

                      <b>
                        {status}
                      </b>
                    </div>
                  );
                }
              )}
            </div>

            <div className="status-actions">
              {ORDER_STATUSES.map(
                (status) => (
                  <button
                    type="button"
                    key={status}
                    className={
                      status ===
                      currentStatus
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      onStatusChange(
                        order,
                        status
                      )
                    }
                  >
                    {status}
                  </button>
                )
              )}
            </div>
          </section>

        </div>

      </section>
    </div>
  );
}

function Info({
  label,
  value,
}) {
  return (
    <div className="order-info">
      <span>{label}</span>
      <b>{value || "—"}</b>
    </div>
  );
}
import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'

import productsData from '../../data/products.js'
import AdminProductEditor from './AdminProductEditor'
import { db } from '../firebase'

const PRODUCTS_PER_PAGE = 50

const CATEGORIES = [
  'Atta, Rice & Dal',
  'Oil & Ghee',
  'Masala & Spices',
  'Snacks',
  'Dairy & Breakfast',
  'Personal Care',
  'Home Care',
  'Baby Care',
  'Other',
]

function getNumber(value) {
  const number = Number.parseFloat(value)

  return Number.isNaN(number) ? 0 : number
}

function formatPrice(value) {
  const number = getNumber(value)

  if (!number) {
    return '—'
  }

  return `₹${number.toFixed(2)}`
}

function formatStock(value) {
  const number = getNumber(value)

  if (!number && String(value).trim() !== '0') {
    return '—'
  }

  return number.toLocaleString('en-IN')
}

function getProductBrand(product) {
  return (
    product.brand ||
    product.company ||
    product.manufacturer ||
    '—'
  )
}

function getImageCount(product) {
  if (!Array.isArray(product.images)) {
    return 0
  }

  return product.images.filter(Boolean).length
}

function normalizeProduct(product) {
  return {
    ...product,

    id:
      product.id ||
      product.firestoreId ||
      product.localId ||
      `product-${Date.now()}`,

    images: Array.isArray(product.images)
      ? product.images.filter(Boolean)
      : [],

    video: product.video || '',

    isActive:
      product.isActive !== false,

    isLive:
      product.isLive === true,

    isDeleted:
      product.isDeleted === true,
  }
}

function cleanMediaForFirestore(product) {
  const images = Array.isArray(product.images)
    ? product.images.filter(
        (image) =>
          typeof image === 'string' &&
          image.trim() !== '' &&
          !image.startsWith('blob:') &&
          !image.startsWith('data:')
      )
    : []

  let video = product.video || ''

  if (
    video.startsWith('blob:') ||
    video.startsWith('data:')
  ) {
    video = ''
  }

  return {
    ...product,
    images,
    video,
    updatedAt: new Date().toISOString(),
  }
}

export default function AdminProducts() {
  const [allProducts, setAllProducts] = useState(() =>
    Array.isArray(productsData)
      ? productsData.map(normalizeProduct)
      : []
  )

  const [firebaseLoaded, setFirebaseLoaded] =
    useState(false)

  const [firebaseCount, setFirebaseCount] =
    useState(0)

  const [loadingFirebase, setLoadingFirebase] =
    useState(true)

  const [statusMessage, setStatusMessage] =
    useState('Loading Firebase data...')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [currentPage, setCurrentPage] =
    useState(1)

  const [editingProduct, setEditingProduct] =
    useState(null)

  // ==================================================
  // LOAD ALL FIRESTORE PRODUCTS
  // IMPORTANT:
  // NO 20,000 LIMIT
  // ==================================================

  useEffect(() => {
    let cancelled = false

    async function loadFirebaseProducts() {
      setLoadingFirebase(true)
      setStatusMessage(
        'Loading all Firebase products...'
      )

      try {
        const snapshot = await getDocs(
          collection(db, 'products')
        )

        if (cancelled) {
          return
        }

        const firestoreProducts =
          snapshot.docs.map((item) => ({
            id: item.id,
            firestoreId: item.id,
            ...item.data(),
          }))

        const firestoreMap = new Map()

        firestoreProducts.forEach((product) => {
          const normalized =
            normalizeProduct(product)

          firestoreMap.set(
            normalized.id,
            normalized
          )

          if (normalized.firestoreId) {
            firestoreMap.set(
              normalized.firestoreId,
              normalized
            )
          }
        })

        const localProducts = Array.isArray(
          productsData
        )
          ? productsData.map(normalizeProduct)
          : []

        /*
        Firestore is the saved source of truth.

        Local MARG data fills products that may not
        yet exist in Firestore.
        */

        const merged = []
        const addedIds = new Set()

        localProducts.forEach((localProduct) => {
          const saved =
            firestoreMap.get(localProduct.id) ||
            firestoreMap.get(
              localProduct.firestoreId
            ) ||
            firestoreProducts.find(
              (item) =>
                item.code &&
                localProduct.code &&
                String(item.code) ===
                  String(localProduct.code)
            )

          const finalProduct = normalizeProduct(
            saved
              ? {
                  ...localProduct,
                  ...saved,
                }
              : localProduct
          )

          if (!addedIds.has(finalProduct.id)) {
            merged.push(finalProduct)
            addedIds.add(finalProduct.id)
          }
        })

        /*
        Add Firestore-only products such as
        manually added products.
        */

        firestoreProducts.forEach((saved) => {
          const normalized =
            normalizeProduct(saved)

          if (!addedIds.has(normalized.id)) {
            merged.push(normalized)
            addedIds.add(normalized.id)
          }
        })

        setAllProducts(merged)

        setFirebaseCount(
          firestoreProducts.length
        )

        setFirebaseLoaded(true)

        setStatusMessage(
          `Firebase: ${firestoreProducts.length.toLocaleString(
            'en-IN'
          )} saved product(s) loaded`
        )
      } catch (error) {
        console.error(
          'Firebase products load failed:',
          error
        )

        setStatusMessage(
          `Firebase load failed: ${error.message}`
        )
      } finally {
        if (!cancelled) {
          setLoadingFirebase(false)
        }
      }
    }

    loadFirebaseProducts()

    return () => {
      cancelled = true
    }
  }, [])

  // ==================================================
  // STATS
  // ==================================================

  const stats = useMemo(() => {
    const total = allProducts.length

    const live = allProducts.filter(
      (product) =>
        product.isLive === true
    ).length

    const needsImage = allProducts.filter(
      (product) =>
        getImageCount(product) === 0
    ).length

    const lowStock = allProducts.filter(
      (product) => {
        const stock =
          getNumber(product.stock)

        return stock >= 0 && stock <= 5
      }
    ).length

    return {
      total,
      live,
      needsImage,
      lowStock,
    }
  }, [allProducts])

  // ==================================================
  // FILTER
  // ==================================================

  const filteredProducts = useMemo(() => {
    const searchText =
      search.trim().toLowerCase()

    return allProducts.filter((product) => {
      if (product.isDeleted === true) {
        return false
      }

      const name = String(
        product.name || ''
      ).toLowerCase()

      const brand = String(
        product.brand ||
          product.company ||
          product.manufacturer ||
          ''
      ).toLowerCase()

      const barcode = String(
        product.barcode || ''
      ).toLowerCase()

      const code = String(
        product.code || ''
      ).toLowerCase()

      const matchesSearch =
        !searchText ||
        name.includes(searchText) ||
        brand.includes(searchText) ||
        barcode.includes(searchText) ||
        code.includes(searchText)

      const matchesCategory =
        !category ||
        String(
          product.category || ''
        ).toLowerCase() ===
          category.toLowerCase()

      let matchesStatus = true

      if (status === 'live') {
        matchesStatus =
          product.isLive === true
      }

      if (status === 'hidden') {
        matchesStatus =
          product.isLive !== true
      }

      if (status === 'no-image') {
        matchesStatus =
          getImageCount(product) === 0
      }

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus
      )
    })
  }, [
    allProducts,
    search,
    status,
    category,
  ])

  // ==================================================
  // PAGINATION
  // ==================================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredProducts.length /
        PRODUCTS_PER_PAGE
    )
  )

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  )

  const startIndex =
    (safeCurrentPage - 1) *
    PRODUCTS_PER_PAGE

  const visibleProducts =
    filteredProducts.slice(
      startIndex,
      startIndex + PRODUCTS_PER_PAGE
    )

  // ==================================================
  // SEARCH / FILTER
  // ==================================================

  const handleSearchChange = (event) => {
    setSearch(event.target.value)
    setCurrentPage(1)
  }

  const handleCategoryChange = (event) => {
    setCategory(event.target.value)
    setCurrentPage(1)
  }

  const handleStatusChange = (event) => {
    setStatus(event.target.value)
    setCurrentPage(1)
  }

  // ==================================================
  // PAGINATION
  // ==================================================

  const handlePrevious = () => {
    setCurrentPage((page) =>
      Math.max(1, page - 1)
    )
  }

  const handleNext = () => {
    setCurrentPage((page) =>
      Math.min(totalPages, page + 1)
    )
  }

  // ==================================================
  // ADD PRODUCT
  // ==================================================

  const handleAddProduct = () => {
    const newProduct = {
      id: `product_${Date.now()}`,
      firestoreId: `product_${Date.now()}`,

      name: '',
      code: '',
      barcode: '',

      brand: '',
      company: '',
      manufacturer: '',

      category: 'Other',
      subcategory: '',

      unit: 'PCS',
      packSize: '',

      stock: '0',
      stockStatus: 'out-of-stock',

      cost: '',
      purchaseRate: '',
      mrp: '',
      salePrice: '',

      websitePrice: '',
      offerPrice: '',
      blinkitReferencePrice: '',

      rackNo: '',

      deal: '0',
      free: '0',
      purchaseDeal: '0',
      purchaseFree: '0',

      images: [],
      mainImage: '',
      video: '',

      description: '',

      isActive: true,
      isLive: false,

      isFeatured: false,
      isBestSeller: false,
      isNewArrival: false,
      isOffer: false,

      isDeleted: false,

      source: 'ADMIN',

      imageReady: false,
      hasImage: false,
      liveReady: false,
    }

    setEditingProduct(newProduct)
  }

  // ==================================================
  // SAVE PRODUCT
  // ==================================================

  const handleSaveProduct =
    async (updatedProduct) => {
      try {
        setStatusMessage(
          'Saving product to Firebase...'
        )

        const cleaned =
          cleanMediaForFirestore(
            normalizeProduct(
              updatedProduct
            )
          )

        const firestoreId =
          cleaned.firestoreId ||
          cleaned.id

        if (!firestoreId) {
          throw new Error(
            'Product ID is missing.'
          )
        }

        /*
        Product without an image must not
        become live/orderable.
        */

        const imageCount =
          getImageCount(cleaned)

        if (imageCount === 0) {
          cleaned.isLive = false
          cleaned.imageReady = false
          cleaned.hasImage = false
          cleaned.liveReady = false
        } else {
          cleaned.imageReady = true
          cleaned.hasImage = true
          cleaned.liveReady =
            String(
              cleaned.name || ''
            ).trim() !== ''
        }

        await setDoc(
          doc(
            db,
            'products',
            firestoreId
          ),
          cleaned,
          {
            merge: true,
          }
        )

        setAllProducts(
          (currentProducts) => {
            const exists =
              currentProducts.some(
                (product) =>
                  product.id ===
                    cleaned.id ||
                  product.firestoreId ===
                    firestoreId
              )

            if (exists) {
              return currentProducts.map(
                (product) =>
                  product.id ===
                      cleaned.id ||
                    product.firestoreId ===
                      firestoreId
                    ? {
                        ...product,
                        ...cleaned,
                        id: firestoreId,
                        firestoreId,
                      }
                    : product
              )
            }

            return [
              {
                ...cleaned,
                id: firestoreId,
                firestoreId,
              },
              ...currentProducts,
            ]
          }
        )

        setEditingProduct(null)

        setStatusMessage(
          '✅ Product saved permanently in Firebase'
        )
      } catch (error) {
        console.error(
          'Product save failed:',
          error
        )

        setStatusMessage(
          `❌ Save failed: ${error.message}`
        )
      }
    }

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="products-admin">
      <div className="products-admin-header">
        <div>
          <span className="admin-section-label">
            PRODUCT MANAGEMENT
          </span>

          <h2>All Products</h2>

          <p>
            Manage your MARG products, prices,
            stock, images and videos from one
            place.
          </p>

          <div
            style={{
              marginTop: '8px',
              fontSize: '13px',
              color:
                loadingFirebase
                  ? '#b7791f'
                  : '#008744',
              fontWeight: 600,
            }}
          >
            {statusMessage}
          </div>
        </div>

        <button
          type="button"
          className="add-product-button"
          onClick={handleAddProduct}
        >
          + Add Product
        </button>
      </div>

      <div className="product-stats">
        <div className="product-stat-card">
          <span>Total Products</span>

          <strong>
            {stats.total.toLocaleString(
              'en-IN'
            )}
          </strong>
        </div>

        <div className="product-stat-card">
          <span>Live Products</span>

          <strong>
            {stats.live.toLocaleString(
              'en-IN'
            )}
          </strong>
        </div>

        <div className="product-stat-card">
          <span>Needs Image</span>

          <strong>
            {stats.needsImage.toLocaleString(
              'en-IN'
            )}
          </strong>
        </div>

        <div className="product-stat-card">
          <span>Low Stock</span>

          <strong>
            {stats.lowStock.toLocaleString(
              'en-IN'
            )}
          </strong>
        </div>
      </div>

      <div className="products-toolbar">
        <div className="product-search">
          <span>⌕</span>

          <input
            type="text"
            value={search}
            onChange={
              handleSearchChange
            }
            placeholder="Search product, barcode, brand, code..."
          />
        </div>

        <select
          value={category}
          onChange={
            handleCategoryChange
          }
        >
          <option value="">
            All Categories
          </option>

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

        <select
          value={status}
          onChange={handleStatusChange}
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

      <div className="products-table-card">
        <div className="products-table-top">
          <div>
            <strong>
              {filteredProducts.length.toLocaleString(
                'en-IN'
              )}
            </strong>

            <span>
              {' '}
              products found
            </span>
          </div>

          <div className="products-page-info">
            Page {safeCurrentPage} of{' '}
            {totalPages}
          </div>
        </div>

        {visibleProducts.length ===
        0 ? (
          <div className="products-no-results">
            <div className="products-empty-icon">
              🔍
            </div>

            <h3>
              No products found
            </h3>

            <p>
              Try another product name,
              barcode, company or filter.
            </p>
          </div>
        ) : (
          <>
            <div className="products-table-wrapper">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>
                      Company / Brand
                    </th>
                    <th>Stock</th>
                    <th>MRP</th>
                    <th>Purchase</th>
                    <th>Sale Rate</th>
                    <th>Barcode</th>
                    <th>Media</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleProducts.map(
                    (product) => {
                      const imageCount =
                        getImageCount(
                          product
                        )

                      const isLive =
                        product.isLive ===
                        true

                      return (
                        <tr
                          key={
                            product.id
                          }
                        >
                          <td>
                            <div className="admin-product-name">
                              <div className="admin-product-image">
                                {imageCount >
                                0 ? (
                                  <img
                                    src={
                                      product
                                        .images[0]
                                    }
                                    alt={
                                      product.name
                                    }
                                  />
                                ) : (
                                  <span>
                                    📦
                                  </span>
                                )}
                              </div>

                              <div>
                                <strong>
                                  {
                                    product.name
                                  }
                                </strong>

                                <small>
                                  Code:{' '}
                                  {product.code ||
                                    '—'}
                                </small>

                                <small>
                                  {product.unit ||
                                    '—'}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="table-company">
                              {getProductBrand(
                                product
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={
                                getNumber(
                                  product.stock
                                ) <= 5
                                  ? 'stock-value low'
                                  : 'stock-value'
                              }
                            >
                              {formatStock(
                                product.stock
                              )}
                            </span>
                          </td>

                          <td>
                            {formatPrice(
                              product.mrp
                            )}
                          </td>

                          <td>
                            {formatPrice(
                              product.purchaseRate
                            )}
                          </td>

                          <td>
                            {formatPrice(
                              product.salePrice
                            )}
                          </td>

                          <td>
                            <span className="barcode-value">
                              {product.barcode ||
                                '—'}
                            </span>
                          </td>

                          <td>
                            <div className="media-status">
                              <span>
                                📷{' '}
                                {imageCount}
                              </span>

                              <span>
                                🎥{' '}
                                {product.video
                                  ? 1
                                  : 0}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={
                                isLive
                                  ? 'product-status live'
                                  : 'product-status hidden'
                              }
                            >
                              {isLive
                                ? 'LIVE'
                                : 'NOT LIVE'}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="edit-product-button"
                              onClick={() =>
                                setEditingProduct(
                                  product
                                )
                              }
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    }
                  )}
                </tbody>
              </table>
            </div>

            <div className="products-pagination">
              <div className="pagination-summary">
                Showing{' '}
                {startIndex + 1}–
                {Math.min(
                  startIndex +
                    PRODUCTS_PER_PAGE,
                  filteredProducts.length
                )}{' '}
                of{' '}
                {filteredProducts.length.toLocaleString(
                  'en-IN'
                )}
              </div>

              <div className="pagination-buttons">
                <button
                  type="button"
                  onClick={
                    handlePrevious
                  }
                  disabled={
                    safeCurrentPage ===
                    1
                  }
                >
                  ← Previous
                </button>

                <span>
                  {safeCurrentPage}
                </span>

                <button
                  type="button"
                  onClick={
                    handleNext
                  }
                  disabled={
                    safeCurrentPage ===
                    totalPages
                  }
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {editingProduct && (
        <AdminProductEditor
          product={editingProduct}
          onClose={() =>
            setEditingProduct(null)
          }
          onSave={
            handleSaveProduct
          }
        />
      )}
    </div>
  )
}
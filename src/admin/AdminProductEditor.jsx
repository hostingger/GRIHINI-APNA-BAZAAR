import { useEffect, useState } from 'react'
import './AdminProductEditor.css'

function cloneProduct(product) {
  return JSON.parse(JSON.stringify(product))
}

function createImagePreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(new Error('Image read failed'))
    }

    reader.readAsDataURL(file)
  })
}

function createVideoPreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(new Error('Video read failed'))
    }

    reader.readAsDataURL(file)
  })
}

export default function AdminProductEditor({
  product,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    cloneProduct({
      ...product,
      images: Array.isArray(product.images)
        ? product.images
        : [],
      video: product.video || '',
    })
  )

  const [history, setHistory] = useState(() => [
    cloneProduct(product),
  ])

  const [historyIndex, setHistoryIndex] = useState(0)

  const [saving, setSaving] = useState(false)
  const [mediaMessage, setMediaMessage] = useState('')

  const updateField = (field, value) => {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      setHistory((currentHistory) => {
        const nextHistory = currentHistory.slice(
          0,
          historyIndex + 1
        )

        nextHistory.push(cloneProduct(next))

        return nextHistory
      })

      setHistoryIndex((currentIndex) => currentIndex + 1)

      return next
    })
  }

  const updateMultipleFields = (values) => {
    setForm((current) => {
      const next = {
        ...current,
        ...values,
      }

      setHistory((currentHistory) => {
        const nextHistory = currentHistory.slice(
          0,
          historyIndex + 1
        )

        nextHistory.push(cloneProduct(next))

        return nextHistory
      })

      setHistoryIndex((currentIndex) => currentIndex + 1)

      return next
    })
  }

  const undo = () => {
    if (historyIndex <= 0) {
      return
    }

    const newIndex = historyIndex - 1

    setHistoryIndex(newIndex)
    setForm(cloneProduct(history[newIndex]))
  }

  const redo = () => {
    if (historyIndex >= history.length - 1) {
      return
    }

    const newIndex = historyIndex + 1

    setHistoryIndex(newIndex)
    setForm(cloneProduct(history[newIndex]))
  }

  useEffect(() => {
    const handleKeyboard = (event) => {
      const target = event.target

      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement

      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'z'

      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        (
          event.key.toLowerCase() === 'y' ||
          (
            event.shiftKey &&
            event.key.toLowerCase() === 'z'
          )
        )

      if (isUndo) {
        event.preventDefault()
        undo()
      }

      if (isRedo) {
        event.preventDefault()
        redo()
      }

      if (
        isTyping &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyboard
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyboard
      )
    }
  })

  const handleImages = async (event) => {
    const files = Array.from(
      event.target.files || []
    )

    event.target.value = ''

    if (!files.length) {
      return
    }

    setMediaMessage(
      `${files.length} image${
        files.length > 1 ? 's' : ''
      } loading...`
    )

    try {
      const validFiles = files.filter(
        (file) =>
          file.type.startsWith('image/')
      )

      const newImages = await Promise.all(
        validFiles.map((file) =>
          createImagePreview(file)
        )
      )

      const images = [
        ...(form.images || []),
        ...newImages,
      ]

      updateField('images', images)

      setMediaMessage(
        `${newImages.length} image${
          newImages.length > 1 ? 's' : ''
        } added successfully.`
      )
    } catch {
      setMediaMessage(
        'Image upload failed.'
      )
    }
  }

  const removeImage = (index) => {
    const images = [
      ...(form.images || []),
    ]

    images.splice(index, 1)

    updateField('images', images)

    setMediaMessage('Image removed.')
  }

  const setMainImage = (index) => {
    const images = [
      ...(form.images || []),
    ]

    if (index <= 0) {
      return
    }

    const [selected] = images.splice(
      index,
      1
    )

    images.unshift(selected)

    updateField('images', images)

    setMediaMessage(
      'Main image changed.'
    )
  }

  const moveImageLeft = (index) => {
    if (index <= 0) {
      return
    }

    const images = [
      ...(form.images || []),
    ]

    const temp = images[index - 1]

    images[index - 1] = images[index]
    images[index] = temp

    updateField('images', images)

    setMediaMessage('Image order updated.')
  }

  const moveImageRight = (index) => {
    const images = [
      ...(form.images || []),
    ]

    if (index >= images.length - 1) {
      return
    }

    const temp = images[index + 1]

    images[index + 1] = images[index]
    images[index] = temp

    updateField('images', images)

    setMediaMessage('Image order updated.')
  }

  const handleVideo = async (event) => {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.type.startsWith('video/')) {
      setMediaMessage(
        'Please select a valid video file.'
      )

      return
    }

    try {
      setMediaMessage('Video loading...')

      const video =
        await createVideoPreview(file)

      updateField('video', video)

      setMediaMessage(
        'Video added successfully.'
      )
    } catch {
      setMediaMessage(
        'Video upload failed.'
      )
    }
  }

  const removeVideo = () => {
    updateField('video', '')

    setMediaMessage('Video removed.')
  }

  const handleSave = async () => {
    if (!form.name?.trim()) {
      setMediaMessage(
        'Product name is required.'
      )

      return
    }

    setSaving(true)

    try {
      const finalProduct = {
        ...form,

        name: form.name.trim(),

        images: Array.isArray(form.images)
          ? form.images
          : [],

        isActive:
          form.isActive !== false,

        isLive:
          form.isLive === true,

        isFeatured:
          form.isFeatured === true,

        isBestSeller:
          form.isBestSeller === true,

        isNewArrival:
          form.isNewArrival === true,

        isOffer:
          form.isOffer === true,

        updatedAt:
          new Date().toISOString(),
      }

      onSave(finalProduct)
    } finally {
      setSaving(false)
    }
  }

  const imageCount = (
    form.images || []
  ).length

  const hasImages = imageCount > 0
  const hasVideo = Boolean(form.video)

  return (
    <div className="product-editor-overlay">
      <div className="product-editor">
        <header className="product-editor-header">
          <div>
            <span className="editor-label">
              PRODUCT EDITOR
            </span>

            <h2>Edit Product</h2>

            <p>
              {form.name || 'Product'}
            </p>
          </div>

          <button
            type="button"
            className="editor-close-button"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="editor-toolbar">
          <div className="editor-history-buttons">
            <button
              type="button"
              onClick={undo}
              disabled={historyIndex === 0}
            >
              ↶ Undo
            </button>

            <button
              type="button"
              onClick={redo}
              disabled={
                historyIndex >=
                history.length - 1
              }
            >
              Redo ↷
            </button>
          </div>

          <span className="editor-history-help">
            Ctrl + Z = Undo&nbsp;&nbsp;•&nbsp;&nbsp;
            Ctrl + Y = Redo
          </span>

          {mediaMessage && (
            <span className="editor-media-message">
              {mediaMessage}
            </span>
          )}
        </div>

        <div className="product-editor-body">
          <section className="editor-section">
            <div className="editor-section-title">
              <span>01</span>

              <div>
                <h3>
                  Product Information
                </h3>

                <p>
                  Product details and
                  identification.
                </p>
              </div>
            </div>

            <div className="editor-grid">
              <label className="editor-field editor-field-full">
                <span>Product Name *</span>

                <input
                  value={form.name || ''}
                  onChange={(event) =>
                    updateField(
                      'name',
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="editor-field">
                <span>Product Code</span>

                <input
                  value={form.code || ''}
                  onChange={(event) =>
                    updateField(
                      'code',
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="editor-field">
                <span>Company / Brand</span>

                <input
                  value={
                    form.company ||
                    form.brand ||
                    ''
                  }
                  onChange={(event) =>
                    updateMultipleFields({
                      company:
                        event.target.value,
                      brand:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="editor-field">
                <span>Manufacturer</span>

                <input
                  value={
                    form.manufacturer ||
                    form.manufact ||
                    ''
                  }
                  onChange={(event) =>
                    updateMultipleFields({
                      manufacturer:
                        event.target.value,
                      manufact:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="editor-field">
                <span>Unit / Pack Size</span>

                <input
                  value={form.unit || ''}
                  onChange={(event) =>
                    updateField(
                      'unit',
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="editor-field">
                <span>Barcode</span>

                <input
                  value={form.barcode || ''}
                  onChange={(event) =>
                    updateField(
                      'barcode',
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="editor-field">
                <span>Rack No.</span>

                <input
                  value={
                    form.rackNo ||
                    form.rackno ||
                    ''
                  }
                  onChange={(event) =>
                    updateMultipleFields({
                      rackNo:
                        event.target.value,
                      rackno:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="editor-field">
                <span>Category</span>

                <select
                  value={form.category || ''}
                  onChange={(event) =>
                    updateField(
                      'category',
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select Category
                  </option>

                  <option value="Atta, Rice & Dal">
                    Atta, Rice & Dal
                  </option>

                  <option value="Oil & Ghee">
                    Oil & Ghee
                  </option>

                  <option value="Masala & Spices">
                    Masala & Spices
                  </option>

                  <option value="Snacks">
                    Snacks
                  </option>

                  <option value="Dairy & Breakfast">
                    Dairy & Breakfast
                  </option>

                  <option value="Personal Care">
                    Personal Care
                  </option>

                  <option value="Home Care">
                    Home Care
                  </option>

                  <option value="Baby Care">
                    Baby Care
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </label>

              <label className="editor-field">
                <span>Subcategory</span>

                <input
                  value={
                    form.subcategory || ''
                  }
                  onChange={(event) =>
                    updateField(
                      'subcategory',
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="editor-field editor-field-full">
                <span>Description</span>

                <textarea
                  value={
                    form.description || ''
                  }
                  onChange={(event) =>
                    updateField(
                      'description',
                      event.target.value
                    )
                  }
                  rows="4"
                  placeholder="Write product description..."
                />
              </label>
            </div>
          </section>

          <section className="editor-section">
            <div className="editor-section-title">
              <span>02</span>

              <div>
                <h3>Pricing</h3>

                <p>
                  Control every price from one
                  place.
                </p>
              </div>
            </div>

            <div className="editor-grid">
              <label className="editor-field">
                <span>MRP</span>

                <div className="price-input">
                  <b>₹</b>

                  <input
                    type="number"
                    step="0.01"
                    value={form.mrp ?? ''}
                    onChange={(event) =>
                      updateField(
                        'mrp',
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <label className="editor-field">
                <span>Purchase Rate</span>

                <div className="price-input">
                  <b>₹</b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.purchaseRate ?? ''
                    }
                    onChange={(event) =>
                      updateField(
                        'purchaseRate',
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <label className="editor-field">
                <span>MARG Sale Rate</span>

                <div className="price-input">
                  <b>₹</b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.salePrice ?? ''
                    }
                    onChange={(event) =>
                      updateField(
                        'salePrice',
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <label className="editor-field">
                <span>Website Price</span>

                <div className="price-input website-price">
                  <b>₹</b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.websitePrice ?? ''
                    }
                    onChange={(event) =>
                      updateField(
                        'websitePrice',
                        event.target.value
                      )
                    }
                    placeholder="Website selling price"
                  />
                </div>
              </label>

              <label className="editor-field">
                <span>Offer Price</span>

                <div className="price-input">
                  <b>₹</b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.offerPrice ?? ''
                    }
                    onChange={(event) =>
                      updateField(
                        'offerPrice',
                        event.target.value
                      )
                    }
                    placeholder="Optional"
                  />
                </div>
              </label>

              <label className="editor-field">
                <span>Blinkit Reference Price</span>

                <div className="price-input">
                  <b>₹</b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.blinkitReferencePrice ??
                      ''
                    }
                    onChange={(event) =>
                      updateField(
                        'blinkitReferencePrice',
                        event.target.value
                      )
                    }
                    placeholder="Reference only"
                  />
                </div>
              </label>
            </div>
          </section>

          <section className="editor-section">
            <div className="editor-section-title">
              <span>03</span>

              <div>
                <h3>Stock Management</h3>

                <p>
                  Manage quantity and stock
                  availability.
                </p>
              </div>
            </div>

            <div className="editor-grid">
              <label className="editor-field">
                <span>Current Stock</span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock ?? ''}
                  onChange={(event) =>
                    updateField(
                      'stock',
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="editor-field">
                <span>Stock Status</span>

                <select
                  value={
                    form.stockStatus ||
                    'auto'
                  }
                  onChange={(event) =>
                    updateField(
                      'stockStatus',
                      event.target.value
                    )
                  }
                >
                  <option value="auto">
                    Automatic
                  </option>

                  <option value="in-stock">
                    In Stock
                  </option>

                  <option value="low-stock">
                    Low Stock
                  </option>

                  <option value="out-of-stock">
                    Out of Stock
                  </option>
                </select>
              </label>
            </div>
          </section>

          <section className="editor-section">
            <div className="editor-section-title">
              <span>04</span>

              <div>
                <h3>Product Photos & Video</h3>

                <p>
                  Upload, arrange and manage
                  product media.
                </p>
              </div>
            </div>

            <div className="media-upload-grid">
              <div className="media-upload-card">
                <div className="media-upload-heading">
                  <div>
                    <strong>
                      Product Photos
                    </strong>

                    <small>
                      Main image should be
                      first.
                    </small>
                  </div>

                  <span>
                    {imageCount} photo
                    {imageCount !== 1
                      ? 's'
                      : ''}
                  </span>
                </div>

                <div className="image-preview-grid">
                  {(
                    form.images || []
                  ).map((image, index) => (
                    <div
                      className={`image-preview ${
                        index === 0
                          ? 'main-image'
                          : ''
                      }`}
                      key={`${image}-${index}`}
                    >
                      <img
                        src={image}
                        alt={`${form.name || 'Product'} ${
                          index + 1
                        }`}
                      />

                      {index === 0 && (
                        <span className="main-image-badge">
                          MAIN
                        </span>
                      )}

                      <div className="image-actions">
                        <button
                          type="button"
                          title="Set as main image"
                          disabled={
                            index === 0
                          }
                          onClick={() =>
                            setMainImage(
                              index
                            )
                          }
                        >
                          ⭐
                        </button>

                        <button
                          type="button"
                          title="Move left"
                          disabled={
                            index === 0
                          }
                          onClick={() =>
                            moveImageLeft(
                              index
                            )
                          }
                        >
                          ←
                        </button>

                        <button
                          type="button"
                          title="Move right"
                          disabled={
                            index ===
                            imageCount - 1
                          }
                          onClick={() =>
                            moveImageRight(
                              index
                            )
                          }
                        >
                          →
                        </button>

                        <button
                          type="button"
                          title="Delete image"
                          onClick={() =>
                            removeImage(
                              index
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}

                  <label className="upload-image-button">
                    <span>＋</span>

                    <strong>
                      Add Photos
                    </strong>

                    <small>
                      JPG, PNG, WEBP
                    </small>

                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={
                        handleImages
                      }
                    />
                  </label>
                </div>

                {!hasImages && (
                  <div className="no-media-message">
                    📷 No product image yet.
                    Upload at least one image
                    before making this product
                    LIVE.
                  </div>
                )}
              </div>

              <div className="media-upload-card">
                <div className="media-upload-heading">
                  <div>
                    <strong>
                      Product Video
                    </strong>

                    <small>
                      Optional product video.
                    </small>
                  </div>

                  <span>
                    {hasVideo
                      ? 'Added'
                      : 'No video'}
                  </span>
                </div>

                {hasVideo ? (
                  <div className="video-preview-box">
                    <video
                      className="product-video-preview"
                      src={form.video}
                      controls
                      playsInline
                    />

                    <button
                      type="button"
                      className="remove-video-button"
                      onClick={
                        removeVideo
                      }
                    >
                      Remove Video
                    </button>
                  </div>
                ) : (
                  <label className="upload-video-button">
                    <span>🎥</span>

                    <strong>
                      Add Product Video
                    </strong>

                    <small>
                      MP4 / WebM
                    </small>

                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      onChange={
                        handleVideo
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          </section>

          <section className="editor-section">
            <div className="editor-section-title">
              <span>05</span>

              <div>
                <h3>Website Controls</h3>

                <p>
                  Control product visibility
                  and website sections.
                </p>
              </div>
            </div>

            <div className="editor-toggle-grid">
              <label className="editor-toggle">
                <input
                  type="checkbox"
                  checked={
                    form.isActive !== false
                  }
                  onChange={(event) =>
                    updateField(
                      'isActive',
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>Active</strong>

                  <small>
                    Product is enabled.
                  </small>
                </span>
              </label>

              <label className="editor-toggle">
                <input
                  type="checkbox"
                  checked={
                    form.isLive === true
                  }
                  onChange={(event) =>
                    updateField(
                      'isLive',
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>Live</strong>

                  <small>
                    Show product on website.
                  </small>
                </span>
              </label>

              <label className="editor-toggle">
                <input
                  type="checkbox"
                  checked={
                    form.isFeatured === true
                  }
                  onChange={(event) =>
                    updateField(
                      'isFeatured',
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>Featured</strong>

                  <small>
                    Show in featured section.
                  </small>
                </span>
              </label>

              <label className="editor-toggle">
                <input
                  type="checkbox"
                  checked={
                    form.isBestSeller === true
                  }
                  onChange={(event) =>
                    updateField(
                      'isBestSeller',
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>Best Seller</strong>

                  <small>
                    Mark as best seller.
                  </small>
                </span>
              </label>

              <label className="editor-toggle">
                <input
                  type="checkbox"
                  checked={
                    form.isNewArrival === true
                  }
                  onChange={(event) =>
                    updateField(
                      'isNewArrival',
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>New Arrival</strong>

                  <small>
                    Mark as new arrival.
                  </small>
                </span>
              </label>

              <label className="editor-toggle">
                <input
                  type="checkbox"
                  checked={
                    form.isOffer === true
                  }
                  onChange={(event) =>
                    updateField(
                      'isOffer',
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>Offer</strong>

                  <small>
                    Enable offer display.
                  </small>
                </span>
              </label>
            </div>

            {!hasImages && (
              <div className="live-warning">
                ⚠️ This product has no image.
                Keep it NOT LIVE until an
                image is uploaded.
              </div>
            )}
          </section>
        </div>

        <footer className="product-editor-footer">
          <button
            type="button"
            className="editor-cancel-button"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="editor-save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Save Product'}
          </button>
        </footer>
      </div>
    </div>
  )
}
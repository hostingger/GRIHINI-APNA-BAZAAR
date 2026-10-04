import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import './AdminProductEditor.css'

import {
  uploadImageToCloudinary,
  uploadVideoToCloudinary,
} from '../utils/cloudinary'


/*
=====================================================
CATEGORIES
=====================================================
*/

const CATEGORIES = [
  'Atta, Rice & Dal',
  'Oil & Ghee',
  'Masala & Spices',
  'Biscuits & Bakery',
  'Snacks',
  'Noodles & Pasta',
  'Tea & Coffee',
  'Dairy & Breakfast',
  'Personal Care',
  'Home Care',
  'Baby Care',
  'Puja & Household',
  'Other',
]


/*
=====================================================
HELPERS
=====================================================
*/

function cloneProduct(product) {
  return JSON.parse(
    JSON.stringify(
      product || {}
    )
  )
}


function safeProduct(product) {
  const value =
    product || {}


  return {
    ...value,

    name:
      value.name ||
      value.productName ||
      value.itemName ||
      '',

    images:
      Array.isArray(
        value.images
      )
        ? value.images.filter(
            Boolean
          )
        : [],

    video:
      value.video || '',

    isActive:
      value.isActive !==
      false,

    isLive:
      value.isLive ===
      true,

    isFeatured:
      value.isFeatured ===
      true,

    isBestSeller:
      value.isBestSeller ===
      true,

    isNewArrival:
      value.isNewArrival ===
      true,

    isOffer:
      value.isOffer ===
      true,
  }
}


function createLocalPreview(
  file
) {
  return URL.createObjectURL(
    file
  )
}


function isImageFile(
  file
) {
  return Boolean(
    file?.type?.startsWith(
      'image/'
    )
  )
}


function isVideoFile(
  file
) {
  return Boolean(
    file?.type?.startsWith(
      'video/'
    )
  )
}


function normalizeImages(
  images
) {
  return Array.isArray(
    images
  )
    ? images.filter(Boolean)
    : []
}


/*
=====================================================
MAIN COMPONENT
=====================================================
*/

export default function
AdminProductEditor({
  product,
  onClose,
  onSave,
}) {

  const initialProduct =
    useMemo(
      () =>
        safeProduct(
          product
        ),
      [product]
    )


  const [
    form,
    setForm,
  ] = useState(
    () =>
      cloneProduct(
        initialProduct
      )
  )


  const [
    history,
    setHistory,
  ] = useState(
    () => [
      cloneProduct(
        initialProduct
      ),
    ]
  )


  const [
    historyIndex,
    setHistoryIndex,
  ] = useState(0)


  const [
    saving,
    setSaving,
  ] = useState(false)


  const [
    mediaMessage,
    setMediaMessage,
  ] = useState('')


  const [
    dragActive,
    setDragActive,
  ] = useState(false)


  const [
    videoDragActive,
    setVideoDragActive,
  ] = useState(false)


  const [
    uploading,
    setUploading,
  ] = useState({})


  const imageInputRef =
    useRef(null)

  const videoInputRef =
    useRef(null)

  const mountedRef =
    useRef(true)

  const uploadFilesRef =
    useRef({})


  /*
  =====================================================
  MOUNT
  =====================================================
  */

  useEffect(() => {
    mountedRef.current =
      true

    return () => {
      mountedRef.current =
        false
    }
  }, [])


  /*
  =====================================================
  RESET WHEN PRODUCT CHANGES
  =====================================================
  */

  useEffect(() => {
    const next =
      safeProduct(
        product
      )

    setForm(
      cloneProduct(
        next
      )
    )

    setHistory([
      cloneProduct(
        next
      ),
    ])

    setHistoryIndex(0)

    setUploading({})

    setMediaMessage('')

    uploadFilesRef.current =
      {}
  }, [product])


  /*
  =====================================================
  HISTORY
  =====================================================
  */

  const pushHistory =
    (next) => {
      setHistory(
        (current) => {
          const trimmed =
            current.slice(
              0,
              historyIndex + 1
            )

          trimmed.push(
            cloneProduct(
              next
            )
          )

          return trimmed
        }
      )

      setHistoryIndex(
        (current) =>
          current + 1
      )
    }


  const updateField =
    (
      field,
      value
    ) => {
      setForm(
        (current) => {
          const next = {
            ...current,
            [field]: value,
          }

          pushHistory(
            next
          )

          return next
        }
      )
    }


  const updateMultipleFields =
    (values) => {
      setForm(
        (current) => {
          const next = {
            ...current,
            ...values,
          }

          pushHistory(
            next
          )

          return next
        }
      )
    }


  const undo = () => {
    if (
      historyIndex <= 0
    ) {
      return
    }


    const nextIndex =
      historyIndex - 1


    setHistoryIndex(
      nextIndex
    )


    setForm(
      cloneProduct(
        history[
          nextIndex
        ]
      )
    )


    setMediaMessage(
      'Undo applied.'
    )
  }


  const redo = () => {
    if (
      historyIndex >=
      history.length - 1
    ) {
      return
    }


    const nextIndex =
      historyIndex + 1


    setHistoryIndex(
      nextIndex
    )


    setForm(
      cloneProduct(
        history[
          nextIndex
        ]
      )
    )


    setMediaMessage(
      'Redo applied.'
    )
  }


  /*
  =====================================================
  KEYBOARD SHORTCUTS
  =====================================================
  */

  useEffect(() => {

    const handleKeyboard =
      (event) => {

        const key =
          event.key.toLowerCase()


        const modifier =
          event.ctrlKey ||
          event.metaKey


        if (!modifier) {
          return
        }


        if (
          key === 'z' &&
          !event.shiftKey
        ) {
          event.preventDefault()

          undo()

          return
        }


        if (
          key === 'y' ||
          (
            key === 'z' &&
            event.shiftKey
          )
        ) {
          event.preventDefault()

          redo()
        }
      }


    window.addEventListener(
      'keydown',
      handleKeyboard
    )


    return () =>
      window.removeEventListener(
        'keydown',
        handleKeyboard
      )

  })


  /*
  =====================================================
  REPLACE TEMP IMAGE WITH
  PERMANENT CLOUDINARY URL
  =====================================================
  */

  const replaceImageUrl =
    (
      previewUrl,
      permanentUrl
    ) => {

      setForm(
        (current) => {

          const images =
            normalizeImages(
              current.images
            ).map(
              (image) =>
                image ===
                previewUrl
                  ? permanentUrl
                  : image
            )


          return {
            ...current,
            images,
          }
        }
      )
    }


  /*
  =====================================================
  UPLOAD ONE IMAGE
  =====================================================
  */

  const uploadOneImage =
    async (
      file,
      previewUrl
    ) => {

      const key =
        previewUrl


      uploadFilesRef.current[
        key
      ] = file


      setUploading(
        (current) => ({
          ...current,

          [key]: {
            type:
              'image',

            progress:
              0,

            status:
              'preparing',
          },
        })
      )


      try {

        const permanentUrl =
          await uploadImageToCloudinary(
            file,
            {
              onProgress:
                (
                  progress
                ) => {

                  if (
                    !mountedRef.current
                  ) {
                    return
                  }


                  setUploading(
                    (current) => ({
                      ...current,

                      [key]: {
                        type:
                          'image',

                        progress,

                        status:
                          'uploading',
                      },
                    })
                  )
                },
            }
          )


        replaceImageUrl(
          previewUrl,
          permanentUrl
        )


        if (
          mountedRef.current
        ) {

          setUploading(
            (current) => {

              const next =
                {
                  ...current,
                }

              delete next[
                key
              ]

              return next
            }
          )


          setMediaMessage(
            'Image uploaded successfully.'
          )
        }


        URL.revokeObjectURL(
          previewUrl
        )


        delete uploadFilesRef
          .current[
            key
          ]

      } catch (
        error
      ) {

        if (
          !mountedRef.current
        ) {
          return
        }


        setUploading(
          (current) => ({
            ...current,

            [key]: {
              type:
                'image',

              progress:
                0,

              status:
                'error',

              error:
                error?.message ||
                'Upload failed.',
            },
          })
        )


        setMediaMessage(
          error?.message ||
          'Image upload failed.'
        )
      }
    }


  /*
  =====================================================
  ADD IMAGE FILES
  =====================================================
  */

  const addImageFiles =
    (files) => {

      const validFiles =
        Array.from(
          files || []
        ).filter(
          isImageFile
        )


      if (
        !validFiles.length
      ) {

        setMediaMessage(
          'Please select valid JPG, PNG or WEBP image files.'
        )

        return
      }


      const entries =
        validFiles.map(
          (file) => ({
            file,

            previewUrl:
              createLocalPreview(
                file
              ),
          })
        )


      setForm(
        (current) => ({
          ...current,

          images: [
            ...normalizeImages(
              current.images
            ),

            ...entries.map(
              (
                item
              ) =>
                item.previewUrl
            ),
          ],
        })
      )


      setMediaMessage(
        `${entries.length} image${
          entries.length >
          1
            ? 's'
            : ''
        } added. Uploading...`
      )


      entries.forEach(
        ({
          file,
          previewUrl,
        }) => {

          uploadOneImage(
            file,
            previewUrl
          )
        }
      )
    }


  /*
  =====================================================
  FILE INPUT
  =====================================================
  */

  const handleImages =
    (event) => {

      const files =
        Array.from(
          event.target
            .files || []
        )


      event.target.value =
        ''


      if (
        files.length
      ) {
        addImageFiles(
          files
        )
      }
    }


  /*
  =====================================================
  IMAGE DROP
  =====================================================
  */

  const handleImageDrop =
    (event) => {

      event.preventDefault()
      event.stopPropagation()

      setDragActive(
        false
      )


      const files =
        Array.from(
          event.dataTransfer
            .files || []
        )


      if (
        files.length
      ) {
        addImageFiles(
          files
        )
      }
    }


  const handleImageDragOver =
    (event) => {

      event.preventDefault()
      event.stopPropagation()

      setDragActive(
        true
      )
    }


  const handleImageDragLeave =
    (event) => {

      event.preventDefault()
      event.stopPropagation()

      setDragActive(
        false
      )
    }


  /*
  =====================================================
  RETRY IMAGE
  =====================================================
  */

  const retryImage =
    (image) => {

      const file =
        uploadFilesRef
          .current[
            image
          ]


      if (!file) {

        setMediaMessage(
          'Please select the image again to retry.'
        )

        return
      }


      uploadOneImage(
        file,
        image
      )
    }


  /*
  =====================================================
  REMOVE IMAGE
  =====================================================
  */

  const removeImage =
    (index) => {

      const images = [
        ...normalizeImages(
          form.images
        ),
      ]


      const removed =
        images[index]


      images.splice(
        index,
        1
      )


      if (
        removed?.startsWith(
          'blob:'
        )
      ) {

        URL.revokeObjectURL(
          removed
        )


        delete uploadFilesRef
          .current[
            removed
          ]


        setUploading(
          (current) => {

            const next =
              {
                ...current,
              }

            delete next[
              removed
            ]

            return next
          }
        )
      }


      updateField(
        'images',
        images
      )


      setMediaMessage(
        'Image removed.'
      )
    }


  /*
  =====================================================
  MAIN IMAGE
  =====================================================
  */

  const setMainImage =
    (index) => {

      const images = [
        ...normalizeImages(
          form.images
        ),
      ]


      if (
        index <= 0 ||
        index >=
          images.length
      ) {
        return
      }


      const [
        selected,
      ] =
        images.splice(
          index,
          1
        )


      images.unshift(
        selected
      )


      updateField(
        'images',
        images
      )


      setMediaMessage(
        'Main image changed.'
      )
    }


  /*
  =====================================================
  MOVE IMAGE LEFT
  =====================================================
  */

  const moveImageLeft =
    (index) => {

      if (
        index <= 0
      ) {
        return
      }


      const images = [
        ...normalizeImages(
          form.images
        ),
      ]


      ;[
        images[
          index - 1
        ],
        images[index],
      ] = [
        images[index],
        images[
          index - 1
        ],
      ]


      updateField(
        'images',
        images
      )


      setMediaMessage(
        'Image order updated.'
      )
    }


  /*
  =====================================================
  MOVE IMAGE RIGHT
  =====================================================
  */

  const moveImageRight =
    (index) => {

      const images = [
        ...normalizeImages(
          form.images
        ),
      ]


      if (
        index >=
        images.length - 1
      ) {
        return
      }


      ;[
        images[
          index + 1
        ],
        images[index],
      ] = [
        images[index],
        images[
          index + 1
        ],
      ]


      updateField(
        'images',
        images
      )


      setMediaMessage(
        'Image order updated.'
      )
    }


  /*
  =====================================================
  VIDEO
  =====================================================
  */

  const addVideoFile =
    async (
      file
    ) => {

      if (
        !isVideoFile(
          file
        )
      ) {

        setMediaMessage(
          'Please select a valid MP4, WebM or MOV video.'
        )

        return
      }


      const previewUrl =
        createLocalPreview(
          file
        )


      const uploadKey =
        `video:${previewUrl}`


      const oldVideo =
        form.video || ''


      if (
        oldVideo.startsWith(
          'blob:'
        )
      ) {
        URL.revokeObjectURL(
          oldVideo
        )
      }


      updateField(
        'video',
        previewUrl
      )


      uploadFilesRef
        .current[
          uploadKey
        ] = file


      setUploading(
        (current) => ({
          ...current,

          [uploadKey]: {
            type:
              'video',

            progress:
              0,

            status:
              'uploading',
          },
        })
      )


      setMediaMessage(
        'Video added. Uploading...'
      )


      try {

        const permanentUrl =
          await uploadVideoToCloudinary(
            file,
            {
              onProgress:
                (
                  progress
                ) => {

                  if (
                    !mountedRef.current
                  ) {
                    return
                  }


                  setUploading(
                    (current) => ({
                      ...current,

                      [uploadKey]: {
                        type:
                          'video',

                        progress,

                        status:
                          'uploading',
                      },
                    })
                  )
                },
            }
          )


        if (
          !mountedRef.current
        ) {
          return
        }


        setForm(
          (current) => ({
            ...current,

            video:
              current.video ===
              previewUrl
                ? permanentUrl
                : current.video,
          })
        )


        setUploading(
          (current) => {

            const next =
              {
                ...current,
              }

            delete next[
              uploadKey
            ]

            return next
          }
        )


        delete uploadFilesRef
          .current[
            uploadKey
          ]


        URL.revokeObjectURL(
          previewUrl
        )


        setMediaMessage(
          'Video uploaded successfully.'
        )

      } catch (
        error
      ) {

        if (
          !mountedRef.current
        ) {
          return
        }


        setUploading(
          (current) => ({
            ...current,

            [uploadKey]: {
              type:
                'video',

              progress:
                0,

              status:
                'error',

              error:
                error?.message ||
                'Video upload failed.',
            },
          })
        )


        setMediaMessage(
          error?.message ||
          'Video upload failed.'
        )
      }
    }


  const handleVideo =
    (event) => {

      const file =
        event.target
          .files?.[0]


      event.target.value =
        ''


      if (file) {
        addVideoFile(
          file
        )
      }
    }


  const handleVideoDrop =
    (event) => {

      event.preventDefault()
      event.stopPropagation()

      setVideoDragActive(
        false
      )


      const file =
        event.dataTransfer
          .files?.[0]


      if (file) {
        addVideoFile(
          file
        )
      }
    }


  const handleVideoDragOver =
    (event) => {

      event.preventDefault()
      event.stopPropagation()

      setVideoDragActive(
        true
      )
    }


  const handleVideoDragLeave =
    (event) => {

      event.preventDefault()
      event.stopPropagation()

      setVideoDragActive(
        false
      )
    }


  const removeVideo =
    () => {

      const oldVideo =
        form.video || ''


      if (
        oldVideo.startsWith(
          'blob:'
        )
      ) {
        URL.revokeObjectURL(
          oldVideo
        )
      }


      updateField(
        'video',
        ''
      )


      setMediaMessage(
        'Video removed.'
      )
    }


  /*
  =====================================================
  UPLOAD STATUS
  =====================================================
  */

  const pendingUploads =
    Object.values(
      uploading
    ).filter(
      (item) =>
        item.status ===
          'preparing' ||
        item.status ===
          'uploading'
    )


  const failedUploads =
    Object.values(
      uploading
    ).filter(
      (item) =>
        item.status ===
        'error'
    )


  /*
  =====================================================
  SAVE
  =====================================================
  */

  const handleSave =
    async () => {

      if (
        !form.name?.trim()
      ) {

        setMediaMessage(
          'Product name is required.'
        )

        return
      }


      if (
        pendingUploads.length >
        0
      ) {

        setMediaMessage(
          'Please wait for all media uploads to finish.'
        )

        return
      }


      if (
        failedUploads.length >
        0
      ) {

        setMediaMessage(
          'One or more media uploads failed. Remove the failed item and upload it again.'
        )

        return
      }


      const images =
        normalizeImages(
          form.images
        ).filter(
          (image) =>
            !image.startsWith(
              'blob:'
            )
        )


      const finalProduct =
        {
          ...form,

          name:
            form.name.trim(),

          images,

          isActive:
            form.isActive !==
            false,

          isLive:
            images.length >
              0 &&
            form.isLive ===
              true,

          isFeatured:
            form.isFeatured ===
            true,

          isBestSeller:
            form.isBestSeller ===
            true,

          isNewArrival:
            form.isNewArrival ===
            true,

          isOffer:
            form.isOffer ===
            true,

          category:
            String(
              form.category ||
                ''
            ).trim(),

          updatedAt:
            new Date()
              .toISOString(),
        }


      setSaving(
        true
      )


      try {

        await onSave(
          finalProduct
        )

      } catch (
        error
      ) {

        console.error(
          'Save failed:',
          error
        )


        setMediaMessage(
          error?.message ||
          'Save failed.'
        )

      } finally {

        if (
          mountedRef.current
        ) {
          setSaving(
            false
          )
        }
      }
    }


  /*
  =====================================================
  CLEANUP
  =====================================================
  */

  useEffect(() => {

    return () => {

      normalizeImages(
        form.images
      ).forEach(
        (image) => {

          if (
            image.startsWith(
              'blob:'
            )
          ) {
            URL.revokeObjectURL(
              image
            )
          }
        }
      )


      if (
        form.video?.startsWith(
          'blob:'
        )
      ) {
        URL.revokeObjectURL(
          form.video
        )
      }
    }

  }, [])


  /*
  =====================================================
  VALUES
  =====================================================
  */

  const images =
    normalizeImages(
      form.images
    )


  const imageCount =
    images.length


  const hasImages =
    imageCount > 0


  const hasVideo =
    Boolean(
      form.video
    )


  /*
  =====================================================
  UI
  =====================================================
  */

  return (
    <div className="product-editor-overlay">

      <div className="product-editor">

        {/* HEADER */}

        <header className="product-editor-header">

          <div>

            <span className="editor-label">
              PRODUCT EDITOR
            </span>

            <h2>
              {product?.id
                ? 'Edit Product'
                : 'Add Product'}
            </h2>

            <p>
              {form.name ||
                'New Product'}
            </p>

          </div>


          <button
            type="button"
            className="editor-close-button"
            onClick={
              onClose
            }
            disabled={
              saving
            }
          >
            ✕
          </button>

        </header>


        {/* TOOLBAR */}

        <div className="editor-toolbar">

          <div className="editor-history-buttons">

            <button
              type="button"
              onClick={
                undo
              }
              disabled={
                historyIndex ===
                0
              }
            >
              ↶ Undo
            </button>


            <button
              type="button"
              onClick={
                redo
              }
              disabled={
                historyIndex >=
                history.length -
                  1
              }
            >
              Redo ↷
            </button>

          </div>


          <span className="editor-history-help">
            Ctrl + Z = Undo
            &nbsp;&nbsp;•&nbsp;&nbsp;
            Ctrl + Y = Redo
          </span>


          {mediaMessage && (
            <span className="editor-media-message">
              {mediaMessage}
            </span>
          )}

        </div>


        {/* BODY */}

        <div className="product-editor-body">

          {/* =================================================
              01 PRODUCT INFORMATION
          ================================================= */}

          <section className="editor-section">

            <div className="editor-section-title">

              <span>
                01
              </span>

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

                <span>
                  Product Name *
                </span>

                <input
                  value={
                    form.name ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'name',
                      event.target
                        .value
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Product Code
                </span>

                <input
                  value={
                    form.code ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'code',
                      event.target
                        .value
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Company / Brand
                </span>

                <input
                  value={
                    form.company ||
                    form.brand ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateMultipleFields(
                      {
                        company:
                          event.target
                            .value,

                        brand:
                          event.target
                            .value,
                      }
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Manufacturer
                </span>

                <input
                  value={
                    form.manufacturer ||
                    form.manufact ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateMultipleFields(
                      {
                        manufacturer:
                          event.target
                            .value,

                        manufact:
                          event.target
                            .value,
                      }
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Unit
                </span>

                <input
                  value={
                    form.unit ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'unit',
                      event.target
                        .value
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Pack Size
                </span>

                <input
                  value={
                    form.packSize ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'packSize',
                      event.target
                        .value
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Barcode
                </span>

                <input
                  value={
                    form.barcode ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'barcode',
                      event.target
                        .value
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Rack No.
                </span>

                <input
                  value={
                    form.rackNo ||
                    form.rackno ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateMultipleFields(
                      {
                        rackNo:
                          event.target
                            .value,

                        rackno:
                          event.target
                            .value,
                      }
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Category
                </span>

                <select
                  value={
                    form.category ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'category',
                      event.target
                        .value
                    )
                  }
                >

                  <option value="">
                    Select Category
                  </option>


                  {CATEGORIES.map(
                    (
                      item
                    ) => (
                      <option
                        key={
                          item
                        }
                        value={
                          item
                        }
                      >
                        {item}
                      </option>
                    )
                  )}

                </select>

              </label>


              <label className="editor-field">

                <span>
                  Subcategory
                </span>

                <input
                  value={
                    form.subcategory ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'subcategory',
                      event.target
                        .value
                    )
                  }
                />

              </label>


              <label className="editor-field editor-field-full">

                <span>
                  Description
                </span>

                <textarea
                  value={
                    form.description ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'description',
                      event.target
                        .value
                    )
                  }
                  rows="4"
                  placeholder="Write product description..."
                />

              </label>

            </div>

          </section>


          {/* =================================================
              02 PRICING
          ================================================= */}

          <section className="editor-section">

            <div className="editor-section-title">

              <span>
                02
              </span>

              <div>

                <h3>
                  Pricing
                </h3>

                <p>
                  Control every price
                  from one place.
                </p>

              </div>

            </div>


            <div className="editor-grid">

              <label className="editor-field">

                <span>
                  MRP
                </span>

                <div className="price-input">

                  <b>
                    ₹
                  </b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.mrp ??
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        'mrp',
                        event.target
                          .value
                      )
                    }
                  />

                </div>

              </label>


              <label className="editor-field">

                <span>
                  Purchase Rate
                </span>

                <div className="price-input">

                  <b>
                    ₹
                  </b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.purchaseRate ??
                      form.pur_rate ??
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      updateMultipleFields(
                        {
                          purchaseRate:
                            event.target
                              .value,

                          pur_rate:
                            event.target
                              .value,
                        }
                      )
                    }
                  />

                </div>

              </label>


              <label className="editor-field">

                <span>
                  MARG Sale Rate
                </span>

                <div className="price-input">

                  <b>
                    ₹
                  </b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.salePrice ??
                      form.rate ??
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      updateMultipleFields(
                        {
                          salePrice:
                            event.target
                              .value,

                          rate:
                            event.target
                              .value,
                        }
                      )
                    }
                  />

                </div>

              </label>


              <label className="editor-field">

                <span>
                  Website Price
                </span>

                <div className="price-input website-price">

                  <b>
                    ₹
                  </b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.websitePrice ??
                      form.finalOnlinePrice ??
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      updateMultipleFields(
                        {
                          websitePrice:
                            event.target
                              .value,

                          finalOnlinePrice:
                            event.target
                              .value,
                        }
                      )
                    }
                    placeholder="Website selling price"
                  />

                </div>

              </label>


              <label className="editor-field">

                <span>
                  Offer Price
                </span>

                <div className="price-input">

                  <b>
                    ₹
                  </b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.offerPrice ??
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        'offerPrice',
                        event.target
                          .value
                      )
                    }
                  />

                </div>

              </label>


              <label className="editor-field">

                <span>
                  Blinkit Reference
                </span>

                <div className="price-input">

                  <b>
                    ₹
                  </b>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      form.blinkitReference ??
                      form.blinkitPrice ??
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      updateMultipleFields(
                        {
                          blinkitReference:
                            event.target
                              .value,

                          blinkitPrice:
                            event.target
                              .value,
                        }
                      )
                    }
                  />

                </div>

              </label>

            </div>

          </section>


          {/* =================================================
              03 STOCK
          ================================================= */}

          <section className="editor-section">

            <div className="editor-section-title">

              <span>
                03
              </span>

              <div>

                <h3>
                  Stock & Inventory
                </h3>

                <p>
                  Keep online stock connected
                  to your MARG data.
                </p>

              </div>

            </div>


            <div className="editor-grid">

              <label className="editor-field">

                <span>
                  Current Stock
                </span>

                <input
                  type="number"
                  step="1"
                  value={
                    form.stock ??
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'stock',
                      event.target
                        .value
                    )
                  }
                />

              </label>


              <label className="editor-field">

                <span>
                  Stock Status
                </span>

                <select
                  value={
                    form.stockStatus ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'stockStatus',
                      event.target
                        .value
                    )
                  }
                >

                  <option value="">
                    Auto
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


          {/* =================================================
              04 MEDIA
          ================================================= */}

          <section className="editor-section">

            <div className="editor-section-title">

              <span>
                04
              </span>

              <div>

                <h3>
                  Product Photos & Video
                </h3>

                <p>
                  Upload, drag, arrange and
                  manage product media.
                  Images are permanently
                  uploaded to Cloudinary.
                </p>

              </div>

            </div>


            <div className="media-upload-grid">

              {/* IMAGE CARD */}

              <div className="media-upload-card">

                <div className="media-upload-heading">

                  <div>

                    <strong>
                      Product Photos
                    </strong>

                    <small>
                      Select multiple images
                      or drag & drop.
                    </small>

                  </div>

                  <span>
                    {imageCount}
                    {' '}
                    photo
                    {imageCount !==
                    1
                      ? 's'
                      : ''}
                  </span>

                </div>


                <div
                  className={
                    dragActive
                      ? 'image-drop-zone drag-active'
                      : 'image-drop-zone'
                  }
                  onDragEnter={
                    handleImageDragOver
                  }
                  onDragOver={
                    handleImageDragOver
                  }
                  onDragLeave={
                    handleImageDragLeave
                  }
                  onDrop={
                    handleImageDrop
                  }
                >

                  <div className="image-preview-grid">

                    {images.map(
                      (
                        image,
                        index
                      ) => {

                        const status =
                          uploading[
                            image
                          ]


                        return (
                          <div
                            className={
                              index ===
                              0
                                ? 'image-preview main-image'
                                : 'image-preview'
                            }
                            key={`${image}-${index}`}
                          >

                            <img
                              src={
                                image
                              }
                              alt={`${form.name || 'Product'} ${index + 1}`}
                            />


                            {index ===
                              0 && (
                              <span className="main-image-badge">
                                MAIN
                              </span>
                            )}


                            {status && (
                              <div className="upload-status-overlay">

                                <strong>

                                  {status.status ===
                                  'preparing'
                                    ? 'Preparing…'
                                    : status.status ===
                                      'uploading'
                                    ? `Uploading ${status.progress}%`
                                    : 'Upload failed'}

                                </strong>


                                {status.status ===
                                  'uploading' && (
                                  <div className="upload-progress">

                                    <i
                                      style={{
                                        width: `${status.progress}%`,
                                      }}
                                    />

                                  </div>
                                )}


                                {status.status ===
                                  'error' && (
                                  <small>
                                    {status.error}
                                  </small>
                                )}

                              </div>
                            )}


                            <div className="image-actions">

                              {index >
                                0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMainImage(
                                      index
                                    )
                                  }
                                  title="Make main image"
                                >
                                  ★
                                </button>
                              )}


                              {index >
                                0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveImageLeft(
                                      index
                                    )
                                  }
                                  title="Move left"
                                >
                                  ←
                                </button>
                              )}


                              {index <
                                images.length -
                                  1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveImageRight(
                                      index
                                    )
                                  }
                                  title="Move right"
                                >
                                  →
                                </button>
                              )}


                              {status?.status ===
                                'error' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    retryImage(
                                      image
                                    )
                                  }
                                  title="Retry"
                                >
                                  ↻
                                </button>
                              )}


                              <button
                                type="button"
                                onClick={() =>
                                  removeImage(
                                    index
                                  )
                                }
                                title="Delete"
                              >
                                ×
                              </button>

                            </div>

                          </div>
                        )
                      }
                    )}


                    {/* ADD PHOTO */}

                    <label className="upload-image-button">

                      <span>
                        ＋
                      </span>

                      <strong>
                        Add Photos
                      </strong>

                      <small>
                        JPG / PNG / WEBP
                      </small>


                      <input
                        ref={
                          imageInputRef
                        }
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/*"
                        multiple
                        onChange={
                          handleImages
                        }
                      />

                    </label>

                  </div>


                  <div className="drag-upload-info">

                    <span>
                      🖼️
                    </span>

                    <strong>
                      {dragActive
                        ? 'Drop images here'
                        : 'Drag & Drop images here'}
                    </strong>

                    <small>
                      or click “Add Photos”
                    </small>

                  </div>

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


              {/* VIDEO CARD */}

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
                      src={
                        form.video
                      }
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

                  <div
                    className={
                      videoDragActive
                        ? 'video-drop-zone drag-active'
                        : 'video-drop-zone'
                    }
                    onDragEnter={
                      handleVideoDragOver
                    }
                    onDragOver={
                      handleVideoDragOver
                    }
                    onDragLeave={
                      handleVideoDragLeave
                    }
                    onDrop={
                      handleVideoDrop
                    }
                  >

                    <label className="upload-video-button">

                      <span>
                        🎥
                      </span>

                      <strong>
                        Add Product Video
                      </strong>

                      <small>
                        MP4 / WebM / MOV
                      </small>


                      <input
                        ref={
                          videoInputRef
                        }
                        type="file"
                        accept="video/*"
                        onChange={
                          handleVideo
                        }
                      />

                    </label>


                    <div className="drag-upload-info">

                      <strong>
                        {videoDragActive
                          ? 'Drop video here'
                          : 'Drag & Drop video here'}
                      </strong>

                      <small>
                        or click to select
                      </small>

                    </div>

                  </div>

                )}

              </div>

            </div>

          </section>


          {/* =================================================
              05 WEBSITE CONTROLS
          ================================================= */}

          <section className="editor-section">

            <div className="editor-section-title">

              <span>
                05
              </span>

              <div>

                <h3>
                  Website Controls
                </h3>

                <p>
                  Control product visibility
                  and website sections.
                </p>

              </div>

            </div>


            <div className="editor-toggle-grid">

              {/* ACTIVE */}

              <label className="editor-toggle">

                <input
                  type="checkbox"
                  checked={
                    form.isActive !==
                    false
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'isActive',
                      event.target
                        .checked
                    )
                  }
                />

                <span>

                  <strong>
                    Active
                  </strong>

                  <small>
                    Product is enabled.
                  </small>

                </span>

              </label>


              {/* LIVE */}

              <label
                className={
                  hasImages
                    ? 'editor-toggle'
                    : 'editor-toggle disabled'
                }
              >

                <input
                  type="checkbox"
                  checked={
                    hasImages &&
                    form.isLive ===
                      true
                  }
                  disabled={
                    !hasImages
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'isLive',
                      event.target
                        .checked
                    )
                  }
                />

                <span>

                  <strong>
                    Live
                  </strong>

                  <small>
                    {hasImages
                      ? 'Show product on website.'
                      : 'Image required before LIVE.'}
                  </small>

                </span>

              </label>


              {/* FEATURED */}

              <label className="editor-toggle">

                <input
                  type="checkbox"
                  checked={
                    form.isFeatured ===
                    true
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'isFeatured',
                      event.target
                        .checked
                    )
                  }
                />

                <span>

                  <strong>
                    Featured
                  </strong>

                  <small>
                    Show in featured section.
                  </small>

                </span>

              </label>


              {/* BEST SELLER */}

              <label className="editor-toggle">

                <input
                  type="checkbox"
                  checked={
                    form.isBestSeller ===
                    true
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'isBestSeller',
                      event.target
                        .checked
                    )
                  }
                />

                <span>

                  <strong>
                    Best Seller
                  </strong>

                  <small>
                    Mark as best seller.
                  </small>

                </span>

              </label>


              {/* NEW ARRIVAL */}

              <label className="editor-toggle">

                <input
                  type="checkbox"
                  checked={
                    form.isNewArrival ===
                    true
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'isNewArrival',
                      event.target
                        .checked
                    )
                  }
                />

                <span>

                  <strong>
                    New Arrival
                  </strong>

                  <small>
                    Mark as new arrival.
                  </small>

                </span>

              </label>


              {/* OFFER */}

              <label className="editor-toggle">

                <input
                  type="checkbox"
                  checked={
                    form.isOffer ===
                    true
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      'isOffer',
                      event.target
                        .checked
                    )
                  }
                />

                <span>

                  <strong>
                    Offer
                  </strong>

                  <small>
                    Enable offer display.
                  </small>

                </span>

              </label>

            </div>


            {!hasImages && (
              <div className="live-warning">

                ⚠️ This product has no image.
                It cannot be made LIVE until
                an image is added.

              </div>
            )}

          </section>

        </div>


        {/* FOOTER */}

        <footer className="product-editor-footer">

          <button
            type="button"
            className="editor-cancel-button"
            onClick={
              onClose
            }
            disabled={
              saving
            }
          >
            Cancel
          </button>


          <button
            type="button"
            className="editor-save-button"
            onClick={
              handleSave
            }
            disabled={
              saving ||
              pendingUploads.length >
                0
            }
          >

            {pendingUploads.length >
            0
              ? `Uploading ${pendingUploads.length} media…`
              : saving
                ? 'Saving...'
                : 'Save Product'}

          </button>

        </footer>

      </div>

    </div>
  )
}
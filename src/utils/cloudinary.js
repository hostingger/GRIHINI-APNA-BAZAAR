const CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME

const UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET


function ensureConfig() {
  if (
    !CLOUD_NAME ||
    !UPLOAD_PRESET
  ) {
    throw new Error(
      'Cloudinary settings are missing. Check .env.local and restart the Vite server.'
    )
  }
}


/*
=====================================================
LOAD IMAGE
=====================================================
*/

function loadImage(file) {
  return new Promise(
    (resolve, reject) => {
      const url =
        URL.createObjectURL(file)

      const image =
        new Image()

      image.onload = () => {
        URL.revokeObjectURL(url)
        resolve(image)
      }

      image.onerror = () => {
        URL.revokeObjectURL(url)

        reject(
          new Error(
            'Image could not be read.'
          )
        )
      }

      image.src = url
    }
  )
}


/*
=====================================================
COMPRESS IMAGE
=====================================================
*/

async function compressImage(
  file
) {
  const image =
    await loadImage(file)

  const maxSide = 1600

  const sourceWidth =
    image.naturalWidth ||
    image.width

  const sourceHeight =
    image.naturalHeight ||
    image.height

  const scale =
    Math.min(
      1,
      maxSide /
        Math.max(
          sourceWidth,
          sourceHeight
        )
    )

  const width =
    Math.max(
      1,
      Math.round(
        sourceWidth * scale
      )
    )

  const height =
    Math.max(
      1,
      Math.round(
        sourceHeight * scale
      )
    )


  const canvas =
    document.createElement(
      'canvas'
    )

  canvas.width = width
  canvas.height = height


  const context =
    canvas.getContext(
      '2d',
      {
        alpha: false,
      }
    )


  if (!context) {
    throw new Error(
      'Browser image processing is unavailable.'
    )
  }


  context.imageSmoothingEnabled =
    true

  context.imageSmoothingQuality =
    'high'

  context.fillStyle =
    '#ffffff'

  context.fillRect(
    0,
    0,
    width,
    height
  )

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  )


  const blob =
    await new Promise(
      (
        resolve,
        reject
      ) => {
        canvas.toBlob(
          (value) => {
            if (value) {
              resolve(value)
            } else {
              reject(
                new Error(
                  'Image compression failed.'
                )
              )
            }
          },
          'image/jpeg',
          0.82
        )
      }
    )


  const base =
    (
      file.name ||
      'product-image'
    )
      .replace(
        /\.[^.]+$/,
        ''
      )
      .replace(
        /[^a-zA-Z0-9-_]+/g,
        '-'
      )
      .slice(
        0,
        80
      ) ||
    'product-image'


  return new File(
    [blob],
    `${base}.jpg`,
    {
      type: 'image/jpeg',
    }
  )
}


/*
=====================================================
CLOUDINARY XHR UPLOAD
=====================================================
*/

function xhrUpload(
  file,
  resourceType,
  folder,
  onProgress
) {
  ensureConfig()


  return new Promise(
    (
      resolve,
      reject
    ) => {
      const xhr =
        new XMLHttpRequest()


      const endpoint =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`


      xhr.open(
        'POST',
        endpoint
      )


      xhr.responseType = 'json'
      xhr.timeout = 60000


      /*
      UPLOAD PROGRESS
      */

      xhr.upload.onprogress =
        (event) => {
          if (
            event.lengthComputable &&
            typeof onProgress ===
              'function'
          ) {
            const progress =
              Math.round(
                (
                  event.loaded /
                  event.total
                ) * 100
              )

            onProgress(
              progress
            )
          }
        }


      xhr.onerror =
        () => {
          reject(
            new Error(
              'Network error while uploading to Cloudinary.'
            )
          )
        }


      xhr.ontimeout = () => {
        reject(new Error('Cloudinary upload timed out. Check your Cloudinary preset, internet connection, and .env.local settings.'))
      }

      xhr.onabort =
        () => {
          reject(
            new Error(
              'Upload cancelled.'
            )
          )
        }


      xhr.onload =
        () => {
          const data =
            xhr.response ||
            {}


          if (
            xhr.status <
              200 ||
            xhr.status >=
              300
          ) {
            reject(
              new Error(
                data?.error
                  ?.message ||
                  'Cloudinary upload failed.'
              )
            )

            return
          }


          if (
            !data.secure_url
          ) {
            reject(
              new Error(
                'Cloudinary did not return a permanent URL.'
              )
            )

            return
          }


          resolve(
            data.secure_url
          )
        }


      const body =
        new FormData()


      body.append(
        'file',
        file
      )

      body.append(
        'upload_preset',
        UPLOAD_PRESET
      )

      body.append(
        'folder',
        folder
      )


      xhr.send(body)
    }
  )
}


/*
=====================================================
IMAGE UPLOAD
=====================================================
*/

export async function
uploadImageToCloudinary(
  file,
  options = {}
) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Please select a valid JPG, PNG or WEBP image.')
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image is too large. Please select an image below 15 MB.')
  }

  const compressed = await Promise.race([
    compressImage(file),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Image processing timed out. Please try another image.')),
        30000,
      ),
    ),
  ])

  return xhrUpload(
    compressed,
    'image',
    options.folder ||
      'grihini-apna-bazaar/products',
    options.onProgress
  )
}


/*
=====================================================
VIDEO UPLOAD
=====================================================
*/

export async function
uploadVideoToCloudinary(
  file,
  options = {}
) {
  if (
    !file?.type?.startsWith(
      'video/'
    )
  ) {
    throw new Error(
      'Please select a valid video file.'
    )
  }


  return xhrUpload(
    file,
    'video',
    options.folder ||
      'grihini-apna-bazaar/product-videos',
    options.onProgress
  )
}
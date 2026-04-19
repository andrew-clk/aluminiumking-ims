-- Set default image for all products that don't have an image
UPDATE products
SET image_url = '/images/default-product.svg'
WHERE image_url IS NULL OR image_url LIKE '%placeholder%';

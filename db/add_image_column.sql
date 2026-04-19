-- Add image_url column to products table

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add some sample default images for existing products
UPDATE products SET image_url = 'https://via.placeholder.com/80/2563eb/ffffff?text=AL' WHERE category = 'Aluminium' AND image_url IS NULL;
UPDATE products SET image_url = 'https://via.placeholder.com/80/dc2626/ffffff?text=HW' WHERE category = 'Hardware' AND image_url IS NULL;
UPDATE products SET image_url = 'https://via.placeholder.com/80/16a34a/ffffff?text=GL' WHERE category = 'Glass' AND image_url IS NULL;
UPDATE products SET image_url = 'https://via.placeholder.com/80/ca8a04/ffffff?text=AC' WHERE category = 'Accessory' AND image_url IS NULL;

-- AluminiumKing IMS Database Schema

-- Drop existing tables
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS requisition_items CASCADE;
DROP TABLE IF EXISTS requisitions CASCADE;
DROP TABLE IF EXISTS po_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  uom VARCHAR(20) NOT NULL,
  current_stock DECIMAL(10,2) DEFAULT 0,
  allocated_stock DECIMAL(10,2) DEFAULT 0,
  par_level DECIMAL(10,2) NOT NULL,
  reorder_point DECIMAL(10,2) NOT NULL,
  lead_time_days INTEGER DEFAULT 30,
  rack_location VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  supplier VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Orders table
CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE NOT NULL,
  supplier VARCHAR(255) NOT NULL,
  contact VARCHAR(100),
  expected_date DATE,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Order Items table
CREATE TABLE po_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  sku VARCHAR(50) REFERENCES products(sku) ON DELETE RESTRICT,
  product_name VARCHAR(255),
  quantity_ordered DECIMAL(10,2) NOT NULL,
  quantity_received DECIMAL(10,2) DEFAULT 0,
  eta DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requisitions table
CREATE TABLE requisitions (
  id SERIAL PRIMARY KEY,
  req_number VARCHAR(50) UNIQUE NOT NULL,
  job_number VARCHAR(50),
  requested_by VARCHAR(100) NOT NULL,
  request_date DATE NOT NULL,
  required_date DATE,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requisition Items table
CREATE TABLE requisition_items (
  id SERIAL PRIMARY KEY,
  req_id INTEGER REFERENCES requisitions(id) ON DELETE CASCADE,
  sku VARCHAR(50) REFERENCES products(sku) ON DELETE RESTRICT,
  product_name VARCHAR(255),
  quantity_requested DECIMAL(10,2) NOT NULL,
  quantity_issued DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table (stock movements)
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  txn_number VARCHAR(50) UNIQUE NOT NULL,
  txn_date TIMESTAMP NOT NULL,
  txn_type VARCHAR(30) NOT NULL,
  sku VARCHAR(50) REFERENCES products(sku) ON DELETE RESTRICT,
  product_name VARCHAR(255),
  quantity DECIMAL(10,2) NOT NULL,
  stock_before DECIMAL(10,2),
  stock_after DECIMAL(10,2),
  reference VARCHAR(100),
  user_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier);
CREATE INDEX idx_requisitions_status ON requisitions(status);
CREATE INDEX idx_transactions_sku ON transactions(sku);
CREATE INDEX idx_transactions_date ON transactions(txn_date);
CREATE INDEX idx_transactions_type ON transactions(txn_type);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requisitions_updated_at BEFORE UPDATE ON requisitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

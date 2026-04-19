-- Job Orders Schema

-- Drop existing tables
DROP TABLE IF EXISTS job_order_materials CASCADE;
DROP TABLE IF EXISTS job_orders CASCADE;

-- Job Orders table
CREATE TABLE job_orders (
  id SERIAL PRIMARY KEY,
  job_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  description TEXT,
  order_date DATE NOT NULL,
  due_date DATE NOT NULL,
  start_date DATE,
  completion_date DATE,
  status VARCHAR(30) DEFAULT 'upcoming',
  priority VARCHAR(20) DEFAULT 'normal',
  location VARCHAR(255),
  contact_person VARCHAR(100),
  contact_phone VARCHAR(50),
  total_value DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Order Materials table (link to products/materials needed)
CREATE TABLE job_order_materials (
  id SERIAL PRIMARY KEY,
  job_order_id INTEGER REFERENCES job_orders(id) ON DELETE CASCADE,
  sku VARCHAR(50) REFERENCES products(sku) ON DELETE RESTRICT,
  product_name VARCHAR(255),
  quantity_required DECIMAL(10,2) NOT NULL,
  quantity_allocated DECIMAL(10,2) DEFAULT 0,
  quantity_used DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_job_orders_status ON job_orders(status);
CREATE INDEX idx_job_orders_due_date ON job_orders(due_date);
CREATE INDEX idx_job_orders_customer ON job_orders(customer_name);
CREATE INDEX idx_job_order_materials_job ON job_order_materials(job_order_id);

-- Update trigger
CREATE TRIGGER update_job_orders_updated_at BEFORE UPDATE ON job_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

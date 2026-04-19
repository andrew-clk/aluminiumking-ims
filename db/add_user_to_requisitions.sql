-- Add user_id column to requisitions table to link with users
ALTER TABLE requisitions
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Add job_order_id column to link requisitions with job orders
ALTER TABLE requisitions
ADD COLUMN IF NOT EXISTS job_order_id INTEGER REFERENCES job_orders(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_requisitions_user_id ON requisitions(user_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_job_order_id ON requisitions(job_order_id);

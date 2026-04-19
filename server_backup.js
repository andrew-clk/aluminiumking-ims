import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './db/index.js';
import { put } from '@vercel/blob';
import multer from 'multer';
import bcrypt from 'bcrypt';
import session from 'express-session';
import cookieParser from 'cookie-parser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Setup multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'aluminiumking-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  proxy: true // Trust the reverse proxy (Vercel)
}));
app.use(express.static('.'));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────────────────

const requireAuth = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const result = await pool.query('SELECT id, username, full_name, role, status FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0 || result.rows[0].status !== 'active') {
      return res.status(401).json({ error: 'Invalid session' });
    }
    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// ─── AUTHENTICATION ROUTES ───────────────────────────────────────────────

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND status = $2', [username, 'active']);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Set session
    req.session.userId = user.id;

    res.json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      email: user.email
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    full_name: req.user.full_name,
    role: req.user.role
  });
});

// Get all users (super admin only)
app.get('/api/users', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, full_name, email, role, status, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (super admin only)
app.post('/api/users', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;

    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(`
      INSERT INTO users (username, password_hash, full_name, email, role, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id, username, full_name, email, role, status
    `, [username, passwordHash, full_name, email, role]);

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (super admin only)
app.put('/api/users/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, status, password } = req.body;

    let query = `
      UPDATE users
      SET full_name = $1, email = $2, role = $3, status = $4
    `;
    let params = [full_name, email, role, status];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query += `, password_hash = $5 WHERE id = $6 RETURNING id, username, full_name, email, role, status`;
      params.push(passwordHash, id);
    } else {
      query += ` WHERE id = $5 RETURNING id, username, full_name, email, role, status`;
      params.push(id);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (super admin only)
app.delete('/api/users/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── API ROUTES ──────────────────────────────────────────────────────────

// Get all products
app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        sku, name, category as cat, subcategory as sub, uom,
        current_stock as current, allocated_stock as allocated,
        par_level as par, reorder_point as reorder,
        lead_time_days as lead, rack_location as rack,
        status, supplier, image_url
      FROM products
      ORDER BY category, name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get all purchase orders with items
app.get('/api/purchase-orders', requireAuth, async (req, res) => {
  try {
    const posResult = await pool.query(`
      SELECT
        po_number as id, po_date as date, supplier, contact,
        expected_date as exp, status, notes
      FROM purchase_orders
      ORDER BY po_date DESC
    `);

    const pos = [];
    for (const po of posResult.rows) {
      const itemsResult = await pool.query(`
        SELECT
          sku, product_name as name,
          quantity_ordered as ordered,
          quantity_received as received,
          eta
        FROM po_items
        WHERE po_id = (SELECT id FROM purchase_orders WHERE po_number = $1)
      `, [po.id]);

      pos.push({
        ...po,
        items: itemsResult.rows.map(item => ({
          ...item,
          eta: item.eta ? item.eta.toISOString().split('T')[0] : null
        })),
        date: po.date ? po.date.toISOString().split('T')[0] : null,
        exp: po.exp ? po.exp.toISOString().split('T')[0] : null
      });
    }

    res.json(pos);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// Get all requisitions with items
app.get('/api/requisitions', requireAuth, async (req, res) => {
  try {
    const reqsResult = await pool.query(`
      SELECT
        req_number as id, job_number as job,
        requested_by as by, request_date as date,
        required_date as required, status
      FROM requisitions
      ORDER BY request_date DESC
    `);

    const reqs = [];
    for (const req of reqsResult.rows) {
      const itemsResult = await pool.query(`
        SELECT
          sku, product_name as name,
          quantity_requested as req,
          quantity_issued as issued
        FROM requisition_items
        WHERE req_id = (SELECT id FROM requisitions WHERE req_number = $1)
      `, [req.id]);

      reqs.push({
        ...req,
        items: itemsResult.rows,
        date: req.date ? req.date.toISOString().split('T')[0] : null,
        required: req.required ? req.required.toISOString().split('T')[0] : null
      });
    }

    res.json(reqs);
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
});

// Get all transactions
app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        txn_number as id,
        TO_CHAR(txn_date, 'YYYY-MM-DD HH24:MI') as date,
        txn_type as type, sku, product_name as name,
        quantity as qty, stock_before as before,
        stock_after as after, reference as ref,
        user_name as user
      FROM transactions
      ORDER BY txn_date DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get all job orders with materials
app.get('/api/job-orders', requireAuth, async (req, res) => {
  try {
    const jobsResult = await pool.query(`
      SELECT
        job_number, customer_name, project_name, description,
        order_date, due_date, start_date, completion_date,
        status, priority, location, contact_person, contact_phone,
        total_value, notes
      FROM job_orders
      ORDER BY
        CASE status
          WHEN 'ongoing' THEN 1
          WHEN 'upcoming' THEN 2
          WHEN 'completed' THEN 3
          ELSE 4
        END,
        due_date ASC
    `);

    const jobs = [];
    for (const job of jobsResult.rows) {
      const materialsResult = await pool.query(`
        SELECT
          sku, product_name as name,
          quantity_required as required,
          quantity_allocated as allocated,
          quantity_used as used,
          notes
        FROM job_order_materials
        WHERE job_order_id = (SELECT id FROM job_orders WHERE job_number = $1)
      `, [job.job_number]);

      jobs.push({
        ...job,
        materials: materialsResult.rows.map(m => ({
          ...m,
          required: parseFloat(m.required) || 0,
          allocated: parseFloat(m.allocated) || 0,
          used: parseFloat(m.used) || 0
        })),
        order_date: job.order_date ? job.order_date.toISOString().split('T')[0] : null,
        due_date: job.due_date ? job.due_date.toISOString().split('T')[0] : null,
        start_date: job.start_date ? job.start_date.toISOString().split('T')[0] : null,
        completion_date: job.completion_date ? job.completion_date.toISOString().split('T')[0] : null,
        total_value: parseFloat(job.total_value) || 0
      });
    }

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching job orders:', error);
    res.status(500).json({ error: 'Failed to fetch job orders' });
  }
});

// Upload product image
app.post('/api/upload-image', requireAuth, requireRole('super_admin', 'purchaser'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // For local development without Vercel Blob token, save to local filesystem
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const fs = await import('fs/promises');
      const crypto = await import('crypto');

      // Generate unique filename
      const fileExt = req.file.originalname.split('.').pop();
      const uniqueName = `${crypto.randomBytes(16).toString('hex')}.${fileExt}`;
      const uploadPath = path.join(__dirname, 'public/images/uploads', uniqueName);

      // Ensure upload directory exists
      await fs.mkdir(path.join(__dirname, 'public/images/uploads'), { recursive: true });

      // Save file
      await fs.writeFile(uploadPath, req.file.buffer);

      // Return local URL
      const url = `/images/uploads/${uniqueName}`;
      return res.json({ url });
    }

    // For production with Vercel Blob
    const blob = await put(req.file.originalname, req.file.buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    res.json({ url: blob.url });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Create new product
app.post('/api/products', requireAuth, requireRole('super_admin', 'purchaser'), async (req, res) => {
  try {
    const { sku, name, cat, sub, uom, par, reorder, lead, rack, supplier, current, image_url, status } = req.body;

    // Set default image if none provided
    const finalImageUrl = image_url || '/images/default-product.svg';

    const result = await pool.query(`
      INSERT INTO products (sku, name, category, subcategory, uom, par_level, reorder_point, lead_time_days, rack_location, supplier, current_stock, image_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [sku, name, cat, sub, uom, par, reorder, lead, rack, supplier, current || 0, finalImageUrl, status || 'active']);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update existing product
app.put('/api/products/:sku', requireAuth, requireRole('super_admin', 'purchaser'), async (req, res) => {
  try {
    const { sku } = req.params;
    const { name, cat, sub, uom, par, reorder, lead, rack, supplier, current, image_url, status } = req.body;

    const result = await pool.query(`
      UPDATE products
      SET name = $1, category = $2, subcategory = $3, uom = $4,
          par_level = $5, reorder_point = $6, lead_time_days = $7,
          rack_location = $8, supplier = $9, current_stock = $10,
          image_url = $11, status = $12, updated_at = CURRENT_TIMESTAMP
      WHERE sku = $13
      RETURNING *
    `, [name, cat, sub, uom, par, reorder, lead, rack, supplier, current, image_url, status, sku]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Create new purchase order
app.post('/api/purchase-orders', requireAuth, requireRole('super_admin', 'purchaser'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { po_number, supplier, contact, expected_date, notes, items } = req.body;

    const poResult = await client.query(`
      INSERT INTO purchase_orders (po_number, po_date, supplier, contact, expected_date, status, notes)
      VALUES ($1, CURRENT_DATE, $2, $3, $4, 'draft', $5)
      RETURNING id
    `, [po_number, supplier, contact, expected_date, notes]);

    const poId = poResult.rows[0].id;

    for (const item of items) {
      await client.query(`
        INSERT INTO po_items (po_id, sku, product_name, quantity_ordered, eta)
        VALUES ($1, $2, $3, $4, $5)
      `, [poId, item.sku, item.name, item.quantity, item.eta]);
    }

    await client.query('COMMIT');
    res.json({ success: true, po_id: poId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  } finally {
    client.release();
  }
});

// Create new requisition
app.post('/api/requisitions', requireAuth, requireRole('super_admin', 'production', 'stock_keeper'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { req_number, job_number, requested_by, required_date, items } = req.body;

    const reqResult = await client.query(`
      INSERT INTO requisitions (req_number, job_number, requested_by, request_date, required_date, status)
      VALUES ($1, $2, $3, CURRENT_DATE, $4, 'pending')
      RETURNING id
    `, [req_number, job_number, requested_by, required_date]);

    const reqId = reqResult.rows[0].id;

    for (const item of items) {
      await client.query(`
        INSERT INTO requisition_items (req_id, sku, product_name, quantity_requested)
        VALUES ($1, $2, $3, $4)
      `, [reqId, item.sku, item.name, item.quantity]);
    }

    await client.query('COMMIT');
    res.json({ success: true, req_id: reqId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating requisition:', error);
    res.status(500).json({ error: 'Failed to create requisition' });
  } finally {
    client.release();
  }
});

// Create new job order with automatic requisition
app.post('/api/job-orders', requireAuth, requireRole('super_admin', 'production'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      job_number, customer_name, project_name, description,
      order_date, due_date, priority, location, contact_person,
      contact_phone, total_value, notes, materials, user_id
    } = req.body;

    // Insert job order
    const jobResult = await client.query(`
      INSERT INTO job_orders (
        job_number, customer_name, project_name, description,
        order_date, due_date, status, priority, location,
        contact_person, contact_phone, total_value, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'upcoming', $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      job_number, customer_name, project_name, description,
      order_date, due_date, priority, location,
      contact_person, contact_phone, total_value, notes
    ]);

    const jobId = jobResult.rows[0].id;

    // Insert materials
    for (const material of materials) {
      await client.query(`
        INSERT INTO job_order_materials (job_order_id, sku, product_name, quantity_required)
        VALUES ($1, $2, $3, $4)
      `, [jobId, material.sku, material.name, material.quantity]);
    }

    // Automatically create requisition for this job order
    const reqNumber = `REQ-${Date.now()}`;
    const reqResult = await client.query(`
      INSERT INTO requisitions (
        req_number, job_number, requested_by, request_date,
        required_date, status, user_id, job_order_id
      )
      VALUES ($1, $2, (SELECT full_name FROM users WHERE id = $3), CURRENT_DATE, $4, 'pending', $3, $5)
      RETURNING id
    `, [reqNumber, job_number, user_id, due_date, jobId]);

    const reqId = reqResult.rows[0].id;

    // Add materials to requisition
    for (const material of materials) {
      await client.query(`
        INSERT INTO requisition_items (req_id, sku, product_name, quantity_requested)
        VALUES ($1, $2, $3, $4)
      `, [reqId, material.sku, material.name, material.quantity]);
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      job_id: jobId,
      req_id: reqId,
      req_number: reqNumber,
      message: 'Job order created and requisition generated automatically'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating job order:', error);
    res.status(500).json({ error: 'Failed to create job order' });
  } finally {
    client.release();
  }
});

// Update product stock (for receiving goods)
app.post('/api/products/:sku/receive', requireAuth, requireRole('super_admin', 'stock_keeper'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { sku } = req.params;
    const { quantity, reference, user } = req.body;

    // Get current stock
    const productResult = await client.query('SELECT current_stock, name FROM products WHERE sku = $1', [sku]);
    const product = productResult.rows[0];
    const stockBefore = parseFloat(product.current_stock);
    const stockAfter = stockBefore + parseFloat(quantity);

    // Update product stock
    await client.query('UPDATE products SET current_stock = $1 WHERE sku = $2', [stockAfter, sku]);

    // Record transaction
    const txnNumber = `TXN-${Date.now()}`;
    await client.query(`
      INSERT INTO transactions (txn_number, txn_date, txn_type, sku, product_name, quantity, stock_before, stock_after, reference, user_name)
      VALUES ($1, NOW(), 'purchase_receipt', $2, $3, $4, $5, $6, $7, $8)
    `, [txnNumber, sku, product.name, quantity, stockBefore, stockAfter, reference, user]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error receiving stock:', error);
    res.status(500).json({ error: 'Failed to receive stock' });
  } finally {
    client.release();
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AluminiumKing IMS Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: Neon (PostgreSQL)`);
  console.log(`📁 Static files served from: ${__dirname}`);
});

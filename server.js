import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './db/index.js';
import { put } from '@vercel/blob';
import multer from 'multer';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';

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
app.use(express.static('.'));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// ─── JWT AUTH HELPERS ────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'aluminiumking-jwt-secret-change-in-production';

function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadString).toString('base64');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadBase64).digest('base64');
  return `${payloadBase64}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payloadBase64).digest('base64');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────────────────

const requireAuth = async (req, res, next) => {
  const token = req.cookies.authToken || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    const result = await pool.query('SELECT id, username, full_name, role, status FROM users WHERE id = $1', [payload.id]);
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

    // Generate JWT token
    const token = generateToken(user);

    // Set cookie with proper settings for production
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

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
  res.clearCookie('authToken');
  res.json({ success: true });
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

// ─── SUPPLIER ROUTES ─────────────────────────────────────────────────────

// Get all suppliers
app.get('/api/suppliers', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, contact_person, phone, email, address, lead_time_days, notes, status
      FROM suppliers
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Get products by supplier
app.get('/api/suppliers/:supplierId/products', requireAuth, async (req, res) => {
  try {
    const { supplierId } = req.params;
    const supplierResult = await pool.query('SELECT name FROM suppliers WHERE id = $1', [supplierId]);
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    const supplierName = supplierResult.rows[0].name;
    const result = await pool.query(`
      SELECT sku, name, category, uom, current_stock, supplier
      FROM products
      WHERE supplier = $1 AND status = 'active'
      ORDER BY name
    `, [supplierName]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching supplier products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create supplier
app.post('/api/suppliers', requireAuth, requireRole('super_admin', 'purchaser'), async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, lead_time_days, notes } = req.body;
    const result = await pool.query(`
      INSERT INTO suppliers (name, contact_person, phone, email, address, lead_time_days, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING *
    `, [name, contact_person, phone, email, address, lead_time_days || 7, notes]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating supplier:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Supplier name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  }
});

// Update supplier
app.put('/api/suppliers/:id', requireAuth, requireRole('super_admin', 'purchaser'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address, lead_time_days, notes, status } = req.body;

    // Build update query dynamically based on provided fields
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (name !== undefined) { updateFields.push(`name = $${paramCount++}`); values.push(name); }
    if (contact_person !== undefined) { updateFields.push(`contact_person = $${paramCount++}`); values.push(contact_person); }
    if (phone !== undefined) { updateFields.push(`phone = $${paramCount++}`); values.push(phone); }
    if (email !== undefined) { updateFields.push(`email = $${paramCount++}`); values.push(email); }
    if (address !== undefined) { updateFields.push(`address = $${paramCount++}`); values.push(address); }
    if (lead_time_days !== undefined) { updateFields.push(`lead_time_days = $${paramCount++}`); values.push(lead_time_days); }
    if (notes !== undefined) { updateFields.push(`notes = $${paramCount++}`); values.push(notes); }
    if (status !== undefined) { updateFields.push(`status = $${paramCount++}`); values.push(status); }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(`
      UPDATE suppliers
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// ─── USER ROUTES ─────────────────────────────────────────────────────────

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
          quantity_requested as requested,
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

    const { supplier, contact, date, exp, status, notes, items } = req.body;

    // Generate PO number
    const countResult = await client.query('SELECT COUNT(*) FROM purchase_orders');
    const count = parseInt(countResult.rows[0].count) + 1;
    const year = new Date().getFullYear();
    const po_number = `PO-${year}-${String(count).padStart(3, '0')}`;

    const poResult = await client.query(`
      INSERT INTO purchase_orders (po_number, po_date, supplier, contact, expected_date, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, po_number
    `, [po_number, date || new Date().toISOString().split('T')[0], supplier, contact, exp, status || 'draft', notes]);

    const poId = poResult.rows[0].id;
    const generatedPoNumber = poResult.rows[0].po_number;

    for (const item of items) {
      await client.query(`
        INSERT INTO po_items (po_id, sku, product_name, quantity_ordered, eta)
        VALUES ($1, $2, $3, $4, $5)
      `, [poId, item.sku, item.name, item.ordered, item.eta]);
    }

    await client.query('COMMIT');
    res.json({ success: true, po_id: poId, po_number: generatedPoNumber });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  } finally {
    client.release();
  }
});

// Update purchase order status
app.put('/api/purchase-orders/:poNumber/status', requireAuth, requireRole('super_admin', 'purchaser', 'stock_keeper'), async (req, res) => {
  try {
    const { poNumber } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['draft', 'sent', 'in_transit', 'fully_received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(`
      UPDATE purchase_orders
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE po_number = $2
      RETURNING *
    `, [status, poNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json({ success: true, po: result.rows[0] });
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    res.status(500).json({ error: 'Failed to update purchase order status' });
  }
});

// Delete purchase order
app.delete('/api/purchase-orders/:poNumber', requireAuth, requireRole('super_admin', 'purchaser'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { poNumber } = req.params;

    // Get PO ID
    const poResult = await client.query('SELECT id FROM purchase_orders WHERE po_number = $1', [poNumber]);
    if (poResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const poId = poResult.rows[0].id;

    // Delete PO items first (foreign key constraint)
    await client.query('DELETE FROM po_items WHERE po_id = $1', [poId]);

    // Delete PO
    await client.query('DELETE FROM purchase_orders WHERE id = $1', [poId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ error: 'Failed to delete purchase order' });
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

// Delete requisition
app.delete('/api/requisitions/:reqNumber', requireAuth, requireRole('super_admin', 'production', 'stock_keeper'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { reqNumber } = req.params;

    // Get requisition ID
    const reqResult = await client.query('SELECT id FROM requisitions WHERE req_number = $1', [reqNumber]);
    if (reqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Requisition not found' });
    }

    const reqId = reqResult.rows[0].id;

    // Delete requisition items first (foreign key constraint)
    await client.query('DELETE FROM requisition_items WHERE req_id = $1', [reqId]);

    // Delete requisition
    await client.query('DELETE FROM requisitions WHERE id = $1', [reqId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting requisition:', error);
    res.status(500).json({ error: 'Failed to delete requisition' });
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
      customer_name, project_name, description,
      order_date, due_date, priority, location, contact_person,
      contact_phone, total_value, notes, materials, user_id
    } = req.body;

    // Auto-generate job number: AKJOB-YYMM-XXXXX
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // Last 2 digits of year
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month with leading zero

    // Get count of all job orders for sequential numbering
    const countResult = await client.query('SELECT COUNT(*) FROM job_orders');
    const count = parseInt(countResult.rows[0].count) + 1;
    const sequentialNumber = String(count).padStart(5, '0'); // 5 digits with leading zeros

    const job_number = `AKJOB-${year}${month}-${sequentialNumber}`;

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
      job_number: job_number,
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

// Update job order status
app.put('/api/job-orders/:jobNumber/status', requireAuth, requireRole('super_admin', 'production'), async (req, res) => {
  try {
    const { jobNumber } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['upcoming', 'ongoing', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update the job order status
    let updateQuery = `UPDATE job_orders SET status = $1, updated_at = CURRENT_TIMESTAMP`;
    const params = [status, jobNumber];

    // Set start_date when moving to ongoing
    if (status === 'ongoing') {
      updateQuery += `, start_date = COALESCE(start_date, CURRENT_DATE)`;
    }

    // Set completion_date when moving to completed
    if (status === 'completed') {
      updateQuery += `, completion_date = CURRENT_DATE`;
    }

    // Clear completion_date if reopening
    if (status === 'ongoing' || status === 'upcoming') {
      updateQuery += `, completion_date = NULL`;
    }

    updateQuery += ` WHERE job_number = $2 RETURNING *`;

    const result = await pool.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job order not found' });
    }

    res.json({ success: true, job: result.rows[0] });
  } catch (error) {
    console.error('Error updating job order status:', error);
    res.status(500).json({ error: 'Failed to update job order status' });
  }
});

// Delete job order
app.delete('/api/job-orders/:jobNumber', requireAuth, requireRole('super_admin', 'production'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { jobNumber } = req.params;

    // Get job order ID
    const jobResult = await client.query('SELECT id FROM job_orders WHERE job_number = $1', [jobNumber]);
    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job order not found' });
    }

    const jobId = jobResult.rows[0].id;

    // Delete associated requisitions and their items
    const reqsResult = await client.query('SELECT id FROM requisitions WHERE job_order_id = $1', [jobId]);
    for (const req of reqsResult.rows) {
      await client.query('DELETE FROM requisition_items WHERE req_id = $1', [req.id]);
    }
    await client.query('DELETE FROM requisitions WHERE job_order_id = $1', [jobId]);

    // Delete job order materials
    await client.query('DELETE FROM job_order_materials WHERE job_order_id = $1', [jobId]);

    // Delete job order
    await client.query('DELETE FROM job_orders WHERE id = $1', [jobId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting job order:', error);
    res.status(500).json({ error: 'Failed to delete job order' });
  } finally {
    client.release();
  }
});

// Receive PO items (bulk receive with transaction logging)
app.post('/api/purchase-orders/:poNumber/receive', requireAuth, requireRole('super_admin', 'stock_keeper'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { poNumber } = req.params;
    const { items, user } = req.body; // items: [{ sku, quantity_received }]

    // Get PO ID
    const poResult = await client.query('SELECT id FROM purchase_orders WHERE po_number = $1', [poNumber]);
    if (poResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const poId = poResult.rows[0].id;

    // Process each received item
    for (const item of items) {
      // Get product info and current stock
      const productResult = await client.query('SELECT current_stock, name FROM products WHERE sku = $1', [item.sku]);
      if (productResult.rows.length === 0) continue;

      const product = productResult.rows[0];
      const stockBefore = parseFloat(product.current_stock) || 0;
      const quantityReceived = parseFloat(item.quantity_received);
      const stockAfter = stockBefore + quantityReceived;

      // Update product stock
      await client.query('UPDATE products SET current_stock = $1 WHERE sku = $2', [stockAfter, item.sku]);

      // Update PO item received quantity
      await client.query(`
        UPDATE po_items
        SET quantity_received = COALESCE(quantity_received, 0) + $1
        WHERE po_id = $2 AND sku = $3
      `, [quantityReceived, poId, item.sku]);

      // Record transaction
      const txnNumber = `TXN-${Date.now()}-${item.sku}`;
      await client.query(`
        INSERT INTO transactions (txn_number, txn_date, txn_type, sku, product_name, quantity, stock_before, stock_after, reference, user_name)
        VALUES ($1, NOW(), 'purchase_receipt', $2, $3, $4, $5, $6, $7, $8)
      `, [txnNumber, item.sku, product.name, quantityReceived, stockBefore, stockAfter, poNumber, user]);
    }

    // Check if PO is fully received
    const checkResult = await client.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE quantity_received >= quantity_ordered) as received_items
      FROM po_items
      WHERE po_id = $1
    `, [poId]);

    const { total_items, received_items } = checkResult.rows[0];
    if (parseInt(total_items) === parseInt(received_items)) {
      await client.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', ['fully_received', poId]);
    } else {
      await client.query('UPDATE purchase_orders SET status = $1 WHERE id = $2 AND status = $3', ['in_transit', poId, 'sent']);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error receiving PO items:', error);
    res.status(500).json({ error: 'Failed to receive items' });
  } finally {
    client.release();
  }
});

// Fulfill requisition (issue materials to job with transaction logging)
app.post('/api/requisitions/:reqNumber/fulfill', requireAuth, requireRole('super_admin', 'stock_keeper'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { reqNumber } = req.params;
    const { items, user } = req.body; // items: [{ sku, quantity_issued }]

    // Get requisition info
    const reqResult = await client.query('SELECT id, job_number FROM requisitions WHERE req_number = $1', [reqNumber]);
    if (reqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Requisition not found' });
    }
    const { id: reqId, job_number } = reqResult.rows[0];

    // Process each issued item
    for (const item of items) {
      // Get product info and current stock
      const productResult = await client.query('SELECT current_stock, name FROM products WHERE sku = $1', [item.sku]);
      if (productResult.rows.length === 0) continue;

      const product = productResult.rows[0];
      const stockBefore = parseFloat(product.current_stock) || 0;
      const quantityIssued = parseFloat(item.quantity_issued);
      const stockAfter = stockBefore - quantityIssued;

      // Check if sufficient stock
      if (stockAfter < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${stockBefore}, Requested: ${quantityIssued}`
        });
      }

      // Update product stock
      await client.query('UPDATE products SET current_stock = $1 WHERE sku = $2', [stockAfter, item.sku]);

      // Update requisition item issued quantity
      await client.query(`
        UPDATE requisition_items
        SET quantity_issued = COALESCE(quantity_issued, 0) + $1
        WHERE req_id = $2 AND sku = $3
      `, [quantityIssued, reqId, item.sku]);

      // Record transaction
      const txnNumber = `TXN-${Date.now()}-${item.sku}`;
      await client.query(`
        INSERT INTO transactions (txn_number, txn_date, txn_type, sku, product_name, quantity, stock_before, stock_after, reference, user_name)
        VALUES ($1, NOW(), 'material_issue', $2, $3, $4, $5, $6, $7, $8)
      `, [txnNumber, item.sku, product.name, quantityIssued, stockBefore, stockAfter, `${reqNumber} (${job_number})`, user]);
    }

    // Check if requisition is fully fulfilled
    const checkResult = await client.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE quantity_issued >= quantity_requested) as issued_items
      FROM requisition_items
      WHERE req_id = $1
    `, [reqId]);

    const { total_items, issued_items } = checkResult.rows[0];
    if (parseInt(total_items) === parseInt(issued_items)) {
      await client.query('UPDATE requisitions SET status = $1 WHERE id = $2', ['fulfilled', reqId]);
    } else {
      await client.query('UPDATE requisitions SET status = $1 WHERE id = $2 AND status = $3', ['partial', reqId, 'pending']);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fulfilling requisition:', error);
    res.status(500).json({ error: 'Failed to fulfill requisition' });
  } finally {
    client.release();
  }
});

// Update product stock (for manual adjustments)
app.post('/api/products/:sku/adjust', requireAuth, requireRole('super_admin', 'stock_keeper'), async (req, res) => {
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
    const txnType = parseFloat(quantity) > 0 ? 'stock_adjustment_in' : 'stock_adjustment_out';
    await client.query(`
      INSERT INTO transactions (txn_number, txn_date, txn_type, sku, product_name, quantity, stock_before, stock_after, reference, user_name)
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9)
    `, [txnNumber, txnType, sku, product.name, Math.abs(quantity), stockBefore, stockAfter, reference, user]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adjusting stock:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  } finally {
    client.release();
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server (for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 AluminiumKing IMS Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: Neon (PostgreSQL)`);
    console.log(`🔐 Authentication: JWT-based`);
    console.log(`📁 Static files served from: ${__dirname}`);
  });
}

// Export for Vercel
export default app;

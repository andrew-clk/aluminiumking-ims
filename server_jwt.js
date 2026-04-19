import express from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { put } from '@vercel/blob';
import { fileURLToPath } from 'url';
import path from 'path';
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

// Serve static files
app.use(express.static('.'));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Simple JWT implementation for Vercel
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
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadBase64)
    .digest('base64');

  return `${payloadBase64}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;

  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadBase64)
      .digest('base64');

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

    if (payload.exp < Date.now()) return null;

    return payload;
  } catch (err) {
    return null;
  }
}

// Auth middleware
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

// Check auth status
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    full_name: req.user.full_name,
    role: req.user.role
  });
});

// ─── PRODUCT ROUTES ──────────────────────────────────────────────────────

app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        sku,
        name,
        category as cat,
        subcategory as sub,
        uom,
        current_stock as current,
        allocated_stock as allocated,
        par_level as par,
        reorder_point as reorder,
        lead_time_days as lead,
        rack_location as rack,
        status,
        supplier
      FROM products
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/products', requireAuth, requireRole('super_admin', 'purchaser'), async (req, res) => {
  try {
    const { sku, name, category, subcategory, uom, par_level, reorder_point, rack_location, supplier } = req.body;

    const result = await pool.query(`
      INSERT INTO products (sku, name, category, subcategory, uom, par_level, reorder_point, rack_location, supplier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [sku, name, category, subcategory, uom, par_level, reorder_point, rack_location, supplier]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
});

app.put('/api/products/:sku', requireAuth, requireRole('super_admin', 'purchaser'), async (req, res) => {
  try {
    const { sku } = req.params;
    const { name, category, subcategory, uom, par_level, reorder_point, rack_location, supplier } = req.body;

    const result = await pool.query(`
      UPDATE products
      SET name = $2, category = $3, subcategory = $4, uom = $5,
          par_level = $6, reorder_point = $7, rack_location = $8, supplier = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE sku = $1
      RETURNING *
    `, [sku, name, category, subcategory, uom, par_level, reorder_point, rack_location, supplier]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:sku', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { sku } = req.params;

    const result = await pool.query('DELETE FROM products WHERE sku = $1 RETURNING *', [sku]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────

app.get('/api/purchase-orders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        po.*,
        COALESCE(
          json_agg(
            json_build_object(
              'sku', poi.sku,
              'name', poi.product_name,
              'ordered', poi.quantity_ordered,
              'received', poi.quantity_received,
              'eta', poi.eta
            )
            ORDER BY poi.id
          ) FILTER (WHERE poi.id IS NOT NULL),
          '[]'
        ) as items
      FROM purchase_orders po
      LEFT JOIN po_items poi ON po.id = poi.po_id
      GROUP BY po.id
      ORDER BY po.po_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// ─── JOB ORDERS ──────────────────────────────────────────────────────────

app.get('/api/job-orders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        jo.*,
        COALESCE(
          json_agg(
            json_build_object(
              'sku', jom.sku,
              'name', p.name,
              'required', jom.quantity_required,
              'allocated', jom.quantity_allocated
            )
            ORDER BY jom.id
          ) FILTER (WHERE jom.id IS NOT NULL),
          '[]'
        ) as materials
      FROM job_orders jo
      LEFT JOIN job_order_materials jom ON jo.id = jom.job_order_id
      LEFT JOIN products p ON jom.sku = p.sku
      GROUP BY jo.id
      ORDER BY jo.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching job orders:', error);
    res.status(500).json({ error: 'Failed to fetch job orders' });
  }
});

// ─── REQUISITIONS ────────────────────────────────────────────────────────

app.get('/api/requisitions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'sku', ri.sku,
              'name', ri.product_name,
              'requested', ri.quantity_requested,
              'issued', ri.quantity_issued
            )
            ORDER BY ri.id
          ) FILTER (WHERE ri.id IS NOT NULL),
          '[]'
        ) as items
      FROM requisitions r
      LEFT JOIN requisition_items ri ON r.id = ri.req_id
      GROUP BY r.id
      ORDER BY r.request_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
});

// ─── TRANSACTIONS ────────────────────────────────────────────────────────

app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM transactions
      ORDER BY txn_date DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ─── SERVER START ────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 AluminiumKing IMS Server (JWT) running on http://localhost:${PORT}`);
  console.log(`📊 Database: Neon (PostgreSQL)`);
  console.log(`🔐 Authentication: JWT-based (stateless)`);
  console.log(`📁 Static files served from: ${__dirname}`);
});

export default app;
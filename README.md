# AluminiumKing IMS

Inventory Management System with Neon PostgreSQL database integration.

## Database Setup

This application now uses **Neon Database** (PostgreSQL) instead of mock data.

### Current Configuration

- **Database**: Neon PostgreSQL (Serverless)
- **Connection**: Configured in `.env` file
- **Schema**: Full relational database with products, purchase orders, requisitions, and transactions

### Database Schema

- **products** - Product inventory with stock levels, PAR levels, and locations
- **purchase_orders** - Purchase order headers
- **po_items** - Purchase order line items
- **requisitions** - Material requisitions for jobs
- **requisition_items** - Requisition line items
- **transactions** - Complete audit trail of all stock movements

### Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Database is already set up** with schema and sample data:
   - 15 products
   - 6 purchase orders
   - 5 requisitions
   - 10 transactions

3. **Start the application**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000)

### Development Commands

- `npm run dev` - Start development server
- `npm run db:setup` - Reset database (recreate schema and seed data)

### API Endpoints

All data is now served via RESTful API:

- `GET /api/products` - Get all products
- `GET /api/purchase-orders` - Get all purchase orders with items
- `GET /api/requisitions` - Get all requisitions with items
- `GET /api/transactions` - Get transaction history
- `POST /api/products` - Create new product
- `POST /api/purchase-orders` - Create new purchase order
- `POST /api/requisitions` - Create new requisition
- `POST /api/products/:sku/receive` - Receive goods (update stock)

### Deployment to Vercel

The application is configured for Vercel deployment with:

- `vercel.json` - Vercel configuration
- Node.js serverless functions
- Neon database connection (configured as environment variable)

To deploy:
```bash
vercel
```

Make sure to set the `DATABASE_URL` environment variable in Vercel project settings.

### Environment Variables

Required in `.env` (local) and Vercel (production):

```
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
PORT=3000
```

## Features

- Real-time inventory tracking
- Purchase order management
- Material requisitions
- Stock receiving with GRN
- Transaction audit trail
- Availability checking
- Low stock alerts
- Dashboard with key metrics

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express.js
- **Database**: Neon PostgreSQL
- **Hosting**: Vercel-ready

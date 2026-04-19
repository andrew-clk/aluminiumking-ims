-- AluminiumKing IMS Sample Data

-- Insert Products
INSERT INTO products (sku, name, category, subcategory, uom, current_stock, allocated_stock, par_level, reorder_point, lead_time_days, rack_location, status, supplier) VALUES
('AL-650-3M', 'Profile 650 3m', 'Aluminium', 'Profile', 'meter', 5.0, 2.0, 50.0, 30.0, 45, 'C-01', 'active', 'China Aluminium Co.'),
('AL-750-6M', 'Profile 750 6m', 'Aluminium', 'Profile', 'meter', 120.0, 30.0, 80.0, 50.0, 45, 'C-02', 'active', 'China Aluminium Co.'),
('AL-500-3M', 'Profile 500 3m', 'Aluminium', 'Profile', 'meter', 85.0, 20.0, 60.0, 40.0, 45, 'C-03', 'active', 'China Aluminium Co.'),
('HG-X200', 'Hinge Heavy Duty X-200', 'Hardware', 'Hinge', 'pcs', 2, 0, 20, 10, 30, 'A-12', 'active', 'Golden Hardware Co.'),
('HG-P100', 'Pivot Hinge P-100', 'Hardware', 'Hinge', 'pcs', 12, 4, 20, 10, 30, 'A-10', 'active', 'Golden Hardware Co.'),
('TR-T500', 'Track System T-500', 'Hardware', 'Track', 'pcs', 0, 0, 10, 5, 30, 'B-05', 'active', 'Golden Hardware Co.'),
('GL-6MM-CLR', 'Glass 6mm Clear', 'Glass', 'Clear', 'sqm', 45.5, 12.0, 20.0, 15.0, 21, 'D-03', 'active', 'KL Glass Sdn Bhd'),
('GL-8MM-TIN', 'Glass 8mm Tinted', 'Glass', 'Tinted', 'sqm', 22.0, 8.0, 15.0, 10.0, 21, 'D-05', 'active', 'KL Glass Sdn Bhd'),
('GL-10MM-FRO', 'Glass 10mm Frosted', 'Glass', 'Frosted', 'sqm', 0, 0, 10.0, 5.0, 21, 'D-07', 'active', 'KL Glass Sdn Bhd'),
('LK-SS201', 'Lock Stainless Steel 201', 'Hardware', 'Lock', 'pcs', 8, 3, 15, 8, 30, 'A-08', 'discontinued', 'Golden Hardware Co.'),
('RO-SS-01', 'Roller Stainless Set', 'Hardware', 'Roller', 'set', 35, 10, 30, 20, 30, 'A-15', 'active', 'Golden Hardware Co.'),
('SC-SEAL-10M', 'Rubber Seal Strip 10m', 'Accessory', 'Seal', 'roll', 6, 2, 10, 6, 14, 'E-01', 'active', 'Local Supplier KL'),
('AL-800-4M', 'Profile 800 4m', 'Aluminium', 'Profile', 'meter', 75.0, 15.0, 70.0, 45.0, 45, 'C-04', 'active', 'China Aluminium Co.'),
('HG-X300', 'Hinge Heavy Duty X-300', 'Hardware', 'Hinge', 'pcs', 18, 5, 25, 12, 30, 'A-13', 'active', 'Golden Hardware Co.'),
('GL-12MM-CLR', 'Glass 12mm Clear', 'Glass', 'Clear', 'sqm', 30.0, 10.0, 25.0, 18.0, 21, 'D-04', 'active', 'KL Glass Sdn Bhd');

-- Insert Purchase Orders
INSERT INTO purchase_orders (po_number, po_date, supplier, contact, expected_date, status, notes) VALUES
('PO-2024-001', '2024-02-20', 'China Aluminium Co.', '+86 135 xxxx xxxx', '2024-03-15', 'in_transit', 'Urgent restock Q1'),
('PO-2024-002', '2024-02-25', 'Golden Hardware Co.', '+86 138 xxxx xxxx', '2024-03-18', 'in_transit', ''),
('PO-2024-003', '2024-03-01', 'KL Glass Sdn Bhd', '+60 12 xxxx xxxx', '2024-03-22', 'sent', 'Shower screen project'),
('PO-2024-004', '2024-01-15', 'China Aluminium Co.', '+86 135 xxxx xxxx', '2024-02-20', 'fully_received', ''),
('PO-2024-005', '2024-03-05', 'Golden Hardware Co.', '+86 138 xxxx xxxx', '2024-03-25', 'draft', 'Pending approval from manager'),
('PO-2024-006', '2024-03-10', 'KL Glass Sdn Bhd', '+60 12 xxxx xxxx', '2024-03-30', 'draft', 'New project requirement');

-- Insert PO Items
INSERT INTO po_items (po_id, sku, product_name, quantity_ordered, quantity_received, eta) VALUES
-- PO-2024-001
(1, 'AL-650-3M', 'Profile 650 3m', 200, 0, '2024-03-15'),
(1, 'AL-750-6M', 'Profile 750 6m', 50, 0, '2024-03-15'),
-- PO-2024-002
(2, 'HG-X200', 'Hinge Heavy Duty X-200', 100, 0, '2024-03-18'),
(2, 'TR-T500', 'Track System T-500', 50, 0, '2024-03-18'),
(2, 'RO-SS-01', 'Roller Stainless Set', 40, 0, '2024-03-20'),
-- PO-2024-003
(3, 'GL-6MM-CLR', 'Glass 6mm Clear', 30, 0, '2024-03-22'),
(3, 'GL-10MM-FRO', 'Glass 10mm Frosted', 15, 0, '2024-03-22'),
-- PO-2024-004
(4, 'AL-500-3M', 'Profile 500 3m', 100, 100, '2024-02-20'),
-- PO-2024-005
(5, 'HG-P100', 'Pivot Hinge P-100', 50, 0, '2024-03-25'),
(5, 'SC-SEAL-10M', 'Rubber Seal Strip 10m', 20, 0, '2024-03-25'),
-- PO-2024-006
(6, 'GL-12MM-CLR', 'Glass 12mm Clear', 25, 0, '2024-03-30'),
(6, 'AL-800-4M', 'Profile 800 4m', 60, 0, '2024-03-30');

-- Insert Requisitions
INSERT INTO requisitions (req_number, job_number, requested_by, request_date, required_date, status) VALUES
('REQ-2024-001', 'JOB-145', 'Ahmad Yusof', '2024-03-08', '2024-03-15', 'pending'),
('REQ-2024-002', 'JOB-148', 'Rahman Ali', '2024-03-09', '2024-03-16', 'approved'),
('REQ-2024-003', 'JOB-142', 'Tan Wei Ming', '2024-03-05', '2024-03-10', 'issued'),
('REQ-2024-004', 'JOB-150', 'Lee Chong Wei', '2024-03-11', '2024-03-18', 'pending'),
('REQ-2024-005', 'JOB-152', 'Kumar Selvam', '2024-03-12', '2024-03-20', 'approved');

-- Insert Requisition Items
INSERT INTO requisition_items (req_id, sku, product_name, quantity_requested, quantity_issued) VALUES
-- REQ-2024-001
(1, 'AL-650-3M', 'Profile 650 3m', 20, 0),
(1, 'HG-X200', 'Hinge X-200', 8, 0),
-- REQ-2024-002
(2, 'GL-6MM-CLR', 'Glass 6mm Clear', 12, 0),
(2, 'RO-SS-01', 'Roller Stainless Set', 4, 0),
-- REQ-2024-003
(3, 'AL-500-3M', 'Profile 500 3m', 30, 30),
-- REQ-2024-004
(4, 'AL-750-6M', 'Profile 750 6m', 25, 0),
(4, 'HG-X300', 'Hinge Heavy Duty X-300', 6, 0),
(4, 'GL-8MM-TIN', 'Glass 8mm Tinted', 8, 0),
-- REQ-2024-005
(5, 'AL-800-4M', 'Profile 800 4m', 15, 0),
(5, 'SC-SEAL-10M', 'Rubber Seal Strip 10m', 3, 0);

-- Insert Transactions
INSERT INTO transactions (txn_number, txn_date, txn_type, sku, product_name, quantity, stock_before, stock_after, reference, user_name) VALUES
('TXN-001', '2024-03-05 09:14:00', 'purchase_receipt', 'AL-500-3M', 'Profile 500 3m', 100, 0, 100, 'GRN-2024-001', 'John Wong'),
('TXN-002', '2024-03-05 14:30:00', 'production_issue', 'AL-500-3M', 'Profile 500 3m', -15, 100, 85, 'REQ-2024-003', 'Ahmad Yusof'),
('TXN-003', '2024-03-07 10:00:00', 'adjustment', 'GL-8MM-TIN', 'Glass 8mm Tinted', -2, 24, 22, 'ADJ-2024-001', 'John Wong'),
('TXN-004', '2024-03-08 08:45:00', 'purchase_receipt', 'HG-P100', 'Pivot Hinge P-100', 20, 0, 20, 'GRN-2024-002', 'John Wong'),
('TXN-005', '2024-03-09 11:20:00', 'production_issue', 'GL-6MM-CLR', 'Glass 6mm Clear', -10, 55.5, 45.5, 'REQ-2024-002', 'Rahman Ali'),
('TXN-006', '2024-03-10 13:00:00', 'purchase_receipt', 'RO-SS-01', 'Roller Stainless Set', 25, 20, 45, 'GRN-2024-003', 'John Wong'),
('TXN-007', '2024-03-10 15:30:00', 'production_issue', 'RO-SS-01', 'Roller Stainless Set', -10, 45, 35, 'REQ-2024-002', 'Rahman Ali'),
('TXN-008', '2024-03-11 09:00:00', 'adjustment', 'AL-750-6M', 'Profile 750 6m', 5, 115, 120, 'ADJ-2024-002', 'John Wong'),
('TXN-009', '2024-03-12 10:15:00', 'purchase_receipt', 'SC-SEAL-10M', 'Rubber Seal Strip 10m', 8, 0, 8, 'GRN-2024-004', 'John Wong'),
('TXN-010', '2024-03-12 14:45:00', 'production_issue', 'SC-SEAL-10M', 'Rubber Seal Strip 10m', -2, 8, 6, 'REQ-2024-005', 'Kumar Selvam');

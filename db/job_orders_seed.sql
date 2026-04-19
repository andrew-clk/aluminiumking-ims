-- Sample Job Orders Data

-- Insert Job Orders
INSERT INTO job_orders (job_number, customer_name, project_name, description, order_date, due_date, start_date, completion_date, status, priority, location, contact_person, contact_phone, total_value, notes) VALUES
-- Ongoing Jobs
('JOB-145', 'TechCorp Sdn Bhd', 'Office Renovation Phase 2', 'Aluminium partitions and glass doors for 3rd floor office space', '2024-02-20', '2024-03-20', '2024-03-01', NULL, 'ongoing', 'high', 'Menara TechCorp, KL', 'Tan Sri Ahmad', '+60 12 345 6789', 85000.00, 'Rush order - client needs completion before March 25'),
('JOB-148', 'Sunshine Residences', 'Balcony Railings Installation', 'Custom aluminium railings for 12 balconies in residential tower', '2024-02-28', '2024-03-25', '2024-03-08', NULL, 'ongoing', 'normal', 'Damansara Heights, KL', 'David Wong', '+60 19 876 5432', 45000.00, ''),
('JOB-142', 'Modern Living Development', 'Shower Screens Supply', 'Frosted glass shower screens for 20 units', '2024-02-15', '2024-03-15', '2024-02-25', NULL, 'ongoing', 'normal', 'Mont Kiara, KL', 'Sarah Lim', '+60 16 234 5678', 32000.00, 'Installation by client contractor'),

-- Upcoming Jobs
('JOB-150', 'Grand Hotel KL', 'Lobby Entrance Doors', 'Large-scale glass entrance doors with stainless steel frames', '2024-03-05', '2024-04-10', NULL, NULL, 'upcoming', 'high', 'Bukit Bintang, KL', 'Manager Ali', '+60 12 111 2222', 125000.00, 'Site visit scheduled for March 18'),
('JOB-152', 'Green Valley Homes', 'Window Frames Package', 'Aluminium window frames for 8 semi-detached houses', '2024-03-08', '2024-04-05', NULL, NULL, 'upcoming', 'normal', 'Cyberjaya', 'Kumar Property', '+60 17 333 4444', 68000.00, 'Materials to be delivered by March 20'),
('JOB-155', 'City Mall Extension', 'Skylight Framework', 'Custom aluminium framework for glass skylight', '2024-03-10', '2024-04-20', NULL, NULL, 'upcoming', 'high', 'Petaling Jaya', 'Eng. Rahman', '+60 19 555 6666', 95000.00, 'Engineering drawings pending approval'),
('JOB-157', 'Luxury Villas Project', 'Premium Door Sets', 'High-end aluminium and glass door sets for 5 villas', '2024-03-12', '2024-04-15', NULL, NULL, 'upcoming', 'normal', 'Bangsar', 'Lisa Tan', '+60 16 777 8888', 78000.00, ''),

-- Completed Jobs
('JOB-138', 'ABC Manufacturing', 'Factory Partition Walls', 'Industrial aluminium partition system for factory floor', '2024-01-15', '2024-02-28', '2024-02-05', '2024-02-26', 'completed', 'normal', 'Shah Alam', 'John Lee', '+60 12 999 0000', 55000.00, 'Completed ahead of schedule'),
('JOB-140', 'Smart Office Tower', 'Conference Room Glass Walls', 'Frameless glass walls for 3 conference rooms', '2024-01-20', '2024-03-01', '2024-02-10', '2024-02-28', 'completed', 'normal', 'KLCC, KL', 'Michael Chen', '+60 19 111 3333', 42000.00, 'Client very satisfied'),
('JOB-135', 'Riverside Condos', 'Balcony Doors Upgrade', 'Sliding glass balcony doors for 15 units', '2024-01-10', '2024-02-20', '2024-01-25', '2024-02-18', 'completed', 'low', 'Ampang', 'Robert Tan', '+60 16 222 4444', 38000.00, '');

-- Insert Job Order Materials
INSERT INTO job_order_materials (job_order_id, sku, product_name, quantity_required, quantity_allocated, quantity_used, notes) VALUES
-- JOB-145 (Ongoing)
(1, 'AL-650-3M', 'Profile 650 3m', 60, 20, 18, 'Main structural profiles'),
(1, 'HG-X200', 'Hinge Heavy Duty X-200', 24, 8, 6, 'For partition doors'),
(1, 'GL-6MM-CLR', 'Glass 6mm Clear', 35, 12, 10, 'Office partition glass'),
(1, 'RO-SS-01', 'Roller Stainless Set', 8, 4, 2, 'Sliding door mechanisms'),

-- JOB-148 (Ongoing)
(2, 'AL-750-6M', 'Profile 750 6m', 48, 15, 12, 'Railing posts'),
(2, 'AL-500-3M', 'Profile 500 3m', 36, 12, 10, 'Horizontal rails'),
(2, 'SC-SEAL-10M', 'Rubber Seal Strip 10m', 8, 3, 2, 'Weather sealing'),

-- JOB-142 (Ongoing)
(3, 'GL-10MM-FRO', 'Glass 10mm Frosted', 25, 8, 8, 'Shower screens'),
(3, 'TR-T500', 'Track System T-500', 20, 0, 0, 'Glass door tracks - pending stock'),
(3, 'HG-P100', 'Pivot Hinge P-100', 40, 0, 0, 'Pivot hinges'),

-- JOB-150 (Upcoming)
(4, 'AL-800-4M', 'Profile 800 4m', 45, 0, 0, 'Heavy duty entrance frames'),
(4, 'GL-12MM-CLR', 'Glass 12mm Clear', 40, 0, 0, 'Entrance glass panels'),
(4, 'HG-X300', 'Hinge Heavy Duty X-300', 16, 0, 0, 'Heavy duty door hinges'),

-- JOB-152 (Upcoming)
(5, 'AL-500-3M', 'Profile 500 3m', 96, 0, 0, 'Window frame profiles'),
(5, 'GL-6MM-CLR', 'Glass 6mm Clear', 48, 0, 0, 'Window glass'),
(5, 'SC-SEAL-10M', 'Rubber Seal Strip 10m', 12, 0, 0, 'Window seals'),

-- JOB-155 (Upcoming)
(6, 'AL-800-4M', 'Profile 800 4m', 80, 0, 0, 'Skylight framework'),
(6, 'GL-8MM-TIN', 'Glass 8mm Tinted', 65, 0, 0, 'Tinted skylight panels'),

-- JOB-157 (Upcoming)
(7, 'AL-650-3M', 'Profile 650 3m', 40, 0, 0, 'Premium door frames'),
(7, 'GL-12MM-CLR', 'Glass 12mm Clear', 30, 0, 0, 'Premium glass doors'),
(7, 'LK-SS201', 'Lock Stainless Steel 201', 10, 0, 0, 'Door locks'),

-- JOB-138 (Completed)
(8, 'AL-750-6M', 'Profile 750 6m', 70, 70, 70, 'Used for partition frames'),
(8, 'GL-8MM-TIN', 'Glass 8mm Tinted', 45, 45, 45, 'Tinted partition glass'),

-- JOB-140 (Completed)
(9, 'GL-10MM-FRO', 'Glass 10mm Frosted', 28, 28, 28, 'Conference room walls'),
(9, 'TR-T500', 'Track System T-500', 12, 12, 12, 'Sliding wall tracks'),

-- JOB-135 (Completed)
(10, 'AL-500-3M', 'Profile 500 3m', 45, 45, 45, 'Door frames'),
(10, 'GL-6MM-CLR', 'Glass 6mm Clear', 30, 30, 30, 'Balcony doors'),
(10, 'RO-SS-01', 'Roller Stainless Set', 15, 15, 15, 'Sliding mechanisms');

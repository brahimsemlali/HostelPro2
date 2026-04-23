-- Seed data for HostelPro
-- Run after 001_initial_schema.sql
-- NOTE: Replace 'YOUR_USER_ID' with an actual Supabase auth user ID after creating a test account

-- Property
INSERT INTO properties (id, owner_id, name, address, city, phone, email, wifi_password, check_in_time, check_out_time, police_prefecture)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000', -- Replace with real user ID
  'Auberge Atlas',
  'Rue Ibn Battouta, Talborjt',
  'Agadir',
  '+212661234567',
  'contact@aubergeatlas.ma',
  'Atlas2024!',
  '14:00',
  '11:00',
  'Préfecture d''Agadir-Ida-Ou-Tanane'
);

-- Rooms
INSERT INTO rooms (id, property_id, name, type, floor, gender_policy) VALUES
('b1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Dortoir A', 'dorm', 1, 'mixed'),
('b1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Dortoir B', 'dorm', 1, 'mixed'),
('b1000003-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Dortoir C', 'dorm', 2, 'female'),
('b1000004-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Chambre Privée 1', 'private', 2, 'mixed');

-- Beds — Dortoir A (6 beds)
INSERT INTO beds (id, room_id, property_id, name, bunk_position, base_price, status) VALUES
('c1000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'A1', 'bottom', 120.00, 'occupied'),
('c1000002-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'A2', 'top', 110.00, 'occupied'),
('c1000003-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'A3', 'bottom', 120.00, 'available'),
('c1000004-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'A4', 'top', 110.00, 'dirty'),
('c1000005-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'A5', 'bottom', 120.00, 'occupied'),
('c1000006-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'A6', 'top', 110.00, 'available');

-- Beds — Dortoir B (6 beds)
INSERT INTO beds (id, room_id, property_id, name, bunk_position, base_price, status) VALUES
('c2000001-0000-0000-0000-000000000001', 'b1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'B1', 'bottom', 120.00, 'occupied'),
('c2000002-0000-0000-0000-000000000001', 'b1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'B2', 'top', 110.00, 'available'),
('c2000003-0000-0000-0000-000000000001', 'b1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'B3', 'bottom', 120.00, 'maintenance'),
('c2000004-0000-0000-0000-000000000001', 'b1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'B4', 'top', 110.00, 'occupied'),
('c2000005-0000-0000-0000-000000000001', 'b1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'B5', 'bottom', 120.00, 'available'),
('c2000006-0000-0000-0000-000000000001', 'b1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'B6', 'top', 110.00, 'available');

-- Beds — Dortoir C (4 beds)
INSERT INTO beds (id, room_id, property_id, name, bunk_position, base_price, status) VALUES
('c3000001-0000-0000-0000-000000000001', 'b1000003-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'C1', 'bottom', 120.00, 'occupied'),
('c3000002-0000-0000-0000-000000000001', 'b1000003-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'C2', 'top', 110.00, 'occupied'),
('c3000003-0000-0000-0000-000000000001', 'b1000003-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'C3', 'bottom', 120.00, 'available'),
('c3000004-0000-0000-0000-000000000001', 'b1000003-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'C4', 'top', 110.00, 'available');

-- Beds — Chambre Privée (2 beds)
INSERT INTO beds (id, room_id, property_id, name, bunk_position, base_price, status) VALUES
('c4000001-0000-0000-0000-000000000001', 'b1000004-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Lit 1', null, 350.00, 'occupied'),
('c4000002-0000-0000-0000-000000000001', 'b1000004-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Lit 2', null, 350.00, 'available');

-- Guests
INSERT INTO guests (id, property_id, first_name, last_name, email, phone, whatsapp, nationality, document_type, document_number, date_of_birth, gender, country_of_residence, profession) VALUES
('d1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Sophie', 'Dupont', 'sophie.dupont@email.fr', '+33612345678', '+33612345678', 'Française', 'passport', 'FR2024001', '1992-03-15', 'F', 'France', 'Enseignante'),
('d2000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Carlos', 'Martinez', 'carlos.m@email.es', '+34612345678', '+34612345678', 'Espagnole', 'passport', 'ES2024001', '1988-07-22', 'M', 'Espagne', 'Ingénieur'),
('d3000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Yuki', 'Tanaka', 'yuki.t@email.jp', '+819012345678', '+819012345678', 'Japonaise', 'passport', 'JP2024001', '1995-11-08', 'F', 'Japon', 'Designer'),
('d4000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Mohamed', 'Alami', null, '+212661234568', '+212661234568', 'Marocaine', 'cin', 'CIN001234', '1990-05-30', 'M', 'Maroc', 'Entrepreneur'),
('d5000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Emma', 'Schmidt', 'emma.s@email.de', '+4917612345678', '+4917612345678', 'Allemande', 'passport', 'DE2024001', '1997-09-14', 'F', 'Allemagne', 'Étudiante'),
('d6000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'James', 'Wilson', 'j.wilson@email.uk', '+447712345678', '+447712345678', 'Britannique', 'passport', 'GB2024001', '1985-01-25', 'M', 'Royaume-Uni', 'Photographe'),
('d7000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Fatima', 'Zahra', null, '+212671234567', '+212671234567', 'Marocaine', 'cin', 'CIN567890', '1993-12-03', 'F', 'Maroc', 'Médecin'),
('d8000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Lucas', 'Bernard', 'lucas.b@email.fr', '+33712345678', '+33712345678', 'Française', 'passport', 'FR2024002', '2001-04-18', 'M', 'France', 'Étudiant'),
('d9000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Ana', 'Rodrigues', 'ana.r@email.pt', '+351912345678', '+351912345678', 'Portugaise', 'passport', 'PT2024001', '1994-08-07', 'F', 'Portugal', 'Architecte'),
('d0000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Ahmed', 'Benali', null, '+212651234567', '+212651234567', 'Algérienne', 'passport', 'DZ2024001', '1989-06-20', 'M', 'Algérie', 'Commercant');

-- Bookings (mix of checked_in, confirmed, checked_out)
INSERT INTO bookings (id, property_id, guest_id, bed_id, source, status, check_in_date, check_out_date, adults, total_price, commission_rate) VALUES
-- Currently checked in
('e1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd1000001-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'booking_com', 'checked_in', CURRENT_DATE - 1, CURRENT_DATE + 3, 1, 480.00, 15),
('e2000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd2000001-0000-0000-0000-000000000001', 'c1000002-0000-0000-0000-000000000001', 'hostelworld', 'checked_in', CURRENT_DATE - 2, CURRENT_DATE + 1, 1, 330.00, 12),
('e3000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd3000001-0000-0000-0000-000000000001', 'c1000005-0000-0000-0000-000000000001', 'direct', 'checked_in', CURRENT_DATE, CURRENT_DATE + 5, 1, 600.00, 0),
('e4000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd4000001-0000-0000-0000-000000000001', 'c2000001-0000-0000-0000-000000000001', 'direct', 'checked_in', CURRENT_DATE - 3, CURRENT_DATE + 2, 1, 600.00, 0),
('e5000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd5000001-0000-0000-0000-000000000001', 'c2000004-0000-0000-0000-000000000001', 'booking_com', 'checked_in', CURRENT_DATE - 1, CURRENT_DATE + 4, 1, 550.00, 15),
('e6000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd6000001-0000-0000-0000-000000000001', 'c3000001-0000-0000-0000-000000000001', 'direct', 'checked_in', CURRENT_DATE - 4, CURRENT_DATE + 1, 1, 600.00, 0),
('e7000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd7000001-0000-0000-0000-000000000001', 'c3000002-0000-0000-0000-000000000001', 'walkin', 'checked_in', CURRENT_DATE, CURRENT_DATE + 2, 1, 240.00, 0),
('e8000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'c4000001-0000-0000-0000-000000000001', 'direct', 'checked_in', CURRENT_DATE - 1, CURRENT_DATE + 3, 1, 1400.00, 0),
-- Arriving today
('e9000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd8000001-0000-0000-0000-000000000001', 'c3000003-0000-0000-0000-000000000001', 'booking_com', 'confirmed', CURRENT_DATE, CURRENT_DATE + 3, 1, 360.00, 15),
('eA000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd9000001-0000-0000-0000-000000000001', 'c2000005-0000-0000-0000-000000000001', 'hostelworld', 'confirmed', CURRENT_DATE, CURRENT_DATE + 2, 1, 240.00, 12),
-- Future bookings
('eB000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'd1000001-0000-0000-0000-000000000001', 'c1000006-0000-0000-0000-000000000001', 'direct', 'confirmed', CURRENT_DATE + 7, CURRENT_DATE + 12, 1, 550.00, 0);

-- Payments
INSERT INTO payments (property_id, booking_id, guest_id, amount, method, type, status, payment_date) VALUES
('a1b2c3d4-0000-0000-0000-000000000001', 'e1000001-0000-0000-0000-000000000001', 'd1000001-0000-0000-0000-000000000001', 408.00, 'cash', 'payment', 'completed', NOW() - INTERVAL '1 day'),
('a1b2c3d4-0000-0000-0000-000000000001', 'e2000001-0000-0000-0000-000000000001', 'd2000001-0000-0000-0000-000000000001', 290.40, 'cash', 'payment', 'completed', NOW() - INTERVAL '2 days'),
('a1b2c3d4-0000-0000-0000-000000000001', 'e3000001-0000-0000-0000-000000000001', 'd3000001-0000-0000-0000-000000000001', 600.00, 'virement', 'payment', 'completed', NOW()),
('a1b2c3d4-0000-0000-0000-000000000001', 'e4000001-0000-0000-0000-000000000001', 'd4000001-0000-0000-0000-000000000001', 300.00, 'cash', 'deposit', 'completed', NOW() - INTERVAL '3 days'),
('a1b2c3d4-0000-0000-0000-000000000001', 'e5000001-0000-0000-0000-000000000001', 'd5000001-0000-0000-0000-000000000001', 467.50, 'cmi', 'payment', 'completed', NOW() - INTERVAL '1 day'),
('a1b2c3d4-0000-0000-0000-000000000001', 'e6000001-0000-0000-0000-000000000001', 'd6000001-0000-0000-0000-000000000001', 600.00, 'cash', 'payment', 'completed', NOW() - INTERVAL '4 days'),
('a1b2c3d4-0000-0000-0000-000000000001', 'e7000001-0000-0000-0000-000000000001', 'd7000001-0000-0000-0000-000000000001', 240.00, 'cash', 'payment', 'completed', NOW()),
('a1b2c3d4-0000-0000-0000-000000000001', 'e8000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 700.00, 'cash', 'deposit', 'completed', NOW() - INTERVAL '1 day'),
-- Historical payments last 7 days
('a1b2c3d4-0000-0000-0000-000000000001', null, null, 360.00, 'cash', 'payment', 'completed', NOW() - INTERVAL '5 days'),
('a1b2c3d4-0000-0000-0000-000000000001', null, null, 480.00, 'booking_com', 'payment', 'completed', NOW() - INTERVAL '5 days'),
('a1b2c3d4-0000-0000-0000-000000000001', null, null, 220.00, 'cash', 'payment', 'completed', NOW() - INTERVAL '6 days'),
('a1b2c3d4-0000-0000-0000-000000000001', null, null, 550.00, 'virement', 'payment', 'completed', NOW() - INTERVAL '6 days'),
('a1b2c3d4-0000-0000-0000-000000000001', null, null, 350.00, 'cash', 'payment', 'completed', NOW() - INTERVAL '7 days');

-- Maintenance requests
INSERT INTO maintenance (property_id, room_id, bed_id, title, description, priority, status, assigned_to) VALUES
('a1b2c3d4-0000-0000-0000-000000000001', 'b1000002-0000-0000-0000-000000000001', 'c2000003-0000-0000-0000-000000000001', 'Lit B3 cassé', 'Pied du lit inférieur fissuré, dangereux', 'urgent', 'open', 'Hassan'),
('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', null, 'Douche Dortoir A bouchée', 'Évacuation lente dans la douche du fond', 'normal', 'in_progress', 'Youssef plombier'),
('a1b2c3d4-0000-0000-0000-000000000001', 'b1000003-0000-0000-0000-000000000001', null, 'Ampoule grillée Dortoir C', 'Remplacement ampoule couloir dortoir C', 'low', 'resolved', 'Hassan');

-- Staff
INSERT INTO staff (property_id, name, role, phone, is_active) VALUES
('a1b2c3d4-0000-0000-0000-000000000001', 'Karim Bensouda', 'owner', '+212661234567', true),
('a1b2c3d4-0000-0000-0000-000000000001', 'Nadia Tazi', 'receptionist', '+212662345678', true),
('a1b2c3d4-0000-0000-0000-000000000001', 'Hassan Moussaoui', 'receptionist', '+212663456789', true);

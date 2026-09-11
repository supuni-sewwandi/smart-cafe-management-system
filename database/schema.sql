-- ============================================================
-- Bean & Brew — Database Schema
-- ============================================================
-- Run this once to create the database and all tables.
-- Usage (MySQL command line or Workbench):
--   mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS bean_and_brew
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bean_and_brew;

-- ============================================================
-- 1. CUSTOMER ACCOUNTS  (Epic 01 — US01.1, US01.2, US01.3)
-- ============================================================
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(30),
  address       VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 2. ADMIN / STAFF ACCOUNTS  (Epic 03 — US03.11, US03.12)
-- ============================================================
CREATE TABLE admin_accounts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('Cafe Owner','Cafe Manager','System Administrator','Cashier','Inventory Manager','Cafe Staff') NOT NULL,
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Which modules each role is allowed to open (US03.12)
CREATE TABLE role_permissions (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  role    ENUM('Cafe Owner','Cafe Manager','System Administrator','Cashier','Inventory Manager','Cafe Staff') NOT NULL,
  module  ENUM('Orders','Inventory','Suppliers','Staff','Reports','System Admin') NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY unique_role_module (role, module)
) ENGINE=InnoDB;

-- ============================================================
-- 3. MENU ITEMS  (Epic 01 — US01.4; feeds the customer menu page)
-- ============================================================
CREATE TABLE menu_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  category    ENUM('coffee','cold','food') NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  description VARCHAR(255),
  photo_url   VARCHAR(500),
  badge       VARCHAR(40),
  rating      DECIMAL(2,1) DEFAULT 4.5,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 4. ORDERS  (Epic 01/02 — US01.5-01.8, US02.3-02.6, US02.8-02.12)
-- ============================================================
CREATE TABLE orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  order_type     ENUM('pickup','delivery') NOT NULL,
  address        VARCHAR(255),
  payment_method ENUM('cash','card') NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  delivery_fee   DECIMAL(10,2) NOT NULL DEFAULT 0,
  total          DECIMAL(10,2) NOT NULL,
  status         ENUM('new','prep','ready','completed','cancelled') NOT NULL DEFAULT 'new',
  refund_status  ENUM('none','requested','processed') NOT NULL DEFAULT 'none',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,
  menu_item_id INT,
  item_name    VARCHAR(120) NOT NULL,   -- snapshot of the name at order time
  price        DECIMAL(10,2) NOT NULL,  -- snapshot of the price at order time
  qty          INT NOT NULL DEFAULT 1,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 5. RESERVATIONS  (Epic 02 — US02.1, US02.2)
-- ============================================================
CREATE TABLE reservations (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  res_date   DATE NOT NULL,
  res_time   VARCHAR(20) NOT NULL,
  guests     INT NOT NULL,
  name       VARCHAR(120) NOT NULL,
  phone      VARCHAR(30) NOT NULL,
  status     ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 6. FEEDBACK  (Epic 01 — US01.9)
-- ============================================================
CREATE TABLE feedback (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  order_id   INT,
  rating     TINYINT NOT NULL,
  comment    VARCHAR(1000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 7. NOTIFICATIONS  (Epic 02 — US02.7)
-- ============================================================
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  message    VARCHAR(255) NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 8. SUPPLIERS  (Epic 03 — US03.4, US03.6, US03.7)
-- ============================================================
CREATE TABLE suppliers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  contact_person VARCHAR(120),
  phone          VARCHAR(30),
  items_supplied VARCHAR(255)
) ENGINE=InnoDB;

-- ============================================================
-- 9. INVENTORY  (Epic 03 — US03.1, US03.2, US03.3)
-- ============================================================
CREATE TABLE inventory (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  unit          VARCHAR(20) NOT NULL,
  stock         DECIMAL(10,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  supplier_id   INT,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE purchases (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id  INT NOT NULL,
  supplier_id   INT,
  qty           DECIMAL(10,2) NOT NULL,
  cost          DECIMAL(10,2) NOT NULL,
  status        ENUM('requested','confirmed','shipped','delivered') NOT NULL DEFAULT 'requested',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE waste_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id INT NOT NULL,
  qty          DECIMAL(10,2) NOT NULL,
  reason       VARCHAR(255),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 10. STAFF DIRECTORY & TEAM UPDATES  (Epic 03 — US03.9, US03.10, US03.14)
-- ============================================================
CREATE TABLE staff (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  name    VARCHAR(120) NOT NULL,
  role    VARCHAR(60) NOT NULL,
  shift   VARCHAR(60) NOT NULL,
  contact VARCHAR(30),
  status  ENUM('active','off') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB;

CREATE TABLE team_posts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  author     VARCHAR(150) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA — default admin login + default role permissions
-- ============================================================

-- Default admin account
-- email: admin@beanandbrew.cafe   password: BnB-Admin#2026
-- (password_hash below is a bcrypt hash of "BnB-Admin#2026" — the backend
--  verifies it with bcrypt.compare, never store or check plain text passwords)
INSERT INTO admin_accounts (full_name, email, password_hash, role, status) VALUES
('Bean & Brew Admin', 'admin@beanandbrew.cafe', '$2b$10$EnSkhvznCbnMTJCc17C0SOOxkpbiaInqrFu8n9PyQEDXvz.Y3cufW', 'System Administrator', 'active');

-- Default role permission matrix
INSERT INTO role_permissions (role, module, allowed) VALUES
('Cafe Owner','Orders',TRUE),('Cafe Owner','Inventory',TRUE),('Cafe Owner','Suppliers',TRUE),('Cafe Owner','Staff',TRUE),('Cafe Owner','Reports',TRUE),('Cafe Owner','System Admin',TRUE),
('Cafe Manager','Orders',TRUE),('Cafe Manager','Inventory',TRUE),('Cafe Manager','Suppliers',TRUE),('Cafe Manager','Staff',TRUE),('Cafe Manager','Reports',TRUE),('Cafe Manager','System Admin',FALSE),
('System Administrator','Orders',FALSE),('System Administrator','Inventory',FALSE),('System Administrator','Suppliers',FALSE),('System Administrator','Staff',FALSE),('System Administrator','Reports',FALSE),('System Administrator','System Admin',TRUE),
('Cashier','Orders',TRUE),('Cashier','Inventory',FALSE),('Cashier','Suppliers',FALSE),('Cashier','Staff',FALSE),('Cashier','Reports',FALSE),('Cashier','System Admin',FALSE),
('Inventory Manager','Orders',FALSE),('Inventory Manager','Inventory',TRUE),('Inventory Manager','Suppliers',TRUE),('Inventory Manager','Staff',FALSE),('Inventory Manager','Reports',FALSE),('Inventory Manager','System Admin',FALSE),
('Cafe Staff','Orders',TRUE),('Cafe Staff','Inventory',FALSE),('Cafe Staff','Suppliers',FALSE),('Cafe Staff','Staff',FALSE),('Cafe Staff','Reports',FALSE),('Cafe Staff','System Admin',FALSE);

-- Starter menu items (matches the current static menu.html)
INSERT INTO menu_items (name, category, price, description, photo_url, badge, rating) VALUES
('Classic Espresso','coffee',450,'A double shot pulled to order — rich crema, bold and intense.','https://i.pinimg.com/736x/ec/cf/fa/eccffa2956e07ba9ca768283b736e857.jpg','Best Seller',4.8),
('House Cappuccino','coffee',550,'Steamed milk poured over espresso in a soft rosetta, cinnamon dust.','https://i.pinimg.com/1200x/d6/d2/50/d6d250621f61eb751e6c848342b16395.jpg',NULL,4.8),
('Slow Cold Brew','cold',600,'Steeped 18 hours over ice — smooth, low-acid, quietly strong.','https://i.pinimg.com/736x/f7/02/79/f70279b0e41a921f5871d10fcb7aa0b8.jpg','Hot',4.7),
('Butter Croissant','food',350,'Laminated by hand and baked fresh each morning.','https://i.pinimg.com/736x/6d/21/d6/6d21d6fcf3eb2093022163b245a8cffb.jpg',NULL,4.9);

-- Starter inventory + suppliers
INSERT INTO suppliers (name, contact_person, phone, items_supplied) VALUES
('Ceylon Coffee Traders','Mr. Perera','0771112233','Coffee beans, cold brew concentrate'),
('Fresh Dairy Co.','Ms. Fernando','0712223344','Milk, oat milk, cream'),
('Golden Bakes Supply','Mr. Silva','0763334455','Croissant dough, pastries');

INSERT INTO inventory (name, unit, stock, reorder_level, cost_per_unit, supplier_id) VALUES
('Espresso Beans','kg',38,15,2200,1),
('Oat Milk','L',6,20,650,2),
('Croissant Dough','kg',14,10,900,3);

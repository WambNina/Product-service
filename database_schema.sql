CREATE DATABASE IF NOT EXISTS product_service_db ;
USE product_service_db;
--CHARACTER SET utf8mb4 
--COLLATE utf8mb4_unicode_ci;

USE product_service_db;

CREATE TABLE IF NOT EXISTS products (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    merchant_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    category_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    sku VARCHAR(100) UNIQUE,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    compare_at_price DECIMAL(10, 2),
    cost_price DECIMAL(10, 2),
    quantity INT DEFAULT 0,
    images VARCHAR(500),
    weight DECIMAL(8, 2),
    weight_unit ENUM('kg', 'g', 'lb', 'oz') DEFAULT 'kg',
    status ENUM('draft', 'active', 'archived', 'out_of_stock', 'payment_expired') DEFAULT 'draft',
    visibility ENUM('draft', 'visible', 'hidden', 'payment_required') DEFAULT 'public',
    is_free_tier BOOLEAN DEFAULT TRUE,
    payment_plan ENUM('free', 'monthly', 'yearly') DEFAULT 'free',
    payment_expires_at DATETIME,
    payment_renewal_reminder_sent BOOLEAN DEFAULT FALSE,
    tax_class VARCHAR(50) DEFAULT 'standard',
    tags JSON,
    seo_title VARCHAR(70),
    seo_description VARCHAR(160),
    meta_keywords VARCHAR(255),
    attributes_schema JSON,
    has_variants BOOLEAN DEFAULT FALSE,
    variant_attributes JSON,
    source ENUM('web', 'whatsapp', 'api', 'bulk_import') DEFAULT 'web',
    whatsapp_media_group_id VARCHAR(100),
    featured BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    view_count INT DEFAULT 0,
    sales_count INT DEFAULT 0,
    rating_average DECIMAL(2, 1) DEFAULT 0.0,
    rating_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_merchant_id (merchant_id),
    INDEX idx_store_id (store_id),
    INDEX idx_category_id (category_id),
    INDEX idx_status (status),
    INDEX idx_visibility (visibility),
    INDEX idx_payment_expires (payment_expires_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id CHAR(36) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    attributes JSON NOT NULL,
    color VARCHAR(50),
    size VARCHAR(20),
    material VARCHAR(50),
    pattern VARCHAR(50),
    price_adjustment DECIMAL(10, 2) DEFAULT 0.00,
    final_price DECIMAL(10, 2),
    price DECIMAL(10, 2),
    compare_at_price DECIMAL(10, 2),
    quantity INT DEFAULT 0,
    weight DECIMAL(8, 2),
    image_id CHAR(36),
    is_default BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'out_of_stock', 'discontinued') DEFAULT 'active',
    position INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_id_status (product_id, status),
    INDEX idx_color_size (color, size),
    INDEX idx_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id CHAR(36) NOT NULL,
    variant_id CHAR(36),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    size_bytes INT NOT NULL,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    medium_url VARCHAR(500),
    large_url VARCHAR(500),
    width INT,
    height INT,
    alt_text VARCHAR(255),
    caption VARCHAR(500),
    position INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    source ENUM('upload', 'whatsapp', 'url', 'api') DEFAULT 'upload',
    whatsapp_media_id VARCHAR(100),
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    INDEX idx_product_id (product_id),
    INDEX idx_variant_id (variant_id),
    INDEX idx_is_primary (is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_attributes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id CHAR(36) NOT NULL,
    name VARCHAR(50) NOT NULL,
    value VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    type ENUM('text', 'number', 'boolean', 'select', 'multiselect', 'date') DEFAULT 'text',
    unit VARCHAR(20),
    is_variant_attribute BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    is_filterable BOOLEAN DEFAULT FALSE,
    position INT DEFAULT 0,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_id_name (product_id, name),
    INDEX idx_is_variant (is_variant_attribute)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_payment_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id CHAR(36) NOT NULL,
    merchant_id CHAR(36) NOT NULL,
    plan ENUM('free', 'monthly', 'yearly') NOT NULL,
    amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    started_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_merchant_id (merchant_id),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_analytics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    merchant_id CHAR(36) NOT NULL,
    view_date DATE NOT NULL,
    view_count INT DEFAULT 0,
    unique_visitors INT DEFAULT 0,
    sales_count INT DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_product_date (product_id, view_date),
    INDEX idx_store_date (store_id, view_date),
    INDEX idx_merchant_date (merchant_id, view_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_media_temp (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    media_group_id VARCHAR(100) NOT NULL,
    media_id VARCHAR(100) NOT NULL,
    merchant_id CHAR(36) NOT NULL,
    url VARCHAR(500),
    local_path VARCHAR(500),
    status ENUM('pending', 'downloaded', 'processed', 'failed') DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    
    INDEX idx_media_group (media_group_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock table for products and variants
CREATE TABLE IF NOT EXISTS product_stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255) NULL,
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    alert_threshold INT DEFAULT 10,
    last_movement_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_variant (product_id, variant_id)
);

-- Stock movement history (audit trail)
CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255) NULL,
    movement_type ENUM('increase', 'decrease', 'adjustment', 'initial') NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reason VARCHAR(255),
    reference_id VARCHAR(100),
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    INDEX idx_product_movements (product_id, created_at)
);
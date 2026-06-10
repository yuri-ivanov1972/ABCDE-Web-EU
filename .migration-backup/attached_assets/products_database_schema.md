
# Product and Ingredient Database Schema

This document describes the database schema for storing product and ingredient information.

## Tables

### Products
Stores basic product information.
```sql
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    rimi_url TEXT UNIQUE,
    category_id INTEGER NOT NULL,
    quantity_value DECIMAL(10,2),
    quantity_unit VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
```

### NutritionFacts
Stores nutritional information for products.
```sql
CREATE TABLE nutritionfacts (
    nutrition_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL UNIQUE,
    ingredients_text TEXT,
    energy_kcal INTEGER,
    energy_kj INTEGER,
    fat_total DECIMAL(10,2),
    fat_saturated DECIMAL(10,2),
    carbs_total DECIMAL(10,2),
    carbs_sugars DECIMAL(10,2),
    protein DECIMAL(10,2),
    salt DECIMAL(10,2),
    fiber DECIMAL(10,2),
    nutri_score_grade CHAR(1),
    nutri_score_points INTEGER,
    data_source_date TIMESTAMP WITH TIME ZONE
)
```

### ProductPhotos
Stores product images.
```sql
CREATE TABLE productphotos (
    photo_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    photo_url TEXT NOT NULL,
    alt_text TEXT,
    is_primary BOOLEAN DEFAULT false
)
```

### IngredientAnalysis
Stores unique ingredients and their frequency across products.
```sql
CREATE TABLE ingredient_analysis (
    id SERIAL PRIMARY KEY,
    ingredient TEXT NOT NULL UNIQUE,
    frequency INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE
)
```

### IngredientProductMapping
Maps ingredients to products (many-to-many relationship).
```sql
CREATE TABLE ingredient_product_mapping (
    ingredient_id INTEGER NOT NULL,
    product_sku TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (ingredient_id, product_sku)
)
```

## Key Features

- Product tracking with SKUs and categories
- Detailed nutritional information
- Product photo management
- Ingredient analysis and frequency tracking
- Many-to-many relationship between products and ingredients

## Common Queries

### Get Product Details
```sql
SELECT p.*, n.*, ph.photo_url 
FROM products p
LEFT JOIN nutritionfacts n ON p.product_id = n.product_id
LEFT JOIN productphotos ph ON p.product_id = ph.product_id
WHERE p.sku = 'product_sku'
```

### Get Product Ingredients
```sql
SELECT ia.ingredient
FROM ingredient_analysis ia
JOIN ingredient_product_mapping ipm ON ia.id = ipm.ingredient_id
WHERE ipm.product_sku = 'product_sku'
```

### Get Most Common Ingredients
```sql
SELECT ingredient, frequency
FROM ingredient_analysis
ORDER BY frequency DESC
LIMIT 10
```

## Performance Considerations

The database includes indexes for:
- Product SKUs
- Product names (using gin_trgm_ops for text search)
- Category IDs
- Nutrition facts
- Ingredient frequencies

These indexes optimize common queries and searches across the database.

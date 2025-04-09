
# Rimi Categories Database Documentation

## Overview
This database contains normalized product categories from Rimi supermarket. The structure is hierarchical with three levels of categories.

## Database Tables

### 1. normalized_categories
Main table storing the hierarchical category structure.

#### Columns:
- `category_id` (SERIAL PRIMARY KEY): Unique identifier for each category
- `rimi_category_code` (VARCHAR(20) UNIQUE): Unique category code (format: SH-XX-YY-ZZ)
- `name_lv` (TEXT): Category name in Latvian
- `name_en` (TEXT): Category name in English
- `parent_category_id` (INTEGER): Reference to parent category (NULL for level 1)
- `level` (INTEGER): Category level (1-3)

#### Constraints:
- Valid parent reference check: Level 1 categories must have NULL parent_id, levels 2-3 must have valid parent_id
- Unique rimi_category_code
- Foreign key on parent_category_id referencing category_id

#### Indexes:
- Primary key on category_id
- Index on parent_category_id
- Index on rimi_category_code

### Category Levels

1. **Level 1** (Main Categories)
   - Example: "SH-11" - Vegāniem un veģetāriešiem / For vegans and vegetarians

2. **Level 2** (Subcategories)
   - Example: "SH-11-10" - Vegāniem un veģetāriešiem / For vegans and vegetarians

3. **Level 3** (Detailed Categories)
   - Example: "SH-11-10-1" - Vegāniem un veģetāriešiem - Siers / For vegans and vegetarians - Cheese

## Usage Example
```sql
-- Get all Level 1 categories
SELECT category_id, rimi_category_code, name_en 
FROM normalized_categories 
WHERE level = 1;

-- Get subcategories for a specific parent
SELECT category_id, rimi_category_code, name_en 
FROM normalized_categories 
WHERE parent_category_id = [parent_id];

-- Get full category path
WITH RECURSIVE category_path AS (
  SELECT category_id, rimi_category_code, name_en, level, parent_category_id, 
         ARRAY[name_en] as path
  FROM normalized_categories
  WHERE category_id = [target_category_id]
  
  UNION ALL
  
  SELECT c.category_id, c.rimi_category_code, c.name_en, c.level, 
         c.parent_category_id, array_prepend(c.name_en, p.path)
  FROM normalized_categories c
  JOIN category_path p ON c.category_id = p.parent_category_id
)
SELECT * FROM category_path;
```

## Connection Details
Use the following environment variable for database connection:
```
CATEGORIES_DB_URL=postgresql://[username]:[password]@[host]:[port]/[dbname]
```

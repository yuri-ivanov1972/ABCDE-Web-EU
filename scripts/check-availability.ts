import { neon } from '@neondatabase/serverless';

const rimiDb = neon(process.env.RIMI_DATABASE_URL!);
const maximaDb = neon(process.env.MAXIMA_DATABASE_URL!);

async function checkAvailability() {
  console.log('=== RIMI DATABASE ===');
  
  // Check availability distribution
  const rimiAvailability = await rimiDb`
    SELECT is_available, COUNT(DISTINCT product_id) as product_count 
    FROM product_price_history 
    GROUP BY is_available
  `;
  console.log('Rimi availability distribution:', JSON.stringify(rimiAvailability, null, 2));
  
  // Check latest availability per product (most recent record)
  const rimiLatest = await rimiDb`
    WITH latest_prices AS (
      SELECT product_id, is_available, recorded_at,
             ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY recorded_at DESC) as rn
      FROM product_price_history
    )
    SELECT is_available, COUNT(*) as count
    FROM latest_prices
    WHERE rn = 1
    GROUP BY is_available
  `;
  console.log('Rimi latest availability per product:', JSON.stringify(rimiLatest, null, 2));
  
  // Check if there's an index on product_id and recorded_at
  const rimiIndexes = await rimiDb`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'product_price_history'
  `;
  console.log('Rimi indexes on product_price_history:', JSON.stringify(rimiIndexes, null, 2));
  
  console.log('\n=== MAXIMA DATABASE ===');
  
  // Check if product_price_history exists in Maxima
  try {
    const maximaTables = await maximaDb`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%price%' OR table_name LIKE '%history%')
    `;
    console.log('Maxima tables with price/history:', JSON.stringify(maximaTables, null, 2));
    
    if (maximaTables.length > 0) {
      const maximaAvailability = await maximaDb`
        SELECT is_available, COUNT(DISTINCT product_id) as product_count 
        FROM product_price_history 
        GROUP BY is_available
      `;
      console.log('Maxima availability distribution:', JSON.stringify(maximaAvailability, null, 2));
      
      const maximaLatest = await maximaDb`
        WITH latest_prices AS (
          SELECT product_id, is_available, recorded_at,
                 ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY recorded_at DESC) as rn
          FROM product_price_history
        )
        SELECT is_available, COUNT(*) as count
        FROM latest_prices
        WHERE rn = 1
        GROUP BY is_available
      `;
      console.log('Maxima latest availability per product:', JSON.stringify(maximaLatest, null, 2));
      
      const maximaIndexes = await maximaDb`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'product_price_history'
      `;
      console.log('Maxima indexes on product_price_history:', JSON.stringify(maximaIndexes, null, 2));
    }
  } catch (e: any) {
    console.log('Maxima error:', e.message);
  }
}

checkAvailability();

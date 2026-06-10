import { neon } from '@neondatabase/serverless';

const rimiDb = neon(process.env.RIMI_DATABASE_URL!);

async function checkTables() {
  // Check if product_price_history table exists
  const tables = await rimiDb`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%price%' OR table_name LIKE '%history%')
  `;
  console.log('Tables with price/history:', JSON.stringify(tables, null, 2));
  
  // Check product_price_history structure if it exists
  try {
    const columns = await rimiDb`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'product_price_history'
      ORDER BY ordinal_position
    `;
    console.log('product_price_history columns:', JSON.stringify(columns, null, 2));
    
    // Sample data
    const sample = await rimiDb`
      SELECT * FROM product_price_history LIMIT 3
    `;
    console.log('Sample data:', JSON.stringify(sample, null, 2));
    
    // Check availability values
    const availabilityValues = await rimiDb`
      SELECT DISTINCT availability_status, COUNT(*) as count 
      FROM product_price_history 
      GROUP BY availability_status
    `;
    console.log('Availability status values:', JSON.stringify(availabilityValues, null, 2));
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

checkTables();

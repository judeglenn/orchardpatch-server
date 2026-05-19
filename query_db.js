const pool = require('./src/db');

async function runQueries() {
  try {
    console.log("=== Fix 2: Ollama Status ===\n");
    
    console.log("Q1: Ollama in apps table");
    const q1 = await pool.query(`
      SELECT device_id, name, installomator_label, version, source
      FROM apps WHERE name ILIKE '%ollama%'
      ORDER BY device_id, name;
    `);
    console.log(JSON.stringify(q1.rows, null, 2));
    
    console.log("\n\nQ2: Ollama in latest_versions table");
    const q2 = await pool.query(`
      SELECT * FROM latest_versions WHERE label ILIKE '%ollama%';
    `);
    console.log(JSON.stringify(q2.rows, null, 2));
    
    console.log("\n\nQ3: Ollama in catalog");
    const q3 = await pool.query(`
      SELECT * FROM app_catalog WHERE app_name ILIKE '%ollama%';
    `);
    console.log(JSON.stringify(q3.rows, null, 2));
    
    console.log("\n\n=== Fix 3: Canva Status ===\n");
    
    console.log("Q4: Canva in catalog");
    const q4 = await pool.query(`
      SELECT * FROM app_catalog WHERE app_name ILIKE '%canva%';
    `);
    console.log(JSON.stringify(q4.rows, null, 2));
    
    console.log("\n\nQ5: Canva in latest_versions");
    const q5 = await pool.query(`
      SELECT * FROM latest_versions WHERE label ILIKE '%canva%';
    `);
    console.log(JSON.stringify(q5.rows, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

runQueries();

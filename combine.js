const fs = require('fs');
const path = require('path');

/**
 * Combine and flatten all JSON files in the src directory into one big JSON file
 * 
 * Reads all JSON files from the src directory, merges all key-value pairs
 * into a single flat object, and writes the result to an output file.
 */

function combineJSONFiles(srcDir, outputPath) {
  try {
    // Read all files in the src directory
    const files = fs.readdirSync(srcDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.error(`No JSON files found in ${srcDir}`);
      process.exit(1);
    }
    
    console.log(`Found ${jsonFiles.length} JSON file(s) to combine:`);
    
    // Combined result object
    const combined = {};
    let totalKeys = 0;
    
    // Process each JSON file
    for (const file of jsonFiles) {
      const filePath = path.join(srcDir, file);
      console.log(`  Reading: ${file}`);
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileContent);
        
        // Merge all keys from this file into the combined object
        const keys = Object.keys(jsonData);
        for (const key of keys) {
          if (combined.hasOwnProperty(key)) {
            console.warn(`    Warning: Duplicate key "${key}" found. Overwriting with value from ${file}`);
          }
          combined[key] = jsonData[key];
        }
        
        totalKeys += keys.length;
        console.log(`    ✓ Added ${keys.length} keys`);
        
      } catch (error) {
        console.error(`    ✗ Error reading ${file}:`, error.message);
        // Continue with other files
      }
    }
    
    // Write the combined result
    console.log(`\nWriting combined JSON to: ${outputPath}`);
    fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2), 'utf8');
    
    console.log(`✓ Successfully combined ${totalKeys} keys from ${jsonFiles.length} file(s)`);
    console.log(`✓ Output written to: ${outputPath}`);
    
    return combined;
    
  } catch (error) {
    console.error(`Error combining JSON files:`, error.message);
    throw error;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  // Default paths
  const srcDir = args[0] || path.join(__dirname, 'src');
  const outputPath = args[1] || path.join(__dirname, 'combined.json');
  
  // Ensure src directory exists
  if (!fs.existsSync(srcDir)) {
    console.error(`Error: Source directory does not exist: ${srcDir}`);
    process.exit(1);
  }
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  combineJSONFiles(srcDir, outputPath);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  combineJSONFiles
};


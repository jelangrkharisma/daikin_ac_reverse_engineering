const fs = require('fs');
const path = require('path');

/**
 * Normalize and transform JSON files from input format to target format
 * 
 * Input format: { "operatingMode-swingMode-fanMode-temperature": "IR Command" }
 * Target format: commands.fanMode.swingMode.temperature
 * 
 * The script extracts all information from the JSON object keys themselves.
 */

function normalizeKey(key) {
  // Keys are in format: "operatingMode-swingMode-fanMode-temperature"
  // Example: "cool-on-auto_quiet-16"
  const parts = key.split('-');
  
  if (parts.length < 4) {
    throw new Error(`Invalid key format: ${key}. Expected format: operatingMode-swingMode-fanMode-temperature`);
  }
  
  // Last part is temperature (may contain decimal, e.g., "16.5")
  const temperature = parts[parts.length - 1];
  
  // First part is operatingMode
  const operatingMode = parts[0];
  
  // Second part is swingMode
  const swingMode = parts[1];
  
  // Everything in between (if any) plus the third part is fanMode
  // For "cool-on-auto_quiet-16", fanMode is "auto_quiet"
  const fanMode = parts.slice(2, -1).join('_');
  
  return {
    operatingMode,
    swingMode,
    fanMode,
    temperature
  };
}

function transformJSON(inputData) {
  const output = {
    commands: {}
  };
  
  // Process each key-value pair in the input
  for (const [key, value] of Object.entries(inputData)) {
    const normalized = normalizeKey(key);
    
    // Build the nested structure: commands.fanMode.swingMode.temperature
    if (!output.commands[normalized.fanMode]) {
      output.commands[normalized.fanMode] = {};
    }
    
    if (!output.commands[normalized.fanMode][normalized.swingMode]) {
      output.commands[normalized.fanMode][normalized.swingMode] = {};
    }
    
    output.commands[normalized.fanMode][normalized.swingMode][normalized.temperature] = value;
  }
  
  return output;
}

function processFile(inputPath, outputPath) {
  try {
    // Read input file
    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    console.log(`Processing: ${inputPath}`);
    
    // Transform the JSON (all info extracted from keys)
    const outputData = transformJSON(inputData);
    
    // Write output file
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
    
    console.log(`  ✓ Successfully wrote: ${outputPath}`);
    console.log(`  ✓ Processed ${Object.keys(inputData).length} commands\n`);
    
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error.message);
    throw error;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node generator.js <input-file> [output-file]');
    console.error('  If output-file is not provided, it will be generated from input filename');
    process.exit(1);
  }
  
  const inputPath = args[0];
  let outputPath = args[1];
  
  // Generate output path if not provided
  if (!outputPath) {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, '.json');
    outputPath = path.join(dir, `${basename}.transformed.json`);
  }
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  processFile(inputPath, outputPath);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  normalizeKey,
  transformJSON,
  processFile
};


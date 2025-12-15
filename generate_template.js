const fs = require('fs');
const path = require('path');

/**
 * Generate template keys for JSON objects
 * 
 * Takes three parameters: operatingMode, swingMode, fanMode
 * Generates keys in format: - operatingMode-swingMode-fanMode-temperature
 * Temperature range: 16 to 32 with 0.5 increments
 * Output saved to: operatingMode/operatingMode.swingMode.fanMode.txt
 */

function generateTemplate(operatingMode, swingMode, fanMode) {
  // Guard: Check if JSON file already exists in src directory before proceeding
  const srcDir = path.join(__dirname, 'src');
  const jsonFilename = `${operatingMode}.${swingMode}.${fanMode}.json`;
  const jsonPath = path.join(srcDir, jsonFilename);
  
  if (fs.existsSync(jsonPath)) {
    console.error(`\n❌ Aborted: JSON file already exists in src directory`);
    console.error(`   File: ${jsonPath}`);
    console.error(`   To prevent overwriting existing data, the operation was cancelled.`);
    console.error(`   If you need to regenerate, please delete or rename the existing file first.\n`);
    return null;
  }
  
  // Generate temperature values from 16 to 32 with 0.5 increments
  const temperatures = [];
  for (let temp = 16; temp <= 32; temp += 0.5) {
    // Format to avoid floating point precision issues
    const formattedTemp = temp % 1 === 0 ? temp.toString() : temp.toFixed(1);
    temperatures.push(formattedTemp);
  }
  
  // Generate template keys
  const keys = temperatures.map(temp => {
    return `- ${operatingMode}-${swingMode}-${fanMode}-${temp}`;
  });
  
  // Create output directory (named after operatingMode)
  const outputDir = path.join(__dirname, operatingMode);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create output filename: operatingMode.swingMode.fanMode.txt
  const filename = `${operatingMode}.${swingMode}.${fanMode}.txt`;
  const outputPath = path.join(outputDir, filename);
  
  // Write keys to file (one per line)
  const content = keys.join('\n') + '\n';
  fs.writeFileSync(outputPath, content, 'utf8');
  
  // Create empty JSON file in src directory
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }
  
  const emptyJson = {};
  fs.writeFileSync(jsonPath, JSON.stringify(emptyJson, null, 2) + '\n', 'utf8');
  
  // Check for power saving features
  const allParams = `${operatingMode} ${swingMode} ${fanMode}`;
  const hasPowerSaving = allParams.includes('power_saving') || allParams.includes('power_saving_plus');
  const hasComfort = allParams.includes('comfort');
  
  console.log(`Generated template for:`);
  console.log(`  Operating Mode: ${operatingMode}`);
  console.log(`  Swing Mode: ${swingMode}`);
  console.log(`  Fan Mode: ${fanMode}`);
  console.log(`  Temperature range: 16 to 32 (0.5 increments)`);
  console.log(`  Total keys: ${keys.length}`);
  if (hasPowerSaving) {
    console.log(`  Power Saving: enabled`);
    if (allParams.includes('power_saving_plus')) {
      console.log(`  Power Saving Plus: enabled`);
    }
  }
  if (hasComfort) {
    console.log(`  Comfort Mode: active`);
  }
  console.log(`  Template file: ${outputPath}`);
  console.log(`  JSON file: ${jsonPath}`);
  
  return {
    outputPath,
    jsonPath,
    keys,
    count: keys.length
  };
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: node generate_template.js <operatingMode> <swingMode> <fanMode>');
    console.error('');
    console.error('Example:');
    console.error('  node generate_template.js cool on_power_saving night_quiet');
    console.error('  node generate_template.js cool on auto');
    process.exit(1);
  }
  
  const operatingMode = args[0];
  const swingMode = args[1];
  const fanMode = args[2];
  
  const result = generateTemplate(operatingMode, swingMode, fanMode);
  if (result === null) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  generateTemplate
};


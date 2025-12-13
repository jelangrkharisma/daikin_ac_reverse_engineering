const fs = require('fs');
const path = require('path');

// Read the input file
const inputFile = path.join(__dirname, 'src', 'fan_only.json');
const outputFile = path.join(__dirname, 'src', 'fan_only.json');

// Read the existing fan_only.json
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Generate temperatures from 16 to 32 with 0.5 increments
const temperatures = [];
for (let temp = 16; temp <= 32; temp += 0.5) {
  temperatures.push(temp);
}

// Create new object with temperature variations
const output = {};

// For each entry in the original file
for (const [key, value] of Object.entries(data)) {
  // Extract the base key (e.g., "fan_only-on-auto" from "fan_only-on-auto")
  const baseKey = key;
  
  // Generate entries for each temperature
  temperatures.forEach(temp => {
    const newKey = `${baseKey}-${temp}`;
    // Use the same value for all temperatures since fan mode doesn't control temperature
    output[newKey] = value;
  });
}

// Write the output
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Generated ${Object.keys(output).length} entries (${Object.keys(data).length} modes × ${temperatures.length} temperatures)`);
console.log(`Output written to: ${outputFile}`);


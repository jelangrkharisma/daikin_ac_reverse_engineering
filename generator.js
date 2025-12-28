const fs = require("fs");
const path = require("path");
const { combineJSONFiles } = require("./combine.js");

/**
 * Normalize and transform JSON files from input format to target format
 *
 * Input format: { "operatingMode-swingMode-fanMode-temperature": "IR Command" }
 * Target format: commands.operatingMode.fanMode.swingMode.temperature
 *
 * The script extracts all information from the JSON object keys themselves.
 */

function normalizeKey(key) {
  // Keys are in format: "operatingMode-swingMode-fanMode-temperature"
  // Example: "cool-on-auto_quiet-16"
  const parts = key.split("-");

  if (parts.length < 4) {
    throw new Error(
      `Invalid key format: ${key}. Expected format: operatingMode-swingMode-fanMode-temperature`,
    );
  }

  // Last part is temperature (may contain decimal, e.g., "16.5")
  const temperature = parts[parts.length - 1];

  // First part is operatingMode
  const operatingMode = parts[0];

  // Second part is swingMode
  const swingMode = parts[1];

  // Everything in between (if any) plus the third part is fanMode
  // For "cool-on-auto_quiet-16", fanMode is "auto_quiet"
  const fanMode = parts.slice(2, -1).join("_");

  return {
    operatingMode,
    swingMode,
    fanMode,
    temperature,
  };
}

function transformJSON(inputData, includeMetadata = false) {
  // Create output object with metadata first (if --full flag is provided)
  let output;

  if (includeMetadata) {
    output = {
      manufacturer: "Daikin",
      supportedModels: ["ftkc20tvm4"],
      commandsEncoding: "Base64",
      supportedController: "Broadlink",
      minTemperature: 16,
      maxTemperature: 32,
      precision: 0.5,
      operationModes: ["dry", "cool", "fan_only"],
      fanModes: [
        "auto",
        "night",
        "level1",
        "level2",
        "level3",
        "level4",
        "level5",
        "auto_quiet",
        "night_quiet",
        "level1_quiet",
        "level2_quiet",
        "level3_quiet",
        "level4_quiet",
        "level5_quiet",
      ],
      swingModes: [
        "on",
        "on_power_saving",
        "on_power_saving_plus",
        "comfort",
        "comfort_power_saving",
        "comfort_power_saving_plus",
        "off",
        "off_power_saving",
        "off_power_saving_plus",
      ],
      commands: {},
    };
  } else {
    output = {
      commands: {},
    };
  }

  // Separate off commands and regular commands
  const offCommands = {};
  const regularCommands = {};

  // Process each key-value pair in the input
  for (const [key, value] of Object.entries(inputData)) {
    // Handle simple "off" command - just "off" as key
    if (key === "off") {
      offCommands.off = value;
      continue;
    }

    // Try to normalize the key - if it fails, skip it
    let normalized;
    try {
      normalized = normalizeKey(key);
    } catch (error) {
      console.warn(`Skipping invalid key format: ${key}`);
      continue;
    }

    // Build the nested structure: commands.operatingMode.fanMode.swingMode.temperature
    if (!regularCommands[normalized.operatingMode]) {
      regularCommands[normalized.operatingMode] = {};
    }

    if (!regularCommands[normalized.operatingMode][normalized.fanMode]) {
      regularCommands[normalized.operatingMode][normalized.fanMode] = {};
    }

    if (
      !regularCommands[normalized.operatingMode][normalized.fanMode][
      normalized.swingMode
      ]
    ) {
      regularCommands[normalized.operatingMode][normalized.fanMode][
        normalized.swingMode
      ] = {};
    }

    regularCommands[normalized.operatingMode][normalized.fanMode][
      normalized.swingMode
    ][normalized.temperature] = value;
  }

  // Merge commands: off first, then regular commands
  // This ensures "off" is always on top
  output.commands = { ...offCommands, ...regularCommands };

  return output;
}

function processFile(inputPath, outputPath, includeMetadata = false) {
  try {
    // Read input file
    const inputData = JSON.parse(fs.readFileSync(inputPath, "utf8"));

    console.log(`Processing: ${inputPath}`);

    // Transform the JSON (all info extracted from keys)
    const outputData = transformJSON(inputData, includeMetadata);

    // Write output file
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf8");

    console.log(`  ✓ Successfully wrote: ${outputPath}`);
    console.log(`  ✓ Processed ${Object.keys(inputData).length} commands`);
    if (includeMetadata) {
      console.log(`  ✓ Included metadata (--full mode)`);
    }
    console.log();
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error.message);
    throw error;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  // Check for --full flag
  const includeMetadata = args.includes("--full");
  const filteredArgs = args.filter((arg) => arg !== "--full");

  let inputPath;
  let outputPath;

  // If --full is used, automatically combine files from src/ and use combined.json
  if (includeMetadata) {
    const combinedPath = path.join(__dirname, "combined.json");

    // Determine input source
    if (filteredArgs.length === 0) {
      // No arguments: combine from src/ directory
      const srcDir = path.join(__dirname, "src");
      console.log("Combining JSON files from src/ directory...\n");
      combineJSONFiles(srcDir, combinedPath);
      console.log();
      inputPath = combinedPath;
    } else {
      const firstArg = filteredArgs[0];
      // Check if first argument is a directory
      const isDirectory =
        fs.existsSync(firstArg) && fs.statSync(firstArg).isDirectory();

      if (isDirectory) {
        // Combine all JSON files from the specified directory
        console.log(`Combining JSON files from ${firstArg}...\n`);
        combineJSONFiles(firstArg, combinedPath);
        console.log();
        inputPath = combinedPath;
      } else {
        // Use provided input file directly
        inputPath = firstArg;
      }
    }

    // Default output path for --full mode
    outputPath =
      filteredArgs[1] || path.join(__dirname, "result", "ftkc20tvm4.json");
  } else {
    // Normal mode - require input file
    if (filteredArgs.length < 1) {
      console.error(
        "Usage: node generator.js <input-file> [output-file] [--full]",
      );
      console.error(
        "  If output-file is not provided, it will be generated from input filename",
      );
      console.error(
        "  Use --full to include metadata and automatically combine files from src/",
      );
      process.exit(1);
    }

    inputPath = filteredArgs[0];
    outputPath = filteredArgs[1];

    // Generate output path if not provided
    if (!outputPath) {
      const dir = path.dirname(inputPath);
      const basename = path.basename(inputPath, ".json");
      outputPath = path.join(dir, `${basename}.transformed.json`);
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  processFile(inputPath, outputPath, includeMetadata);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  normalizeKey,
  transformJSON,
  processFile,
};

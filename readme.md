# Daikin IR Command Generator

This project contains scripts to generate, combine, and transform Daikin IR command JSON files.

## File Naming Convention

**Source files (in `src/` directory):**
```
operatingMode.swingMode.fanMode.json
```

**Example:** `cool.on.level1_quiet.json`

## JSON Structure

### Input Format (source files)
```json
{
  "operatingMode-swingMode-fanMode-temperature": "IR Command Base64",
  "cool-on-auto_quiet-16": "JgBEAQ0PDQ8NDg4ODg4OAAM...",
  "cool-on-auto_quiet-16.5": "JgBEAQ0PDQ4ODg4ODg4OAAM..."
}
```

### Output Format (transformed files)

**Without `--full` flag:**
```json
{
  "commands": {
    "operatingMode": {
      "fanMode": {
        "swingMode": {
          "temperature": "IR Command Base64"
        }
      }
    }
  }
}
```

**With `--full` flag (includes metadata):**
```json
{
  "manufacturer": "Daikin",
  "supportedModels": ["ftkc20tvm4"],
  "commandsEncoding": "Base64",
  "supportedController": "Broadlink",
  "minTemperature": 16,
  "maxTemperature": 32,
  "precision": 0.5,
  "operationModes": ["dry", "cool", "fan_only"],
  "fanModes": ["auto", "night", "level1", ...],
  "swingModes": ["on", "comfort", "off", ...],
  "commands": {
    "operatingMode": {
      "fanMode": {
        "swingMode": {
          "temperature": "IR Command Base64"
        }
      }
    }
  }
}
```

**Example:**
```json
{
  "commands": {
    "cool": {
      "auto_quiet": {
        "on": {
          "16": "JgBEAQ0PDQ8NDg4ODg4OAAM...",
          "16.5": "JgBEAQ0PDQ4ODg4ODg4OAAM..."
        }
      }
    }
  }
}
```

## Scripts

### 1. `generate_template.js`

Generates template keys for JSON objects and creates empty JSON files in the `src/` directory.

**Usage:**
```bash
node generate_template.js <operatingMode> <swingMode> <fanMode>
```

**Examples:**
```bash
node generate_template.js cool on_power_saving night_quiet
node generate_template.js cool on auto
```

**What it does:**
- Generates temperature keys from 16 to 32 (0.5 increments)
- Creates a template text file in `operatingMode/operatingMode.swingMode.fanMode.txt`
- Creates an empty JSON file in `src/operatingMode.swingMode.fanMode.json`
- Outputs 33 keys (16, 16.5, 17, ..., 32)

### 2. `generate_fan_only_temps.js`

Generates temperature variations for `fan_only.json` file. Since fan mode doesn't control temperature, all temperature variations use the same IR command value.

**Usage:**
```bash
node generate_fan_only_temps.js
```

**What it does:**
- Reads `src/fan_only.json`
- For each mode (e.g., `fan_only-on-auto`, `fan_only-on-night`, etc.)
- Generates temperature entries from 16 to 32 (0.5 increments)
- Uses the same IR command value for all temperatures of the same mode
- Writes the result back to `src/fan_only.json`
- Generates: 14 modes × 33 temperatures = 462 entries total

**Example output:**
```json
{
  "fan_only-on-auto-16": "JgBEAQ0PDQ4ODg4ODg4OAAM...",
  "fan_only-on-auto-16.5": "JgBEAQ0PDQ4ODg4ODg4OAAM...",
  "fan_only-on-auto-17": "JgBEAQ0PDQ4ODg4ODg4OAAM...",
  ...
}
```

### 3. `combine.js`

Combines and flattens all JSON files from the `src/` directory into one combined JSON file.

**Usage:**
```bash
node combine.js [src-directory] [output-file]
```

**Examples:**
```bash
# Use defaults (src/ -> combined.json)
node combine.js

# Specify custom paths
node combine.js src output/combined.json
```

**What it does:**
- Reads all `.json` files from the source directory (default: `src/`)
- Merges all key-value pairs into a single flat object
- Writes the result to the output file (default: `combined.json`)
- Warns about duplicate keys if found

### 4. `generator.js`

Transforms JSON files from input format to target format. Converts flat key-value pairs into nested structure.

**Usage:**
```bash
node generator.js [input-file] [output-file] [--full]
```

**Examples:**
```bash
# Basic usage - auto-generate output filename
node generator.js combined.json

# Specify output file
node generator.js combined.json result/transformed.json

# Full mode - automatically combines src/ and includes metadata
node generator.js --full

# Full mode with custom directory
node generator.js src --full

# Full mode with custom input file and output
node generator.js combined.json result/ftkc20tvm4.json --full
```

**What it does:**
- Reads input JSON file with flat keys (e.g., `"cool-on-auto_quiet-16"`)
- Parses keys to extract: operatingMode, swingMode, fanMode, temperature
- Transforms into nested structure: `commands.operatingMode.fanMode.swingMode.temperature`
- Writes transformed JSON to output file
- If output file is not specified, creates `input-filename.transformed.json` in the same directory

**`--full` flag behavior:**
- **Automatically combines** all JSON files from `src/` directory (or specified directory)
- **Includes metadata** at the top of the output JSON:
  - `manufacturer`, `supportedModels`, `commandsEncoding`, `supportedController`
  - `minTemperature`, `maxTemperature`, `precision`
  - `operationModes`, `fanModes`, `swingModes` arrays
- **Default output**: `result/ftkc20tvm4.json` when `--full` is used
- When no input is provided with `--full`, automatically uses `src/` directory

**Key Format:**
- Input: `"operatingMode-swingMode-fanMode-temperature"`
- Example: `"cool-on-auto_quiet-16"`
- Output: `commands.cool.auto_quiet.on.16`

## Workflow

### Standard Workflow

1. **Generate templates** (if needed):
   ```bash
   node generate_template.js cool on auto
   ```

2. **Fill in IR commands** in the generated JSON files in `src/` directory

3. **Generate temperature variations** for fan_only mode:
   ```bash
   node generate_fan_only_temps.js
   ```

4. **Combine all source files**:
   ```bash
   node combine.js
   ```

5. **Transform to final format**:
   ```bash
   node generator.js combined.json result/transformed.json
   ```

### Quick Workflow (with `--full` flag)

The `--full` flag automates steps 4 and 5, and includes metadata:

1. **Generate templates** (if needed):
   ```bash
   node generate_template.js cool on auto
   ```

2. **Fill in IR commands** in the generated JSON files in `src/` directory

3. **Generate temperature variations** for fan_only mode:
   ```bash
   node generate_fan_only_temps.js
   ```

4. **Generate final output with metadata** (automatically combines and transforms):
   ```bash
   node generator.js --full
   ```
   
   This single command will:
   - Combine all JSON files from `src/` directory
   - Transform to nested structure
   - Include all metadata fields
   - Output to `result/ftkc20tvm4.json`

## Directory Structure

```
daikin/
├── src/                    # Source JSON files
│   ├── cool.on.auto.json
│   ├── cool.on.level1_quiet.json
│   ├── fan_only.json
│   └── ...
├── result/                 # Transformed output files
│   ├── transformed.json
│   └── ftkc20tvm4.json    # Full output with metadata (generated with --full)
├── combined.json           # Combined source files (auto-generated)
├── combine.js              # Combine script
├── generator.js            # Transform script (with --full flag support)
├── generate_template.js    # Template generator
├── generate_fan_only_temps.js  # Fan-only temp generator
└── readme.md              # This file
```

## Metadata Fields (with `--full` flag)

When using the `--full` flag, the following metadata is included:

- **manufacturer**: "Daikin"
- **supportedModels**: ["ftkc20tvm4"]
- **commandsEncoding**: "Base64"
- **supportedController**: "Broadlink"
- **minTemperature**: 16
- **maxTemperature**: 32
- **precision**: 0.5
- **operationModes**: ["dry", "cool", "fan_only"]
- **fanModes**: ["auto", "night", "level1", "level2", "level3", "level4", "level5", "auto_quiet", "night_quiet", "level1_quiet", "level2_quiet", "level3_quiet", "level4_quiet", "level5_quiet"]
- **swingModes**: ["on", "comfort", "off", "on_power_saving", "comfort_power_saving", "off_power_saving", "on_power_saving_plus", "comfort_power_saving_plus", "off_power_saving_plus"]

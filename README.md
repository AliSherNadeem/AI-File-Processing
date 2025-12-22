# AI-Powered Excel & CSV Processing System

Intelligent Excel (.xlsx) and CSV (.csv) file processing using Ollama's **qwen3-coder:480b-cloud** model to automatically map varying customer data structures to a standardized 10-column format.

## Overview

This system uses AI to intelligently process Excel and CSV files with different column structures and convert them into a standardized format for database insertion. The AI can:

- **Intelligently map columns** by analyzing column names AND data content
- **Combine split names** (First Name + Last Name → Name)
- **Consolidate addresses** (Street, City, State, etc. → Single Address)
- **Infer data types** from sample values (e.g., detecting Gender from "M/F" values)
- **Validate data quality** before saving
- **Handle missing columns** gracefully
- **Process both Excel (.xlsx) and CSV (.csv) files**

## Standardized Output Format (10 Columns)

Every processed file will have exactly these columns:

1. **Date** - Purchase/transaction date
2. **Name** - Full customer name
3. **Age** - Customer age
4. **Address** - Complete address (consolidated from multiple fields if needed)
5. **Gender** - M/F/Male/Female
6. **Contact Number** - Phone/mobile number
7. **Product Purchased** - Product/service/item name
8. **Amount** - Price/cost/total amount
9. **Product Quantity** - Quantity purchased
10. **Email** - Customer email address

## Prerequisites

1. **Node.js** installed (v14 or higher)
2. **Ollama** installed and running
3. **qwen3-coder:480b-cloud** model installed

### Install Ollama Model

```bash
ollama pull qwen3-coder:480b-cloud
```

### Start Ollama Server

```bash
ollama serve
```

## Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

## Configuration

The system uses environment variables for configuration. Copy `.env.example` to `.env` and customize as needed:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API server URL |
| `OLLAMA_MODEL` | `qwen3-coder:480b-cloud` | Ollama model to use |
| `UPLOAD_DIR` | `./upload` | Input files directory |
| `OUTPUT_DIR` | `./output` | Output files directory |
| `MAX_SAMPLE_SIZE` | `5` | Number of sample rows to analyze |
| `LARGE_FILE_THRESHOLD` | `100` | Row count threshold for batch processing |

### .env File Example

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3-coder:480b-cloud

# Processing Directories
UPLOAD_DIR=./upload
OUTPUT_DIR=./output

# Processing Limits
MAX_SAMPLE_SIZE=5
LARGE_FILE_THRESHOLD=100
```

**Note**: The `.env` file is gitignored to protect sensitive configuration. Never commit it to version control.

## Usage

### Basic Command

```bash
node process-excel-ai.js <filename.xlsx|filename.csv>
```

### Examples

```bash
# Process Excel file with spaces in the name
node process-excel-ai.js "new test file.xlsx"

# Process a simple Excel filename
node process-excel-ai.js customers.xlsx

# Process CSV file
node process-excel-ai.js data.csv

# Process CSV with spaces
node process-excel-ai.js "sales data 2024.csv"
```

### File Locations

- **Input**: Place Excel (.xlsx) or CSV (.csv) files in `./upload/` directory
- **Output**: Processed files are saved to `./output/` directory with `processed_` prefix
- **Output Format**: Same as input (Excel input → Excel output, CSV input → CSV output)

## Supported File Formats

| Format | Extension | Read | Write | Notes |
|--------|-----------|------|-------|-------|
| Excel | .xlsx | ✅ | ✅ | Full support, multi-sheet capable |
| CSV | .csv | ✅ | ✅ | Comma-separated values |

## How It Works

### Workflow

1. **File Validation** - Checks if file exists in upload directory (.xlsx or .csv)
2. **Sample Analysis** - Reads sample rows (configurable, default: 5) to understand structure
3. **Relationship Detection** - Identifies split names/addresses
4. **Intelligent Mapping** - Maps source columns to 10 standard columns
5. **Efficient Processing**:
   - **Small files (≤100 rows)**: Full read → transform → validate → write
   - **Large files (>100 rows)**: Batch processing without loading all data into AI context
6. **Validation** - Data quality checks (for small files only)
7. **Output** - Saves processed file in same format as input

### Performance Features

- **Batch Processing**: Files larger than `LARGE_FILE_THRESHOLD` (default: 100 rows) are processed server-side in batches
- **Memory Efficient**: Large files never load all rows into AI context, preventing memory issues
- **Context Limit Protection**: Automatically switches to batch mode for files that would exceed AI context limits

### Intelligent Mapping Examples

The AI understands many variations:

| Standard Column | AI Can Recognize |
|----------------|------------------|
| Date | date, purchase_date, order_date, transaction_date, timestamp |
| Name | name, customer_name, full_name, client_name |
| Age | age, years, yrs, customer_age |
| Address | address, location, addr, full_address |
| Gender | gender, sex, m/f, g (and analyzes data: M/F values) |
| Contact Number | phone, mobile, cell, telephone, contact_number |
| Product Purchased | product, item, sku, product_name, service |
| Amount | amount, price, cost, total, payment, revenue |
| Product Quantity | quantity, qty, count, units, items |
| Email | email, e-mail, mail, email_address |

### Special Features

#### 1. Name Combination

If your data has:
- `First Name` + `Last Name` → Combines into `Name`
- `First Name` + `Middle Name` + `Last Name` → Combines into `Name`

Example:
```
First Name: John
Last Name: Smith
→ Name: John Smith
```

#### 2. Address Consolidation

If your data has split addresses:
- `Street`, `City`, `State`, `Postal Code`, `Country`
→ Consolidates into single `Address`

Example:
```
Street: 123 Main St
Apartment: Apt 4
City: New York
State: NY
Postal Code: 10001
Country: USA
→ Address: 123 Main St, Apt 4, New York, NY 10001, USA
```

#### 3. Data Type Inference

The AI analyzes sample data to detect:
- Single-letter columns with M/F values → Gender
- Columns with @ symbols → Email
- Columns with phone patterns → Contact Number
- Numeric columns → Amount or Quantity
- Date patterns → Date

## Output Examples

### Excel Input → Excel Output

```bash
node process-excel-ai.js customers.xlsx
# Creates: ./output/processed_customers.xlsx
```

### CSV Input → CSV Output

```bash
node process-excel-ai.js data.csv
# Creates: ./output/processed_data.csv
```

### Input File Structure (Varying)
```
Customer Name | Age | Phone | Product | Price | QTY
John Smith    | 35  | 555... | Widget | 99.99 | 2
```

### Output File Structure (Standardized - 10 columns)
```
Date | Name       | Age | Address | Gender | Contact Number | Product Purchased | Amount | Product Quantity | Email
     | John Smith | 35  |         |        | 555...         | Widget           | 99.99  | 2                |
```

## Configuration

### Environment Variables (`.env`)

```env
OLLAMA_BASE_URL=http://localhost:11434
```

The model `qwen3-coder:480b-cloud` is hardcoded in the script as requested.

## Troubleshooting

### Error: Connection Refused

```bash
# Make sure Ollama is running
ollama serve
```

### Error: Model not found

```bash
# Install the model
ollama pull qwen3-coder:480b-cloud
```

### Error: File not found

- Check that the file exists in `./upload/` directory
- Use quotes around filenames with spaces
- Verify the file extension is .xlsx or .csv

### Error: Unsupported file format

- Only .xlsx and .csv files are supported
- Other formats (.xls, .xlsm, .txt) are not supported

### Validation Warnings

The AI will report warnings for:
- Invalid email formats
- Invalid phone numbers
- Non-numeric amounts
- Unusual age values

These are warnings, not errors - the file will still be created.

## Advanced Features

### Custom Column Detection

The AI can handle unusual column names by:
1. Checking exact matches (case-insensitive)
2. Checking semantic similarities
3. Analyzing sample data content
4. Pattern matching on data types

### Data Quality Validation

After transformation, the AI validates:
- Email addresses (@ symbol presence)
- Phone numbers (numeric pattern with 10+ digits)
- Amounts (numeric values)
- Quantities (integer values)
- Ages (0-150 range)
- Gender (M/F/Male/Female)

## Files in This System

### Core System Files:
- `process-excel-ai.js` - Main processing script ⭐
- `constants.js` - 10-column definitions and mapping rules
- `excelFunctions.js` - Excel/CSV operations
- `tools.js` - AI tool definitions
- `utils.js` - Data type inference and formatting
- `nameParser.js` - Name combination utilities
- `addressParser.js` - Address consolidation utilities

### Documentation & Testing:
- `README.md` - This file
- `test-functions.js` - Core functions validation test

## Comparison: Excel vs CSV

| Feature | Excel (.xlsx) | CSV (.csv) |
|---------|--------------|------------|
| Multi-sheet support | ✅ Yes | ❌ No (single sheet) |
| Formatting preserved | ✅ Yes | ❌ No (plain text) |
| File size | Larger | Smaller |
| Compatibility | Excel, LibreOffice | Universal (all tools) |
| Processing speed | Slightly slower | Slightly faster |
| AI processing | ✅ Full support | ✅ Full support |

## Command Reference

```bash
# Process Excel file
node process-excel-ai.js file.xlsx

# Process CSV file
node process-excel-ai.js file.csv

# Test core functions
npm test

# Using npm scripts
npm start file.xlsx
npm start file.csv
```

## Support

For issues or questions:
1. Check that Ollama is running: `ollama serve`
2. Verify model is installed: `ollama list`
3. Check upload directory has the file
4. Verify file format is .xlsx or .csv
5. Review console output for specific errors

## Next Steps

1. Place Excel (.xlsx) or CSV (.csv) files in `./upload/` directory
2. Run: `node process-excel-ai.js "your-file.xlsx"` or `node process-excel-ai.js "your-file.csv"`
3. Check output in `./output/processed_your-file.xlsx` (or .csv)
4. Review console output for any warnings
5. Import processed file into your PostgreSQL database

---

**Built with AI for AI-powered data processing** 🚀

**Supports**: Excel (.xlsx) | CSV (.csv) | 10-Column Standardized Output

# AI-Powered Excel Processing System

Intelligent Excel file processing using Ollama's **qwen3-coder:480b-cloud** model to automatically map varying customer data structures to a standardized 10-column format.

## Overview

This system uses AI to intelligently process Excel files with different column structures and convert them into a standardized format for database insertion. The AI can:

- **Intelligently map columns** by analyzing column names AND data content
- **Combine split names** (First Name + Last Name → Name)
- **Consolidate addresses** (Street, City, State, etc. → Single Address)
- **Infer data types** from sample values (e.g., detecting Gender from "M/F" values)
- **Validate data quality** before saving
- **Handle missing columns** gracefully

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

## Usage

### Basic Command

```bash
node process-excel-ai.js <filename.xlsx>
```

### Examples

```bash
# Process a file with spaces in the name
node process-excel-ai.js "new test file.xlsx"

# Process a simple filename
node process-excel-ai.js customers.xlsx

# Process with custom data structure
node process-excel-ai.js "sales_data_2024.xlsx"
```

### File Locations

- **Input**: Place Excel files in `./upload/` directory
- **Output**: Processed files are saved to `./output/` directory with `processed_` prefix

## How It Works

### Workflow

1. **File Validation** - Checks if file exists in upload directory
2. **Sample Analysis** - Reads 5 sample rows to understand structure
3. **Relationship Detection** - Identifies split names/addresses
4. **Data Combination** - Combines split fields if needed
5. **Intelligent Mapping** - Maps source columns to 10 standard columns
6. **Full Data Read** - Reads all rows from source file
7. **Transformation** - Converts to 10-column format
8. **Validation** - Checks data quality
9. **Output** - Saves processed file

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

## Output Example

### Input File Structure (Varying)
```
Customer Name | Age | Phone | Product | Price | QTY
John Smith    | 35  | 555... | Widget | 99.99 | 2
```

### Output File Structure (Standardized)
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

## Files Created

### New System Files (10-Column)
- `constants-new.js` - 10-column definitions and mapping rules
- `excelFunctions-new.js` - Excel operations for 10 columns
- `tools-new.js` - AI tool definitions
- `nameParser.js` - Name combination utilities
- `addressParser.js` - Address consolidation utilities
- `process-excel-ai.js` - Main processing script ⭐

### Existing Files (Still Used)
- `utils.js` - Data type inference and formatting
- `package.json` - Dependencies
- `.env` - Configuration

## Comparison with Old System

| Feature | Old System (15 columns) | New System (10 columns) |
|---------|------------------------|-------------------------|
| Output Columns | 15 separate columns | 10 consolidated columns |
| Address | 6 separate fields | 1 consolidated field |
| Name Handling | Single field only | Combines split names |
| AI Model | llama3.1:8b / gemini | qwen3-coder:480b-cloud |
| Data Inference | Limited | Advanced pattern detection |
| Validation | Basic | Comprehensive |

## Support

For issues or questions:
1. Check that Ollama is running: `ollama serve`
2. Verify model is installed: `ollama list`
3. Check upload directory has the file
4. Review console output for specific errors

## Next Steps

1. Place Excel files in `./upload/` directory
2. Run: `node process-excel-ai.js "your-file.xlsx"`
3. Check output in `./output/processed_your-file.xlsx`
4. Review console output for any warnings
5. Import processed file into your PostgreSQL database

---

**Built with AI for AI-powered Excel processing** 🚀

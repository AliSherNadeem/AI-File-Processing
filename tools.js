import fs from 'fs/promises';
import path from 'path';
import {
  readExcelFileSample,
  readExcelFileFull,
  writeExcelFile,
  createColumnMapping,
  transformRows,
  validateExcelMapping,
  transformAndWriteFile
} from './excelFunctions.js';
import { combineNameFromRow } from './nameParser.js';
import { consolidateAddressFromRow, looksLikeAddress } from './addressParser.js';
import { normalizeColumnName } from './utils.js';
import { SEMANTIC_MAPPING_RULES, ADDRESS_COMPONENTS, NAME_COMPONENTS } from './constants.js';

// File system tools
const createFile = async ({ directory, fileName, content }) => {
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
  return { success: true, filePath, message: `File created: ${fileName}` };
};

const readFile = async ({ directory, fileName }) => {
  const filePath = path.join(directory, fileName);
  const content = await fs.readFile(filePath, 'utf-8');
  return { success: true, content, filePath };
};

const updateFile = async ({ directory, fileName, content }) => {
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
  return { success: true, filePath, message: `File updated: ${fileName}` };
};

const listFiles = async ({ directory, extension = null }) => {
  const files = await fs.readdir(directory);
  const filteredFiles = extension
    ? files.filter(file => file.endsWith(extension))
    : files;
  return { success: true, files: filteredFiles, count: filteredFiles.length };
};

const deleteFile = async ({ directory, fileName }) => {
  const filePath = path.join(directory, fileName);
  await fs.unlink(filePath);
  return { success: true, message: `File deleted: ${fileName}` };
};

const appendToFile = async ({ directory, fileName, content }) => {
  const filePath = path.join(directory, fileName);
  await fs.appendFile(filePath, content, 'utf-8');
  return { success: true, filePath, message: `Content appended to: ${fileName}` };
};

// Advanced AI Tools

/**
 * Analyze column relationships to detect name and address splits
 * @param {Object} params - Function parameters
 * @param {Array<string>} params.headers - Column headers from source file
 * @param {Array<Array<string>>} params.sampleRows - Sample rows for analysis
 * @returns {Object} - Relationship analysis results
 */
const analyzeColumnRelationships = async ({ headers, sampleRows }) => {
  try {
    const relationships = {
      hasNameSplit: false,
      nameComponents: {},
      hasAddressSplit: false,
      addressComponents: {},
      hasCombinedAddress: false,
      combinedAddressColumn: null
    };

    // Normalize headers for comparison
    const normalizedHeaders = headers.map(h => normalizeColumnName(h));

    // Check for name components - use exact matching to avoid false positives
    for (const [component, variations] of Object.entries(NAME_COMPONENTS)) {
      for (const header of headers) {
        const normalized = normalizeColumnName(header);
        // Use exact match or pattern contains the whole normalized name
        // This prevents "Name" from matching "First Name" or "Last Name"
        if (variations.some(v => normalized === v || (normalized.includes(v) && normalized.length > v.length + 2))) {
          relationships.nameComponents[component] = header;
          break;
        }
      }
    }

    // CRITICAL: Only set hasNameSplit=true if we have BOTH First Name AND Last Name
    // AND they are DIFFERENT columns (not the same column matched twice)
    const hasFirstName = relationships.nameComponents['First Name'];
    const hasLastName = relationships.nameComponents['Last Name'];

    if (hasFirstName && hasLastName && hasFirstName !== hasLastName) {
      relationships.hasNameSplit = true;
    } else {
      // Clear nameComponents if we don't have valid split names
      relationships.nameComponents = {};
      relationships.hasNameSplit = false;
    }

    // Check for address components
    for (const [component, variations] of Object.entries(ADDRESS_COMPONENTS)) {
      for (const header of headers) {
        const normalized = normalizeColumnName(header);
        if (variations.some(v => normalized === v || normalized.includes(v))) {
          relationships.hasAddressSplit = true;
          relationships.addressComponents[component] = header;
          break;
        }
      }
    }

    // Check for combined address column
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const normalized = normalizeColumnName(header);

      // Check if header name suggests it's an address
      const addressVariations = SEMANTIC_MAPPING_RULES['Address'] || [];
      const isAddressColumn = addressVariations.some(v => normalized === v || normalized.includes(v));

      if (isAddressColumn) {
        // Check sample data to see if it looks like a combined address
        const sampleValues = sampleRows.map(row => row[i]).filter(Boolean);
        const lookLikeCombinedAddress = sampleValues.some(val => looksLikeAddress(val));

        if (lookLikeCombinedAddress) {
          relationships.hasCombinedAddress = true;
          relationships.combinedAddressColumn = header;
          break;
        }
      }
    }

    return {
      success: true,
      relationships,
      message: `Found ${relationships.hasNameSplit ? 'split names' : 'no name split'}, ${relationships.hasAddressSplit ? 'split addresses' : relationships.hasCombinedAddress ? 'combined address' : 'no address split'}`
    };

  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message || 'Error analyzing column relationships',
        functionName: 'analyzeColumnRelationships'
      }
    };
  }
};

/**
 * Combine name fields from multiple columns
 * @param {Object} params - Function parameters
 * @param {string} params.firstNameColumn - Source column name for first name
 * @param {string} params.lastNameColumn - Source column name for last name
 * @param {string} params.middleNameColumn - Optional source column name for middle name
 * @param {Array<Array<string>>} params.sourceRows - Source rows to process
 * @param {Array<string>} params.sourceHeaders - Source column headers
 * @returns {Object} - Combined names result
 */
const combineNameFields = async ({ firstNameColumn, lastNameColumn, middleNameColumn, sourceRows, sourceHeaders }) => {
  try {
    const nameMapping = {
      firstNameColumn,
      lastNameColumn,
      middleNameColumn: middleNameColumn || null
    };

    const combinedNames = sourceRows.map(row =>
      combineNameFromRow(nameMapping, row, sourceHeaders)
    );

    return {
      success: true,
      combinedNames,
      rowCount: combinedNames.length,
      message: `Combined ${combinedNames.length} names from ${firstNameColumn} and ${lastNameColumn}${middleNameColumn ? ' and ' + middleNameColumn : ''}`
    };

  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message || 'Error combining name fields',
        functionName: 'combineNameFields'
      }
    };
  }
};

/**
 * Consolidate address fields into single address column
 * @param {Object} params - Function parameters
 * @param {Object} params.addressComponents - Object with street, apartment, city, state, postal, country column names
 * @param {Array<Array<string>>} params.sourceRows - Source rows to process
 * @param {Array<string>} params.sourceHeaders - Source column headers
 * @returns {Object} - Consolidated addresses result
 */
const consolidateAddress = async ({ addressComponents, sourceRows, sourceHeaders }) => {
  try {
    const consolidatedAddresses = sourceRows.map(row =>
      consolidateAddressFromRow(addressComponents, row, sourceHeaders)
    );

    const componentsUsed = Object.keys(addressComponents).filter(k => addressComponents[k]);

    return {
      success: true,
      consolidatedAddresses,
      rowCount: consolidatedAddresses.length,
      message: `Consolidated ${consolidatedAddresses.length} addresses from ${componentsUsed.length} components`
    };

  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message || 'Error consolidating addresses',
        functionName: 'consolidateAddress'
      }
    };
  }
};

/**
 * Infer missing data patterns
 * @param {Object} params - Function parameters
 * @param {string} params.columnName - Name of the standard column to infer
 * @param {Array<Array<string>>} params.sampleRows - Sample rows for pattern analysis
 * @param {string} params.pattern - Detected pattern description
 * @returns {Object} - Inference results
 */
const inferMissingData = async ({ columnName, sampleRows, pattern }) => {
  try {
    // This is a placeholder for pattern-based inference
    // In a real implementation, this could use more sophisticated logic

    const inference = {
      columnName,
      pattern,
      suggestedDefault: '',
      confidence: 'low'
    };

    // Example: If all visible data is empty but pattern suggests a default
    if (pattern && pattern.toLowerCase().includes('always')) {
      const match = pattern.match(/always ["']?([^"']+)["']?/i);
      if (match) {
        inference.suggestedDefault = match[1];
        inference.confidence = 'medium';
      }
    }

    return {
      success: true,
      inference,
      message: `Analyzed pattern for ${columnName}: ${pattern}`
    };

  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message || 'Error inferring missing data',
        functionName: 'inferMissingData'
      }
    };
  }
};

// Export all available functions
export const availableFunctions = {
  createFile,
  readFile,
  updateFile,
  listFiles,
  deleteFile,
  appendToFile,
  readExcelFileSample,
  readExcelFileFull,
  writeExcelFile,
  createColumnMapping,
  transformRows,
  transformAndWriteFile,
  validateExcelMapping,
  analyzeColumnRelationships,
  combineNameFields,
  consolidateAddress,
  inferMissingData
};

// Export function definitions for AI
export const functionDefinitions = [
  {
    name: 'listFiles',
    description: 'Lists all files in a directory, optionally filtered by extension',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory path to list files from' },
        extension: { type: 'string', description: 'Optional file extension filter (e.g., ".xlsx", ".csv")' }
      },
      required: ['directory']
    }
  },
  {
    name: 'readExcelFileSample',
    description: 'Reads a sample of rows from an Excel (.xlsx) or CSV (.csv) file to analyze column structure. Returns headers and 3-5 sample rows with data type inference. Use this first to understand the file structure.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory path where file is located (e.g., "./upload")' },
        fileName: { type: 'string', description: 'Name of the Excel or CSV file to sample (e.g., "customers.xlsx", "data.csv")' },
        sheetName: { type: 'string', description: 'Optional sheet name to read (only for Excel files). CSV files are read as single sheet.' },
        sampleSize: { type: 'number', description: 'Number of rows to sample (default: 5, max: 10)' }
      },
      required: ['directory', 'fileName']
    }
  },
  {
    name: 'analyzeColumnRelationships',
    description: 'Analyzes column headers and sample data to detect relationships like split names (First Name + Last Name) or split addresses (Street, City, State, etc.). Use this after readExcelFileSample to understand data structure.',
    parameters: {
      type: 'object',
      properties: {
        headers: {
          type: 'array',
          description: 'Array of column headers from the source file',
          items: { type: 'string' }
        },
        sampleRows: {
          type: 'array',
          description: 'Array of sample data rows from readExcelFileSample',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      required: ['headers', 'sampleRows']
    }
  },
  {
    name: 'combineNameFields',
    description: 'Combines First Name, Last Name, and optionally Middle Name columns into a single full name. Use when analyzeColumnRelationships detects split names. Returns array of combined names that should be used for the Name column mapping.',
    parameters: {
      type: 'object',
      properties: {
        firstNameColumn: { type: 'string', description: 'Source column name containing first names' },
        lastNameColumn: { type: 'string', description: 'Source column name containing last names' },
        middleNameColumn: { type: 'string', description: 'Optional source column name containing middle names' },
        sourceRows: {
          type: 'array',
          description: 'Source data rows from readExcelFileFull',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        sourceHeaders: {
          type: 'array',
          description: 'Source column headers from readExcelFileFull',
          items: { type: 'string' }
        }
      },
      required: ['firstNameColumn', 'lastNameColumn', 'sourceRows', 'sourceHeaders']
    }
  },
  {
    name: 'consolidateAddress',
    description: 'Consolidates multiple address component columns (Street, Apartment, City, State, Postal Code, Country) into a single formatted address string. Use when analyzeColumnRelationships detects split addresses. Returns array of consolidated addresses.',
    parameters: {
      type: 'object',
      properties: {
        addressComponents: {
          type: 'object',
          description: 'Object mapping address component names to source column names',
          properties: {
            street: { type: 'string', description: 'Source column for street address' },
            apartment: { type: 'string', description: 'Source column for apartment/unit' },
            city: { type: 'string', description: 'Source column for city' },
            state: { type: 'string', description: 'Source column for state/province' },
            postal: { type: 'string', description: 'Source column for postal/zip code' },
            country: { type: 'string', description: 'Source column for country' }
          }
        },
        sourceRows: {
          type: 'array',
          description: 'Source data rows from readExcelFileFull',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        sourceHeaders: {
          type: 'array',
          description: 'Source column headers from readExcelFileFull',
          items: { type: 'string' }
        }
      },
      required: ['addressComponents', 'sourceRows', 'sourceHeaders']
    }
  },
  {
    name: 'createColumnMapping',
    description: 'Creates and stores a mapping configuration from source Excel columns to the standard 10-column output format. This mapping will be used to transform all rows. The mapping must include all 10 standard columns: Date, Name, Age, Address, Gender, Contact Number, Product Purchased, Amount, Product Quantity, Email. If a source column maps to a standard column, provide the source column name. If no source data exists for a standard column, use an empty string. SPECIAL: If you used combineNameFields or consolidateAddress, use "__COMBINED__" as the value to indicate the data comes from combined fields.',
    parameters: {
      type: 'object',
      properties: {
        mapping: {
          type: 'object',
          description: 'JSON object mapping each of the 10 standard column names to source column names (or empty string if no mapping, or "__COMBINED__" if using combined data)',
          properties: {
            'Date': { type: 'string', description: 'Source column name for Date (or empty string)' },
            'Name': { type: 'string', description: 'Source column name for Name (or empty string, or "__COMBINED__" if using combineNameFields)' },
            'Age': { type: 'string', description: 'Source column name for Age (or empty string)' },
            'Address': { type: 'string', description: 'Source column name for Address (or empty string, or "__COMBINED__" if using consolidateAddress)' },
            'Gender': { type: 'string', description: 'Source column name for Gender (or empty string)' },
            'Contact Number': { type: 'string', description: 'Source column name for Contact Number (or empty string)' },
            'Product Purchased': { type: 'string', description: 'Source column name for Product Purchased (or empty string)' },
            'Amount': { type: 'string', description: 'Source column name for Amount (or empty string)' },
            'Product Quantity': { type: 'string', description: 'Source column name for Product Quantity (or empty string)' },
            'Email': { type: 'string', description: 'Source column name for Email (or empty string)' }
          },
          required: ['Date', 'Name', 'Age', 'Address', 'Gender', 'Contact Number', 'Product Purchased', 'Amount', 'Product Quantity', 'Email']
        }
      },
      required: ['mapping']
    }
  },
  {
    name: 'readExcelFileFull',
    description: 'Reads all rows from an Excel (.xlsx) or CSV (.csv) file, with support for batch processing. Use this to get the actual data rows that need to be transformed.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory path where file is located (e.g., "./upload")' },
        fileName: { type: 'string', description: 'Name of the Excel or CSV file to read' },
        sheetName: { type: 'string', description: 'Optional sheet name to read (only for Excel files). If not specified, uses the first sheet. CSV files are read as single sheet.' },
        startRow: { type: 'number', description: 'Starting row number for batch processing (default: 0, first data row)' },
        batchSize: { type: 'number', description: 'Number of rows to read in this batch (default: 500, max: 500)' }
      },
      required: ['directory', 'fileName']
    }
  },
  {
    name: 'transformRows',
    description: 'Transforms source rows to the standardized 10-column format using a previously created mapping. This function automatically converts your source data rows into the required 10-column output format. IMPORTANT: If you used combineNameFields or consolidateAddress, you must manually construct the 10-column rows instead of using this function, inserting the combined data in the appropriate column positions.',
    parameters: {
      type: 'object',
      properties: {
        mappingId: { type: 'string', description: 'ID of the column mapping returned by createColumnMapping' },
        sourceRows: {
          type: 'array',
          description: 'Array of source data rows from readExcelFileFull (rows property)',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        sourceHeaders: {
          type: 'array',
          description: 'Array of source column headers from readExcelFileFull (headers property)',
          items: { type: 'string' }
        }
      },
      required: ['mappingId', 'sourceRows', 'sourceHeaders']
    }
  },
  {
    name: 'transformAndWriteFile',
    description: 'EFFICIENT BATCH PROCESSING: Transforms an entire Excel/CSV file and writes output directly WITHOUT loading all rows into AI context. This is the RECOMMENDED approach for files with more than 100 rows. Supports name combining and address consolidation. Instead of reading full file → transform → write separately, this does everything in one step server-side. The AI never sees the full dataset, avoiding context limits. Returns only a summary (rows processed, output file path). Use this instead of readExcelFileFull + transformRows + writeExcelFile for large files.',
    parameters: {
      type: 'object',
      properties: {
        sourceDirectory: { type: 'string', description: 'Source directory (e.g., "./upload")' },
        sourceFileName: { type: 'string', description: 'Source file name (e.g., "data.xlsx" or "data.csv")' },
        outputDirectory: { type: 'string', description: 'Output directory (e.g., "./output")' },
        outputFileName: { type: 'string', description: 'Output file name (e.g., "processed_data.xlsx")' },
        mapping: {
          type: 'object',
          description: 'Column mapping object from createColumnMapping (the mapping itself, not the ID). Do NOT map Index, Row Number, ID columns to Amount/Quantity. Leave unmapped columns as empty string "".'
        },
        mappingId: { type: 'string', description: 'Mapping ID (for reference only, not used internally)' },
        nameColumns: {
          type: 'object',
          description: 'OPTIONAL: If names are split across multiple columns, provide { firstName: "First Name", lastName: "Last Name", middleName: "Middle Name" } with exact source column names. If provided, names will be combined automatically.',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            middleName: { type: 'string' }
          }
        },
        addressComponents: {
          type: 'object',
          description: 'OPTIONAL: If address is split across multiple columns, provide { street: "Street", apartment: "Apt", city: "City", state: "State", country: "Country", postal: "Postal" } with exact source column names. If provided, address will be consolidated automatically.',
          properties: {
            street: { type: 'string' },
            apartment: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            country: { type: 'string' },
            postal: { type: 'string' }
          }
        }
      },
      required: ['sourceDirectory', 'sourceFileName', 'outputDirectory', 'outputFileName', 'mapping', 'mappingId']
    }
  },
  {
    name: 'validateExcelMapping',
    description: 'Validates that transformed sample data matches expected data types for each standard column. Use this after transforming your initial sample to verify the mapping works correctly before processing all rows.',
    parameters: {
      type: 'object',
      properties: {
        sampleData: {
          type: 'array',
          description: 'Array of sample rows in 10-column format to validate (typically 5-10 transformed rows)',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      required: ['sampleData']
    }
  },
  {
    name: 'writeExcelFile',
    description: 'Writes transformed data to an Excel (.xlsx) or CSV (.csv) file with the standard 10-column format. File format is determined by the fileName extension. Each row must contain exactly 10 values corresponding to: Date, Name, Age, Address, Gender, Contact Number, Product Purchased, Amount, Product Quantity, Email (in that order). Empty columns should be empty strings.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory path where file should be created. Use "./output" for output files.' },
        fileName: { type: 'string', description: 'Name of the Excel or CSV file to create (e.g., "processed_customers.xlsx", "processed_data.csv"). Extension determines format.' },
        data: {
          type: 'array',
          description: 'Array of row arrays, where each row is an array of exactly 10 string values in standard column order',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        append: { type: 'boolean', description: 'If true, append to existing file; if false, create new file (default: false). Use true for subsequent batches.' }
      },
      required: ['directory', 'fileName', 'data']
    }
  },
  {
    name: 'inferMissingData',
    description: 'Analyzes sample data to infer patterns for missing columns. Use when a standard column has no direct mapping but you detect a pattern (e.g., all customers are from USA, so Country should default to "United States").',
    parameters: {
      type: 'object',
      properties: {
        columnName: { type: 'string', description: 'Name of the standard column to infer data for' },
        sampleRows: {
          type: 'array',
          description: 'Sample rows to analyze for patterns',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        pattern: { type: 'string', description: 'Description of the detected pattern (e.g., "always United States")' }
      },
      required: ['columnName', 'sampleRows', 'pattern']
    }
  }
];

import fs from 'fs/promises';
import path from 'path';
import XLSX from 'xlsx';
import {
  STANDARD_COLUMNS,
  BATCH_SIZE_LIMITS,
  DATA_TYPE_PATTERNS
} from './constants.js';
import {
  calculateSampleIndices,
  analyzeColumns,
  createErrorResponse,
  formatValue
} from './utils.js';

// Store column mappings in memory
const columnMappings = new Map();

/**
 * Read and analyze a sample of rows from an Excel/CSV file
 * @param {Object} params - Function parameters
 * @param {string} params.directory - Directory path where file is located
 * @param {string} params.fileName - Name of the Excel/CSV file to sample
 * @param {string} params.sheetName - Optional sheet name to read (for Excel files)
 * @param {number} params.sampleSize - Number of rows to sample (default: 5, max: 10)
 * @returns {Object} - Sample data with column analysis
 */
export async function readExcelFileSample({ directory, fileName, sheetName, sampleSize = 5 }) {
  try {
    const filePath = path.join(directory, fileName);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    // Determine file type
    const isCSV = fileName.toLowerCase().endsWith('.csv');
    const fileType = isCSV ? 'CSV' : 'Excel';

    // Read the workbook (XLSX library supports both Excel and CSV)
    let workbook;
    try {
      workbook = XLSX.readFile(filePath);
    } catch (error) {
      throw new Error(`Invalid file format: ${fileName} is not a valid ${fileType} file`);
    }

    // Check if workbook has sheets
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error(`${fileType} file has no data`);
    }

    // Get the sheet (CSV files have one sheet)
    const actualSheetName = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[actualSheetName];

    if (!sheet) {
      if (isCSV) {
        throw new Error(`CSV file has no data`);
      } else {
        throw new Error(
          `Sheet not found: ${sheetName}. Available sheets: ${workbook.SheetNames.join(', ')}`
        );
      }
    }

    // Convert sheet to array of arrays
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length === 0) {
      throw new Error('Sheet is empty');
    }

    // Extract headers (first row)
    const headers = data[0].map(h => String(h || '').trim());

    // Filter out empty rows (rows where all cells are empty)
    const isRowEmpty = (row) => {
      if (!row || !Array.isArray(row)) return true;
      return row.every(cell => cell === null || cell === undefined || cell === '');
    };

    // Get only non-empty data rows (excluding header)
    const nonEmptyDataRows = data.slice(1).filter(row => !isRowEmpty(row));

    // Calculate total data rows (excluding header, only non-empty)
    const totalRows = nonEmptyDataRows.length;

    if (totalRows === 0) {
      return {
        success: true,
        fileName,
        sheetName: actualSheetName,
        totalRows: 0,
        headers,
        sampleRows: [],
        columnAnalysis: headers.map(h => ({ column: h, dataType: 'empty', example: '' }))
      };
    }

    // Calculate sample indices
    const maxSample = Math.min(sampleSize, 10, totalRows);
    const sampleIndices = calculateSampleIndices(totalRows, maxSample);

    // Extract sample rows from non-empty data rows
    const sampleRows = sampleIndices.map(idx => {
      const row = nonEmptyDataRows[idx] || [];
      return headers.map((header, colIdx) => formatValue(row[colIdx], header));
    });

    // Analyze columns
    const columnAnalysis = analyzeColumns(headers, sampleRows);

    return {
      success: true,
      fileName,
      sheetName: actualSheetName,
      totalRows,
      headers,
      sampleRows,
      columnAnalysis
    };

  } catch (error) {
    return createErrorResponse('readExcelFileSample', error);
  }
}

/**
 * Create and store a column mapping configuration
 * @param {Object} params - Function parameters
 * @param {Object} params.mapping - Object mapping standard columns to source columns
 * @returns {Object} - Mapping creation result
 */
export async function createColumnMapping({ mapping }) {
  try {
    // Validate that mapping is an object
    if (!mapping || typeof mapping !== 'object') {
      throw new Error('Mapping must be an object');
    }

    // Validate that all 10 standard columns are present in the mapping
    const missingColumns = STANDARD_COLUMNS.filter(col => !(col in mapping));
    if (missingColumns.length > 0) {
      throw new Error(
        `Mapping is missing required columns: ${missingColumns.join(', ')}`
      );
    }

    // Generate mapping ID
    const mappingId = `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store mapping
    columnMappings.set(mappingId, mapping);

    // Count mapped vs unmapped columns
    const mappedColumns = Object.values(mapping).filter(val => val && val.trim() !== '').length;
    const unmappedColumns = STANDARD_COLUMNS.length - mappedColumns;

    return {
      success: true,
      message: 'Column mapping created successfully',
      mappingId,
      mappedColumns,
      unmappedColumns
    };

  } catch (error) {
    return createErrorResponse('createColumnMapping', error);
  }
}

/**
 * Transform source rows to standardized 10-column format using a mapping
 * @param {Object} params - Function parameters
 * @param {string} params.mappingId - ID of the column mapping to use
 * @param {Array<Array<string>>} params.sourceRows - Source rows to transform
 * @param {Array<string>} params.sourceHeaders - Source column headers
 * @returns {Object} - Transformed rows in 10-column format
 */
export async function transformRows({ mappingId, sourceRows, sourceHeaders }) {
  try {
    // Validate mappingId
    if (!mappingId || typeof mappingId !== 'string') {
      throw new Error('mappingId is required and must be a string');
    }

    // Get the mapping
    const mapping = columnMappings.get(mappingId);
    if (!mapping) {
      throw new Error(`Mapping not found: ${mappingId}. Please create a mapping first using createColumnMapping.`);
    }

    // Validate sourceRows
    if (!Array.isArray(sourceRows)) {
      throw new Error('sourceRows must be an array');
    }

    // Validate sourceHeaders
    if (!Array.isArray(sourceHeaders)) {
      throw new Error('sourceHeaders must be an array');
    }

    // Create a map of source column name to index
    const sourceIndexMap = {};
    sourceHeaders.forEach((header, index) => {
      sourceIndexMap[header] = index;
    });

    // Transform each row
    const transformedRows = [];
    for (let i = 0; i < sourceRows.length; i++) {
      const sourceRow = sourceRows[i];
      const transformedRow = [];

      // For each of the 10 standard columns
      for (const standardColumn of STANDARD_COLUMNS) {
        const sourceColumnName = mapping[standardColumn];

        if (!sourceColumnName || sourceColumnName.trim() === '') {
          // Unmapped column - add empty string
          transformedRow.push('');
        } else {
          // Get the source column index
          const sourceIndex = sourceIndexMap[sourceColumnName];

          if (sourceIndex !== undefined && sourceRow[sourceIndex] !== undefined) {
            // Get value from source row and format it
            // Pass the source column name as a hint for proper formatting (especially for dates)
            transformedRow.push(formatValue(sourceRow[sourceIndex], sourceColumnName));
          } else {
            // Source column not found or no value - add empty string
            transformedRow.push('');
          }
        }
      }

      transformedRows.push(transformedRow);
    }

    return {
      success: true,
      message: `Transformed ${transformedRows.length} rows successfully`,
      transformedRows,
      rowCount: transformedRows.length,
      columnCount: 10
    };

  } catch (error) {
    return createErrorResponse('transformRows', error);
  }
}

/**
 * Read all rows from an Excel/CSV file in batches
 * @param {Object} params - Function parameters
 * @param {string} params.directory - Directory path where file is located
 * @param {string} params.fileName - Name of the Excel/CSV file to read
 * @param {string} params.sheetName - Optional sheet name to read (for Excel files)
 * @param {number} params.startRow - Starting row number for batch processing (default: 0)
 * @param {number} params.batchSize - Number of rows to read in this batch
 * @returns {Object} - Batch of rows with metadata
 */
export async function readExcelFileFull({ directory, fileName, sheetName, startRow = 0, batchSize = BATCH_SIZE_LIMITS.default }) {
  try {
    const filePath = path.join(directory, fileName);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    // Determine file type
    const isCSV = fileName.toLowerCase().endsWith('.csv');
    const fileType = isCSV ? 'CSV' : 'Excel';

    // Read the workbook (XLSX library supports both Excel and CSV)
    let workbook;
    try {
      workbook = XLSX.readFile(filePath);
    } catch (error) {
      throw new Error(`Invalid file format: ${fileName} is not a valid ${fileType} file`);
    }

    // Get the sheet (CSV files have one sheet)
    const actualSheetName = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[actualSheetName];

    if (!sheet) {
      throw new Error(isCSV ? `CSV file has no data` : `Sheet not found: ${sheetName}`);
    }

    // Convert sheet to array of arrays
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length === 0) {
      throw new Error('Sheet is empty');
    }

    // Extract headers
    const headers = data[0].map(h => String(h || '').trim());

    // Filter out empty rows (rows where all cells are empty)
    const isRowEmpty = (row) => {
      if (!row || !Array.isArray(row)) return true;
      return row.every(cell => cell === null || cell === undefined || cell === '');
    };

    // Get only non-empty data rows (excluding header)
    const nonEmptyDataRows = data.slice(1).filter(row => !isRowEmpty(row));

    // Calculate total data rows (only non-empty)
    const totalRows = nonEmptyDataRows.length;

    // Validate batch size
    const effectiveBatchSize = Math.min(
      batchSize,
      BATCH_SIZE_LIMITS.max
    );

    // Calculate end row
    const endRow = Math.min(startRow + effectiveBatchSize, totalRows);

    // Extract batch rows from non-empty data rows
    const rows = [];
    for (let i = startRow; i < endRow; i++) {
      const row = nonEmptyDataRows[i] || [];
      rows.push(headers.map((header, colIdx) => formatValue(row[colIdx], header)));
    }

    // Check if there are more rows
    const hasMore = endRow < totalRows;

    return {
      success: true,
      fileName,
      sheetName: actualSheetName,
      totalRows,
      rowsReturned: rows.length,
      startRow,
      hasMore,
      headers,
      rows
    };

  } catch (error) {
    return createErrorResponse('readExcelFileFull', error);
  }
}

/**
 * Transform and write Excel/CSV file in batches (for large files)
 * This function processes the entire file without loading all rows into AI context
 * @param {Object} params - Function parameters
 * @param {string} params.sourceDirectory - Source directory path
 * @param {string} params.sourceFileName - Source file name
 * @param {string} params.outputDirectory - Output directory path
 * @param {string} params.outputFileName - Output file name
 * @param {Object} params.mapping - Column mapping object
 * @param {string} params.mappingId - Mapping ID (not used, for compatibility)
 * @returns {Object} - Transformation summary (NOT the actual data)
 */
export async function transformAndWriteFile({ sourceDirectory, sourceFileName, outputDirectory, outputFileName, mapping, mappingId }) {
  try {
    const sourceFilePath = path.join(sourceDirectory, sourceFileName);
    const outputFilePath = path.join(outputDirectory, outputFileName);

    // Check if source file exists
    try {
      await fs.access(sourceFilePath);
    } catch {
      throw new Error(`Source file not found: ${sourceFilePath}`);
    }

    // Determine file type
    const isCSV = sourceFileName.toLowerCase().endsWith('.csv');
    const fileType = isCSV ? 'CSV' : 'Excel';

    // Read the source workbook
    let workbook;
    try {
      workbook = XLSX.readFile(sourceFilePath);
    } catch (error) {
      throw new Error(`Invalid file format: ${sourceFileName} is not a valid ${fileType} file`);
    }

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error('Source file has no data');
    }

    // Convert sheet to array of arrays
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length === 0) {
      throw new Error('Source file is empty');
    }

    // Extract headers and data rows
    const sourceHeaders = data[0].map(h => String(h || '').trim());
    const isRowEmpty = (row) => {
      if (!row || !Array.isArray(row)) return true;
      return row.every(cell => cell === null || cell === undefined || cell === '');
    };
    const nonEmptyDataRows = data.slice(1).filter(row => !isRowEmpty(row));

    // Validate mapping
    if (!mapping || typeof mapping !== 'object') {
      throw new Error('Invalid mapping object');
    }

    // Create source index map
    const sourceIndexMap = {};
    sourceHeaders.forEach((header, index) => {
      sourceIndexMap[header] = index;
    });

    // Process all rows in batches internally
    const transformedRows = [];
    const batchSize = 100; // Process 100 rows at a time
    let processedCount = 0;

    for (let startIdx = 0; startIdx < nonEmptyDataRows.length; startIdx += batchSize) {
      const endIdx = Math.min(startIdx + batchSize, nonEmptyDataRows.length);
      const batch = nonEmptyDataRows.slice(startIdx, endIdx);

      // Transform this batch
      for (const sourceRow of batch) {
        const transformedRow = [];

        // For each of the 10 standard columns
        for (const standardColumn of STANDARD_COLUMNS) {
          const sourceColumnName = mapping[standardColumn];

          if (!sourceColumnName || sourceColumnName.trim() === '') {
            transformedRow.push('');
          } else {
            const sourceIndex = sourceIndexMap[sourceColumnName];

            if (sourceIndex !== undefined && sourceRow[sourceIndex] !== undefined) {
              transformedRow.push(formatValue(sourceRow[sourceIndex], sourceColumnName));
            } else {
              transformedRow.push('');
            }
          }
        }

        transformedRows.push(transformedRow);
        processedCount++;
      }
    }

    // Create output workbook
    const outputWorkbook = XLSX.utils.book_new();
    const outputData = [STANDARD_COLUMNS, ...transformedRows];
    const outputSheet = XLSX.utils.aoa_to_sheet(outputData);
    XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, 'Sheet1');

    // Ensure output directory exists
    try {
      await fs.access(outputDirectory);
    } catch {
      await fs.mkdir(outputDirectory, { recursive: true });
    }

    // Write file
    XLSX.writeFile(outputWorkbook, outputFilePath);

    // Return ONLY summary - NOT the actual data
    return {
      success: true,
      message: `Transformed and wrote ${processedCount} rows to ${outputFileName}`,
      sourceFile: sourceFileName,
      outputFile: outputFileName,
      rowsProcessed: processedCount,
      columnsOutput: 10,
      filePath: outputFilePath
    };

  } catch (error) {
    return createErrorResponse('transformAndWriteFile', error);
  }
}

/**
 * Write data to an Excel or CSV file with the standard 10-column format
 * @param {Object} params - Function parameters
 * @param {string} params.directory - Directory path where file should be created
 * @param {string} params.fileName - Name of the Excel/CSV file to create
 * @param {Array<Array<string>>} params.data - Array of row arrays in standard 10-column format
 * @param {boolean} params.append - If true, append to existing file; if false, create new file
 * @returns {Object} - File creation result
 */
export async function writeExcelFile({ directory, fileName, data, append = false }) {
  try {
    // Validate data
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array');
    }

    // Validate each row has exactly 10 columns
    const invalidRows = data.filter(row => !Array.isArray(row) || row.length !== 10);
    if (invalidRows.length > 0) {
      throw new Error(
        `All rows must have exactly 10 columns. Found ${invalidRows.length} invalid rows.`
      );
    }

    const filePath = path.join(directory, fileName);

    // Determine output file type
    const isCSV = fileName.toLowerCase().endsWith('.csv');
    const fileType = isCSV ? 'CSV' : 'Excel';

    let finalData;

    if (append) {
      // Try to read existing file and append
      try {
        const existingWorkbook = XLSX.readFile(filePath);
        const existingSheet = existingWorkbook.Sheets[existingWorkbook.SheetNames[0]];
        const existingData = XLSX.utils.sheet_to_json(existingSheet, { header: 1 });

        // Append new data (without adding headers again)
        finalData = [...existingData, ...data];
      } catch {
        // File doesn't exist, create new with headers
        finalData = [STANDARD_COLUMNS, ...data];
      }
    } else {
      // Create new file with headers
      finalData = [STANDARD_COLUMNS, ...data];
    }

    // Create worksheet from array of arrays
    const worksheet = XLSX.utils.aoa_to_sheet(finalData);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // Ensure output directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write file (XLSX library automatically handles CSV format based on extension)
    XLSX.writeFile(workbook, filePath);

    return {
      success: true,
      filePath,
      message: append ? `Appended ${data.length} rows to ${fileName}` : `${fileType} file created: ${fileName}`,
      rowsWritten: data.length,
      columns: 10,
      fileType
    };

  } catch (error) {
    return createErrorResponse('writeExcelFile', error);
  }
}

/**
 * Validate that transformed data matches expected data types
 * @param {Object} params - Function parameters
 * @param {Array<Array<string>>} params.sampleData - Array of sample rows in 10-column format
 * @returns {Object} - Validation result
 */
export async function validateExcelMapping({ sampleData }) {
  try {
    if (!Array.isArray(sampleData) || sampleData.length === 0) {
      throw new Error('Sample data must be a non-empty array');
    }

    const issues = [];
    const warnings = [];

    // Column indices for validation (10-column structure)
    const columnIndices = {
      Date: 0,
      Name: 1,
      Age: 2,
      Address: 3,
      Gender: 4,
      ContactNumber: 5,
      ProductPurchased: 6,
      Amount: 7,
      ProductQuantity: 8,
      Email: 9
    };

    sampleData.forEach((row, rowIdx) => {
      if (!Array.isArray(row) || row.length !== 10) {
        issues.push({
          column: 'ALL',
          issue: `Row ${rowIdx} doesn't have exactly 10 columns (has ${row?.length || 0})`,
          affectedRows: [rowIdx],
          severity: 'error'
        });
        return;
      }

      // Validate Email
      const email = row[columnIndices.Email];
      if (email && email.trim() !== '' && !DATA_TYPE_PATTERNS.email.test(email)) {
        warnings.push({
          column: 'Email',
          issue: `Row ${rowIdx}: "${email}" doesn't look like a valid email`,
          affectedRows: [rowIdx],
          severity: 'warning'
        });
      }

      // Validate Contact Number
      const phone = row[columnIndices.ContactNumber];
      if (phone && phone.trim() !== '' && !DATA_TYPE_PATTERNS.phone.test(phone)) {
        warnings.push({
          column: 'Contact Number',
          issue: `Row ${rowIdx}: "${phone}" doesn't match phone number pattern`,
          affectedRows: [rowIdx],
          severity: 'warning'
        });
      }

      // Validate Amount
      const amount = row[columnIndices.Amount];
      if (amount && amount.trim() !== '') {
        const cleanAmount = amount.replace(/[$,]/g, '');
        if (isNaN(parseFloat(cleanAmount))) {
          issues.push({
            column: 'Amount',
            issue: `Row ${rowIdx}: "${amount}" is not a valid number`,
            affectedRows: [rowIdx],
            severity: 'error'
          });
        }
      }

      // Validate Product Quantity
      const quantity = row[columnIndices.ProductQuantity];
      if (quantity && quantity.trim() !== '' && isNaN(parseInt(quantity))) {
        warnings.push({
          column: 'Product Quantity',
          issue: `Row ${rowIdx}: "${quantity}" is not a valid number`,
          affectedRows: [rowIdx],
          severity: 'warning'
        });
      }

      // Validate Age
      const age = row[columnIndices.Age];
      if (age && age.trim() !== '') {
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
          warnings.push({
            column: 'Age',
            issue: `Row ${rowIdx}: "${age}" doesn't look like a valid age`,
            affectedRows: [rowIdx],
            severity: 'warning'
          });
        }
      }

      // Validate Gender
      const gender = row[columnIndices.Gender];
      if (gender && gender.trim() !== '') {
        const normalizedGender = gender.trim().toUpperCase();
        if (!/^[MF]$|^MALE$|^FEMALE$/.test(normalizedGender)) {
          warnings.push({
            column: 'Gender',
            issue: `Row ${rowIdx}: "${gender}" should be M, F, Male, or Female`,
            affectedRows: [rowIdx],
            severity: 'warning'
          });
        }
      }
    });

    // Aggregate warnings by column
    const aggregatedWarnings = warnings.reduce((acc, warning) => {
      const existing = acc.find(w => w.column === warning.column && w.issue.split(':')[0] === warning.issue.split(':')[0]);
      if (existing) {
        existing.affectedRows.push(...warning.affectedRows);
      } else {
        acc.push({ ...warning });
      }
      return acc;
    }, []);

    return {
      success: true,
      validationPassed: issues.length === 0,
      issues,
      warnings: aggregatedWarnings
    };

  } catch (error) {
    return createErrorResponse('validateExcelMapping', error);
  }
}

// Get stored mapping (helper function, not exposed to Ollama)
export function getColumnMapping(mappingId) {
  return columnMappings.get(mappingId);
}

// Clear all mappings (helper function)
export function clearColumnMappings() {
  columnMappings.clear();
}

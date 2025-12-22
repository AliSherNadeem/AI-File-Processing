import {
  DATA_TYPE_PATTERNS,
  ERROR_CATEGORIES,
  ERROR_SUGGESTIONS,
  RECOVERABLE_ERRORS
} from './constants.js';

/**
 * Infer data type from sample values
 * @param {Array} values - Array of sample values from a column
 * @returns {string} - Detected data type
 */
export function inferDataType(values) {
  if (!values || values.length === 0) return 'empty';

  // Filter out null, undefined, and empty string values
  const nonEmptyValues = values.filter(val =>
    val !== null && val !== undefined && val !== ''
  );

  if (nonEmptyValues.length === 0) return 'empty';

  const firstValue = String(nonEmptyValues[0]).trim();

  // Phone number patterns
  if (DATA_TYPE_PATTERNS.phone.test(firstValue)) {
    return 'phone';
  }

  // Email pattern
  if (DATA_TYPE_PATTERNS.email.test(firstValue)) {
    return 'email';
  }

  // Currency pattern
  const cleanedValue = firstValue.replace(/,/g, '');
  if (DATA_TYPE_PATTERNS.currency.test(cleanedValue)) {
    return 'currency';
  }

  // Date patterns
  if (DATA_TYPE_PATTERNS.dateISO.test(firstValue)) {
    return 'date';
  }
  if (DATA_TYPE_PATTERNS.dateUS.test(firstValue)) {
    return 'date';
  }
  if (DATA_TYPE_PATTERNS.dateEU.test(firstValue)) {
    return 'date';
  }

  // Number patterns
  if (DATA_TYPE_PATTERNS.number.test(firstValue)) {
    return 'number';
  }
  if (DATA_TYPE_PATTERNS.decimal.test(firstValue)) {
    return 'number';
  }

  // Default to string
  return 'string';
}

/**
 * Calculate smart sample indices for representative data sampling
 * Samples from beginning, middle, and end of dataset
 * @param {number} totalRows - Total number of rows available
 * @param {number} sampleSize - Desired number of samples
 * @returns {Array<number>} - Array of row indices to sample
 */
export function calculateSampleIndices(totalRows, sampleSize) {
  if (totalRows <= 0) return [];
  if (totalRows <= sampleSize) {
    return Array.from({ length: totalRows }, (_, i) => i);
  }

  const indices = [];

  // Always include first row
  indices.push(0);

  // Calculate step size for middle samples
  const remainingSamples = sampleSize - 2; // -2 for first and last
  if (remainingSamples > 0) {
    const step = Math.floor(totalRows / (remainingSamples + 1));
    for (let i = 1; i <= remainingSamples; i++) {
      const index = Math.floor(i * step);
      if (index < totalRows - 1) {
        indices.push(index);
      }
    }
  }

  // Always include last row
  if (totalRows > 1) {
    indices.push(totalRows - 1);
  }

  // Remove duplicates and sort
  return [...new Set(indices)].sort((a, b) => a - b);
}

/**
 * Categorize error based on error properties
 * @param {Error} error - Error object
 * @returns {string} - Error category
 */
export function categorizeError(error) {
  if (!error) return ERROR_CATEGORIES.UNKNOWN_ERROR;

  // File system errors
  if (error.code === 'ENOENT') return ERROR_CATEGORIES.FILE_NOT_FOUND;
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return ERROR_CATEGORIES.PERMISSION_DENIED;
  }

  // Excel-specific errors
  const message = error.message || '';
  if (message.includes('Invalid file format') || message.includes('not a valid Excel')) {
    return ERROR_CATEGORIES.INVALID_EXCEL_FORMAT;
  }
  if (message.includes('Sheet not found')) {
    return ERROR_CATEGORIES.SHEET_NOT_FOUND;
  }
  if (message.includes('out of memory') || message.includes('heap')) {
    return ERROR_CATEGORIES.MEMORY_ERROR;
  }
  if (message.includes('XLSX') || message.includes('workbook')) {
    return ERROR_CATEGORIES.EXCEL_PARSING_ERROR;
  }
  if (message.includes('validation') || message.includes('invalid data')) {
    return ERROR_CATEGORIES.VALIDATION_ERROR;
  }
  if (message.includes('mapping')) {
    return ERROR_CATEGORIES.MAPPING_ERROR;
  }

  return ERROR_CATEGORIES.UNKNOWN_ERROR;
}

/**
 * Get user-friendly error suggestion based on error category
 * @param {string} category - Error category
 * @returns {string} - Error suggestion
 */
export function getErrorSuggestion(category) {
  return ERROR_SUGGESTIONS[category] || ERROR_SUGGESTIONS[ERROR_CATEGORIES.UNKNOWN_ERROR];
}

/**
 * Check if an error is recoverable
 * @param {string} category - Error category
 * @returns {boolean} - True if error is recoverable
 */
export function isRecoverableError(category) {
  return RECOVERABLE_ERRORS.includes(category);
}

/**
 * Create structured error response
 * @param {string} functionName - Name of the function where error occurred
 * @param {Error} error - Error object
 * @returns {Object} - Structured error response
 */
export function createErrorResponse(functionName, error) {
  const category = categorizeError(error);
  return {
    success: false,
    error: {
      category,
      message: error.message || 'Unknown error occurred',
      functionName,
      recoverable: isRecoverableError(category),
      suggestion: getErrorSuggestion(category)
    }
  };
}

/**
 * Normalize column name for comparison
 * @param {string} columnName - Column name to normalize
 * @returns {string} - Normalized column name
 */
export function normalizeColumnName(columnName) {
  if (!columnName) return '';
  return String(columnName).toLowerCase().trim();
}

/**
 * Check if a number is likely an Excel serial date
 * Excel dates are stored as numbers (days since 1/1/1900)
 * Valid range: ~1 to ~50000 (years 1900-2136)
 * @param {number} num - Number to check
 * @returns {boolean} - True if likely an Excel date
 */
function isExcelSerialDate(num) {
  // Excel serial dates are typically between 1 (1/1/1900) and 50000 (year ~2036)
  // Also check if it has decimal part (time component)
  return num > 0 && num < 100000 && (num % 1 !== 0 || (num >= 1 && num <= 50000));
}

/**
 * Convert Excel serial date to readable date string
 * @param {number} serial - Excel serial number
 * @returns {string} - Formatted date string (M/D/YYYY)
 */
function excelSerialToDate(serial) {
  // Excel epoch is 1/1/1900 (but Excel incorrectly treats 1900 as a leap year)
  const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
  const msPerDay = 86400000; // milliseconds in a day

  // Calculate the date
  const dateMs = excelEpoch.getTime() + (Math.floor(serial) * msPerDay);
  const date = new Date(dateMs);

  // Format as M/D/YYYY
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

/**
 * Format a value as string, handling various data types including Excel serial dates
 * @param {*} value - Value to format
 * @param {string} columnHint - Optional hint about the column type (e.g., 'date')
 * @returns {string} - Formatted string value
 */
export function formatValue(value, columnHint = '') {
  if (value === null || value === undefined) return '';

  // Handle string values
  if (typeof value === 'string') return value.trim();

  // Handle boolean values
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  // Handle Date objects
  if (value instanceof Date) {
    const month = value.getMonth() + 1;
    const day = value.getDate();
    const year = value.getFullYear();
    return `${month}/${day}/${year}`;
  }

  // Handle numbers
  if (typeof value === 'number') {
    // ONLY convert to date if column hint explicitly indicates it's a date column
    const lowerHint = columnHint.toLowerCase();
    const isDateColumn = lowerHint.includes('date') || lowerHint.includes('time') || lowerHint.includes('timestamp');

    // Only apply date conversion if:
    // 1. Column hint explicitly says it's a date, AND
    // 2. The number is in a valid Excel date range, AND
    // 3. NOT a column related to age, amount, quantity, price, cost, count, qty, number, units
    const isNumericColumn = lowerHint.includes('age') || lowerHint.includes('amount') ||
                            lowerHint.includes('quantity') || lowerHint.includes('price') ||
                            lowerHint.includes('cost') || lowerHint.includes('qty') ||
                            lowerHint.includes('count') || lowerHint.includes('number') ||
                            lowerHint.includes('units') || lowerHint.includes('total');

    if (isDateColumn && !isNumericColumn && isExcelSerialDate(value)) {
      // Try to convert as Excel serial date
      try {
        return excelSerialToDate(value);
      } catch (e) {
        // If conversion fails, return as string
        return String(value);
      }
    }

    // Regular number - return as-is
    return String(value);
  }

  return String(value);
}

/**
 * Analyze columns from sample data
 * @param {Array<string>} headers - Column headers
 * @param {Array<Array>} sampleRows - Sample data rows
 * @returns {Array<Object>} - Column analysis results
 */
export function analyzeColumns(headers, sampleRows) {
  if (!headers || headers.length === 0) return [];

  return headers.map((header, colIndex) => {
    // Extract sample values for this column
    const sampleValues = sampleRows
      .map(row => row[colIndex])
      .filter(val => val !== null && val !== undefined && val !== '');

    const dataType = inferDataType(sampleValues);
    const example = sampleValues.length > 0 ? formatValue(sampleValues[0]) : '';

    return {
      column: header || `Column ${colIndex + 1}`,
      dataType,
      example
    };
  });
}

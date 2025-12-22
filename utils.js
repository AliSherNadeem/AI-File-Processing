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
 * Format a value as string, handling various data types
 * @param {*} value - Value to format
 * @returns {string} - Formatted string value
 */
export function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString().split('T')[0];
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

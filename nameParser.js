/**
 * Name combination and parsing utilities
 * Used to intelligently combine split name fields into a single Name field
 */

/**
 * Combine first, middle, and last names into a single full name
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} middleName - Optional middle name
 * @returns {string} - Combined full name
 */
export function combineName(firstName, lastName, middleName = '') {
  const parts = [firstName, middleName, lastName]
    .filter(Boolean)
    .map(s => String(s).trim())
    .filter(s => s.length > 0);

  return parts.join(' ');
}

/**
 * Combine name fields from row data
 * @param {Object} nameMapping - Object with firstNameColumn, lastNameColumn, middleNameColumn properties
 * @param {Array} row - Data row array
 * @param {Array} headers - Column headers array
 * @returns {string} - Combined full name
 */
export function combineNameFromRow(nameMapping, row, headers) {
  const { firstNameColumn, lastNameColumn, middleNameColumn } = nameMapping;

  // Get indices
  const firstNameIdx = headers.indexOf(firstNameColumn);
  const lastNameIdx = headers.indexOf(lastNameColumn);
  const middleNameIdx = middleNameColumn ? headers.indexOf(middleNameColumn) : -1;

  // Extract values
  const firstName = firstNameIdx >= 0 ? row[firstNameIdx] : '';
  const lastName = lastNameIdx >= 0 ? row[lastNameIdx] : '';
  const middleName = middleNameIdx >= 0 ? row[middleNameIdx] : '';

  return combineName(firstName, lastName, middleName);
}

/**
 * Detect if a value looks like a first name or last name
 * (Simple heuristic based on common patterns)
 * @param {string} value - Name value to analyze
 * @returns {string} - 'first', 'last', or 'unknown'
 */
export function detectNameType(value) {
  if (!value || typeof value !== 'string') return 'unknown';

  const trimmed = value.trim();

  // Common indicators of last names (all caps, contains comma)
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 1) {
    return 'last';
  }

  if (trimmed.includes(',')) {
    return 'last';
  }

  // Default assumption
  return 'first';
}

/**
 * Parse a combined name into components (best effort)
 * @param {string} fullName - Full name string
 * @returns {Object} - {firstName, middleName, lastName}
 */
export function parseCombinedName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', middleName: '', lastName: '' };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', middleName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: '', lastName: '' };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: '', lastName: parts[1] };
  }

  // 3 or more parts - assume First Middle Last
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
}

/**
 * Format name consistently (Title Case)
 * @param {string} name - Name to format
 * @returns {string} - Formatted name
 */
export function formatName(name) {
  if (!name || typeof name !== 'string') return '';

  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

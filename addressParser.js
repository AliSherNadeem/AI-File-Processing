/**
 * Address consolidation and parsing utilities
 * Used to intelligently combine split address fields into a single Address field
 */

/**
 * Consolidate individual address fields into a single formatted address
 * @param {string} street - Street address
 * @param {string} apartment - Apartment/Unit number
 * @param {string} city - City
 * @param {string} state - State/Province
 * @param {string} postal - Postal/Zip code
 * @param {string} country - Country
 * @returns {string} - Consolidated address
 */
export function consolidateAddressFields(street, apartment, city, state, postal, country) {
  const parts = [];

  // Add street
  if (street && String(street).trim()) {
    parts.push(String(street).trim());
  }

  // Add apartment/unit (if exists)
  if (apartment && String(apartment).trim()) {
    parts.push(String(apartment).trim());
  }

  // Add city
  if (city && String(city).trim()) {
    parts.push(String(city).trim());
  }

  // Add state and postal code together
  const statePostal = [];
  if (state && String(state).trim()) {
    statePostal.push(String(state).trim());
  }
  if (postal && String(postal).trim()) {
    statePostal.push(String(postal).trim());
  }
  if (statePostal.length > 0) {
    parts.push(statePostal.join(' '));
  }

  // Add country
  if (country && String(country).trim()) {
    parts.push(String(country).trim());
  }

  return parts.join(', ');
}

/**
 * Consolidate address from row data using address component mapping
 * @param {Object} addressMapping - Object with street, apartment, city, state, postal, country column names
 * @param {Array} row - Data row array
 * @param {Array} headers - Column headers array
 * @returns {string} - Consolidated address
 */
export function consolidateAddressFromRow(addressMapping, row, headers) {
  const { street, apartment, city, state, postal, country } = addressMapping;

  // Get indices
  const streetIdx = street ? headers.indexOf(street) : -1;
  const apartmentIdx = apartment ? headers.indexOf(apartment) : -1;
  const cityIdx = city ? headers.indexOf(city) : -1;
  const stateIdx = state ? headers.indexOf(state) : -1;
  const postalIdx = postal ? headers.indexOf(postal) : -1;
  const countryIdx = country ? headers.indexOf(country) : -1;

  // Extract values
  const streetVal = streetIdx >= 0 ? row[streetIdx] : '';
  const apartmentVal = apartmentIdx >= 0 ? row[apartmentIdx] : '';
  const cityVal = cityIdx >= 0 ? row[cityIdx] : '';
  const stateVal = stateIdx >= 0 ? row[stateIdx] : '';
  const postalVal = postalIdx >= 0 ? row[postalIdx] : '';
  const countryVal = countryIdx >= 0 ? row[countryIdx] : '';

  return consolidateAddressFields(
    streetVal,
    apartmentVal,
    cityVal,
    stateVal,
    postalVal,
    countryVal
  );
}

/**
 * Parse a combined address into components (best effort)
 * This is a simple heuristic-based parser
 * @param {string} combinedAddress - Full address string
 * @returns {Object} - {street, apartment, city, state, postal, country}
 */
export function parseAddress(combinedAddress) {
  if (!combinedAddress || typeof combinedAddress !== 'string') {
    return {
      street: '',
      apartment: '',
      city: '',
      state: '',
      postal: '',
      country: ''
    };
  }

  const result = {
    street: '',
    apartment: '',
    city: '',
    state: '',
    postal: '',
    country: ''
  };

  // Split by comma
  const parts = combinedAddress.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) {
    return result;
  }

  // Common patterns:
  // "Street, City, State Postal, Country"
  // "Street, Apt, City, State Postal, Country"
  // "Street, City, State Postal"

  if (parts.length >= 1) {
    result.street = parts[0];
  }

  if (parts.length >= 2) {
    // Check if second part looks like apartment/unit or city
    const secondPart = parts[1];
    if (/^(apt|unit|suite|#|\d+[a-z]?)/i.test(secondPart) || secondPart.length < 10) {
      result.apartment = secondPart;
      if (parts.length >= 3) {
        result.city = parts[2];
      }
      if (parts.length >= 4) {
        const statePostal = parseStatePostal(parts[3]);
        result.state = statePostal.state;
        result.postal = statePostal.postal;
      }
      if (parts.length >= 5) {
        result.country = parts[4];
      }
    } else {
      result.city = secondPart;
      if (parts.length >= 3) {
        const statePostal = parseStatePostal(parts[2]);
        result.state = statePostal.state;
        result.postal = statePostal.postal;
      }
      if (parts.length >= 4) {
        result.country = parts[3];
      }
    }
  }

  return result;
}

/**
 * Parse "State Postal" or "State" into components
 * @param {string} statePostalStr - String like "NY 10001" or "New York 10001"
 * @returns {Object} - {state, postal}
 */
function parseStatePostal(statePostalStr) {
  if (!statePostalStr) {
    return { state: '', postal: '' };
  }

  const parts = statePostalStr.trim().split(/\s+/);

  if (parts.length === 1) {
    // Could be state or postal
    if (/^\d+$/.test(parts[0])) {
      return { state: '', postal: parts[0] };
    } else {
      return { state: parts[0], postal: '' };
    }
  }

  // Multiple parts - last is likely postal if numeric
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      return {
        state: parts.slice(0, -1).join(' '),
        postal: lastPart
      };
    } else {
      return {
        state: parts.join(' '),
        postal: ''
      };
    }
  }

  return { state: statePostalStr, postal: '' };
}

/**
 * Detect if a string looks like a complete address
 * @param {string} value - Value to check
 * @returns {boolean} - True if looks like an address
 */
export function looksLikeAddress(value) {
  if (!value || typeof value !== 'string') return false;

  const lower = value.toLowerCase();

  // Check for common address keywords
  const hasAddressKeywords = /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct|place|pl|apt|unit|suite)\b/i.test(value);

  // Check for numbers (street numbers)
  const hasNumbers = /\d/.test(value);

  // Check for commas (typical in formatted addresses)
  const hasCommas = value.includes(',');

  return (hasAddressKeywords && hasNumbers) || (hasCommas && hasNumbers);
}

/**
 * Format address consistently
 * @param {string} address - Address to format
 * @returns {string} - Formatted address
 */
export function formatAddress(address) {
  if (!address || typeof address !== 'string') return '';

  // Trim and remove multiple spaces
  return address
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ');
}

// Standard output columns - exactly 10 columns in this order
export const STANDARD_COLUMNS = [
  'Date',
  'Name',
  'Age',
  'Address',
  'Gender',
  'Contact Number',
  'Product Purchased',
  'Amount',
  'Product Quantity',
  'Email'
];

// Semantic mapping rules for intelligent column matching
// Maps standard column names to possible variations in source files
export const SEMANTIC_MAPPING_RULES = {
  'Date': [
    'date', 'purchase date', 'order date', 'transaction date', 'sale date',
    'created date', 'created at', 'timestamp', 'time', 'dt', 'order_date',
    'purchase_date', 'trans_date'
  ],
  'Name': [
    'name', 'full name', 'customer name', 'client name', 'fullname',
    'full_name', 'person name', 'user name', 'username', 'customer',
    'client', 'customername', 'customer_name'
  ],
  'Age': [
    'age', 'years', 'years old', 'age years', 'customer age', 'yrs'
  ],
  'Address': [
    'address', 'full address', 'complete address', 'location', 'addr',
    'full_address', 'complete_address', 'mailing address', 'shipping address'
  ],
  'Gender': [
    'gender', 'sex', 'male/female', 'm/f', 'g'
  ],
  'Contact Number': [
    'phone', 'telephone', 'mobile', 'cell', 'contact', 'phone number',
    'contact number', 'tel', 'mobile number', 'cell phone', 'contact no',
    'phone_number', 'mobile_number', 'cellphone', 'cell_phone'
    // NOTE: CNIC, NID, SSN, ID Number are NOT phone numbers - do not map these to Contact Number
  ],
  'Product Purchased': [
    'product', 'item', 'product name', 'item name', 'product purchased',
    'product description', 'product title', 'item description', 'sku',
    'service', 'plan', 'product_name', 'item_name', 'productname'
  ],
  'Amount': [
    'amount', 'price', 'cost', 'total', 'purchase amount', 'sale amount',
    'payment', 'value', 'revenue', 'total amount', 'total price',
    'total_amount', 'total_price', 'purchase_amount', 'sale_amount'
  ],
  'Product Quantity': [
    'quantity', 'qty', 'count', 'number', 'number of items', 'units',
    'product quantity', 'item quantity', 'items', 'product_quantity',
    'item_quantity', 'num_items'
  ],
  'Email': [
    'email', 'e-mail', 'email address', 'e-mail address', 'mail',
    'email id', 'customer email', 'email_address', 'customer_email',
    'e_mail'
  ]
};

// Sub-components for address consolidation
// Used when address is split across multiple columns
export const ADDRESS_COMPONENTS = {
  'Street': [
    'street', 'address line 1', 'address1', 'street address',
    'road', 'street name', 'address_line_1', 'address_1', 'addr1'
  ],
  'Apartment': [
    'apartment', 'apt', 'unit', 'suite', 'address line 2', 'address2',
    'apt number', 'unit number', 'building', 'floor', 'address_line_2',
    'address_2', 'addr2', 'apartment_number'
  ],
  'City': [
    'city', 'town', 'municipality', 'locality', 'city_name'
  ],
  'State': [
    'state', 'province', 'region', 'state/province', 'st', 'state_province'
  ],
  'Country': [
    'country', 'nation', 'country code', 'country name', 'country_name',
    'country_code'
  ],
  'Postal Code': [
    'zip', 'postal', 'postal code', 'zip code', 'postcode',
    'zipcode', 'post code', 'pincode', 'pin', 'postal_code',
    'zip_code', 'post_code'
  ]
};

// Name components for combination
// Used when name is split across multiple columns
export const NAME_COMPONENTS = {
  'First Name': [
    'first name', 'fname', 'first', 'given name', 'forename',
    'first_name', 'firstname', 'givenname'
  ],
  'Last Name': [
    'last name', 'lname', 'last', 'surname', 'family name',
    'last_name', 'lastname', 'familyname', 'family_name'
  ],
  'Middle Name': [
    'middle name', 'mname', 'middle', 'middle initial', 'mi',
    'middle_name', 'middlename', 'middle_initial'
  ]
};

// Regular expressions for data type pattern matching
export const DATA_TYPE_PATTERNS = {
  phone: /^[\+\d\s\-\(\)]{10,}$/,
  email: /@.+\..+/,
  currency: /^\$?[\d,]+\.?\d*$/,
  dateISO: /^\d{4}-\d{2}-\d{2}/,
  dateUS: /^\d{1,2}\/\d{1,2}\/\d{2,4}/,
  dateEU: /^\d{1,2}-\d{1,2}-\d{4}/,
  number: /^\d+$/,
  decimal: /^\d+\.\d+$/
};

// Processing configuration
export const BATCH_SIZE_LIMITS = {
  default: 500,
  max: 1000,
  sample: 10
};

export const ERROR_CATEGORIES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_EXCEL_FORMAT: 'INVALID_EXCEL_FORMAT',
  SHEET_NOT_FOUND: 'SHEET_NOT_FOUND',
  MEMORY_ERROR: 'MEMORY_ERROR',
  EXCEL_PARSING_ERROR: 'EXCEL_PARSING_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MAPPING_ERROR: 'MAPPING_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export const ERROR_SUGGESTIONS = {
  [ERROR_CATEGORIES.FILE_NOT_FOUND]: 'Verify the file exists in the specified directory. Use listFiles to check.',
  [ERROR_CATEGORIES.PERMISSION_DENIED]: 'Check file permissions. The file might be open in another application.',
  [ERROR_CATEGORIES.INVALID_EXCEL_FORMAT]: 'The file is not a valid Excel file (.xlsx). Ensure it\'s not corrupted.',
  [ERROR_CATEGORIES.SHEET_NOT_FOUND]: 'The specified sheet doesn\'t exist. Try without specifying a sheet name to use the first sheet.',
  [ERROR_CATEGORIES.MEMORY_ERROR]: 'File is too large. Try processing in smaller batches or increasing Node.js memory limit.',
  [ERROR_CATEGORIES.EXCEL_PARSING_ERROR]: 'Error parsing Excel file. The file might be corrupted or in an unsupported format.',
  [ERROR_CATEGORIES.VALIDATION_ERROR]: 'Data validation failed. Review the mapping and ensure data types match expectations.',
  [ERROR_CATEGORIES.MAPPING_ERROR]: 'Column mapping failed. Check that source columns exist and mapping is correct.',
  [ERROR_CATEGORIES.UNKNOWN_ERROR]: 'An unexpected error occurred. Check the error message for details.'
};

export const RECOVERABLE_ERRORS = [
  ERROR_CATEGORIES.SHEET_NOT_FOUND,
  ERROR_CATEGORIES.VALIDATION_ERROR,
  ERROR_CATEGORIES.MAPPING_ERROR
];

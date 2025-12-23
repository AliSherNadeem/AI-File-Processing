// AI-Powered Excel Processing with Ollama (qwen3-coder:480b-cloud)
import axios from "axios";
import dotenv from "dotenv";
import { availableFunctions, functionDefinitions } from "./tools.js";
import { STANDARD_COLUMNS } from "./constants.js";

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3-coder:480b-cloud";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./upload";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";
const MAX_SAMPLE_SIZE = parseInt(process.env.MAX_SAMPLE_SIZE || "5", 10);
const LARGE_FILE_THRESHOLD = parseInt(process.env.LARGE_FILE_THRESHOLD || "100", 10);

// Execute function calls from Ollama
async function executeFunctionCall(functionCall) {
  const functionName = functionCall.name;
  let functionArgs;

  if (typeof functionCall.arguments === "string") {
    functionArgs = JSON.parse(functionCall.arguments);
  } else if (typeof functionCall.arguments === "object") {
    functionArgs = functionCall.arguments;
  } else {
    throw new Error(
      `Invalid arguments format: ${typeof functionCall.arguments}`
    );
  }

  if (availableFunctions[functionName]) {
    console.log(`   🔧 ${functionName}`);
    const result = await availableFunctions[functionName](functionArgs);

    // Show concise result
    if (result.success === false) {
      console.log(
        `      ❌ Error: ${result.error?.message || "Unknown error"}`
      );
    } else if (functionName === "readExcelFileSample") {
      console.log(
        `      ✅ Sampled ${result.sampleRows?.length || 0} rows (from ${
          result.totalRows
        } total) with ${result.headers?.length || 0} columns`
      );
    } else if (functionName === "analyzeColumnRelationships") {
      const rel = result.relationships || {};
      console.log(`      ✅ ${result.message}`);
      if (rel.hasNameSplit) {
        console.log(
          `         📝 Name split detected: ${Object.values(
            rel.nameComponents
          ).join(" + ")}`
        );
      }
      if (rel.hasAddressSplit) {
        console.log(
          `         📍 Address split detected: ${
            Object.keys(rel.addressComponents).length
          } components`
        );
      }
      if (rel.hasCombinedAddress) {
        console.log(
          `         📍 Combined address found in: ${rel.combinedAddressColumn}`
        );
      }
    } else if (functionName === "combineNameFields") {
      console.log(`      ✅ ${result.message}`);
    } else if (functionName === "consolidateAddress") {
      console.log(`      ✅ ${result.message}`);
    } else if (functionName === "createColumnMapping") {
      console.log(`      ✅ Mapped ${result.mappedColumns}/10 columns`);
    } else if (functionName === "transformRows") {
      console.log(`      ✅ Transformed ${result.rowCount} rows to 10 columns`);
    } else if (functionName === "transformAndWriteFile") {
      console.log(
        `      ✅ Processed ${result.rowsProcessed} rows → ${result.outputFile}`
      );
      console.log(`      📁 Output: ${result.filePath}`);
    } else if (functionName === "readExcelFileFull") {
      console.log(
        `      ✅ Read ${result.rows?.length || 0} of ${
          result.totalRows
        } total rows`
      );
    } else if (functionName === "validateExcelMapping") {
      const passed = result.validationPassed ? "✅ PASSED" : "⚠️  HAS ISSUES";
      console.log(
        `      ${passed} - ${result.issues?.length || 0} errors, ${
          result.warnings?.length || 0
        } warnings`
      );
      if (result.issues && result.issues.length > 0) {
        result.issues.forEach((issue) => {
          console.log(`         ❌ ${issue.column}: ${issue.issue}`);
        });
      }
      if (
        result.warnings &&
        result.warnings.length > 0 &&
        result.warnings.length <= 5
      ) {
        result.warnings.forEach((warning) => {
          console.log(`         ⚠️  ${warning.column}: ${warning.issue}`);
        });
      } else if (result.warnings && result.warnings.length > 5) {
        console.log(
          `         ⚠️  ${result.warnings.length} warnings (showing first 3):`
        );
        result.warnings.slice(0, 3).forEach((warning) => {
          console.log(`         ⚠️  ${warning.column}: ${warning.issue}`);
        });
      }
    } else if (functionName === "writeExcelFile") {
      console.log(
        `      ✅ Wrote ${result.rowsWritten} rows to ${result.filePath}`
      );
    } else {
      console.log(`      ✅ ${result.message || "Success"}`);
    }

    return result;
  } else {
    throw new Error(`Function ${functionName} not found`);
  }
}

async function processExcelWithAI(fileName) {
  try {
    // Determine file type
    const isCSV = fileName.toLowerCase().endsWith('.csv');
    const isXLSX = fileName.toLowerCase().endsWith('.xlsx');
    const fileType = isCSV ? 'CSV' : 'Excel';

    if (!isCSV && !isXLSX) {
      console.error(`❌ Unsupported file format: ${fileName}`);
      console.error('   Supported formats: .xlsx, .csv');
      return;
    }

    console.log(`🚀 Starting AI-Powered ${fileType} Processing...\n`);
    console.log(`🤖 Using model: ${OLLAMA_MODEL}`);
    console.log(`📁 File: ${fileName}\n`);

    // Step 1: Verify file exists
    console.log("📂 Verifying file exists...");

    // List all supported files
    const xlsxList = await availableFunctions.listFiles({
      directory: UPLOAD_DIR,
      extension: ".xlsx",
    });
    const csvList = await availableFunctions.listFiles({
      directory: UPLOAD_DIR,
      extension: ".csv",
    });
    const allFiles = [...xlsxList.files, ...csvList.files];

    if (!allFiles.includes(fileName)) {
      console.error(`❌ File not found: ${fileName}`);
      console.log(`   Available files: ${allFiles.join(", ")}`);
      return;
    }
    console.log(`✅ File found: ${fileName}\n`);

    // Step 2: Send to Ollama API with function calling
    console.log("🤖 Sending request to Ollama AI...\n");

    const SYSTEM_PROMPT = `# PURPOSE
You are designed to standardize messy customer data files (Excel/CSV) into a clean, uniform 10-column format. Your purpose is to help organizations transform inconsistent data structures from various sources into a single standardized database-ready format.

# CAPABILITIES
You can intelligently:
- Analyze varying column structures and identify data patterns
- Map columns semantically (understanding "phone" means "Contact Number", "purchase_date" means "Date", etc.)
- Combine split data (First Name + Last Name → Name, City + Country → Address)
- Detect and convert Excel serial dates to readable formats
- Handle both Excel (.xlsx) and CSV (.csv) files
- Process files of any size (small files with validation, large files with batch processing)
- Distinguish between relevant and irrelevant data (e.g., Company ≠ Product, Index ≠ Amount)
- Leave columns empty when no relevant data exists (never force-map unrelated data)

# YOUR TASK
Transform the uploaded file "${fileName}" into the standardized 10-column format using intelligent column mapping and data consolidation.

# OUTPUT FORMAT (Required Columns in Exact Order)
1. Date - Transaction/purchase date
2. Name - Full customer name
3. Age - Customer age
4. Address - Complete address
5. Gender - M/F/Male/Female
6. Contact Number - Phone number
7. Product Purchased - Product/item/service name
8. Amount - Price/cost/payment amount
9. Product Quantity - Quantity purchased
10. Email - Email address

# CRITICAL PRINCIPLE
⚠️ ONLY map columns when you find RELEVANT and APPROPRIATE data in the source file.
⚠️ If NO relevant data exists for a column, leave it as EMPTY STRING ("").
⚠️ NEVER force-map unrelated data just to fill columns.

# EXECUTION WORKFLOW

STEP 1: Analyze Structure
- Call readExcelFileSample(directory="${UPLOAD_DIR}", fileName="${fileName}", sampleSize=${MAX_SAMPLE_SIZE})
- Note the totalRows count from the result
- Call analyzeColumnRelationships(headers from step 1, sampleRows from step 1)

⚠️ CRITICAL: Carefully examine the analyzeColumnRelationships result:

Name Status Check:
  ✅ hasNameSplit=true AND nameComponents has "First Name" AND "Last Name"
     → Names are in SEPARATE columns (e.g., "Robert" in one, "Garcia" in another)
     → Action: You WILL use nameColumns parameter in Step 3

  ❌ hasNameSplit=false OR only single name column exists
     → Name is ALREADY COMBINED in one column (e.g., "Robert Garcia" together)
     → Action: DO NOT use nameColumns parameter - map directly in Step 2

Address Status Check:
  ✅ hasAddressSplit=true AND addressComponents has multiple fields
     → Address is split (e.g., "City" in one column, "Country" in another)
     → Action: You WILL use addressComponents parameter in Step 3

  ❌ hasAddressSplit=false OR single address column exists
     → Address is already combined or doesn't exist
     → Action: DO NOT use addressComponents parameter - map directly in Step 2

Address Component Rules:
- ONLY include: Street, Apartment, City, State, Postal Code, Country
- NEVER include: Customer ID, User ID, Index, Row Number, Company, Organization

STEP 2: Create Intelligent Mapping
Action: Call createColumnMapping with a mapping object for all 10 columns

Mapping Strategy:
1. Check exact column name matches (case-insensitive)
2. Check semantic similarities (e.g., "purchase_date" → Date)
3. Analyze sample data content (e.g., values with "@" → Email)
4. Apply column-specific rules below

Column-Specific Mapping Rules:

📅 Date:
   ✅ Map: Date, Transaction Date, Purchase Date, Subscription Date, Order Date
   ❌ Do NOT map: Unrelated date fields

👤 Name:
   IF hasNameSplit=false (single name column):
      ✅ Map directly: "Name" → Name, "Full Name" → Name, "Customer Name" → Name
      ⚠️ This column already has complete names like "Robert Garcia"
      ⚠️ DO NOT combine anything - just map the column name

   IF hasNameSplit=true (split across First Name + Last Name):
      ❌ Leave as "" in mapping (will be combined using nameColumns parameter in Step 3)
      ⚠️ DO NOT map any single column to Name - combination happens automatically

🎂 Age:
   ✅ Map: Age, Customer Age
   ❌ Do NOT map: Index, ID, Row Number

📍 Address:
   ✅ Map: Address, Full Address, Complete Address
   ⚠️ If split (City + Country, etc.): Leave as "" (handled separately)

⚧ Gender:
   ✅ Map: Gender, Sex, M/F, Male/Female
   ❌ Do NOT map: Single-letter columns without M/F values

📞 Contact Number:
   ✅ Map: Phone, Mobile, Telephone, Cell, Contact Number
   ❌ NEVER map: CNIC, NID, SSN, ID Number, Customer ID, Account ID

🛍️ Product Purchased:
   ✅ Map: Product, Product Name, Item, Item Name, Service, SKU
   ❌ NEVER map: Company, Company Name, Business, Organization, Employer, Vendor

💰 Amount:
   ✅ Map: Amount, Price, Cost, Total, Payment
   ❌ NEVER map: Index, Row Number, Customer ID, Serial Number

📦 Product Quantity:
   ✅ Map: Quantity, Qty, Count, Units, Items
   ❌ NEVER map: Index, Row Number, Customer ID, Serial Number

📧 Email:
   ✅ Map: Email, E-mail, Email Address
   ❌ Do NOT map: Columns without @ symbol in sample data

Default Rule:
⚠️ If NO relevant source column exists → Use empty string ""
⚠️ Never force-map unrelated columns just to fill output

Special Handling:
- For split names: Leave "Name" as "" in mapping (will use nameColumns parameter)
- For split addresses: Leave "Address" as "" in mapping (will use addressComponents parameter)

STEP 3: Transform and Write File

Check totalRows from Step 1, then choose the appropriate method:

📊 LARGE FILES (> ${LARGE_FILE_THRESHOLD} rows) - Batch Processing:
   Function: transformAndWriteFile()

   Required Parameters:
   - sourceDirectory: "${UPLOAD_DIR}"
   - sourceFileName: "${fileName}"
   - outputDirectory: "${OUTPUT_DIR}"
   - outputFileName: "processed_${fileName}"
   - mapping: (the mapping object from Step 2)
   - mappingId: (the ID from Step 2)

   ⚠️ CRITICAL - Optional Parameters (based on Step 1 analysis):

   nameColumns parameter:
     ✅ ONLY pass if: hasNameSplit=true AND you have separate "First Name" & "Last Name" columns
        Example: { firstName: "First Name", lastName: "Last Name", middleName: "Middle Name" }

     ❌ DO NOT pass if: hasNameSplit=false OR you have a single "Name" column
        Reason: Single name column is already mapped in Step 2 - passing this causes DUPLICATION

   addressComponents parameter:
     ✅ ONLY pass if: hasAddressSplit=true AND you have multiple separate address columns
        Valid fields: street, apartment, city, state, postal, country
        Example: { city: "City", country: "Country", state: "State" }

     ❌ DO NOT pass if: hasAddressSplit=false OR you have single "Address" column
        ❌ NEVER include: Customer ID, Index, Company, Row Number in addressComponents

   Behavior:
   - Processes file server-side in batches (you never see full data)
   - Combines names and addresses automatically
   - No validation (to avoid context limits)
   - After completion: STOP immediately

📄 SMALL FILES (≤ ${LARGE_FILE_THRESHOLD} rows) - Full Processing:
   1. Call readExcelFileFull(directory="${UPLOAD_DIR}", fileName="${fileName}")

   2. Name Handling:
      IF hasNameSplit=true (First Name + Last Name in separate columns):
         → Call combineNameFields → manually construct rows with combined names
      ELSE (single "Name" column or no name column):
         → DO NOT call combineNameFields - names already in mapping

   3. Address Handling:
      IF hasAddressSplit=true (City + Country in separate columns):
         → Call consolidateAddress → manually construct rows with consolidated addresses
      ELSE (single "Address" column or no address column):
         → DO NOT call consolidateAddress - address already in mapping

   4. IF you did NOT call combineNameFields or consolidateAddress:
         → Call transformRows(mappingId, sourceRows, sourceHeaders)

   5. Validate: Call validateExcelMapping(first ${MAX_SAMPLE_SIZE}-10 rows)
   6. Write: Call writeExcelFile(directory="${OUTPUT_DIR}", fileName="processed_${fileName}", data=rows)

# CONSTRAINTS
1. ⚠️ Empty Column Rule: If no relevant data exists for ANY column, use empty string ""
2. ⚠️ Never map unrelated data (Index → Amount, Company → Product, etc.)
3. ⚠️ NO DUPLICATION: If name is already in one column, DO NOT use nameColumns parameter
4. ⚠️ After file is written: STOP immediately - do NOT call any more functions
5. ⚠️ Execute autonomously - do NOT ask for user permission
6. ⚠️ Respect column data types (analyze sample values, not just names)

# START
Begin execution by calling readExcelFileSample now.`;

    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Process the file "${fileName}". Start by calling readExcelFileSample to analyze the file structure.`,
      },
    ];

    let stepCount = 0;
    let isComplete = false;
    const maxSteps = 20; // Safety limit

    while (!isComplete && stepCount < maxSteps) {
      console.log(`\n📤 AI Request: Step ${stepCount + 1}`);

      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model: OLLAMA_MODEL,
          messages: messages,
          tools: functionDefinitions.map((func) => ({
            type: "function",
            function: {
              name: func.name,
              description: func.description,
              parameters: func.parameters,
            },
          })),
          stream: false,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 300000, // 5 minute timeout
        }
      );

      const message = response.data.message;
      const toolCalls = message.tool_calls || [];

      if (toolCalls.length > 0) {
        // Execute function calls
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const result = await executeFunctionCall(toolCall.function);

          // Add AI message
          messages.push({
            role: "assistant",
            content: message.content || "",
            tool_calls: toolCalls,
          });

          // Add function result
          messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          });

          stepCount++;

          // Check if this is the final step (writeExcelFile or transformAndWriteFile)
          if (functionName === "writeExcelFile" || functionName === "transformAndWriteFile") {
            console.log(
              "\n✅ Processing completed - File written successfully"
            );
            isComplete = true;
            break;
          }
        }
      } else {
        // No tool calls - AI might have stopped or provided text response
        const lastMessage = messages[messages.length - 1];

        if (message.content && message.content.trim() !== "") {
          console.log(`\n💬 AI: ${message.content}`);
        }

        if (lastMessage && lastMessage.role === "tool" && !isComplete) {
          console.log("⚠️  AI stopped unexpectedly, prompting to continue...");

          messages.push({
            role: "assistant",
            content: message.content || "",
          });

          messages.push({
            role: "user",
            content:
              "Continue with the next step. Call the appropriate function now - do not provide explanations.",
          });
        } else {
          console.log("\n⚠️  AI finished without completing writeExcelFile");
          break;
        }
      }
    }

    if (stepCount >= maxSteps) {
      console.log(
        "\n⚠️  Reached maximum step limit - stopping to prevent infinite loop"
      );
    }

    // Verify output
    console.log("\n📊 Verifying output...");
    // Preserve the file extension from input
    const fileExt = fileName.substring(fileName.lastIndexOf('.'));
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const outputFileName = `processed_${fileNameWithoutExt}${fileExt}`;

    try {
      const verifyResult = await availableFunctions.readExcelFileSample({
        directory: OUTPUT_DIR,
        fileName: outputFileName,
        sampleSize: 3,
      });

      console.log("\n📊 Process Summary:");
      console.log(`   Input file: ${fileName}`);
      console.log(`   Output file: ${outputFileName}`);
      console.log(`   Rows processed: ${verifyResult.totalRows}`);
      console.log(`   Output columns: ${verifyResult.headers.length}`);
      console.log(`   Expected: 10 columns (${STANDARD_COLUMNS.join(", ")})`);
      console.log(
        `   Match: ${
          verifyResult.headers.length === 10
            ? "✅ Perfect"
            : "❌ Column count mismatch"
        }`
      );

      if (verifyResult.headers.length === 10) {
        console.log("\n📋 Output columns:");
        verifyResult.headers.forEach((col, idx) => {
          const expected = STANDARD_COLUMNS[idx];
          const match = col === expected ? "✅" : "❌";
          console.log(
            `   ${match} ${idx + 1}. ${col} ${
              col !== expected ? `(expected: ${expected})` : ""
            }`
          );
        });
      }

      console.log("\n✨ AI processing completed successfully!");
      console.log(`📁 Output: ${OUTPUT_DIR}/${outputFileName}`);
    } catch (error) {
      console.log("\n⚠️  Could not verify output file");
      console.log(`   ${error.message}`);
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response?.data) {
      console.error(
        "Ollama Response:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    if (error.code === "ECONNREFUSED") {
      console.error("\n💡 Make sure Ollama is running: ollama serve");
      console.error(
        "💡 And the model is installed: ollama pull qwen3-coder:480b-cloud"
      );
    }
  }
}

// Get filename from command line
const fileName = process.argv[2];

if (!fileName) {
  console.error("❌ Usage: node process-excel-ai.js <filename.xlsx|filename.csv>");
  console.error("\nSupported formats: .xlsx, .csv");
  console.error("\nExamples:");
  console.error('   node process-excel-ai.js "new test file.xlsx"');
  console.error("   node process-excel-ai.js customers.xlsx");
  console.error("   node process-excel-ai.js data.csv");
  process.exit(1);
}

processExcelWithAI(fileName);

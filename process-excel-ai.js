// AI-Powered Excel Processing with Ollama (qwen3-coder:480b-cloud)
import axios from "axios";
import dotenv from "dotenv";
import { availableFunctions, functionDefinitions } from "./tools.js";
import { STANDARD_COLUMNS } from "./constants.js";

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = "qwen3-coder:480b-cloud"; // Hardcoded as requested
const UPLOAD_DIR = "./upload";
const OUTPUT_DIR = "./output";

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
    console.log("🚀 Starting AI-Powered Excel Processing...\n");
    console.log(`🤖 Using model: ${OLLAMA_MODEL}`);
    console.log(`📁 File: ${fileName}\n`);

    // Step 1: Verify file exists
    console.log("📂 Verifying file exists...");
    const fileList = await availableFunctions.listFiles({
      directory: UPLOAD_DIR,
      extension: ".xlsx",
    });

    if (!fileList.files.includes(fileName)) {
      console.error(`❌ File not found: ${fileName}`);
      console.log(`   Available files: ${fileList.files.join(", ")}`);
      return;
    }
    console.log(`✅ File found: ${fileName}\n`);

    // Step 2: Send to Ollama API with function calling
    console.log("🤖 Sending request to Ollama AI...\n");

    const SYSTEM_PROMPT = `You are an autonomous Excel data standardization agent. Your task is to intelligently transform uploaded Excel files with varying column structures into a standardized 10-column format.

TARGET OUTPUT COLUMNS (exact order):
1. Date
2. Name
3. Age
4. Address
5. Gender
6. Contact Number
7. Product Purchased
8. Amount
9. Product Quantity
10. Email

INTELLIGENT MAPPING STRATEGY:

STEP 1: Analyze Structure
- Call readExcelFileSample(directory="./upload", fileName="${fileName}", sampleSize=5)
- Call analyzeColumnRelationships(headers from step 1, sampleRows from step 1)

STEP 2: Read Full Data
- Call readExcelFileFull(directory="./upload", fileName="${fileName}")

STEP 3: Handle Special Cases (based on analysis from Step 1)

IF names are split (analyzeColumnRelationships detected hasNameSplit=true):
- Call combineNameFields(firstNameColumn, lastNameColumn, middleNameColumn if exists, sourceRows from step 2, sourceHeaders from step 2)
- Store the combinedNames result for later use

IF addresses are split (analyzeColumnRelationships detected hasAddressSplit=true):
- Call consolidateAddress(addressComponents from analysis, sourceRows from step 2, sourceHeaders from step 2)
- Store the consolidatedAddresses result for later use

STEP 4: Create Intelligent Mapping
- Call createColumnMapping with a mapping object for all 10 columns
- Mapping rules:
  * If you called combineNameFields, map Name to "__COMBINED__"
  * If you called consolidateAddress, map Address to "__COMBINED__"
  * For other columns, map to source column name using intelligent matching:
    - Check exact matches first (case-insensitive)
    - Check semantic similarities (e.g., "purchase_date" → Date, "phone_number" → Contact Number)
    - Analyze sample data types (e.g., column with "@" → Email, column with phone pattern → Contact Number)
    - Check for single-letter columns with context (e.g., "M" with M/F values → Gender)
  * If no source column exists for a standard column, use empty string ""

STEP 5: Transform Data
IF you used combineNameFields or consolidateAddress:
- Manually construct 10-column rows by combining:
  * Regular mapped columns from source rows
  * Combined names (if applicable) at position 1 (index 1)
  * Consolidated addresses (if applicable) at position 3 (index 3)
ELSE:
- Call transformRows(mappingId from step 4, sourceRows from step 2, sourceHeaders from step 2)

STEP 6: Validate Quality
- Take first 5-10 transformed rows as sample
- Call validateExcelMapping(sample of transformed rows)
- Review validation results

STEP 7: Write Output
- Call writeExcelFile(directory="./output", fileName="processed_${fileName}", all transformed rows)

CRITICAL RULES:
- Execute steps in order, but adapt based on analysis
- After writeExcelFile completes, STOP immediately
- DO NOT call any functions after writeExcelFile
- DO NOT ask for permission - execute autonomously
- Use intelligent column matching - don't just look for exact names
- Pay attention to data types and sample values
- Combine split names and addresses when detected
- Empty columns must use "" (empty string)

Start by calling readExcelFileSample now.`;

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

          // Check if this is the final step (writeExcelFile)
          if (functionName === "writeExcelFile") {
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
    const outputFileName = `processed_${fileName}`;
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
  console.error("❌ Usage: node process-excel-ai.js <filename.xlsx>");
  console.error("\nExample:");
  console.error('   node process-excel-ai.js "new test file.xlsx"');
  console.error("   node process-excel-ai.js customers.xlsx");
  process.exit(1);
}

processExcelWithAI(fileName);

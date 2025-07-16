// index.js

import { execFile } from "child_process";
import { promisify } from "util";
import Tesseract from "tesseract.js";
import fs from "fs/promises";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

const pdfPath = "./check.pdf";

/**
 * @param {string} filePath - The path to the PDF file.
 * @returns {Promise<number>} The total page count.
 */
async function getPdfPageCount(filePath) {
  const { stdout } = await execFileAsync("pdfinfo", [filePath]);
  const matches = stdout.match(/Pages:\s*(\d+)/);
  if (!matches || !matches[1]) {
    throw new Error("Could not determine page count.");
  }
  return parseInt(matches[1], 10);
}

/**
 * Converts a single page of a PDF to an image buffer.
 * @param {string} filePath - The path to the PDF file.
 * @param {number} pageNum - The page number to convert.
 * @returns {Promise<Buffer>} A buffer containing the PNG image data.
 */
async function convertPdfPageToImage(filePath, pageNum) {
  const tempOutputFile = `temp-page-${Date.now()}`;
  const tempFilePath = `${tempOutputFile}.png`;

  const args = [
    "-png",
    "-f",
    pageNum,
    "-l",
    pageNum,
    "-singlefile", // <-- THIS IS THE FIX
    filePath,
    tempOutputFile,
  ];

  try {
    await execFileAsync("pdftocairo", args);
    const imageBuffer = await fs.readFile(tempFilePath);
    return imageBuffer;
  } finally {
    await fs.unlink(tempFilePath).catch(() => {}); // Cleanup, ignore errors
  }
}

/**
 * Runs OCR on an image buffer and returns the extracted text.
 * @param {Buffer} imageBuffer - The image buffer to process.
 * @returns {Promise<string>} The extracted text.
 */
async function runOCRFromBuffer(imageBuffer) {
  const processedImage = await sharp(imageBuffer)
    .greyscale()
    .sharpen()
    .toBuffer();

  const {
    data: { text },
  } = await Tesseract.recognize(processedImage, "eng+hin");
  return text;
}

// Main execution block to process all pages
// Main execution block to process all pages
(async () => {
  try {
    console.log(`Starting processing for: ${pdfPath}`);
    const pageCount = await getPdfPageCount(pdfPath);
    console.log(`PDF has ${pageCount} pages.`);

    const allPagesData = []; // Initialize an empty array to hold all page data

    for (let i = 1; i <= pageCount; i++) {
      console.log(`\n----- Processing Page ${i} of ${pageCount} -----`);
      const imageBuffer = await convertPdfPageToImage(pdfPath, i);
      const text = await runOCRFromBuffer(imageBuffer);

      const cleanedText = cleanOcrText(text);
      const entities = extractCommonEntities(cleanedText);
      const keyValuePairs = extractKeyValuePairs(text);

      // Push the data for the CURRENT page into the main array
      allPagesData.push({
        page: i,
        entities: entities,
        text: cleanedText,
        keyValuePairs,
      });
    }

    //
    // LOG THE FINAL RESULT ONLY ONCE, AFTER THE LOOP IS DONE
    //
    console.log("\n\n===== COMBINED OCR RESULT FROM ALL PAGES =====");
    // Use JSON.stringify to correctly print the array of objects
    console.log(JSON.stringify(allPagesData, null, 2));
  } catch (error) {
    console.error("An error occurred during processing:", error);
  }
})();

/**
 * Extracts common entities (dates, emails, amounts, etc.) from cleaned text.
 * @param {string} cleanedText - The cleaned text.
 * @returns {object} An object containing arrays of found entities.
 */
function extractCommonEntities(cleanedText) {
  const entities = {
    emails: [],
    dates: [],
    urls: [],
    amounts: [],
  };

  // Regex for emails
  entities.emails = cleanedText.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];

  // Regex for dates (handles formats like dd/mm/yyyy, Month dd, yyyy, etc.)
  entities.dates =
    cleanedText.match(
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\w+\s\d{1,2},\s\d{4})/g
    ) || [];

  // Regex for URLs
  entities.urls = cleanedText.match(/https?:\/\/[^\s]+/g) || [];

  // Regex for amounts (handles ₹, $, and numbers with commas)
  entities.amounts = cleanedText.match(/(?:₹|\$|INR)\s*([\d,]+\.?\d*)/g) || [];

  return entities;
}

/**
 * Performs generic cleanup on raw OCR text.
 * @param {string} rawText - The raw text output from Tesseract.
 * @returns {string} The cleaned text.
 */
function cleanOcrText(rawText) {
  let text = rawText;

  // 1. Normalize whitespace and line breaks
  text = text.replace(/\s+/g, " ").trim(); // Replace multiple spaces/newlines with a single space

  // 2. You can add more specific replacements for common OCR errors if you find them
  // e.g., text = text.replace(/I/g, 'l'); // Example: fix a common 'I' vs 'l' error

  return text;
}

function extractKeyValuePairs(rawText) {
  const pairs = {};
  const lines = rawText.split("\n"); // Split the text into individual lines

  // Regex to find lines with a label followed by a colon and a value.
  // e.g., "Verify at: https://..."
  const colonPattern = /^([A-Za-z\s]+):\s*(.*)/;

  lines.forEach((line) => {
    const match = line.match(colonPattern);
    if (match && match[1] && match[2]) {
      // Clean up the key and value
      const key = match[1].trim().replace(/\s+/g, "_").toLowerCase();
      const value = match[2].trim();
      pairs[key] = value;
    }
  });

  return pairs;
}

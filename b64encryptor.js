const fs = require('fs').promises;

async function encodeFileToBase64(filePath) {
  try {
    // Read the file's content in binary form
    const fileContent = await fs.readFile(filePath, { encoding: 'binary' });
    // Encode the binary content to base64
    const base64Content = Buffer.from(fileContent, 'binary').toString('base64');
    // Print the base64 encoded string
    console.log(base64Content);
  } catch (error) {
    console.error('Error reading or encoding file:', error);
  }
}

// Replace 'path/to/your/data.json' with the actual file path
encodeFileToBase64('service-account.json');

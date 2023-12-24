import express, { Request, Response } from "express";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { rimraf } from "rimraf";
import { IncomingForm } from 'formidable';

const app = express();
const MAX_EXECUTION_TIME = 60000; // 60 seconds

app.use(express.urlencoded({ extended: true }));

const WHITELISTED_PACKAGES = [
  "amsmath",
  "amsfonts",
  "amssymb",
  "geometry",
  "graphicx",
  "hyperref",
  "babel",
  "inputenc",
  "fontenc",
  "lipsum",
  "listings",
  "color",
  "xcolor",
  "float",
  "caption",
  "subcaption",
  "tabularx",
  "booktabs",
  "tikz",
  "pgfplots",
  "mathtools",
  "url",
  "algorithm2e",
];

function usesOnlyWhitelistedPackages(latexContent: string): boolean {
  const packageRegex = /\\usepackage(?:\[[^\]]*\])?\{([^\}]+)\}/g;
  let match;

  while ((match = packageRegex.exec(latexContent)) !== null) {
    const packages = match[1].split(",").map((pkg) => pkg.trim());
    if (packages.some((pkg) => !WHITELISTED_PACKAGES.includes(pkg))) {
      return false;
    }
  }

  return true;
}

function sanitizeLatexInput(input: string): string {
  // input = input.replace(/[^a-zA-Z0-9\s\\{}()\[\]\.,;!?&%$#^_`~=+-]/g, '');
  return input;
}

function cleanupFiles() {
  //return;
  try {
    const tempDir = path.join(__dirname, "temp");
    rimraf.sync(tempDir);
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

app.post("/compile", (req: Request, res: Response) => {
  cleanupFiles();
  const startTime = Date.now();

  const form = new IncomingForm({ uploadDir: path.join(__dirname, "temp"), keepExtensions: true });
  form.on("file",function(field, file) {
    fs.rename(file.filepath, path.join(__dirname, "temp") + "/" + file.originalFilename, ()=>{
      console.log("File renamed.");
    });
  });
  form.parse(req, (err, fields, files) => {
    console.log("Received request.");
    if (err) {
      console.error("Error during parsing:", err);
      return res.status(500).send("Error during parsing: " + err);
    }

    // Check if the file was received
    const uploadedFile = files.latexCode && files.latexCode[0];
    if (!uploadedFile) {
      return res.status(400).send("No LaTeX file provided.");
    }

    const originalFileName = uploadedFile.originalFilename as string;
    const fileBaseName = path.basename(originalFileName, '.tex');
    const newFilePath = path.join(__dirname, "temp", originalFileName);
    const outputFilePath = path.join(__dirname, "temp", `${fileBaseName}.pdf`);
    console.log("Compiling LaTeX code...");
      
    execFile(
      "pdflatex",
      ["-interaction=nonstopmode", "-no-shell-escape", newFilePath],
      {
        cwd: path.join(__dirname, "temp"),
        timeout: MAX_EXECUTION_TIME - (Date.now() - startTime),
      },
      (compileErr, stdout, stderr) => {
        console.log("Compilation finished.");
        console.log("stdout:", stdout);
        console.log("stderr:", stderr);
        console.log("err:", compileErr);
        if (compileErr) {
          console.error("Error during compilation:", compileErr);
          return res.status(500).send("Error during LaTeX compilation: " + stderr);
        }
        res.sendFile(outputFilePath);
      }
    );
  });
});


const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server is running on port: ", PORT);
});

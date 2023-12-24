import express, { Request, Response } from 'express';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import validator from 'validator';

const app = express();
const MAX_EXECUTION_TIME = 60000; // 60 seconds

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const WHITELISTED_PACKAGES = [
    'amsmath', 'amsfonts', 'amssymb', 'geometry', 'graphicx', 'hyperref',
    'babel', 'inputenc', 'fontenc', 'lipsum', 'listings', 'color', 'xcolor',
    'float', 'caption', 'subcaption', 'tabularx', 'booktabs', 'tikz', 'pgfplots',
    'mathtools', 'url', 'algorithm2e',
    // Add other packages you deem safe
];

function usesOnlyWhitelistedPackages(latexContent: string): boolean {
    const packageRegex = /\\usepackage(?:\[[^\]]*\])?\{([^\}]+)\}/g;
    let match;

    while ((match = packageRegex.exec(latexContent)) !== null) {
        const packages = match[1].split(',').map(pkg => pkg.trim());
        if (packages.some(pkg => !WHITELISTED_PACKAGES.includes(pkg))) {
            return false;
        }
    }

    return true;
}

function sanitizeLatexInput(input: string): string {
    //input = validator.escape(input);
    input = input.replace(/[^a-zA-Z0-9\s\\{}()\[\]\.,;!?&%$#^_`~=+-]/g, '');
    return input;
}

app.post('/compile', (req: Request, res: Response) => {
    const startTime = Date.now();

    let latexCode = req.body.latexCode as string;
    
    if (latexCode.length > 50000) {
        return res.status(413).send('Input is too large.');
    }

    console.log('Received LaTeX code:', latexCode);
    latexCode = sanitizeLatexInput(latexCode);
    console.log('Sanitized LaTeX code:', latexCode);
    if (!usesOnlyWhitelistedPackages(latexCode)) {
        return res.status(400).send('LaTeX content uses non-whitelisted packages.');
    }

    console.log('Writing LaTeX code to file...');
    const texFilePath = path.join(__dirname, 'document.tex');
    fs.writeFileSync(texFilePath, latexCode);

    console.log('Compiling LaTeX code...');
    const outputFilePath = path.join(__dirname, 'document.pdf');
    execFile('pdflatex', [texFilePath], { timeout: MAX_EXECUTION_TIME - (Date.now() - startTime) }, (err, stdout, stderr) => {
        if (err) {
            console.error('Error:', stderr);
            return res.status(500).send('Error during LaTeX compilation: ' + stderr);
        }
        res.sendFile(outputFilePath);
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

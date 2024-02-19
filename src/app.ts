import express, { Request, Response } from "express";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import admin from 'firebase-admin';
import { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";
import { cert } from "firebase-admin/app";

admin.initializeApp({
  credential: cert({
    projectId: process.env.FB_PROJECT_ID,
    clientEmail: process.env.FB_CLIENT_EMAIL,
    privateKey: (process.env.FB_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  })
});
//firebase storge, database, and auth
const fbstorage = admin.storage();

const app = express();
const MAX_EXECUTION_TIME = 30000; // 30 seconds

app.use(express.json());

interface File {
  type: "LaTeXEntry" | "image";
  file: string;
  content?: string;
  url?: string;
}

app.post("/compile", async (req: Request, res: Response) => {

  reset();

  const auth = req.headers?.authorization?.split(' ')[1];

  if (!auth) {
    return res.status(401).json({ message: 'Authorization header is missing or not in the correct format.' });
  }
  // Verify the token
  let decodedToken: DecodedIdToken; 
  try {
    decodedToken = await admin.auth().verifyIdToken(auth);
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }  

  const { files, outputpath: reloutputpath }: { files: File[], outputpath: string } = req.body;

  for (const file of files) {
    const filePath = path.join(__dirname, "temp", file.file);

    if (file.content) {
      fs.writeFileSync(filePath, file.content);
    } else if (file.url) {
      // Download the file from Firebase Storage and save it to the local file system
      const bucket = fbstorage.bucket();
      const remoteFile = bucket.file(`users/${decodedToken.uid}/${file.url}`);
      await remoteFile.download({ destination: filePath });
    }

    if (file.type === "LaTeXEntry") {
      const outputFilePath = path.join(__dirname, "temp", `${path.basename(file.file, '.tex')}.pdf`);

      execFile(
        "pdflatex",
        ["-interaction=nonstopmode", "-no-shell-escape", filePath],
        {
          cwd: path.join(__dirname, "temp"),
          timeout: MAX_EXECUTION_TIME,
        },
        async (compileErr, stdout, stderr) => {
          if (compileErr) {
            console.error("Error during compilation:", compileErr);
            return res.status(500).send("Error during LaTeX compilation: " + stderr);
          }

          // Upload the PDF to Firebase Storage at the specified output path
          const bucket = fbstorage.bucket();
          const remoteOutputFile = bucket.file(outputFilePath)

          await remoteOutputFile.save(`users/${decodedToken.uid}/${reloutputpath}`, {
            contentType: 'application/pdf',
            public: false,
          });
          reset();
          res.send(`File uploaded to: users/${decodedToken.uid}/${reloutputpath}`);
        }
      );
    }
  }
});

function reset() {
  fs.rmdirSync(path.join(__dirname, "temp"), { recursive: true });
  fs.mkdirSync(path.join(__dirname, "temp"));
}
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server is running on port: ", PORT);
});
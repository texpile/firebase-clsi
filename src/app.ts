import express, { Request, Response } from "express";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";
import { cert } from "firebase-admin/app";
admin.initializeApp({
  credential: cert(
    JSON.parse(
      Buffer.from(process.env.FB_CRED as string, "base64").toString("utf-8")
    )
  ),
  storageBucket: process.env.FB_STORAGE_BUCKET,
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

app.post("/v1/compile", async (req: Request, res: Response) => {
  reset();

  const auth = req.headers?.authorization?.split(" ")[1];

  if (!auth) {
    return res.status(401).json({
      message: "Authorization header is missing or not in the correct format.",
    });
  }
  // Verify the token
  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(auth);
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(403).json({ message: "Invalid or expired token." });
  }

  const {
    files,
    outputpath: reloutputpath,
  }: { files: File[]; outputpath: string } = req.body;

  if (!files || !reloutputpath) {
    return res.status(400).send("Missing files or output path");
  }
  for (const file of files) {
    const filePath = path.join(__dirname, "temp", file.file);
    if (file.type === "image") {
      if (file.url) {
        try {
          const bucket = fbstorage.bucket();
          const remoteFile = bucket.file(
            `users/${decodedToken.uid}/${file.url}`
          );
          await remoteFile.download({ destination: filePath });
        } catch (error) {
          return res
            .status(500)
            .send("Error downloading image from Firebase Storage: " + error);
        }
      } else if (file.content) {
        //not supported return error
        return res.status(400).send("Content not supported for image files");
      }
    }

    if (file.type === "LaTeXEntry") {
      if (file.content) {
        fs.writeFileSync(filePath, file.content);
      } else {
        return res.status(400).send("Content missing for LaTeXEntry");
      }
      const outputFilePath = path.join(
        __dirname,
        "temp",
        `${path.basename(file.file, ".tex")}.pdf`
      );
      const logFilePath = path.join(
        __dirname,
        "temp",
        `${path.basename(file.file, ".tex")}.log`
      );

      try {
        try{
          await compileLaTeX(filePath, outputFilePath);
        } catch (error) {
          console.error("Error during compilation, log will be uploaded");
          const bucket = fbstorage.bucket();
          await bucket.upload(logFilePath, {
            destination: `users/${decodedToken.uid}/${reloutputpath}${path.basename(file.file, ".tex")}.log`,
            metadata: {
              contentType: "text/plain",
              public: true,
            },
          });
          reset();
          return res.status(500).send("Error during LaTeX compilation: " + (error as any).stderr);
        }
        // After successful compilation, upload the PDF
        const bucket = fbstorage.bucket();
        console.log("uploading log file"),
        await Promise.all([
          bucket.upload(outputFilePath, {
            destination: `users/${decodedToken.uid}/${reloutputpath}${path.basename(file.file, ".tex")}.pdf`,
            metadata: {
              contentType: "application/pdf",
              public: true,
            },
          }),
          bucket.upload(logFilePath, {
            destination: `users/${decodedToken.uid}/${reloutputpath}${path.basename(file.file, ".tex")}.log`,
            metadata: {
              contentType: "text/plain",
              public: true,
            },
          }),
        ]);
        // Cleanup or further actions
        reset();
        return res.send(`users/${decodedToken.uid}/${reloutputpath}${path.basename(file.file, ".tex")}.pdf`);
      } catch (compileError) {
        console.error("Error during compilation:", (compileError as any).error);
        return res
          .status(500)
          .send(
            "Error during LaTeX compilation: " + (compileError as any).stderr
          );
      }
    }
  }
});

const compileLaTeX = (filePath: string, outputFilePath: unknown) => {
  return new Promise((resolve, reject) => {
    execFile(
      "pdflatex",
      ["-interaction=nonstopmode", "-no-shell-escape", filePath],
      { cwd: path.join(__dirname, "temp"), timeout: MAX_EXECUTION_TIME },
      (error, stdout, stderr) => {
        if (error) {
          reject({ error, stderr }); // Reject the promise on error
        } else {
          resolve(outputFilePath); // Resolve with the output file path on success
        }
      }
    );
  });
};

function reset() {
  const tempPath = path.join(__dirname, "temp");
  fs.rm(tempPath, { recursive: true, force: true }, err => {
    if (err) console.error("Error removing temp directory:", err);
    fs.mkdirSync(tempPath);
  });
}


const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server is running on port: ", PORT);
});

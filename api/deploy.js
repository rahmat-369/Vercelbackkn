import formidable from "formidable";
import AdmZip from "adm-zip";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Aturan nama project Vercel
function isValidProjectName(name) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

export default async function handler(req, res) {
  // =====================
  // CORS Configuration
  // =====================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ keepExtensions: true, multiples: true });

  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const name = fields.name?.toString();
    const uploadFile = files.file?.[0] || files.file;

    if (!name || !uploadFile) {
      return res.status(400).json({
        error: "Field 'name' dan file wajib diisi",
      });
    }

    if (!isValidProjectName(name)) {
      return res.status(400).json({
        error: "Nama web hanya boleh huruf kecil, angka, dan '-'",
      });
    }

    const originalName = uploadFile.originalFilename || "";
    const isZip = originalName.toLowerCase().endsWith(".zip");
    const isHtml = originalName.toLowerCase().endsWith(".html");

    if (!isZip && !isHtml) {
      return res.status(400).json({
        error: "File harus berformat .zip atau .html",
      });
    }

    let filesPayload = [];

    // =====================
    // MODE HTML
    // =====================
    if (isHtml) {
      const buffer = await fs.promises.readFile(uploadFile.filepath);
      filesPayload.push({
        file: "index.html",
        data: buffer.toString("base64"),
        encoding: "base64",
      });
    }

    // =====================
    // MODE ZIP
    // =====================
    if (isZip) {
      const zip = new AdmZip(uploadFile.filepath);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        filesPayload.push({
          file: entry.entryName,
          data: entry.getData().toString("base64"),
          encoding: "base64",
        });
      }

      if (!filesPayload.length) {
        return res.status(400).json({ error: "ZIP kosong" });
      }
    }

    // =====================
    // DEPLOY KE VERCEL
    // =====================
    const token = process.env.VERCEL_TOKEN || "l16kX4TZ6ykuOIbdhZbr7sHp";

    if (!token) {
      return res.status(500).json({
        error: "Vercel token tidak ditemukan",
      });
    }

    const response = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        files: filesPayload,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Vercel API Error:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Gagal deploy ke Vercel",
        details: data,
      });
    }

    return res.json({
      success: true,
      url: `https://${data.url}`,
      deploymentId: data.id,
    });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}

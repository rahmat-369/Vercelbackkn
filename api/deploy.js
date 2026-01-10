import formidable from "formidable";
import AdmZip from "adm-zip";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, 
  },
};

function isValidProjectName(name) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = formidable({ 
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, 
  });

  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
    const uploadFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!name || !uploadFile) {
      return res.status(400).json({ error: "Field 'name' dan file wajib diisi" });
    }

    if (!isValidProjectName(name)) {
      return res.status(400).json({ error: "Nama web tidak valid (gunakan huruf kecil, angka, dan '-')" });
    }

    const originalName = uploadFile.originalFilename || "";
    let filesPayload = [];

    // =====================
    // MODE HTML
    // =====================
    if (originalName.toLowerCase().endsWith(".html")) {
      const content = fs.readFileSync(uploadFile.filepath);
      filesPayload.push({
        file: "index.html",
        data: content.toString("base64"),
        encoding: "base64",
      });
    } 
    // =====================
    // MODE ZIP
    // =====================
    else if (originalName.toLowerCase().endsWith(".zip")) {
      const zip = new AdmZip(uploadFile.filepath);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        
        if (entry.entryName.startsWith("__MACOSX") || entry.entryName.includes(".DS_Store")) continue;

        filesPayload.push({
          file: entry.entryName,
          data: entry.getData().toString("base64"),
          encoding: "base64",
        });
      }
    } else {
      return res.status(400).json({ error: "Format file harus .zip atau .html" });
    }

    if (filesPayload.length === 0) {
      return res.status(400).json({ error: "Tidak ada file valid untuk diupload" });
    }

    // =====================
    // DEPLOY KE VERCEL
    // =====================
    const token = "l16kX4TZ6ykuOIbdhZbr7sHp";

    const response = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
        projectSettings: {
            framework: null 
        },
        files: filesPayload,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Vercel API Error:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Gagal deploy",
        details: data.error
      });
    }

    return res.json({
      success: true,
      url: `https://${data.url}`,
      deploymentId: data.id,
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
          }

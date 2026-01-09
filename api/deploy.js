import formidable from "formidable"
import AdmZip from "adm-zip"
import fs from "fs"

export const config = {
  api: {
    bodyParser: false
  }
}

// aturan nama project vercel
function isValidProjectName(name) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
}

export default async function handler(req, res) {
  /* =====================
     CORS
  ====================== */
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const form = formidable({ keepExtensions: true })

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        return res.status(500).json({ error: err.message })
      }

      const name = fields.name?.toString()
      const uploadFile = files.file

      if (!name || !uploadFile) {
        return res
          .status(400)
          .json({ error: "Field 'name' dan file wajib diisi" })
      }

      if (!isValidProjectName(name)) {
        return res.status(400).json({
          error: "Nama web hanya boleh huruf kecil, angka, dan '-'"
        })
      }

      const originalName = uploadFile.originalFilename || ""
      const isZip = originalName.endsWith(".zip")
      const isHtml = originalName.endsWith(".html")

      if (!isZip && !isHtml) {
        return res.status(400).json({
          error: "File harus berformat .zip atau .html"
        })
      }

      let filesPayload = []

      /* =====================
         MODE HTML (nama bebas)
      ====================== */
      if (isHtml) {
        const buffer = await fs.promises.readFile(uploadFile.filepath)

        filesPayload.push({
          file: "index.html",
          data: buffer.toString("base64"),
          encoding: "base64"
        })
      }

      /* =====================
         MODE ZIP
      ====================== */
      if (isZip) {
        const zip = new AdmZip(uploadFile.filepath)
        const entries = zip.getEntries()

        for (const entry of entries) {
          if (entry.isDirectory) continue

          filesPayload.push({
            file: entry.entryName,
            data: entry.getData().toString("base64"),
            encoding: "base64"
          })
        }

        if (!filesPayload.length) {
          return res.status(400).json({ error: "ZIP kosong" })
        }
      }

      /* =====================
         DEPLOY KE VERCEL
      ====================== */
      const token = "l16kX4TZ6ykuOIbdhZbr7sHp"

      if (!token) {
        return res
          .status(500)
          .json({ error: "Vercel token tidak ditemukan" })
      }

      const response = await fetch(
        "https://api.vercel.com/v13/deployments",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            files: filesPayload
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        return res.status(500).json(data)
      }

      return res.json({
        success: true,
        url: `https://${data.url}`
      })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  })
      }

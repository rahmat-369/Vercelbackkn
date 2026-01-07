import formidable from "formidable"
import fs from "fs"
import AdmZip from "adm-zip"

export const config = {
  api: {
    bodyParser: false
  }
}

/**
 * Aturan nama web:
 * - huruf kecil
 * - angka
 * - tanda "-"
 * - tidak diawali / diakhiri "-"
 */
function isValidProjectName(name) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
}

export default async function handler(req, res) {
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
      const zipFile = files.file

      if (!name || !zipFile) {
        return res.status(400).json({
          error: "Field 'name' dan file ZIP wajib diisi"
        })
      }

      if (!isValidProjectName(name)) {
        return res.status(400).json({
          error:
            "Nama web tidak valid. Gunakan huruf kecil, angka, dan '-' saja."
        })
      }

      // Extract ZIP
      const zip = new AdmZip(zipFile.filepath)
      const entries = zip.getEntries()

      const filesPayload = []
      let hasIndexHtml = false

      for (const entry of entries) {
        if (entry.isDirectory) continue

        const fileName = entry.entryName

        if (fileName === "index.html") {
          hasIndexHtml = true
        }

        filesPayload.push({
          file: fileName,
          data: entry.getData().toString("base64"),
          encoding: "base64"
        })
      }

      if (!filesPayload.length) {
        return res.status(400).json({ error: "ZIP kosong" })
      }

      if (!hasIndexHtml) {
        return res.status(400).json({
          error: "ZIP harus mengandung file index.html"
        })
      }

      // Deploy ke Vercel
      const response = await fetch(
        "https://api.vercel.com/v13/deployments",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.VERCELTOKEN}`,
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

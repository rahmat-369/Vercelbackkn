const Busboy = require('busboy');
const AdmZip = require('adm-zip');

export const config = {
  api: {
    bodyParser: false,
  },
};

// Token Vercel Anda
const VERCEL_TOKEN = "l16kX4TZ6ykuOIbdhZbr7sHp";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed'
    });
  }

  const busboy = Busboy({ headers: req.headers });
  let projectName = '';
  let fileBuffer = Buffer.alloc(0);
  let fileName = '';
  let contentType = '';

  busboy.on('field', (name, val) => {
    if (name === 'name') {
      // Clean project name: hanya huruf kecil, angka, dan dash
      projectName = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
    }
  });

  busboy.on('file', (name, file, info) => {
    fileName = info.filename;
    contentType = info.mimeType;
    
    const chunks = [];
    file.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
    });
  });

  busboy.on('finish', async () => {
    try {
      // Validasi input
      if (!projectName) {
        throw new Error("Nama project wajib diisi");
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error("File tidak boleh kosong");
      }

      console.log(`🔄 Memulai deploy: ${projectName}, file: ${fileName}`);

      // Process files
      let filesToDeploy = [];

      if (contentType === 'application/zip' || fileName.endsWith('.zip')) {
        console.log('📦 Processing ZIP file...');
        const zip = new AdmZip(fileBuffer);
        const zipEntries = zip.getEntries();

        zipEntries.forEach(entry => {
          if (!entry.isDirectory && !entry.entryName.includes('__MACOSX') && !entry.entryName.includes('.DS_Store')) {
            filesToDeploy.push({
              file: entry.entryName,
              data: entry.getData().toString('base64'),
              encoding: 'base64'
            });
          }
        });
        
        if (filesToDeploy.length === 0) {
          throw new Error("ZIP file tidak mengandung file yang valid");
        }
        
        console.log(`📁 ${filesToDeploy.length} file ditemukan dalam ZIP`);
      } else {
        console.log('📄 Processing single HTML file...');
        filesToDeploy.push({
          file: 'index.html',
          data: fileBuffer.toString('base64'),
          encoding: 'base64'
        });
      }

      // Step 1: Create deployment dengan target production untuk URL clean
      console.log('🚀 Mengirim ke Vercel API...');
      const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectName,
          files: filesToDeploy,
          target: 'production', // CRITICAL: untuk URL clean
          projectSettings: { 
            framework: null,
            buildCommand: null,
            outputDirectory: null,
            installCommand: null,
            rootDirectory: null
          },
          // Nonaktifkan fitur Git untuk mencegah hash di URL
          gitSource: null,
          gitMetadata: null,
          // Force clean URL
          alias: [`${projectName}.vercel.app`]
        })
      });

      const deploymentData = await deploymentResponse.json();

      if (!deploymentResponse.ok) {
        console.error('❌ Vercel API Error:', deploymentData);
        
        // Coba parse error message
        let errorMsg = "Gagal deploy ke Vercel";
        if (deploymentData.error) {
          errorMsg = deploymentData.error.message || JSON.stringify(deploymentData.error);
        }
        
        // Jika project sudah ada, beri saran nama lain
        if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
          errorMsg = `Project "${projectName}" sudah ada. Gunakan nama yang berbeda.`;
        }
        
        throw new Error(errorMsg);
      }

      console.log('✅ Deployment dibuat:', deploymentData.id);
      
      // Generate clean URL
      const cleanUrl = `${projectName}.vercel.app`;
      const fullUrl = `https://${cleanUrl}`;
      
      // Step 2: Tunggu sebentar lalu cek status
      console.log('⏳ Menunggu deployment siap...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Coba cek status deployment
      try {
        const statusResponse = await fetch(`https://api.vercel.com/v13/deployments/${deploymentData.id}`, {
          headers: {
            'Authorization': `Bearer ${VERCEL_TOKEN}`,
          }
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('📊 Status deployment:', statusData.readyState);
        }
      } catch (statusErr) {
        // Ignore status check error
        console.log('ℹ️ Tidak bisa cek status, lanjut...');
      }

      console.log(`🎉 Deployment selesai! URL: ${fullUrl}`);

      // Return success response
      return res.status(200).json({
        success: true,
        message: "Website berhasil di-deploy!",
        data: {
          projectName: projectName,
          url: cleanUrl,
          fullUrl: fullUrl,
          deploymentId: deploymentData.id,
          timestamp: new Date().toISOString(),
          filesCount: filesToDeploy.length,
          fileType: fileName.endsWith('.zip') ? 'zip' : 'html'
        }
      });

    } catch (error) {
      console.error("❌ Error dalam proses deploy:", error.message);
      
      return res.status(500).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  busboy.on('error', (err) => {
    console.error('❌ Busboy error:', err);
    res.status(500).json({
      success: false,
      message: 'Error processing upload'
    });
  });

  req.pipe(busboy);
          }        });
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

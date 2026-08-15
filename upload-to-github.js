const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.argv[2];
const OWNER = 'Sourav1111-001';
const REPO = 'sam-s-birthday';
const BASE_DIR = path.join(__dirname, "happy-birthday-master", "happy-birthday-master");

if (!GITHUB_TOKEN) {
    console.error('Usage: node upload-to-github.js <YOUR_GITHUB_TOKEN>');
    process.exit(1);
}

function apiRequest(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'api.github.com',
            path: urlPath,
            method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'NodeJS-Uploader',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        };
        const req = https.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

function getAllFiles(dir, base = dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
            results = results.concat(getAllFiles(full, base));
        } else {
            results.push(path.relative(base, full).replace(/\\/g, '/'));
        }
    }
    return results;
}

async function getFileSHA(filePath) {
    const res = await apiRequest('GET', `/repos/${OWNER}/${REPO}/contents/${filePath}`);
    if (res.status === 200) return res.body.sha;
    return null;
}

async function uploadFile(filePath) {
    const fullPath = path.join(BASE_DIR, filePath);
    const content = fs.readFileSync(fullPath).toString('base64');
    const sha = await getFileSHA(filePath);
    const body = {
        message: sha ? `Update ${filePath}` : `Add ${filePath}`,
        content,
        ...(sha ? { sha } : {})
    };
    const res = await apiRequest('PUT', `/repos/${OWNER}/${REPO}/contents/${filePath}`, body);
    if (res.status === 200 || res.status === 201) {
        console.log(`✅ ${filePath}`);
    } else {
        console.error(`❌ ${filePath} - ${res.body.message}`);
    }
}

async function main() {
    console.log('📁 Scanning files...');
    const files = getAllFiles(BASE_DIR);
    console.log(`Found ${files.length} files. Uploading...\n`);
    for (const file of files) {
        await uploadFile(file);
    }
    console.log('\n🎉 Done! Check: https://github.com/' + OWNER + '/' + REPO);
}

main().catch(console.error);

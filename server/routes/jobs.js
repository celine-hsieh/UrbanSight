const path = require('path');
const fs = require('fs-extra');
const express = require('express');
const { exec } = require('child_process');
const { ModelDerivativeClient } = require('forge-server-utils');
const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = require('../../config.js');
const CACHE_FOLDER = path.join(__dirname, '..', '..', 'cache');
//const WORKER_FOLDER = path.join(__dirname, 'D:/碩二上/建築論文/實作/example/forge-unity-poc-master/server', 'workers');
const WORKER_FOLDER = path.join('./server', 'workers');
console.log(WORKER_FOLDER);

let modelDerivativeClient = new ModelDerivativeClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });
let router = express.Router();

async function executeJob(urn, guid, cacheDir, statusFilePath, logFilePath, /* outputFilePath */) {
    const updateStatus = (func) => {
        let status = fs.readJsonSync(statusFilePath);
        func(status);
        status.updated = new Date();
        fs.writeJsonSync(statusFilePath, status, { spaces: 2 });
    };
    const execute = async (cmd) => new Promise(function (resolve, reject) {
        exec(cmd, (err, stdout, stderr) => {
            if (err) reject(err); else resolve();
        });
    });
    try {
        const outputFilePath = path.join(cacheDir, guid + '.glb');
        const tmpDir = path.join(cacheDir, 'tmp', 'gltf');
        fs.ensureDirSync(tmpDir);
        updateStatus((s) => { s.status = 'inprogress'; s.message = 'Converting SVF to glTF.'; });
        await execute(`node ${path.join(WORKER_FOLDER, 'svf-to-gltf.js')} "${urn}" "${guid}" "${tmpDir}" >> "${logFilePath}" 2>&1`);
        updateStatus((s) => { s.message = 'Compressing glTF to glb/meshopt.'; });
        await execute(`npx gltfpack -cc -i "${path.join(tmpDir, 'output.gltf')}" -o "${outputFilePath}" >> "${logFilePath}" 2>&1`);
        updateStatus((s) => { s.status = 'success'; s.outputs = { 'glb': guid + '.glb' }; delete s.message; });
    } catch (err) {
        console.error(err);
        updateStatus((s) => { s.status = 'failed'; s.message = err.message; });
    }
}

// router.get('/', async function (req, res, next) {
//     try {
//         const objects = await dataManagementClient.listObjects(FORGE_BUCKET);
//         res.json(objects.map(obj => {
//             return {
//                 name: obj.objectKey,
//                 urn: urnify(obj.objectId)
//             };
//         }));
//     } catch (err) {
//         next(err);
//     }
// });

router.use('/urn/:urn', function (req, res, next) {
    //const { urn } = parseInt(req.params, 1);
    const { urn } = req.params;
    console.log(urn);
    req.cacheDir = path.join(CACHE_FOLDER, urn);
    req.statusFilePath = path.join(req.cacheDir, 'status.json');
    req.logFilePath = path.join(req.cacheDir, 'logs.txt');
    next();
});

// Start a conversion job for specific model
router.post('/urn/:urn', async function (req, res, next) {
    //const { urn } = parseInt(req.params,1);
    const { urn } = req.params;
    try {
        fs.ensureDirSync(req.cacheDir);
        let guid = req.query.guid;
        if (!guid) {
            const res = await modelDerivativeClient.getMetadata(urn);
            const viewable = res.data.metadata.find(entry => entry.role === '3d');
            if (viewable) {
                guid = viewable.guid;
            } else {
                throw new Error('Model does not have any 3D views.');
            }
        }
        const status = { urn, guid, status: 'created', created: new Date() };
        fs.writeJsonSync(req.statusFilePath, status);
        executeJob(urn, guid, req.cacheDir, req.statusFilePath, req.logFilePath); // Kick off the conversion job in the background
        console.log(urn);
        //console.log(guid);
        //console.log(req.cacheDir);

        res.json(status);
        next();
    } catch (err) {
        next(err);
    }
});
//console.log(urn);
// Get the status of a conversion job for specific model
router.get('/urn/:urn', function (req, res,) {
    if (fs.pathExistsSync(req.statusFilePath)) {
        res.sendFile(req.statusFilePath);
    } else {
        res.status(404).end();
    }
});

// Get the logs for a specific conversion job
router.get('/urn/:urn/logs', function (req, res) {
    if (fs.pathExistsSync(req.logFilePath)) {
        res.sendFile(req.logFilePath);
    } else {
        res.status(404).end();
    }
});

// Get the output (glb with meshopt compression) of a specific conversion job
router.get('/urn/:urn/:guid.glb', function (req, res) {
    const { guid } = req.params;
    const artifactPath = path.join(req.cacheDir, guid + '.glb');
    if (fs.pathExistsSync(artifactPath)) {
        res.sendFile(artifactPath);
    } else {
        res.status(404).end();
    }
});

module.exports = router;

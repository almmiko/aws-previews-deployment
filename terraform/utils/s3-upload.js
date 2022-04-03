const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const glob = require("glob");
const path = require("path");
const fs = require('fs');
const mimeTypes = require("mime-types");

// Replace "[ variable ]" with your values.

const s3Client = new S3Client({
    region: "us-east-1",

    // Use profile name or provide aws creds in a different way.
    profile: "[Profile Name]"
 });

// s3 bucket subfolder name for a preview version.
// Example: git commit hash, or git branch.
// You can provide the value via CI env variables during CI/CD pipeline process.
const PREVIEW_PATH = "[Subfolder Name]";

async function upload() {
    // We used app/build as a dist folder with the application.
    const pattern = path.resolve(__dirname + "/../../app/build");
    const files = glob.sync(`${pattern}/**/*`, { absolute: false, nodir: true });

    for (const file of files) {
        const content = fs.readFileSync(file);

        const upload = {
            Bucket: "aws-deployment-previews-root",
            Key: file.replace(`${pattern}/`, `${PREVIEW_PATH}/`),
            Body: content,
            ACL: "public-read",
            ContentType: mimeTypes.contentType(path.extname(file)),
        };

        await s3Client.send(new PutObjectCommand(upload));
    }
}

upload().catch(e => console.error(e));

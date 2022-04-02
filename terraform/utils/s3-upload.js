const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const glob = require("glob");
const path = require("path");
const fs = require('fs');

const s3Client = new S3Client({
    region: "us-east-1",
    profile: "terraform"
 });

// s3 bucket subfolder name for a preview version.
const PREVIEW_PATH = "git-feature-branch";

async function upload() {
    const pattern = path.resolve(__dirname + "/../../app/build");
    const files = glob.sync(`${pattern}/**/*`, { absolute: false, nodir: true });

    for (const file of files) {
        const content = fs.readFileSync(file);

        const upload = {
            Bucket: "aws-deployment-previews-root",
            Key: file.replace(`${pattern}/`, `${PREVIEW_PATH}/`),
            Body: content,
            ACL: "public-read"
        };

        await s3Client.send(new PutObjectCommand(upload));
    }
}

upload().catch(e => console.error(e));

import { Construct } from "constructs";
import glob from "glob";
import path from "path";
import mimeTypes from "mime-types";
import crypto from "crypto";
import { App, TerraformStack } from "cdktf";
import { AwsProvider, s3 } from "@cdktf/provider-aws";

class AWSDeploymentPreviewStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, "AWS", {
        region: "us-east-1",
        profile: "terraform",
      });


    const bucket = new s3.S3Bucket(this, "aws_s3_bucket", {
        bucket: "alm-gg4h3ds4hs-bucket-test",
    });

    new s3.S3BucketAcl(this, "aws_s3_bucket_acl", {
        bucket: bucket.bucket,
        acl: "private",
    });

    const pattern = path.resolve(__dirname + "/../app/build");

    const files = glob.sync(`${pattern}/**/*`, { absolute: false, nodir: true });

    for (const file of files) {
        new s3.S3Object(this, `aws_s3_object_${path.parse(file).name}`, {
            bucket: bucket.bucket,
            dependsOn: [bucket],
            key: file.replace(`${pattern}/`, ""),
            source: file,
            etag: crypto.createHash("md5").update(file).digest("hex"),
            contentType: mimeTypes.contentType(path.extname(file)) || ""
        });
    }
  }
}

const app = new App();

new AWSDeploymentPreviewStack(app, "AWS Deployment Preview");

app.synth();

import { Construct } from "constructs";
import glob from "glob";
import path from "path";
import mimeTypes from "mime-types";
import crypto from "crypto";
import { App, TerraformStack } from "cdktf";
import { AwsProvider, s3, cloudfront } from "@cdktf/provider-aws";


// AWS Resources are configured in one file for the demo purposes.

const BUCKET_NAME = "aws-deployment-previews-root";
const AWS_REGION = "us-east-1";

class AWSDeploymentPreviewStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, "AWS", {
        region: AWS_REGION,
        profile: "terraform",
      });

    const bucket = new s3.S3Bucket(this, "aws_s3_bucket", {
        bucket: BUCKET_NAME,
    });

    new s3.S3BucketAcl(this, "aws_s3_acl", {
        bucket: bucket.bucket,
        acl: "public-read",
    });

    const bucket_website = new s3.S3BucketWebsiteConfiguration(this, "aws_s3_bucket_website_configuration", {
        bucket: bucket.bucket,
        indexDocument: {
            suffix: "index.html"
        }
    });

    const pattern = path.resolve(__dirname + "/../app/build");
    const files = glob.sync(`${pattern}/**/*`, { absolute: false, nodir: true });

    const GIT_BRANCH = "b3442af";

    for (const file of files) {
        new s3.S3Object(this, `aws_s3_object_${path.parse(file).name}`, {
            bucket: bucket.bucket,
            dependsOn: [bucket],
            key: file.replace(`${pattern}/`, `${GIT_BRANCH}/`),
            source: file,
            acl: "public-read",
            etag: crypto.createHash("md5").update(file).digest("hex"),
            contentType: mimeTypes.contentType(path.extname(file)) || "",
        });
    }

    new cloudfront.CloudfrontDistribution(this, "aws_cloudfront_distribution", {
        enabled: true,
        dependsOn: [bucket],
        isIpv6Enabled: true,
        defaultRootObject: "index.html",
        origin: [
            {
                domainName: bucket_website.websiteEndpoint,
                originId: "aws-deployment-previews",
                customOriginConfig: {
                    httpPort: 80,
                    httpsPort: 443,
                    originProtocolPolicy: "http-only",
                    originSslProtocols: ["TLSv1", "TLSv1.1", "TLSv1.2"]
                  }
            }
        ],
        defaultCacheBehavior: {
            allowedMethods: ["HEAD", "DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"],
            cachedMethods: ["GET", "HEAD"],
            targetOriginId: "aws-deployment-previews",
            viewerProtocolPolicy: "redirect-to-https",
            forwardedValues: {
                queryString: false,
                cookies: {
                    forward: "none"
                }
            }
        },
        restrictions: {
            geoRestriction: {
                restrictionType: "none",
            }
        },
        viewerCertificate: {
            cloudfrontDefaultCertificate: true,
        }
    })
  }
}

const app = new App();

new AWSDeploymentPreviewStack(app, "AWS Deployment Preview");

app.synth();

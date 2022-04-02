import { Construct } from "constructs";
import glob from "glob";
import path from "path";
import mimeTypes from "mime-types";
import crypto from "crypto";
import { App, TerraformStack, TerraformAsset, AssetType } from "cdktf";
import { AwsProvider, s3, cloudfront, acm, route53, lambdafunction, iam } from "@cdktf/provider-aws";

// AWS Resources are configured in one file for the demo purposes.

const configuration = {
    BUCKET_NAME: "aws-deployment-previews-root",
    AWS_REGION: "us-east-1",
    AWS_PROFILE: "terraform",
    DOMAIN_NAME: "al-sandbox.com",
    WILCARD_DOMAIN_NAME: "*.al-sandbox.com",
    PREVIEW_PATH: "git-feature-branch", // s3 bucket subfolder name for a preview version.
};

class AWSDeploymentPreviewStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, "AWS", {
        region: configuration.AWS_REGION,
        profile: configuration.AWS_PROFILE,
      });

    /**
     * Root S3 Bucket Setup
     */
    const bucket = new s3.S3Bucket(this, "aws_s3_bucket", {
        bucket: configuration.BUCKET_NAME,
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

    for (const file of files) {
        new s3.S3Object(this, `aws_s3_object_${path.parse(file).name}`, {
            bucket: bucket.bucket,
            dependsOn: [bucket],
            key: file.replace(`${pattern}/`, `${configuration.PREVIEW_PATH}/`),
            source: file,
            acl: "public-read",
            etag: crypto.createHash("md5").update(file).digest("hex"),
            contentType: mimeTypes.contentType(path.extname(file)) || "",
        });
    }

    /**
     * Lambda@Edge Resources Setup
     */
    const lambdaAsset = new TerraformAsset(this, "cf-origin-lambda", {
        path: path.resolve(__dirname + "/../lambda/origin-request"),
        type: AssetType.ARCHIVE,
    });

    const lambdaBucket = new s3.S3Bucket(this, "aws_bucket_for_lambda", {
        bucket: "cf-lambda-origin-req",
    });

    const lambdaArchive = new s3.S3Object(this, "aws_lambda_origin_req_archive", {
        bucket: lambdaBucket.bucket,
        key: `${lambdaAsset.fileName}`,
        source: lambdaAsset.path,
    });

    const lambdaRole = new iam.IamRole(this, "lambda_role", {
        name: "cf-origin-request-lambda-role",
        assumeRolePolicy: `{
            "Version": "2012-10-17",
            "Statement": [
              {
                "Action": "sts:AssumeRole",
                "Principal": {
                  "Service": ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
                },
                "Effect": "Allow"
              }
            ]
        }`
    });

    new iam.IamRolePolicyAttachment(this, "lambda_logs", {
        policyArn: "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess",
        role: lambdaRole.name
    });

    const lambdaEdgeOriginReq = new lambdafunction.LambdaFunction(this, "aws_lambda_origin_request", {
        functionName: "cf_origin_request_lambda",
        role: lambdaRole.arn,
        s3Bucket: lambdaBucket.bucket,
        s3Key: lambdaArchive.key,
        handler: "index.handler",
        runtime: "nodejs14.x",
        publish: true,
        sourceCodeHash: lambdaAsset.assetHash,
    });

    /**
     * Route53 Resources Setup
     */
    const acmCert = new acm.AcmCertificate(this, "aws_acm_certificate", {
        domainName: configuration.DOMAIN_NAME,
        subjectAlternativeNames: [configuration.WILCARD_DOMAIN_NAME],
        validationMethod: "DNS"
    });

    const zone = new route53.DataAwsRoute53Zone(this, "aws_route53_zone", {
        name: `${configuration.DOMAIN_NAME}.`,
    });

    const route53Record = new route53.Route53Record(this, "aws_route53_record", {
        name: acmCert.domainValidationOptions("0").resourceRecordName,
        type: acmCert.domainValidationOptions("0").resourceRecordType,
        records: [acmCert.domainValidationOptions("0").resourceRecordValue],
        zoneId: zone.zoneId,
        ttl: 60,
        allowOverwrite: true,
    });

    new acm.AcmCertificateValidation(this, "aws_acm_certificate_validation", {
        certificateArn: acmCert.arn,
        validationRecordFqdns: [
            route53Record.fqdn
        ]
    });

    /**
     * CloudFront Resources Setup
     */
    const cfCachePolicy = new cloudfront.CloudfrontCachePolicy(this, "aws_cloudfront_cache_policy", {
        name: "headers-forward-policy",
        parametersInCacheKeyAndForwardedToOrigin: {
            headersConfig: {
                headerBehavior: "whitelist",
                headers: {
                    items: ["Host", "Origin", "Referer"],
                }
            },
            queryStringsConfig: {
                queryStringBehavior: "none"
            },
            cookiesConfig: {
                cookieBehavior: "none"
            }
        }
    });

    const cloudfrontDistribution = new cloudfront.CloudfrontDistribution(this, "aws_cloudfront_distribution", {
        enabled: true,
        dependsOn: [bucket],
        isIpv6Enabled: true,
        aliases: [configuration.WILCARD_DOMAIN_NAME],
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
            cachePolicyId: cfCachePolicy.id,
            allowedMethods: ["HEAD", "DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"],
            cachedMethods: ["GET", "HEAD"],
            targetOriginId: "aws-deployment-previews",
            viewerProtocolPolicy: "redirect-to-https",
            lambdaFunctionAssociation: [
                {
                    lambdaArn: lambdaEdgeOriginReq.qualifiedArn,
                    eventType: "origin-request",
                    includeBody: false,
                }
            ]
        },
        restrictions: {
            geoRestriction: {
                restrictionType: "none",
            }
        },
        viewerCertificate: {
            acmCertificateArn: acmCert.arn,
            sslSupportMethod: "sni-only",
            minimumProtocolVersion: "TLSv1.1_2016"
        }
    });

    /**
     * Route53 CloudFront Wildcard Alias
     */
    new route53.Route53Record(this, "aws_route53_record_wildcard", {
        zoneId: zone.zoneId,
        name: configuration.WILCARD_DOMAIN_NAME,
        type: "A",
        alias: [{
            name: cloudfrontDistribution.domainName,
            zoneId: cloudfrontDistribution.hostedZoneId,
            evaluateTargetHealth: false,
        }]
    });
  }
}

const app = new App();

new AWSDeploymentPreviewStack(app, "aws-deployment-preview");

app.synth();

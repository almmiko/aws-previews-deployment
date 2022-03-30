import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { AwsProvider, s3 } from "@cdktf/provider-aws";

class AWSDeploymentPreviewStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, "AWS", {
        region: "us-east-1",
        profile: "terraform",
      });


    const bucket = new s3.S3Bucket(this, 'aws_s3_bucket', {
        bucket: "alm-gg4h3ds4hs-bucket-test",
    });

    new s3.S3BucketAcl(this, 'aws_s3_bucket_acl', {
        bucket: bucket.id,
        acl: "private",
    });

  }
}

const app = new App();

new AWSDeploymentPreviewStack(app, "AWS Deployment Preview");

app.synth();

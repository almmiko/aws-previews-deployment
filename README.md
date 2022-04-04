# AWS Infrastructure for Preview Environments ![terraform](https://img.shields.io/static/v1?label=&message=terraform&color=7B42BC&logo=terraform&style=flat&logoColor=white) ![aws](https://img.shields.io/static/v1?label=&message=aws&color=232F3E&logo=amazonaws&style=flat&logoColor=white)

The AWS infrastructure for showcasing **How to Build Preview Environments for Modern CI/CD Workflows Using Terraform CDK.**

You will deploy [Create React App](https://github.com/facebook/create-react-app), but you can replace the app with any other front-end framework.

The AWS infrastructure is managed using [Terraform Cloud Development Kit](https://www.terraform.io/cdktf).

## Getting Started

Install [terraform CLI](https://learn.hashicorp.com/tutorials/terraform/install-cli).

To install Terraform CDK run:
```bash
npm install --global cdktf-cli@latest
```

Create an [AWS profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) with permission to have access to:
- IAM
- S3
- CloudFront
- VPC
- Lambda
- LambdaExecute
- Route53
- CertificateManager

Install dependencies:
```bash
cd terraform
npm i
```

## Configuration

In `terraform/main.ts` file add your configuration:

```js
const configuration = {
    BUCKET_NAME: "",
    AWS_REGION: "",
    AWS_PROFILE: "",
    DOMAIN_NAME: "",
    WILCARD_DOMAIN_NAME: "",
};
```

To build the example app
```bash
cd app
npm i
npm run build
```

To upload the example app, replace placeholder values in the `terraform/utils/s3-upload.js` file and run:

```bash
npm run s3:upload
```

## Commands

To run deployment plan:
```bash
npm run plan
```

To deploy resources:
```bash
npm run deploy
```

To synthesize infrastructure configuration:
```bash
npm run synth
```

To destroy deployed resources:
```bash
npm run destroy
```

> ⚠️ Lambda@Edge can't be destroyed in one run. Wait until AWS removes replicas and re-run destroy command.


## License ![licence-MIT](https://img.shields.io/badge/license-MIT-green)

This project is licensed under the MIT License - see the [LICENSE](/LICENSE) file for details.

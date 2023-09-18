import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cfo from "aws-cdk-lib/aws-cloudfront-origins";

export class StateBackedBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'StateMachineImageBucket');

    const writer = new iam.User(this, 'StateMachineBotImageWriter');

    bucket.grantReadWrite(writer);

    const originAccessIdentity = new cf.OriginAccessIdentity(this, 'StateMachineImageOriginAccessIdentity');
    bucket.grantRead(originAccessIdentity);

    const distribution = new cf.Distribution(this, 'StateMachineImageDistribution', {
      defaultBehavior: {
        origin: new cfo.S3Origin(bucket, { originAccessIdentity }),
        cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      enabled: true,
    });

    new cdk.CfnOutput(this, 'StateMachineImageBucketName', {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'StateMachineImageDistributionDomainName', {
      value: distribution.distributionDomainName,
    });
  }
}

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cfo from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as cert from "aws-cdk-lib/aws-certificatemanager";

type GithubVisualizerBotAssetsStackProps = cdk.StackProps & {
  hostedZone: route53.IHostedZone;
  certificate: cert.ICertificate;
};

export class GithubVisualizerBotAssetsStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: GithubVisualizerBotAssetsStackProps
  ) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "GithubVisualizerBotAssetsBucket");

    const writer = new iam.User(this, "StateMachineBotImageWriter");

    bucket.grantReadWrite(writer);

    const originAccessIdentity = new cf.OriginAccessIdentity(
      this,
      "StateMachineImageOriginAccessIdentity"
    );
    bucket.grantRead(originAccessIdentity);

    const domainName = "assets.github-visualizer-bot.statebacked.dev";

    const distribution = new cf.Distribution(
      this,
      "GithubVisualizerBotAssetsDistribution",
      {
        defaultBehavior: {
          origin: new cfo.S3Origin(bucket, { originAccessIdentity }),
          cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        domainNames: [domainName],
        certificate: props.certificate,
        enabled: true,
      }
    );

    new route53.ARecord(this, "GithubVisualizerBotAssetsRecord", {
      zone: props.hostedZone,
      recordName: "assets",
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution)
      ),
    });

    new cdk.CfnOutput(this, "GithubVisualizerBotAssetsBucketName", {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, "GithubVisualizerBotAssetsDistributionDomainName", {
      value: distribution.distributionDomainName,
    });
  }
}

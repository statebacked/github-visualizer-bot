import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as cert from "aws-cdk-lib/aws-certificatemanager";

type GithubVisualizerBotAssetsCertStackProps = cdk.StackProps & {
  hostedZone: route53.IHostedZone;
};

// this is so silly but we need a cert in us-east-1 to use with cloudfront
export class GithubVisualizerBotAssetsCertStack extends cdk.Stack {
  public certificate: cert.ICertificate;

  constructor(
    scope: Construct,
    id: string,
    props: GithubVisualizerBotAssetsCertStackProps
  ) {
    super(scope, id, props);

    const domainName = "assets.github-visualizer-bot.statebacked.dev";

    const certificate = new cert.Certificate(
      this,
      "GithubVisualizerBotAssetsCert",
      {
        domainName,
        validation: cert.CertificateValidation.fromDns(props.hostedZone),
      }
    );

    this.certificate = certificate;
  }
}

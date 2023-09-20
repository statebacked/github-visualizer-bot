import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";

export class GithubVisualizerHostedZoneStack extends cdk.Stack {
  public hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hostedZone = new route53.HostedZone(
      this,
      "GithubVisualizerHostedZone",
      {
        zoneName: "github-visualizer-bot.statebacked.dev",
      }
    );

    this.hostedZone = hostedZone;
  }
}

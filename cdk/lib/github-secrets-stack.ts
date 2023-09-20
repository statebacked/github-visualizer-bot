import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";

export class GithubSecretsStack extends cdk.Stack {
  public githubSecret: secrets.ISecret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const secret = new secrets.Secret(this, "GithubVisualizerBotSecret", {
      description: "{ clientId, clientSecret }",
    });

    this.githubSecret = secret;
  }
}

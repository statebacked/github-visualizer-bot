import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "node:path";
import * as apigw from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apigwIntegrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as nlambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";

type AdminApiGetReposStackProps = cdk.StackProps & {
  api: apigw.IHttpApi;
  githubSecret: secrets.ISecret;
};

export class GithubVisualizerAdminApiGetReposStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AdminApiGetReposStackProps) {
    super(scope, id, props);

    const projectRoot = path.join(__dirname, "..", "..", "lambdas");

    const fn = new nlambda.NodejsFunction(
      this,
      "GithubVisualizerAdminApiGetReposFunction",
      {
        description: "Admin API Get Repos Function",
        entry: path.join(projectRoot, "get-repos.ts"),
        projectRoot,
        depsLockFilePath: path.join(projectRoot, "package-lock.json"),
        handler: "handler",
        memorySize: 1024,
        timeout: cdk.Duration.seconds(30),
        environment: {
          GITHUB_SECRET_ARN: props.githubSecret.secretArn,
        },
      }
    );

    const prodAlias = new lambda.Alias(
      this,
      "GithubVisualizerAdminApiGetReposProdAlias",
      {
        aliasName: "prod",
        version: fn.currentVersion,
      }
    );

    props.githubSecret.grantRead(fn);

    new apigw.HttpRoute(this, "GithubVisualizerAdminApiGetReposRoute", {
      httpApi: props.api,
      routeKey: apigw.HttpRouteKey.with("/repos", apigw.HttpMethod.POST),
      integration: new apigwIntegrations.HttpLambdaIntegration(
        "GithubVisualizerAdminApiGetReposIntegration",
        prodAlias
      ),
    });
  }
}

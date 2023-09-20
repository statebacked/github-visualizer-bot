import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigw from "@aws-cdk/aws-apigatewayv2-alpha";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as cert from "aws-cdk-lib/aws-certificatemanager";

type GithubVisualizerAdminApiStackProps = cdk.StackProps & {
  hostedZone: route53.IHostedZone;
};

export class GithubVisualizerAdminApiStack extends cdk.Stack {
  public api: apigw.IHttpApi;

  constructor(
    scope: Construct,
    id: string,
    props: GithubVisualizerAdminApiStackProps
  ) {
    super(scope, id, props);

    const domainName = "admin.github-visualizer-bot.statebacked.dev";

    const certificate = new cert.Certificate(
      this,
      "GithubVisualizerAdminApiCert",
      {
        domainName,
        validation: cert.CertificateValidation.fromDns(props.hostedZone),
      }
    );

    const api = new apigw.HttpApi(this, "GithubVisualizerAdminApi", {
      defaultDomainMapping: {
        domainName: new apigw.DomainName(
          this,
          "GithubVisualizerAdminApiDomainName",
          {
            domainName,
            certificate,
          }
        ),
      },
      corsPreflight: {
        allowCredentials: false,
        allowHeaders: ["*"],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST],
        allowOrigins: ["*"],
        maxAge: cdk.Duration.days(1),
      },
    });
    this.api = api;
  }
}

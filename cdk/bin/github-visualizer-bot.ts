#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { GithubVisualizerBotAssetsStack } from "../lib/github-visualizer-bot-assets-stack";
import { GithubVisualizerAdminApiGetReposStack } from "../lib/admin-api-get-repos-route-stack";
import { GithubVisualizerAdminApiStack } from "../lib/admin-api-stack";
import { GithubSecretsStack } from "../lib/github-secrets-stack";
import { GithubVisualizerHostedZoneStack } from "../lib/hosted-zone-stack";
import { GithubVisualizerBotAssetsCertStack } from "../lib/github-visualizer-bot-assets-cert-stack";

const app = new cdk.App();

const props = {
    env: {
        region: "us-west-1",
    }
};

const hostedZoneStack = new GithubVisualizerHostedZoneStack(
  app,
  "GithubVisualizerHostedZoneStack",
  props
);
const assetsCertStack = new GithubVisualizerBotAssetsCertStack(
    app,
    "GithubVisualizerBotAssetsCertStack",
    {
        ...props,
        env: {
            region: "us-east-1",
        },
        crossRegionReferences: true,
        hostedZone: hostedZoneStack.hostedZone,
    }
);
const assetsStack = new GithubVisualizerBotAssetsStack(
  app,
  "GithubVisualizerBotAssetsStack",
  {
    ...props,
    crossRegionReferences: true,
    hostedZone: hostedZoneStack.hostedZone,
    certificate: assetsCertStack.certificate,
  }
);
const adminApiStack = new GithubVisualizerAdminApiStack(
  app,
  "GithubVisualizerAdminApiStack",
  {
    ...props,
    hostedZone: hostedZoneStack.hostedZone,
  }
);
const githubSecretsStack = new GithubSecretsStack(
  app,
  "GithubVisualizerGithubSecretsStack",
  props
);
const adminApiGetReposStack = new GithubVisualizerAdminApiGetReposStack(
  app,
  "GithubVisualizerAdminApiGetReposStack",
  {
    ...props,
    api: adminApiStack.api,
    githubSecret: githubSecretsStack.githubSecret,
  }
);

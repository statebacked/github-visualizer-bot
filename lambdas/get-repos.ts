import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { OAuthApp } from "octokit";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({
    apiVersion: "2023-09-18",
});

const getApp = (() => {
    let app: OAuthApp | null = null;

    return async () => {
        if (!app) {
            const secret = await secretsClient.send(new GetSecretValueCommand({
                SecretId: process.env.GITHUB_SECRET_ARN!,
            }));
            const { clientId, clientSecret } = JSON.parse(secret.SecretString!);
            app = new OAuthApp({
                clientId,
                clientSecret,
            });
        }

        return app;
    };
})();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const body = event.isBase64Encoded ? Buffer.from(event.body ?? "", 'base64').toString('utf8') : event.body;
    if (!body) {
        return {
            statusCode: 400,
        };
    }

    const { code, installationId } = JSON.parse(body);

    if (!code) {
        return {
            statusCode: 400,
        };
    }

    const app = await getApp();
    const octokit = await app.getUserOctokit({ code })
    const installationsResponse = await octokit.request("GET /user/installations");
    const installations = installationId ? installationsResponse.data.installations.filter((i) => i.id === installationId) : installationsResponse.data.installations;

    console.log(JSON.stringify({
        msg: "installation",
        installations,
        allInstalations: installationsResponse.data.installations,
        installationId,
    }))

    const reposs = await Promise.all(installations.map(async (installation) => {
        const reposResponse = await octokit.request("GET /user/installations/{installation_id}/repositories", {
            installation_id: installation.id,
            per_page: 100,
        });

        const repos = reposResponse.data.repositories;
        return repos.map((r) => r.full_name);
    }));

    const repos = reposs.flat();

    console.log(JSON.stringify({
        msg: "repos",
        repos,
    }));

    return {
        statusCode: 200,
        body: JSON.stringify({
            repos: repos,
        })
    };
}
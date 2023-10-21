// @ts-expect-error
globalThis.document = {}; // ELK (via GWT) gets confused about its env with a defined self and undefined document

import { assign, createMachine } from "xstate";
import { App } from "octokit";
import { extractMachinesFromFile } from "@xstate/machine-extractor";
import {
  xstate,
  SvgFlowGraph,
  getSvgFlowGraphProps,
} from "@statebacked/react-statechart";
import { renderToString } from "react-dom/server";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  accessKeyId,
  machineImageBucketName,
  machineImageDomain,
  privateKey,
  region,
  secretAccessKey,
} from "./secret";
import parseDiff from "parse-diff";
import IntervalTree from "node-interval-tree";

const s3Client = new S3Client({
  region,
  apiVersion: "2023-09-18",
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const githubApp = new App({
  appId: 390218,
  privateKey,
});

type GithubEvent = {
  installation: {
    id: number;
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  pull_request: {
    number: number;
    base: {
      sha: string;
    };
    head: {
      sha: string;
    };
  };
};

type Context = {
  installationId: number;
  repo: string;
  owner: string;
  prNumber: number;
  prevCommit: string;
  newCommit: string;
  prFiles: Array<{
    path: string;
    changedLines: Array<{ from: number; to: number }>;
  }>;
};

export const prCommentingMachine = createMachine({
  schema: {
    events: {} as
      | {
          type: "github.pull_request.opened";
          githubEvent: GithubEvent;
        }
      | {
          type: "github.pull_request.synchronize";
          githubEvent: GithubEvent;
        },
    context: {} as Context,
  },
  context: {
    installationId: 0,
    repo: "",
    owner: "",
    prNumber: 0,
    prevCommit: "",
    newCommit: "",
    prFiles: [],
  },
  initial: "start",
  on: {
    "github.pull_request.synchronize": {
      target: "readFiles",
      actions: assign({
        installationId: (_context, event) => event.githubEvent.installation.id,
        repo: (_context, event) => event.githubEvent.repository.name,
        owner: (_context, event) => event.githubEvent.repository.owner.login,
        prNumber: (_context, event) => event.githubEvent.pull_request.number,
        prevCommit: (_context, event) =>
          event.githubEvent.pull_request.base.sha,
        newCommit: (_context, event) => event.githubEvent.pull_request.head.sha,
      }),
    },
    "github.pull_request.opened": {
      target: "readFiles",
      actions: assign({
        installationId: (_context, event) => event.githubEvent.installation.id,
        repo: (_context, event) => event.githubEvent.repository.name,
        owner: (_context, event) => event.githubEvent.repository.owner.login,
        prNumber: (_context, event) => event.githubEvent.pull_request.number,
        prevCommit: (_context, event) =>
          event.githubEvent.pull_request.base.sha,
        newCommit: (_context, event) => event.githubEvent.pull_request.head.sha,
      }),
    },
  },
  states: {
    start: {},
    readFiles: {
      invoke: {
        src: getFilesForPr,
        onDone: {
          target: "receivedFiles",
          actions: assign({
            prFiles: (context, event) => event.data,
          }),
        },
      },
    },
    receivedFiles: {
      always: [
        {
          target: "processFile",
          cond: (context) => context.prFiles.length > 0,
        },
        { target: "done" },
      ],
    },
    processFile: {
      invoke: {
        src: processFile,
        onDone: "processedFile",
        onError: "processedFile",
      },
      exit: assign({
        prFiles: (context, event) => context.prFiles.slice(0, -1),
      }),
    },
    processedFile: {
      always: [
        {
          target: "processFile",
          cond: (context, event) => context.prFiles.length > 0,
        },
        { target: "done" },
      ],
    },
    done: {},
  },
});

async function getFilesForPr(
  { repo, owner, prNumber, installationId }: Context,
  _event: any
): Promise<Context["prFiles"]> {
  const octokit = await githubApp.getInstallationOctokit(installationId);

  const files = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return files.data
    .filter(
      (file) =>
        ["js", "ts", "tsx", "jsx"].some((ext) => file.filename.endsWith(ext)) &&
        ["added", "modified", "changed"].includes(file.status)
    )
    .map((file) => {
      const parsed = parseDiff(file.patch);
      return parsed && parsed.length > 0
        ? {
            path: file.filename,
            changedLines: parsed[0].chunks.map((chunk) => ({
              from: chunk.newStart,
              to: chunk.newStart + chunk.newLines - 1,
            })),
          }
        : null;
    })
    .filter(<T>(f: T | null): f is T => !!f);
}

async function processFile(
  { repo, owner, prNumber, newCommit, installationId, prFiles }: Context,
  _event: any
) {
  const { path, changedLines } = prFiles[prFiles.length - 1];

  const changedIntervals = new IntervalTree<boolean>();
  for (const { from, to } of changedLines) {
    changedIntervals.insert(from, to, true);
  }

  const octokit = await githubApp.getInstallationOctokit(installationId);

  const fileContents = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref: newCommit,
  });

  const b64Content = (fileContents.data as { content: string }).content;
  const fileContent = b64Content
    .split("\n")
    .map((line) => Buffer.from(line, "base64").toString("utf8"))
    .join("");

  const machines = extractMachinesFromFile(fileContent);

  await Promise.all(
    (machines?.machines ?? []).map(async (machine) => {
      if (!machine) {
        return;
      }

      const c = machine.toConfig();
      if (!c) {
        return;
      }

      const startLine = machine.machineCallResult.node.loc?.start?.line;
      if (startLine === undefined) {
        return;
      }

      const endLine = machine.machineCallResult.node.loc?.end?.line;

      if (
        typeof endLine === "undefined" ||
        changedIntervals.search(startLine, endLine)?.length === 0
      ) {
        console.log("skipping", path, startLine, endLine);
        // not changed
        return;
      }

      const flow = xstate.machineToFlow(createMachine(c as any));
      const props = await getSvgFlowGraphProps({
        flow,
        direction: "horizontal",
      });
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
${renderToString(SvgFlowGraph(props)).replace(
  "<svg",
  "<svg xmlns='http://www.w3.org/2000/svg'"
)}`;
      const hash = Buffer.from(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(svg))
      ).toString("base64url");

      const key = `${hash}.svg`;

      const exists = await s3Client
        .send(
          new HeadObjectCommand({
            Bucket: machineImageBucketName,
            Key: key,
          })
        )
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: machineImageBucketName,
            Key: key,
            Body: svg,
            ContentType: "image/svg+xml",
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
      }

      return octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: newCommit,
        path,
        line: startLine,
        body: `Here's your state machine:
        
![${flow.name ?? "Your state machine"}](https://${machineImageDomain}/${key})

From your friends at [State Backed](https://www.statebacked.dev), the fastest way to deploy state machines to the cloud.`,
      });
    })
  );
}

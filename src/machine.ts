import { assign, createMachine } from "xstate";
import { App } from "octokit";
import { extractMachinesFromFile } from "@xstate/machine-extractor";
import {
  xstate,
  SvgFlowGraph,
  getSvgFlowGraphProps,
} from "@statebacked/react-statechart";
import { renderToString } from "react-dom/server";

const app = new App({
  appId: 390218,
  privateKey: `
`,
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

export const prCommentingMachine = createMachine(
  {
    schema: {
      events: {} as {
        type: "github.pull_request.opened";
        githubEvent: GithubEvent;
      },
    },
    context: {
      installationId: 0,
      repo: "",
      owner: "",
      prNumber: 0,
      prevCommit: "",
      newCommit: "",
      prFiles: [] as Array<string>,
    },
    initial: "start",
    states: {
      start: {
        on: {
          "github.pull_request.opened": {
            target: "readFiles",
            actions: assign({
              installationId: (context, event) =>
                event.githubEvent.installation.id,
              repo: (context, event) => event.githubEvent.repository.name,
              owner: (context, event) =>
                event.githubEvent.repository.owner.login,
              prNumber: (context, event) =>
                event.githubEvent.pull_request.number,
              prevCommit: (context, event) =>
                event.githubEvent.pull_request.base.sha,
              newCommit: (context, event) =>
                event.githubEvent.pull_request.head.sha,
            }),
          },
        },
      },
      readFiles: {
        invoke: {
          src: getFileContentsUrlsForPr,
          onDone: "updateFiles",
        },
      },
      updateFiles: {
        entry: assign({
          // @ts-expect-error
          prFileContentsUrls: (context, event) => event.data,
        }),
        always: [
          {
            target: "processFile",
            cond: (context, event) => context.prFiles.length > 0,
          },
        ],
      },
      processFile: {
        invoke: {
          src: processFile,
          onDone: "processedFile",
          onError: "processedFile",
        },
      },
      processedFile: {
        entry: assign({
          prFiles: (context, event) => context.prFiles.slice(0, -1),
        }),
        always: [
          {
            target: "processFile",
            cond: (context, event) => context.prFiles.length > 0,
          },
          { target: "done" },
        ],
      },
      done: {
        type: "final",
      },
    },
  },
  {
    services: {
      getFileContentsUrlsForPr,
      processFile,
    },
  }
);

async function getFileContentsUrlsForPr(
  { repo, owner, prNumber, installationId }: any,
  event: any
) {
  const octokit = await app.getInstallationOctokit(installationId);

  const files = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return files.data
    .filter((file) => ["added", "modified", "changed"].includes(file.status))
    .map((file) => file.filename);
}

async function processFile(
  { repo, owner, prNumber, newCommit, installationId, prFiles }: any,
  event: any
) {
  const path = prFiles[prFiles.length - 1];

  const octokit = await app.getInstallationOctokit(installationId);

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

  const svgsAndLines: Array<{ svg: string; line: number }> = [];

  const machines = extractMachinesFromFile(fileContent);
  for (const machine of machines?.machines ?? []) {
    if (!machine) {
      continue;
    }

    const c = machine.toConfig();
    if (!c) {
      continue;
    }

    const line = machine.machineCallResult.node.loc?.start?.line;
    if (line === undefined) {
      continue;
    }

    const flow = xstate.machineToFlow(createMachine(c as any));
    const props = await getSvgFlowGraphProps({ flow, direction: "horizontal" });
    const svg = renderToString(SvgFlowGraph(props));
    svgsAndLines.push({ svg, line });
  }

  await Promise.all(
    svgsAndLines.map(({ svg, line }) => {
      return octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: newCommit,
        path,
        line,
        body: svg,
      });
    })
  );
}

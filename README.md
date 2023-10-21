# A State Backed bot to visualize state machines in pull requests

We have a simple state machine in `src/machine.ts` that receives GitHub webhooks as events (through the State Backed webhook integration).
It extracts the files from every PR, identifies state machines in them, determines which state machines were modified in the PR, creates a visualization of them using the [@statebacked/react-statechart](https://github.com/statebacked/react-statechart) library, and adds a comment to the PR with the image.

The state machine is deployed to [State Backed](https://www.statebacked.dev) to run reliably at any scale.

We implement two things outside of State Backed:
1. an S3 bucket to store the images (eventually coming to State Backed!)
2. a stateless API to retrieve the authorized repositories for a GitHub session (also eventually coming to State Backed!)

Both of these are implemented in the `cdk` directory.

## Installation

Install the bot from the GitHub marketplace [here](https://github.com/marketplace/state-backed-machine-visualizer). It's free :)

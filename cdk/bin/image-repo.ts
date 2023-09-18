#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StateBackedBotStack } from '../lib/state-backed-bot-stack';

const app = new cdk.App();
new StateBackedBotStack(app, 'StateBackedBotStack', {});
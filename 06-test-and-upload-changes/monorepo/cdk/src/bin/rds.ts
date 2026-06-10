#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { RdsStack } from "../lib/rdsStack.js";

const app = new cdk.App();

new RdsStack(app, "rds-stack");

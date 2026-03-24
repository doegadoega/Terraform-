import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Concepts } from "./components/Concepts";
import { Workflow } from "./components/Workflow";
import { Commands } from "./components/Commands";
import { Providers } from "./components/Providers";
import { BestPractices } from "./components/BestPractices";
import { Containers } from "./components/Containers";
import { MultiRegion } from "./components/MultiRegion";
import { DeployPractice } from "./components/DeployPractice";
import { GitWorkflow } from "./components/GitWorkflow";
import { Serverless } from "./components/Serverless";
import { VpcContainerPractice } from "./components/VpcContainerPractice";
import { Exercises } from "./components/Exercises";
import { AwsIntegration } from "./components/AwsIntegration";
import { CognitoAuth } from "./components/CognitoAuth";
import { ZscalerConnector } from "./components/ZscalerConnector";
import { VpcStepGuide } from "./components/VpcStepGuide";
import { EcsArchitecture } from "./components/EcsArchitecture";
import { LearningVideos } from "./components/LearningVideos";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "concepts", Component: Concepts },
      { path: "workflow", Component: Workflow },
      { path: "commands", Component: Commands },
      { path: "providers", Component: Providers },
      { path: "containers", Component: Containers },
      { path: "ecs-architecture", Component: EcsArchitecture },
      { path: "vpc-step-guide", Component: VpcStepGuide },
      { path: "vpc-container", Component: VpcContainerPractice },
      { path: "aws-integration", Component: AwsIntegration },
      { path: "cognito-auth", Component: CognitoAuth },
      { path: "zscaler", Component: ZscalerConnector },
      { path: "serverless", Component: Serverless },
      { path: "multi-region", Component: MultiRegion },
      { path: "deploy-practice", Component: DeployPractice },
      { path: "git-workflow", Component: GitWorkflow },
      { path: "best-practices", Component: BestPractices },
      { path: "exercises", Component: Exercises },
      { path: "videos", Component: LearningVideos },
    ],
  },
]);
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  GraphNode,
  NodeCard,
  NodeContent,
  NodeDescription,
  NodeHeader,
  NodeTitle,
} from "@/components/pipecat/graph/node";
import {
  NodeConnector,
  NodeConnectorLabel,
  NodeConnectorPort,
  NodeConnectorsLeft,
  NodeConnectorsRight,
} from "@/components/pipecat/graph/node-connector";

const TONES = [
  "neutral",
  "blue",
  "purple",
  "amber",
  "green",
  "pink",
  "coral",
  "red",
] as const;

const meta = {
  title: "Graph/Node Connector",
  component: NodeConnector,
  args: { active: false },
  argTypes: {
    tone: { control: "select", options: TONES },
    render: { control: false },
  },
} satisfies Meta<typeof NodeConnector>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One connector on a node. Hover the port for its halo. */
export const Basic: Story = {
  render: (args) => (
    <GraphNode tone="green">
      <NodeCard>
        <NodeHeader>
          <NodeTitle>Verify identity</NodeTitle>
        </NodeHeader>
        <NodeContent>
          <NodeDescription>Asks for a date of birth.</NodeDescription>
        </NodeContent>
        <NodeConnectorsRight>
          <NodeConnector {...args}>
            <NodeConnectorPort />
            <NodeConnectorLabel>Verified</NodeConnectorLabel>
          </NodeConnector>
        </NodeConnectorsRight>
      </NodeCard>
    </GraphNode>
  ),
};

/** Either side, with labels or without, and aligned with className. */
export const Sides: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-10">
      <GraphNode>
        <NodeCard>
          <NodeHeader>
            <NodeTitle>Ports only</NodeTitle>
          </NodeHeader>
          <NodeConnectorsLeft>
            <NodeConnector>
              <NodeConnectorPort />
            </NodeConnector>
          </NodeConnectorsLeft>
          <NodeContent>
            <NodeDescription>No labels on either side.</NodeDescription>
          </NodeContent>
          <NodeConnectorsRight>
            <NodeConnector>
              <NodeConnectorPort />
            </NodeConnector>
            <NodeConnector>
              <NodeConnectorPort />
            </NodeConnector>
          </NodeConnectorsRight>
        </NodeCard>
      </GraphNode>
      <GraphNode>
        <NodeCard>
          <NodeHeader>
            <NodeTitle>Labels both sides</NodeTitle>
          </NodeHeader>
          <NodeConnectorsLeft>
            <NodeConnector>
              <NodeConnectorPort />
              <NodeConnectorLabel>patient</NodeConnectorLabel>
            </NodeConnector>
            <NodeConnector>
              <NodeConnectorPort />
              <NodeConnectorLabel>slot</NodeConnectorLabel>
            </NodeConnector>
          </NodeConnectorsLeft>
          <NodeConnectorsRight>
            <NodeConnector>
              <NodeConnectorPort />
              <NodeConnectorLabel>confirmation</NodeConnectorLabel>
            </NodeConnector>
            <NodeConnector>
              <NodeConnectorPort />
              <NodeConnectorLabel>a label too long to fit</NodeConnectorLabel>
            </NodeConnector>
          </NodeConnectorsRight>
        </NodeCard>
      </GraphNode>
      <GraphNode>
        <NodeCard>
          <NodeConnectorsLeft className="justify-start">
            <NodeConnector>
              <NodeConnectorPort />
            </NodeConnector>
          </NodeConnectorsLeft>
          <NodeContent>
            <NodeTitle>Content only</NodeTitle>
            <NodeDescription>
              Connector areas align with className: start on the left, end on
              the right.
            </NodeDescription>
          </NodeContent>
          <NodeConnectorsRight className="justify-end">
            <NodeConnector>
              <NodeConnectorPort />
              <NodeConnectorLabel>Next</NodeConnectorLabel>
            </NodeConnector>
          </NodeConnectorsRight>
        </NodeCard>
      </GraphNode>
    </div>
  ),
};

/** What a port can look like. */
export const Ports: Story = {
  render: () => (
    <GraphNode tone="blue">
      <NodeCard>
        <NodeHeader>
          <NodeTitle>Ports</NodeTitle>
        </NodeHeader>
        <NodeConnectorsRight>
          <NodeConnector>
            <NodeConnectorPort />
            <NodeConnectorLabel>Outline</NodeConnectorLabel>
          </NodeConnector>
          <NodeConnector>
            <NodeConnectorPort variant="dashed" />
            <NodeConnectorLabel>Dashed</NodeConnectorLabel>
          </NodeConnector>
          <NodeConnector>
            <NodeConnectorPort variant="solid" />
            <NodeConnectorLabel>Solid</NodeConnectorLabel>
          </NodeConnector>
          <NodeConnector>
            <NodeConnectorPort shape="diamond" />
            <NodeConnectorLabel>Diamond</NodeConnectorLabel>
          </NodeConnector>
          <NodeConnector active>
            <NodeConnectorPort />
            <NodeConnectorLabel>Active</NodeConnectorLabel>
          </NodeConnector>
          <NodeConnector tone="coral">
            <NodeConnectorPort />
            <NodeConnectorLabel>Its own tone</NodeConnectorLabel>
          </NodeConnector>
        </NodeConnectorsRight>
      </NodeCard>
    </GraphNode>
  ),
};

/** The connector's own variables, set on the area. */
export const Resized: Story = {
  render: () => (
    <GraphNode tone="purple">
      <NodeCard>
        <NodeHeader>
          <NodeTitle>Bigger connectors</NodeTitle>
        </NodeHeader>
        <NodeConnectorsRight className="[--node-connector-height:--spacing(9)] [--node-connector-port:--spacing(5)] [--node-connector-text:--spacing(3.5)]">
          <NodeConnector>
            <NodeConnectorPort />
            <NodeConnectorLabel>Yes</NodeConnectorLabel>
          </NodeConnector>
          <NodeConnector>
            <NodeConnectorPort />
            <NodeConnectorLabel>No</NodeConnectorLabel>
          </NodeConnector>
        </NodeConnectorsRight>
      </NodeCard>
    </GraphNode>
  ),
};

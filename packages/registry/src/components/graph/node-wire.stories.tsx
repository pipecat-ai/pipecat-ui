import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Handle,
  type Node as FlowNode,
  type NodeProps,
  Position,
} from "@xyflow/react";
import { Graph } from "@/components/pipecat/graph/graph";
import {
  Node,
  NodeCard,
  NodeHeader,
  NodeTitle,
} from "@/components/pipecat/graph/node";
import {
  NodeConnector,
  NodeConnectorPort,
  NodeConnectorsLeft,
  NodeConnectorsRight,
} from "@/components/pipecat/graph/node-connector";
import {
  NodeWire,
  NodeWireAction,
  NodeWireConnection,
  type NodeWireEdge,
} from "@/components/pipecat/graph/node-wire";

const meta = {
  title: "Graph/Node Wire",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Dot = FlowNode<{ title: string }, "dot">;

function Dot({ data }: NodeProps<Dot>) {
  return (
    <Node size="sm" className="w-36">
      <NodeCard>
        <NodeHeader>
          <NodeTitle>{data.title}</NodeTitle>
        </NodeHeader>
        <NodeConnectorsLeft>
          <NodeConnector>
            <NodeConnectorPort
              render={<Handle type="target" position={Position.Left} />}
            />
          </NodeConnector>
        </NodeConnectorsLeft>
        <NodeConnectorsRight>
          <NodeConnector>
            <NodeConnectorPort
              render={<Handle type="source" position={Position.Right} />}
            />
          </NodeConnector>
        </NodeConnectorsRight>
      </NodeCard>
    </Node>
  );
}

const NODE_TYPES = { dot: Dot };
const EDGE_TYPES = { wire: NodeWire };

const dot = (id: string, title: string, x: number, y: number): Dot => ({
  id,
  type: "dot",
  position: { x, y },
  data: { title },
});

function Canvas({ nodes, edges }: { nodes: Dot[]; edges: NodeWireEdge[] }) {
  return (
    <div className="h-112 w-200 max-w-[90vw] overflow-hidden rounded-xl border">
      <Graph
        defaultNodes={nodes}
        defaultEdges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        connectionLineComponent={NodeWireConnection}
        defaultEdgeOptions={{ type: "wire" }}
      />
    </div>
  );
}

/** A wire takes a tone, carries a signal dot, and follows its ports. */
export const Basic: Story = {
  render: () => (
    <Canvas
      nodes={[dot("a", "Ask", 0, 0), dot("b", "Answer", 336, 96)]}
      edges={[
        {
          id: "a-b",
          type: "wire",
          source: "a",
          target: "b",
          data: { tone: "blue" },
        },
      ]}
    />
  ),
};

/** Plain, in use, dashed, without its signal, and with a button on its middle. */
export const States: Story = {
  render: () => (
    <Canvas
      nodes={[
        dot("a", "Plain", 0, 0),
        dot("b", "Next", 336, 0),
        dot("c", "Active", 0, 96),
        dot("d", "Next", 336, 96),
        dot("e", "Dashed", 0, 192),
        dot("f", "Next", 336, 192),
        dot("g", "Label", 0, 288),
        dot("h", "Next", 336, 288),
        dot("i", "No signal", 0, 384),
        dot("j", "Next", 336, 384),
      ]}
      edges={[
        {
          id: "a-b",
          type: "wire",
          source: "a",
          target: "b",
          data: { tone: "blue" },
        },
        {
          id: "c-d",
          type: "wire",
          source: "c",
          target: "d",
          data: { tone: "green", active: true },
        },
        {
          id: "e-f",
          type: "wire",
          source: "e",
          target: "f",
          data: { tone: "amber", dashed: true },
        },
        {
          id: "g-h",
          type: "wire",
          source: "g",
          target: "h",
          data: { tone: "purple" },
          label: <NodeWireAction aria-label="Add a step on this wire" />,
        },
        {
          id: "i-j",
          type: "wire",
          source: "i",
          target: "j",
          data: { tone: "pink", signal: false },
        },
      ]}
    />
  ),
};

/** A wire back to an earlier node hooks out, runs underneath and hooks in. */
export const LoopBack: Story = {
  render: () => (
    <Canvas
      nodes={[dot("a", "Find a slot", 0, 0), dot("b", "Book it", 336, 0)]}
      edges={[
        {
          id: "a-b",
          type: "wire",
          source: "a",
          target: "b",
          data: { tone: "green" },
        },
        {
          id: "b-a",
          type: "wire",
          source: "b",
          target: "a",
          data: { tone: "amber", dashed: true },
        },
      ]}
    />
  ),
};

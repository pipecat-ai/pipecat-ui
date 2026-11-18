import {
  addEdge,
  type Connection,
  Handle,
  type Node as FlowNode,
  type NodeProps,
  Panel,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { GripVerticalIcon, MaximizeIcon, SparklesIcon } from "lucide-react";

import {
  arrangeGroups,
  GRAPH_FIT,
  type GraphGroupPacking,
} from "@/components/pipecat/graph/graph";
import {
  Node,
  NodeCard,
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
import {
  NodeGroup,
  NodeGroupHandle,
  NodeGroupIsland,
  NodeGroupTag,
  NodeGroupTitle,
} from "@/components/pipecat/graph/node-group";
import {
  NodeWire,
  NodeWireConnection,
  type NodeWireEdge,
} from "@/components/pipecat/graph/node-wire";
import type { GraphTone } from "@/components/pipecat/graph/tone";
import { Button } from "@/components/ui/button";

/*
 * A small call flow for the Graph stories and docs: two groups, a loose step,
 * and wires between them. Synthetic, like everything else in the fixtures.
 */

type StepNode = FlowNode<
  { title: string; kind: string; tone: GraphTone; exits: string[] },
  "step"
>;
type GroupNode = FlowNode<{ title: string; tone: GraphTone }, "group">;
export type DemoNode = StepNode | GroupNode;

/** A step: a node whose ports are React Flow handles. */
function Step({ data, dragging }: NodeProps<StepNode>) {
  return (
    <Node size="sm" tone={data.tone} data-dragging={dragging || undefined}>
      <NodeCard className="transition-shadow group-data-dragging/node:shadow-xl">
        <NodeHeader>
          <NodeTitle>{data.title}</NodeTitle>
          <NodeDescription className="text-tone-ink">
            {data.kind}
          </NodeDescription>
        </NodeHeader>
        <NodeConnectorsLeft>
          <NodeConnector tone="neutral">
            <NodeConnectorPort
              render={<Handle type="target" position={Position.Left} />}
            />
          </NodeConnector>
        </NodeConnectorsLeft>
        <NodeConnectorsRight>
          {data.exits.map((exit) => (
            <NodeConnector key={exit}>
              <NodeConnectorPort
                render={
                  <Handle type="source" position={Position.Right} id={exit} />
                }
              />
              <NodeConnectorLabel>{exit}</NodeConnectorLabel>
            </NodeConnector>
          ))}
        </NodeConnectorsRight>
      </NodeCard>
    </Node>
  );
}

/** A group: an island the size React Flow gives it, dragged by its tag. */
function Group({ data }: NodeProps<GroupNode>) {
  return (
    <NodeGroup tone={data.tone} className="size-full">
      <NodeGroupTag>
        <NodeGroupHandle>
          <GripVerticalIcon aria-hidden />
          <NodeGroupTitle>{data.title}</NodeGroupTitle>
        </NodeGroupHandle>
      </NodeGroupTag>
      <NodeGroupIsland />
    </NodeGroup>
  );
}

export const DEMO_NODE_TYPES = { step: Step, group: Group };
export const DEMO_EDGE_TYPES = { wire: NodeWire };
export { NodeWireConnection as DemoConnectionLine };

const HANDLE = "[data-slot=node-group-handle]";
const group = (
  id: string,
  title: string,
  tone: GraphTone,
  x: number,
  width: number,
  height: number,
): GroupNode => ({
  id,
  type: "group",
  position: { x, y: 0 },
  width,
  height,
  dragHandle: HANDLE,
  data: { title, tone },
});
const step = (
  id: string,
  parentId: string | undefined,
  x: number,
  y: number,
  data: StepNode["data"],
): StepNode => ({ id, type: "step", parentId, position: { x, y }, data });

export const DEMO_NODES: DemoNode[] = [
  group("answer", "Answer", "blue", 0, 240, 168),
  step("greet", "answer", 24, 48, {
    title: "Greet the caller",
    kind: "Speech",
    tone: "blue",
    exits: ["Next"],
  }),
  group("book", "Book it", "green", 312, 504, 192),
  step("find", "book", 24, 48, {
    title: "Find a slot",
    kind: "Question",
    tone: "green",
    exits: ["Chosen", "None free"],
  }),
  step("confirm", "book", 288, 48, {
    title: "Book the slot",
    kind: "Action",
    tone: "green",
    exits: ["Booked", "Another time"],
  }),
  step("close", undefined, 912, 48, {
    title: "Wrap up",
    kind: "Speech",
    tone: "coral",
    exits: [],
  }),
];

const wire = (
  source: string,
  exit: string,
  target: string,
  data: NodeWireEdge["data"],
): NodeWireEdge => ({
  id: `${source}:${exit}`,
  type: "wire",
  source,
  sourceHandle: exit,
  target,
  data,
});

export const DEMO_EDGES: NodeWireEdge[] = [
  wire("greet", "Next", "find", { tone: "blue" }),
  wire("find", "Chosen", "confirm", { tone: "green", active: true }),
  wire("confirm", "Booked", "close", { tone: "green" }),
  wire("confirm", "Another time", "find", { tone: "amber", dashed: true }),
];

/** The demo's nodes and wires as state, with new wires springing into place. */
export function useGraphDemo() {
  const [nodes, , onNodesChange] = useNodesState(DEMO_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEMO_EDGES);
  const onConnect = (connection: Connection) =>
    setEdges((current) =>
      addEdge<NodeWireEdge>(
        { ...connection, type: "wire", data: { bounce: "connected" } },
        current,
      ),
    );
  return { nodes, edges, onNodesChange, onEdgesChange, onConnect };
}

/**
 * Frame fits the graph to the canvas. Tidy lands every node on the grid, then
 * arranges the groups: React Flow has no layout engine of its own.
 */
export function GraphDemoControls({
  grid,
  gap,
  groups,
}: {
  grid: number;
  gap?: number;
  groups?: GraphGroupPacking;
}) {
  const flow = useReactFlow();
  const snap = (value: number) => Math.round(value / grid) * grid;
  return (
    <Panel position="top-right" className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void flow.fitView({ ...GRAPH_FIT, duration: 450 })}
      >
        <MaximizeIcon data-icon="inline-start" />
        Frame
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          flow.setNodes((nodes) =>
            nodes.map((node) => ({
              ...node,
              position: { x: snap(node.position.x), y: snap(node.position.y) },
            })),
          );
          arrangeGroups(flow, { grid, gap, groups });
        }}
      >
        <SparklesIcon data-icon="inline-start" />
        Tidy
      </Button>
    </Panel>
  );
}

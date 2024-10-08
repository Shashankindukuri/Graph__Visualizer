import React from "react";
import { Graph as D3Graph } from "react-d3-graph";
import { getTypeConfig } from "../parser/inputTypes";
import * as Utils from "../utils/utils";
import * as LayoutUtils from "../layout/layoutUtils";
import { performLayout, LayoutType } from "../layout/layoutTypes";
import { Typography } from "@material-ui/core";
import { useStyles } from "../styles/useStyles";

export const DEFAULT_LEFT_PADDING = 100;
export const DEFAULT_RIGHT_PADDING = 180;
export const DEFAULT_TOP_PADDING = 50;
export const DEFAULT_EXTRA_NODE_SPACING = 50;

export type GraphProps = {
  inputType: number;
  data: {
    nodes: Array<{ id: string; label: string; x?: number; y?: number }>;
    links: Array<{ source: string; target: string }>;
    startNode?: string | null;
    directed?: boolean;
  };
  id: string;
  directed: boolean;
  customNodes: Set<string>;
  startNode: string | null;
  selectedLayout: number;
  drawerOpen: boolean;
  searchText: string;
  horizontalSpacing: number;
  verticalSpacing: number;
};

// Type-safe debounce function
function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (event?: any) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
}

const Graph: React.FC<GraphProps> = ({
  inputType,
  data,
  id = "graph-id",
  directed,
  customNodes,
  startNode,
  selectedLayout,
  drawerOpen,
  searchText,
  horizontalSpacing,
  verticalSpacing
}: GraphProps) => {
  const classes = useStyles();

  const [dimensions, setDimensions] = React.useState({
    height: window.innerHeight,
    width: window.innerWidth
  });
  const [oldToNewId, setOldToNewId] = React.useState<{ [key: string]: string }>({});

  React.useEffect(() => {
    const debouncedHandleResize = debounce(function handleResize() {
      setDimensions({
        height: window.innerHeight,
        width: window.innerWidth
      });
    }, 100);
    window.addEventListener("resize", debouncedHandleResize);
  }, []);

  // every time node set changes, we need to check to see if there are any conflicts in node ids
  React.useEffect(() => {
    const allIds = new Set<string>(Object.values(oldToNewId));
    const currIdMap: { [key: string]: string } = {};
    for (let node of data.nodes) {
      let nodeId = node.id;
      if (allIds.has(nodeId)) {
        currIdMap[nodeId] = nodeId + "-1"; // add a 1 if there is a conflict
      } else {
        currIdMap[nodeId] = nodeId;
      }
    }
    for (let nodeId of Array.from(customNodes)) {
      if (allIds.has(nodeId)) {
        currIdMap[nodeId] = nodeId + "-1";
      } else {
        currIdMap[nodeId] = nodeId;
      }
    }
    setOldToNewId(currIdMap);
  }, [data, customNodes, selectedLayout, startNode, horizontalSpacing, verticalSpacing]);

  if (data.nodes.length === 0) {
    return (
      <div className={classes.layoutError}>
        <Typography color="secondary" variant="h6">
          {"<-- Enter a graph input."}
        </Typography>
      </div>
    );
  }

  const graphPaneHeight = dimensions.height - 120;
  const graphPaneWidth = drawerOpen ? dimensions.width - 350 : dimensions.width - 50;

  // Generate random positions for nodes by default (for testing purposes only)
  for (let n of data.nodes) {
    n.x = Utils.randomInRange(DEFAULT_LEFT_PADDING, graphPaneWidth - DEFAULT_LEFT_PADDING * 1.6);
    n.y = Utils.randomInRange(DEFAULT_TOP_PADDING, graphPaneHeight - DEFAULT_TOP_PADDING * 1.8);
  }

  // Add nodes from customNodes that don't already exist
  let extraNodes = [...LayoutUtils.getExtraNodes(data.nodes, data.links)];
  if (customNodes && customNodes.size > 0) {
    const seen = new Set();
    for (let n of data.nodes) {
      seen.add(n.id);
    }
    // Add if not already in seen
    for (let nodeId of Array.from(customNodes)) {
      if (!seen.has(nodeId)) {
        seen.add(nodeId);
        extraNodes.push({ id: nodeId, label: nodeId });
      }
    }
  }
  // Calculate positions for extra nodes
  let x = graphPaneWidth - DEFAULT_RIGHT_PADDING;
  let y = DEFAULT_TOP_PADDING;
  for (let node of extraNodes) {
    node.x = x;
    node.y = y;
    y += DEFAULT_EXTRA_NODE_SPACING;
  }

  // Perform layout
  data.startNode = startNode;
  data.directed = directed;
  const layoutResult = performLayout(selectedLayout, data, inputType, {
    x: horizontalSpacing,
    y: verticalSpacing
  });
  if (typeof layoutResult === "string") {
    return (
      <div className={classes.layoutError}>
        <Typography color="error" variant="h6">
          {layoutResult}
        </Typography>
      </div>
    );
  }

  const myConfig = {
    nodeHighlightBehavior: true,
    staticGraphWithDragAndDrop: selectedLayout !== LayoutType.ForceLayout,
    width: graphPaneWidth,
    height: graphPaneHeight,
    directed: directed,
    node: {
      color: "lightgreen",
      size: 420,
      labelPosition: "center",
      labelProperty: "label",
      fontWeight: "bold",
      fontSize: 9
    },
    link: {
      color: "blue",
      renderLabel: getTypeConfig(inputType).weighted,
      type: selectedLayout === LayoutType.Arc ? "CURVE_SMOOTH" : "STRAIGHT"
    },
    d3: {
      alphaTarget: 0.05,
      gravity: -180,
      linkLength: 120,
      linkStrength: 0.5,
      disableLinkForce: false
    },
    focusZoom: 1
  };

  const argNodes = [];
  const argLinks = [];
  let focusId: string | undefined;
  const seen = new Set<string>();

  for (let node of [...data.nodes, ...extraNodes]) {
    const nodeId = String(node.id); // Ensure nodeId is a string
    if (seen.has(nodeId)) {
      continue;
    }
    seen.add(nodeId);
    const mappedId = oldToNewId[nodeId] || nodeId;

    if (node.label.toLowerCase() === searchText.trim().toLowerCase()) {
      focusId = mappedId;
      argNodes.push({
        ...node,
        id: mappedId,
        color: "red",
        fontColor: "white"
      });
    } else {
      argNodes.push({
        ...node,
        id: mappedId
      });
    }
  }

  // Fixed error here by ensuring source and target are cast as strings
  let linksToAdd = data.links;
  if (!directed) {
    linksToAdd = LayoutUtils.removeRepeatedEdges(data.links);
  }

  for (let link of linksToAdd) {
    const source = String(link.source);
    const target = String(link.target);

    argLinks.push({
      ...link,
      source: oldToNewId[source] || source,
      target: oldToNewId[target] || target
    });
  }

  return (
    <D3Graph
      id="graph-id" // id is mandatory, if no id is defined rd3g will throw an error
      data={{
        nodes: argNodes,
        links: argLinks,
        focusedNodeId: focusId ? oldToNewId[focusId] : undefined
      }}
      config={myConfig}
    />
  );
};

export default Graph;

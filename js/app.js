// Column visibility configuration
const visibleColumns = {
  subnet: true,
  netmask: false,
  range: true,
  useable: true,
  hosts: true,
  remark: true,
  divide: true,
  join: true,
};

// Current network state
let curNetwork = 0;
let curMask = 0;

// Root subnet node: [depth, numChildren, children, remark]
// children is either null (leaf) or [leftChild, rightChild]
// remark is an optional string for leaf nodes
let rootSubnet;

/**
 * Input Validation
 */

// Validate reserve IP inputs - minimum value is 1
const validateReserveInput = (input) => {
  const value = parseInt(input.value, 10);
  if (isNaN(value) || value < 1) {
    input.value = '1';
  }
  recreateTables();
};

/**
 * IP Address Utility Functions
 */

// Convert integer IP to dotted decimal string
const inetNtoa = (addr) => [
  (addr >>> 24) & 0xff,
  (addr >>> 16) & 0xff,
  (addr >>> 8) & 0xff,
  addr & 0xff
].join('.');

// Convert dotted decimal string to integer IP
const inetAton = (addrStr) => {
  const match = addrStr.match(/^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/);
  if (!match) return null;

  const octets = match.slice(1, 5).map(Number);
  if (octets.some(o => o < 0 || o > 255)) return null;

  return (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
};

// Calculate network address by applying mask
const networkAddress = (ip, mask) => {
  const bits = 32 - mask;
  return bits === 32 ? 0 : (ip >>> bits) << bits;
};

// Calculate number of addresses in a subnet
const subnetAddresses = (mask) => 2 ** (32 - mask);

// Calculate last address in a subnet
const subnetLastAddress = (subnet, mask) => subnet + subnetAddresses(mask) - 1;

// Calculate subnet netmask
const subnetNetmask = (mask) => networkAddress(0xffffffff, mask);

/**
 * Subnet Tree Operations
 */

// Node ID counter for unique identification
let nodeIdCounter = 0;

// Create a new leaf node
const createNode = () => {
  const node = [0, 0, null, '', nodeIdCounter++];
  return node;
};

// Divide a node into two children
const divideNode = (node) => {
  node[2] = [createNode(), createNode()];
};

// Join a node's children
const joinNode = (node) => {
  node[2] = null;
};

/**
 * Highlight cascade for join buttons
 * When hovering over a join button, highlight:
 * (a) All associated subnet rows (leaf nodes under this joinable node)
 * (b) All children CIDR blocks (both UI buttons and non-interactive displays)
 * Effect does NOT propagate upward - parent CIDRs remain in default state
 */
const highlightJoinCascade = (targetNode, isHovering) => {
  // Collect all leaf nodes under the target node (these correspond to table rows)
  const leafNodes = [];
  const collectLeafNodes = (node) => {
    if (!node[2]) {
      leafNodes.push(node);
    } else {
      collectLeafNodes(node[2][0]);
      collectLeafNodes(node[2][1]);
    }
  };
  collectLeafNodes(targetNode);

  // Get all rows in the table
  const calcbody = document.getElementById('calcbody');
  if (!calcbody) return;

  const rows = calcbody.querySelectorAll('tr');

  // Collect all leaf nodes in order to map rows to nodes
  const allLeafNodes = [];
  const collectRowNodes = (node) => {
    if (!node[2]) {
      allLeafNodes.push(node);
    } else {
      collectRowNodes(node[2][0]);
      collectRowNodes(node[2][1]);
    }
  };
  collectRowNodes(rootSubnet);

  // Create a Set of target leaf node IDs for quick lookup
  const targetLeafIds = new Set(leafNodes.map(n => n[4]));

  // Find indices of rows that belong to target
  const targetRowIndices = new Set();
  allLeafNodes.forEach((node, index) => {
    if (targetLeafIds.has(node[4])) {
      targetRowIndices.add(index);
    }
  });

  // (a) Apply row highlighting to associated subnet rows
  rows.forEach((row, index) => {
    if (targetRowIndices.has(index)) {
      if (isHovering) {
        row.classList.add('join-highlight-row');
      } else {
        row.classList.remove('join-highlight-row');
      }
    }
  });

  // (b) Highlight children CIDR blocks (descendants only, not ancestors)
  // Collect all descendant node IDs of the target node (both internal and leaf nodes)
  const descendantIds = new Set();
  const collectDescendantIds = (node) => {
    descendantIds.add(node[4]); // Add the current node's ID
    if (node[2]) {
      collectDescendantIds(node[2][0]);
      collectDescendantIds(node[2][1]);
    }
  };
  collectDescendantIds(targetNode);
  // Remove the target node itself - we only want to highlight children, not the hovered cell
  descendantIds.delete(targetNode[4]);

  // Find all join cells and highlight those belonging to descendant nodes
  const joinCells = document.querySelectorAll('.maskSpanJoinable, .maskSpan');
  joinCells.forEach((cell) => {
    const cellNodeId = parseInt(cell.dataset.nodeId, 10);
    if (!isNaN(cellNodeId) && descendantIds.has(cellNodeId)) {
      if (isHovering) {
        cell.classList.add('join-highlight');
      } else {
        cell.classList.remove('join-highlight');
      }
    }
  });
};

// Update the number of visible leaf children for each node
const updateNumChildren = (node) => {
  if (!node[2]) {
    node[1] = 0;
    return 1;
  }
  node[1] = updateNumChildren(node[2][0]) + updateNumChildren(node[2][1]);
  return node[1];
};

// Update the depth (maximum depth of children tree) for each node
const updateDepthChildren = (node) => {
  if (!node[2]) {
    node[0] = 0;
    return 1;
  }
  node[0] = updateDepthChildren(node[2][0]) + updateDepthChildren(node[2][1]);
  return node[1];
};

/**
 * Serialization for Bookmarking
 */

// Serialize subnet tree to binary string (0=leaf, 1=internal)
const nodeToString = (node) => node[2] ? `1${nodeToString(node[2][0])}${nodeToString(node[2][1])}` : '0';

// Collect all remarks from leaf nodes in tree order
const collectRemarks = (node) => {
  if (node[2]) {
    return collectRemarks(node[2][0]) + collectRemarks(node[2][1]);
  }
  return node[3] ? encodeURIComponent(node[3]) + ',' : ',';
};

// Apply remarks to leaf nodes in tree order
const applyRemarks = (node, remarks) => {
  if (node[2]) {
    const remaining = applyRemarks(node[2][0], remarks);
    return applyRemarks(node[2][1], remaining);
  }
  if (remarks.length > 0) {
    const remark = remarks.shift();
    node[3] = remark ? decodeURIComponent(remark) : '';
  }
  return remarks;
};

// Encode binary string to compact ASCII representation
const binToAscii = (str) => {
  let out = '';
  let char = 0;
  let bit = 0;

  for (const ch of str) {
    if (ch === '1') char |= 1 << bit;
    bit++;
    if (bit > 3) {
      out += char.toString(16);
      char = 0;
      bit = 0;
    }
  }
  if (bit > 0) out += char.toString(16);

  return `${str.length}.${out}`;
};

// Decode ASCII representation back to binary string
const asciiToBin = (str) => {
  const match = str.match(/([0-9]+)\.([0-9a-f]+)/);
  if (!match) return '0';

  const len = parseInt(match[1], 10);
  const encoded = match[2];
  let out = '';

  for (let i = 0; i < len; i++) {
    const ch = parseInt(encoded.charAt(Math.floor(i / 4)), 16);
    const pos = i % 4;
    out += (ch & (1 << pos)) ? '1' : '0';
  }
  return out;
};

// Load subnet tree from binary string
const loadNode = (curNode, division) => {
  if (division.charAt(0) === '0') return division.slice(1);

  curNode[2] = [createNode(), createNode()];
  let remaining = loadNode(curNode[2][0], division.slice(1));
  remaining = loadNode(curNode[2][1], remaining);
  return remaining;
};

// Update remark for a node
const updateNodeRemark = (node, remark) => {
  node[3] = remark;
  // Update the bookmark link after remark change
  updateSaveLink();
};

// Serialize column visibility to compact binary string
const serializeColumnVisibility = () => {
  const columns = ['subnet', 'netmask', 'range', 'useable', 'hosts', 'remark', 'divide', 'join'];
  let binary = '';
  columns.forEach(col => {
    binary += visibleColumns[col] ? '1' : '0';
  });
  // Convert binary to hex for shorter URL
  const hex = parseInt(binary, 2).toString(16).padStart(2, '0');
  return hex;
};

// Deserialize and apply column visibility from hex string
const deserializeColumnVisibility = (hex) => {
  const columns = ['subnet', 'netmask', 'range', 'useable', 'hosts', 'remark', 'divide', 'join'];
  const binary = parseInt(hex, 16).toString(2).padStart(8, '0');
  columns.forEach((col, index) => {
    visibleColumns[col] = binary[index] === '1';
    // Update checkbox state
    const checkbox = document.getElementById(`cb_${col}`);
    if (checkbox) {
      checkbox.checked = visibleColumns[col];
    }
  });
};

// Update just the bookmark link without full table recreation
const updateSaveLink = () => {
  const saveLink = document.getElementById('saveLink');
  if (saveLink) {
    const remarks = collectRemarks(rootSubnet);
    const cols = serializeColumnVisibility();
    const form = document.forms.calc;
    const reserveFront = form.elements.reserve_front?.value || '1';
    const reserveEnd = form.elements.reserve_end?.value || '1';
    const networkName = form.elements.network_name?.value || '';
    const encodedNetworkName = networkName ? encodeURIComponent(networkName) : '';
    saveLink.href = `index.html?network=${inetNtoa(curNetwork)}&mask=${curMask}&division=${binToAscii(nodeToString(rootSubnet))}&remarks=${remarks}&cols=${cols}&rf=${reserveFront}&re=${reserveEnd}&name=${encodedNetworkName}`;
  }
};

/**
 * Query String Parsing
 */

const parseQueryString = (str) => {
  const query = str ? str : location.search;
  const queryPart = query.charAt(0) === '?' ? query.substring(1) : query;
  const args = {};

  if (queryPart) {
    queryPart.split('&').forEach(field => {
      const [key, value] = field.split('=');
      args[decodeURIComponent(key.replace(/\+/g, ' '))] =
        decodeURIComponent((value || '').replace(/\+/g, ' '));
    });
  }
  return args;
};

/**
 * UI Update Functions
 */

const updateNetwork = () => {
  const form = document.forms.calc;
  const newNetworkStr = form.elements.network.value;
  const newMask = parseInt(form.elements.netbits.value, 10);
  const newNetwork = inetAton(newNetworkStr);

  if (newNetwork === null) {
    alert('Invalid network address entered');
    return;
  }

  const tmpNetwork = networkAddress(newNetwork, newMask);
  if (newNetwork !== tmpNetwork) {
    alert(`The network address entered is not on a network boundary for this mask.\nIt has been changed to ${inetNtoa(tmpNetwork)}.`);
    form.elements.network.value = inetNtoa(tmpNetwork);
  }

  if (newMask < 0 || newMask > 32) {
    alert('The network mask you have entered is invalid');
    return;
  }

  if (curMask === 0) {
    curMask = newMask;
    curNetwork = tmpNetwork;
    startOver();
  } else if (curMask !== newMask && confirm(`You are changing the base network from /${curMask} to /${newMask}. This will reset any changes you have made. Proceed?`)) {
    curMask = newMask;
    curNetwork = tmpNetwork;
    startOver();
  } else {
    form.elements.netbits.value = curMask;
    curNetwork = tmpNetwork;
    recreateTables();
  }
};

const startOver = () => {
  rootSubnet = createNode();
  recreateTables();
};

const recreateTables = () => {
  // Update header visibility
  Object.keys(visibleColumns).forEach(name => {
    const header = document.getElementById(`${name}Header`);
    if (header) header.style.display = visibleColumns[name] ? 'table-cell' : 'none';
  });

  const calcbody = document.getElementById('calcbody');
  if (!calcbody) {
    alert('Body not found');
    return;
  }

  // Clear existing rows
  while (calcbody.firstChild) {
    calcbody.removeChild(calcbody.firstChild);
  }

  updateNumChildren(rootSubnet);
  updateDepthChildren(rootSubnet);

  createRow(calcbody, rootSubnet, curNetwork, curMask, [curMask, rootSubnet[1], rootSubnet], rootSubnet[0]);

  const joinHeader = document.getElementById('joinHeader');
  if (joinHeader) joinHeader.colSpan = rootSubnet[0] > 0 ? rootSubnet[0] : 1;

  // Update bookmark link
  updateSaveLink();
};

const createRow = (calcbody, node, address, mask, labels, depth) => {
  if (node[2]) {
    // Internal node - recurse to children
    const [leftChild, rightChild] = node[2];

    // Process left child
    const leftLabels = [...labels, mask + 1, leftChild[1], leftChild];
    createRow(calcbody, leftChild, address, mask + 1, leftLabels, depth - 1);

    // Process right child
    const rightLabels = [mask + 1, rightChild[1], rightChild];
    createRow(calcbody, rightChild, address + subnetAddresses(mask + 1), mask + 1, rightLabels, depth - 1);
  } else {
    // Leaf node - create table row
    const row = document.createElement('tr');
    calcbody.appendChild(row);

    // Get reserve counts from form
    const form = document.forms.calc;
    const reserveFront = parseInt(form.elements.reserve_front?.value || '1', 10) || 0;
    const reserveEnd = parseInt(form.elements.reserve_end?.value || '1', 10) || 0;

    // Calculate address ranges
    const addressFirst = address;
    const addressLast = subnetLastAddress(address, mask);
    const useableFirst = address + reserveFront;
    const useableLast = addressLast - reserveEnd;

    let addressRange, useableRange, numHosts;

    if (mask === 32) {
      addressRange = inetNtoa(addressFirst);
      useableRange = 'N/A';
      numHosts = 0;
    } else if (mask === 31) {
      addressRange = `${inetNtoa(addressFirst)} - ${inetNtoa(addressLast)}`;
      useableRange = 'N/A';
      numHosts = 0;
    } else {
      addressRange = `${inetNtoa(addressFirst)} - ${inetNtoa(addressLast)}`;
      if (useableFirst > useableLast) {
        useableRange = 'N/A';
        numHosts = 0;
      } else {
        if (useableFirst === useableLast) {
          useableRange = inetNtoa(useableFirst);
        } else {
          useableRange = `${inetNtoa(useableFirst)} - ${inetNtoa(useableLast)}`;
        }
        numHosts = useableLast - useableFirst + 1;
      }
    }

    // Subnet address cell
    if (visibleColumns.subnet) {
      const cell = document.createElement('td');
      cell.textContent = `${inetNtoa(address)}/${mask}`;
      row.appendChild(cell);
    }

    // Netmask cell
    if (visibleColumns.netmask) {
      const cell = document.createElement('td');
      cell.textContent = inetNtoa(subnetNetmask(mask));
      row.appendChild(cell);
    }

    // Range of addresses cell
    if (visibleColumns.range) {
      const cell = document.createElement('td');
      cell.textContent = addressRange;
      row.appendChild(cell);
    }

    // Useable addresses cell
    if (visibleColumns.useable) {
      const cell = document.createElement('td');
      cell.textContent = useableRange;
      row.appendChild(cell);
    }

    // Hosts cell
    if (visibleColumns.hosts) {
      const cell = document.createElement('td');
      cell.textContent = numHosts;
      row.appendChild(cell);
    }

    // Remark cell
    if (visibleColumns.remark) {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = node[3] || '';
      input.style.width = '200px';
      input.placeholder = 'Add remark...';
      input.onchange = () => updateNodeRemark(node, input.value);
      cell.appendChild(input);
      row.appendChild(cell);
    }

    // Divide action cell
    if (visibleColumns.divide) {
      const cell = document.createElement('td');
      row.appendChild(cell);

      if (mask === 32) {
        const span = document.createElement('span');
        span.className = 'disabledAction';
        span.textContent = 'Divide';
        cell.appendChild(span);
      } else {
        const link = document.createElement('a');
        link.href = '#';
        link.onclick = () => { divideNode(node); recreateTables(); return false; };
        link.textContent = 'Divide';
        cell.appendChild(link);
      }
    }

    // Join cells
    if (visibleColumns.join) {
      let colspan = depth - node[0];

      for (let i = (labels.length / 3) - 1; i >= 0; i--) {
        const labelMask = labels[i * 3];
        const rowspan = labels[i * 3 + 1];
        const targetNode = labels[i * 3 + 2];

        const cell = document.createElement('td');
        cell.rowSpan = rowspan > 1 ? rowspan : 1;
        cell.colSpan = colspan > 1 ? colspan : 1;
        cell.className = i === (labels.length / 3) - 1 ? 'maskSpan' : 'maskSpanJoinable';

        // Add data attributes for hover highlighting
        if (i !== (labels.length / 3) - 1) {
          cell.onclick = () => { joinNode(targetNode); recreateTables(); };
          cell.onmouseenter = () => highlightJoinCascade(targetNode, true);
          cell.onmouseleave = () => highlightJoinCascade(targetNode, false);
        }
        // Store node ID for relationship tracking
        cell.dataset.nodeId = targetNode[4];

        cell.textContent = `/${labelMask}`;
        row.appendChild(cell);

        colspan = 1; // Reset for subsequent cells
      }
    }
  }
};

const toggleColumn = (checkbox) => {
  const colName = checkbox.id.slice(3);
  visibleColumns[colName] = checkbox.checked;
  recreateTables();
};

const calcOnLoad = () => {
  const args = parseQueryString();

  if (args.network && args.mask && args.division) {
    document.forms.calc.elements.network.value = args.network;
    document.forms.calc.elements.netbits.value = args.mask;

    // Load column visibility if present
    if (args.cols) {
      deserializeColumnVisibility(args.cols);
    }

    // Load reserve values if present
    if (args.rf) {
      document.forms.calc.elements.reserve_front.value = args.rf;
    }
    if (args.re) {
      document.forms.calc.elements.reserve_end.value = args.re;
    }

    // Load network name if present
    if (args.name) {
      document.forms.calc.elements.network_name.value = decodeURIComponent(args.name);
    }

    updateNetwork();

    const division = asciiToBin(args.division);
    rootSubnet = createNode();
    if (division !== '0') {
      loadNode(rootSubnet, division);
    }

    // Load remarks if present
    if (args.remarks) {
      const remarkList = args.remarks.split(',');
      applyRemarks(rootSubnet, remarkList);
    }

    recreateTables();
  } else {
    updateNetwork();
  }
};

window.onload = calcOnLoad;

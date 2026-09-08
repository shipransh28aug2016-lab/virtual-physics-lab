export * from './graph';
export { solveCircuit, type CircuitSolution } from './solve';
export {
  addWire,
  clearTerminal,
  decodeWires,
  encodeWires,
  isConnected,
  removeWire,
  wireKey,
  wiresAt
} from './encode';
export {
  detectFaults,
  isMeasurable,
  externalResistance,
  totalResistance,
  type Fault,
  type FaultKind,
  type FaultSeverity
} from './faults';

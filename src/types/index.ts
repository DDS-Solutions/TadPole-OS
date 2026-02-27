import type { OpenClawModelConfig } from './openclaw';
import type { Mission } from './mission';
export type { Mission };

/**
 * Represents an AI Agent within the Tadpole OS ecosystem.
 * Agents are the primary entities that perform tasks and interact with the system.
 */
export interface Agent {
  /** Unique identifier for the agent */
  id: string;
  /** Display name of the agent */
  name: string;
  /**
   * Functional role of the agent (e.g., 'CEO', 'Backend Dev').
   * Used for visual distinction and grouping.
   */
  role: string;
  department: Department;
  /** Current operational status of the agent (Tadpole extended status) */
  status: AgentStatus;
  /** Total tokens consumed by this agent in the current session */
  tokensUsed: number;
  /** Description of the task currently being executed, if any */
  currentTask?: string;
  /** Primary Model ID (Legacy string for UI) */
  model: string;
  /** Secondary Model ID (Legacy) */
  model2?: string;
  /** Tertiary Model ID (Legacy) */
  model3?: string;
  /** OpenClaw Model Configuration (Strict Schema) */
  modelConfig?: OpenClawModelConfig;
  /** Secondary Model Configuration (Strict Schema) */
  modelConfig2?: OpenClawModelConfig;
  /** Tertiary Model Configuration (Strict Schema) */
  modelConfig3?: OpenClawModelConfig;
  /** ID of the agent this agent reports to (for org chart) */
  reportsTo?: string;
  /** List of available atomic capabilities (e.g., 'Search', 'Read File') */
  capabilities?: string[];
  /** List of available workflows (e.g., 'Deploy', 'Audit') */
  workflows?: string[];
  /** Currently running workflow (if any) */
  activeWorkflow?: string;
  /** OpenClaw Workspace Path */
  workspacePath?: string;
  /** Currently running mission (Option C: Workspace-centric) */
  activeMission?: Mission;
  activeModelSlot?: 1 | 2 | 3;
  /** UI Extension: Custom theme color (HEX) */
  themeColor?: string;
  /** Primary budget limit for this agent (USD) */
  budgetUsd?: number;
  /** Current total cost accrued by this agent (USD) */
  costUsd?: number;
}

/**
 * Represents a unit of work assigned to an agent.
 */
export interface Task {
  /** Unique identifier for the task */
  id: string;
  /** Title or short description of the task */
  title: string;
  /** ID of the agent assigned to this task */
  assignedTo: string;
  /** Current execution status of the task */
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  /** Priority level of the task */
  priority: 'low' | 'medium' | 'high';
  /** ISO timestamp of creation */
  createdAt: string;
  /** History of activity logs related to this task */
  logs: string[];
}

/**
 * Configuration updates for an agent.
 */
export interface AgentConfig {
  name?: string;
  role?: string;
  department?: Department;
  description?: string;
  modelId?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  temperature?: number;
  skills?: string[];
  workflows?: string[];
  themeColor?: string;
  budgetUsd?: number;
  externalId?: string;
  activeModelSlot?: 1 | 2 | 3;
  modelConfig2?: OpenClawModelConfig;
  modelConfig3?: OpenClawModelConfig;
}

/**
 * Payload for sending a command/task to an agent.
 */
export interface TaskPayload {
  message: string;
  clusterId?: string;
  department?: string;
  provider?: string;
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
  rpm?: number;
  tpm?: number;
  rpd?: number;
  tpd?: number;
  budgetUsd?: number;
  externalId?: string;
  safeMode?: boolean;
}

export type Department = 'Executive' | 'Engineering' | 'Marketing' | 'Sales' | 'Product' | 'Operations' | 'Quality Assurance' | 'Design' | 'Research' | 'Support';

/** Operational status of an agent. */
export type AgentStatus = 'idle' | 'working' | 'active' | 'thinking' | 'speaking' | 'coding' | 'paused' | 'offline';


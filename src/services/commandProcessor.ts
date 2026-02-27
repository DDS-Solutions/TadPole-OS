/**
 * @module CommandProcessor
 * Parses and executes slash-commands entered in the Terminal.
 * Routes commands to the appropriate service (EventBus, OpenClawService)
 * and emits feedback to the unified log stream.
 *
 * Supported commands:
 *   /help              — List all available commands
 *   /clear             — Clear the terminal log
 *   /status            — Show current agent swarm status
 *   /deploy            — Trigger a deployment simulation
 *   /config <agentId>  — Show an agent's current config
 *   /pause <agentId>   — Pause a running agent
 *   /resume <agentId>  — Resume a paused agent
 *   /send <agentId> <msg> — Inject a message into an agent's context
 */
import { EventBus } from './eventBus';
import { OpenClawService } from './openclawService';
import { useWorkspaceStore } from './workspaceStore';
import { useSovereignStore } from './sovereignStore';
import type { Agent } from '../types';

/** Return value from processCommand indicating if the log should be cleared. */
export interface CommandResult {
    /** If true, the Terminal should wipe its local log state. */
    shouldClearLogs: boolean;
}

/**
 * Processes a single slash-command string.
 * @param commandText - The raw input from the Terminal (e.g. "/pause agent-1")
 * @param agents - The current agent list for lookups
 * @returns A {@link CommandResult} with side-effect flags
 */
export async function processCommand(
    commandText: string,
    agents: Agent[],
    isSafeMode?: boolean
): Promise<CommandResult> {
    // Regex to split by spaces but keep quoted strings together
    const parts: string[] = [];
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    let match;
    while ((match = regex.exec(commandText)) !== null) {
        parts.push(match[1] || match[2] || match[0]);
    }

    if (parts.length === 0) return { shouldClearLogs: false };
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Build O(1) lookup indexes for agent resolution (name + id + partial match)
    const agentByName = new Map<string, Agent>();
    const agentById = new Map<string, Agent>();
    for (const a of agents) {
        agentByName.set(a.name.toLowerCase(), a);
        agentById.set(String(a.id), a);
    }
    /**
     * Resolves an agent by exact name, partial name, or ID.
     * Emits an error to the EventBus if unresolvable.
     */
    const findAgent = (nameOrId: string | undefined): Agent | null => {
        if (!nameOrId) {
            EventBus.emit({ source: 'System', text: 'Missing agent name. Usage: /<command> <agent-name>', severity: 'error' });
            return null;
        }
        const lower = nameOrId.toLowerCase();
        const found = agentByName.get(lower)
            || agentById.get(nameOrId)
            || agents.find(a => a.name.toLowerCase().includes(lower)); // partial match fallback
        if (!found) {
            EventBus.emit({ source: 'System', text: `Agent "${nameOrId}" not found. Available: ${agents.map(a => a.name).slice(0, 8).join(', ')}...`, severity: 'error' });
            return null;
        }
        return found;
    };

    switch (cmd) {
        // ────────────── HELP ──────────────
        case '/help': {
            EventBus.emit({
                source: 'System',
                text: [
                    '📋 Available Commands:',
                    '  /help              — Show this list',
                    '  /clear             — Clear terminal',
                    '  /status            — Agent swarm summary',
                    '  /deploy            — Trigger deploy simulation',
                    '  /config <name>     — View agent config',
                    '  /switch <name> [1-3] — Switch active model slot',
                    '  /pause <name>      — Pause an agent',
                    '  /resume <name>     — Resume an agent',
                    '  /send <name> <msg> — Inject message to agent',
                    '  /swarm status      — Show mission clusters',
                    '  /swarm optimize    — Trigger reconfiguration',
                ].join('\n'),
                severity: 'info'
            });
            return { shouldClearLogs: false };
        }

        // ────────────── CLEAR ──────────────
        case '/clear': {
            EventBus.clearHistory();
            return { shouldClearLogs: true };
        }

        // ────────────── STATUS ──────────────
        case '/status': {
            const active = agents.filter(a => a.status === 'active' || a.status === 'thinking' || a.status === 'coding').length;
            const idle = agents.filter(a => a.status === 'idle').length;
            const offline = agents.filter(a => a.status === 'offline').length;
            const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

            EventBus.emit({
                source: 'System',
                text: `Swarm Status: ${active} active · ${idle} idle · ${offline} offline | Total tokens: ${(totalTokens / 1000).toFixed(1)}k`,
                severity: 'success'
            });
            return { shouldClearLogs: false };
        }

        // ────────────── DEPLOY (2-step confirmation) ──────────────
        case '/deploy': {
            if (args[0]?.toLowerCase() !== 'confirm') {
                EventBus.emit({
                    source: 'System',
                    text: '⚠️ This will trigger a production deployment. Type "/deploy confirm" to proceed.',
                    severity: 'warning'
                });
                return { shouldClearLogs: false };
            }

            EventBus.emit({
                source: 'System',
                text: '🚀 Triggering deployment to Swarm Bunker via /engine/deploy...',
                severity: 'warning'
            });

            try {
                const { getSettings } = await import('./settingsStore');
                const token = getSettings().openClawApiKey || '';

                const res = await fetch(`${getSettings().openClawUrl}/engine/deploy`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                if (res.ok) {
                    EventBus.emit({
                        source: 'System',
                        text: `✅ Deployment successful. Output: ${(data.output || '').substring(0, 300)}`,
                        severity: 'success'
                    });
                } else {
                    EventBus.emit({
                        source: 'System',
                        text: `❌ Deployment failed: ${data.error || 'Unknown error'}`,
                        severity: 'error'
                    });
                }
            } catch (e) {
                EventBus.emit({
                    source: 'System',
                    text: `❌ Deployment error: ${e}`,
                    severity: 'error'
                });
            }
            return { shouldClearLogs: false };
        }


        // ────────────── CONFIG ──────────────
        case '/config': {
            const agent = findAgent(args[0]);
            if (!agent) return { shouldClearLogs: false };

            EventBus.emit({
                source: 'System',
                text: [
                    `⚙️ Config for ${agent.name}:`,
                    `  Model: ${agent.model}`,
                    `  Temperature: ${agent.modelConfig?.temperature ?? 'default'}`,
                    `  Status: ${agent.status}`,
                    `  Prompt: ${agent.modelConfig?.systemPrompt ? agent.modelConfig.systemPrompt.substring(0, 80) + '...' : '(none)'}`,
                ].join('\n'),
                severity: 'info'
            });
            return { shouldClearLogs: false };
        }

        // ────────────── PAUSE ──────────────
        case '/pause': {
            const agent = findAgent(args[0]);
            if (!agent) return { shouldClearLogs: false };

            const success = await OpenClawService.pauseAgent(agent.id);
            EventBus.emit({
                source: 'System',
                text: success
                    ? `⏸️ Agent ${agent.name} paused via OpenClaw.`
                    : `⏸️ Agent ${agent.name} paused locally (OpenClaw offline).`,
                severity: 'warning'
            });
            return { shouldClearLogs: false };
        }

        // ────────────── RESUME ──────────────
        case '/resume': {
            const agent = findAgent(args[0]);
            if (!agent) return { shouldClearLogs: false };

            const success = await OpenClawService.resumeAgent(agent.id);
            EventBus.emit({
                source: 'System',
                text: success
                    ? `▶️ Agent ${agent.name} resumed via OpenClaw.`
                    : `▶️ Agent ${agent.name} resumed locally (OpenClaw offline).`,
                severity: 'success'
            });
            return { shouldClearLogs: false };
        }

        // ────────────── SEND (sanitized) ──────────────
        case '/send': {
            const agent = findAgent(args[0]);
            if (!agent) return { shouldClearLogs: false };

            const MAX_MSG_LENGTH = 500;
            let message = args.slice(1).join(' ');
            if (!message) {
                EventBus.emit({
                    source: 'System',
                    text: 'Usage: /send <agent-name> <message>',
                    severity: 'error'
                });
                return { shouldClearLogs: false };
            }

            // Sanitize: strip control characters and enforce length limit
            // eslint-disable-next-line no-control-regex
            message = message.replace(/[\x00-\x1F\x7F]/g, '').trim();
            if (message.length > MAX_MSG_LENGTH) {
                EventBus.emit({
                    source: 'System',
                    text: `Message exceeds ${MAX_MSG_LENGTH} character limit (${message.length} chars). Please shorten it.`,
                    severity: 'error'
                });
                return { shouldClearLogs: false };
            }

            await OpenClawService.sendCommand(agent.id, message, undefined, undefined, undefined, undefined, undefined, undefined, isSafeMode);
            EventBus.emit({
                source: 'User',
                text: `→ ${agent.name}: ${message}`,
                severity: 'info'
            });
            // Simulate agent acknowledgment
            setTimeout(() => {
                EventBus.emit({
                    source: 'Agent',
                    agentId: agent.name,
                    text: `Received. Processing instruction...`,
                    severity: 'info'
                });
            }, 600);
            return { shouldClearLogs: false };
        }

        // ────────────── SWARM ──────────────
        case '/swarm': {
            const workspaceStore = useWorkspaceStore.getState();
            const subCmd = args[0]?.toLowerCase();

            if (subCmd === 'status') {
                const clusterInfo = workspaceStore.clusters.map(c =>
                    `🔹 ${c.name} [${c.theme.toUpperCase()}]\n` +
                    `  Alpha: ${agents.find(a => a.id === c.alphaId)?.name || 'NONE'}\n` +
                    `  Objective: ${c.objective || 'No objective set'}\n` +
                    `  Collaborators: ${c.collaborators.length}`
                ).join('\n\n');

                EventBus.emit({
                    source: 'System',
                    text: `🌐 Mission Cluster Inventory:\n\n${clusterInfo}`,
                    severity: 'info'
                });
            } else if (subCmd === 'optimize') {
                EventBus.emit({
                    source: 'System',
                    text: '⚡ Initiating global swarm optimization...',
                    severity: 'warning'
                });

                workspaceStore.clusters.forEach(cluster => {
                    workspaceStore.generateProposal(cluster.id);
                    const proposal = useWorkspaceStore.getState().activeProposals[cluster.id];

                    if (proposal) {
                        setTimeout(() => {
                            EventBus.emit({
                                source: 'Agent',
                                agentId: agents.find(a => a.id === cluster.alphaId)?.name || 'Alpha Node',
                                text: proposal.reasoning,
                                severity: 'info'
                            });
                        }, 500 + Math.random() * 1000);
                    }
                });
            } else {
                EventBus.emit({
                    source: 'System',
                    text: 'Usage: /swarm <status|optimize>',
                    severity: 'error'
                });
            }
            return { shouldClearLogs: false };
        }

        // ────────────── SWITCH ──────────────
        case '/switch': {
            const agent = findAgent(args[0]);
            const slotStr = args[1];
            if (agent && slotStr) {
                const slot = parseInt(slotStr) as 1 | 2 | 3;
                if (slot >= 1 && slot <= 3) {
                    await OpenClawService.updateAgent(agent.id, { activeModelSlot: slot });
                    EventBus.emit({
                        source: 'System',
                        text: `Agent ${agent.name} switched to Neural Slot ${slot}.`,
                        severity: 'success'
                    });
                } else {
                    EventBus.emit({ source: 'System', text: 'Invalid slot. Use 1, 2, or 3.', severity: 'error' });
                }
            } else {
                EventBus.emit({ source: 'System', text: 'Usage: /switch <agent-name> <1|2|3>', severity: 'error' });
            }
            return { shouldClearLogs: false };
        }

        // ────────────── UNKNOWN ──────────────
        default: {
            // Check for conversational targeting
            if (cmd.startsWith('@')) {
                const targetName = cmd.substring(1);
                const agent = findAgent(targetName);
                if (agent) {
                    const message = args.join(' ');
                    await OpenClawService.sendCommand(agent.id, message, undefined, undefined, undefined, undefined, undefined, undefined, isSafeMode);
                    // Simulate agent acknowledgment
                    setTimeout(() => {
                        const reply = `Acknowledged: ${message.substring(0, 30)}...`;
                        EventBus.emit({
                            source: 'Agent',
                            agentId: agent.name,
                            text: reply,
                            severity: 'info'
                        });
                        useSovereignStore.getState().addMessage({
                            senderId: agent.id,
                            senderName: agent.name,
                            text: reply,
                            scope: 'agent'
                        });
                    }, 600);
                }
                return { shouldClearLogs: false };
            } else if (cmd.startsWith('#')) {
                const clusterName = cmd.substring(1).toLowerCase();
                const workspaceStore = useWorkspaceStore.getState();
                const cluster = workspaceStore.clusters.find(c => c.name.toLowerCase() === clusterName || c.id === clusterName);
                if (cluster && cluster.alphaId) {
                    const message = args.join(' ');
                    const alphaAgent = agents.find(a => a.id === cluster.alphaId);
                    if (alphaAgent) {
                        await OpenClawService.sendCommand(alphaAgent.id, message, cluster.id, cluster.department, undefined, undefined, undefined, undefined, isSafeMode);
                        setTimeout(() => {
                            const reply = `[Cluster Command] Distributing task: ${message.substring(0, 30)}...`;
                            EventBus.emit({
                                source: 'Agent',
                                agentId: alphaAgent.name,
                                text: reply,
                                severity: 'info'
                            });
                            useSovereignStore.getState().addMessage({
                                senderId: alphaAgent.id,
                                senderName: alphaAgent.name,
                                targetNode: cluster.name, // Tag the message with the cluster it belongs to
                                text: reply,
                                scope: 'cluster'
                            });
                        }, 600);
                    }
                } else {
                    const errorMsg = `Cluster "${clusterName}" not found or lacks an Alpha node.`;
                    EventBus.emit({
                        source: 'System',
                        text: errorMsg,
                        severity: 'error'
                    });
                    useSovereignStore.getState().addMessage({
                        senderId: 'system',
                        senderName: 'Neural System',
                        targetNode: clusterName,
                        text: errorMsg,
                        scope: 'cluster'
                    });
                }
                return { shouldClearLogs: false };
            } else if (!cmd.startsWith('/')) {
                // If it doesn't start with a slash, @, or #, we assume it's a general swarm directive
                const message = parts.join(' ');
                const reply = `Broadcasting to swarm: ${message.substring(0, 30)}...`;
                EventBus.emit({
                    source: 'System',
                    text: reply,
                    severity: 'info'
                });
                useSovereignStore.getState().addMessage({
                    senderId: 'system',
                    senderName: 'Neural System',
                    text: reply,
                    scope: 'swarm'
                });
                return { shouldClearLogs: false };
            }

            EventBus.emit({
                source: 'System',
                text: `Unknown command: ${cmd}. Type /help for available commands.`,
                severity: 'error'
            });
            return { shouldClearLogs: false };
        }
    }
}

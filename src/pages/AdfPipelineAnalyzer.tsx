import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { toPng } from 'html-to-image'
import { COMPREHENSIVE_SAMPLE } from './AdfPipelineHelperSample'
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    type Node,
    type Edge,
    Position,
    Handle
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { FileJson, Copy, Download, AlertCircle, AlertTriangle, Info, CheckCircle2, Network, TrendingUp, GitBranch, Minimize2, Maximize2, Camera, X, Activity, Zap, Shield, Search, Database, Repeat, RefreshCw, Play, Terminal, Globe, Variable, Timer, CheckCircle, Workflow, Link2, List, Upload, Coins, PieChart, type LucideIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { CodeEditor } from '../components/ui/code-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'

interface Activity {
    name: string
    type: string
    dependsOn: { activity: string; conditions: string[] }[]
    description?: string
    typeProperties?: any
    policy?: any
    linkedServiceName?: { referenceName: string; type: string }
    userProperties?: { name: string; value: any }[]
}

interface PipelineMetadata {
    name: string
    description: string
    activities: Activity[]
    parameters: Record<string, any>
    variables: Record<string, any>
    linkedServices: Set<string>
    datasets: Set<string>
    childPipelines: Set<string>
    errors: string[]
}

interface ValidationIssue {
    severity: 'critical' | 'warning' | 'recommendation'
    category: string
    message: string
    activityName?: string
}

interface DependencyAnalysis {
    circularDependencies: string[][]
    criticalPath: string[]
    parallelGroups: string[][]
    maxDepth: number
    orphanedActivities: string[]
}

// Helper to get Dagre (handle ESM/CJS interop)
const getDagre = () => {
    // @ts-ignore
    const d = dagre.default || dagre
    return d
}

const nodeWidth = 200
const nodeHeight = 60

// Layout algorithm using Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const d = getDagre()
    const dagreGraph = new d.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    const isHorizontal = direction === 'LR'
    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 150,
        nodesep: 200
    })

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    d.layout(dagreGraph)

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        node.targetPosition = isHorizontal ? Position.Left : Position.Top
        node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom

        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        }

        return node
    })

    return { nodes, edges }
}


const generateCsvDocumentation = (metadata: PipelineMetadata): string => {
    if (!metadata) return '';

    const lines: string[] = [];
    const escapeCSV = (val: any) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // Header
    lines.push(`Pipeline Name,${escapeCSV(metadata.name)}`);
    lines.push(`Description,${escapeCSV(metadata.description)}`);
    lines.push('');

    // Parameters Section
    lines.push('=== PARAMETERS ===');
    lines.push('Name,Type,Default Value');
    Object.entries(metadata.parameters).forEach(([name, details]) => {
        lines.push(`${escapeCSV(name)},${escapeCSV(details.type)},${escapeCSV(JSON.stringify(details.defaultValue))}`);
    });
    lines.push('');

    // Variables Section
    lines.push('=== VARIABLES ===');
    lines.push('Name,Type');
    Object.entries(metadata.variables).forEach(([name, details]) => {
        lines.push(`${escapeCSV(name)},${escapeCSV(details.type)}`);
    });
    lines.push('');

    // Activities Section
    lines.push('=== ACTIVITIES ===');
    lines.push('Name,Type,Description,Linked Service,Dependencies,Timeout,Retry');
    metadata.activities.forEach(activity => {
        const deps = activity.dependsOn?.map(d => `${d.activity}(${d.conditions.join('/')})`).join('; ') || '';
        lines.push([
            escapeCSV(activity.name),
            escapeCSV(activity.type),
            escapeCSV(activity.description || ''),
            escapeCSV(activity.linkedServiceName?.referenceName || ''),
            escapeCSV(deps),
            escapeCSV(activity.policy?.timeout || ''),
            escapeCSV(activity.policy?.retry || '')
        ].join(','));
    });

    return lines.join('\n');
}

// Activity type to color and icon mapping
const getActivityColor = (type: string): { bg: string; border: string } => {
    const typeKey = type.toLowerCase()
    if (typeKey.includes('copy')) return { bg: '#3b82f6', border: '#2563eb' } // Blue
    if (typeKey.includes('lookup') || typeKey.includes('getmetadata')) return { bg: '#10b981', border: '#059669' } // Green
    if (typeKey.includes('foreach') || typeKey.includes('ifcondition') || typeKey.includes('until')) return { bg: '#8b5cf6', border: '#7c3aed' } // Purple
    if (typeKey.includes('executepipeline')) return { bg: '#f97316', border: '#ea580c' } // Orange
    if (typeKey.includes('storedprocedure') || typeKey.includes('script')) return { bg: '#ef4444', border: '#dc2626' } // Red
    if (typeKey.includes('web') || typeKey.includes('webhook')) return { bg: '#14b8a6', border: '#0d9488' } // Teal
    if (typeKey.includes('setvariable') || typeKey.includes('appendvariable')) return { bg: '#eab308', border: '#ca8a04' } // Yellow
    if (typeKey.includes('wait') || typeKey.includes('validation')) return { bg: '#6b7280', border: '#4b5563' } // Gray
    if (typeKey.includes('dataflow')) return { bg: '#ec4899', border: '#db2777' } // Pink for DataFlow
    return { bg: '#64748b', border: '#475569' } // Default slate
}

// Get appropriate icon for activity type
const getActivityIcon = (type: string): LucideIcon => {
    const typeKey = type.toLowerCase()
    if (typeKey.includes('copy')) return Copy
    if (typeKey.includes('lookup')) return Search
    if (typeKey.includes('getmetadata')) return Database
    if (typeKey.includes('foreach')) return Repeat
    if (typeKey.includes('ifcondition')) return GitBranch
    if (typeKey.includes('until')) return RefreshCw
    if (typeKey.includes('executepipeline')) return Play
    if (typeKey.includes('storedprocedure') || typeKey.includes('script')) return Terminal
    if (typeKey.includes('web') || typeKey.includes('webhook')) return Globe
    if (typeKey.includes('setvariable') || typeKey.includes('appendvariable')) return Variable
    if (typeKey.includes('wait')) return Timer
    if (typeKey.includes('validation')) return CheckCircle
    if (typeKey.includes('dataflow')) return Workflow
    return Activity // Default
}

// Custom Activity Node Component
const ActivityNode = ({ data, sourcePosition = Position.Bottom, targetPosition = Position.Top }: { data: { label: string; type: string }, sourcePosition?: Position, targetPosition?: Position }) => {
    const colors = getActivityColor(data.type)
    const Icon = getActivityIcon(data.type)

    return (
        <div
            style={{
                background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.border} 100%)`,
                border: `2px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '12px 16px',
                width: nodeWidth,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                position: 'relative',
            }}
        >
            <Handle type="target" position={targetPosition} style={{ background: '#555' }} />
            <div
                style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {data.label}
                </div>
                <div
                    style={{
                        color: 'rgba(255,255,255,0.75)',
                        fontSize: '9px',
                        fontWeight: 500,
                        marginTop: '2px',
                    }}
                >
                    {data.type}
                </div>
            </div>
            <Handle type="source" position={sourcePosition} style={{ background: '#555' }} />
        </div>
    )
}

// Node types for React Flow
// Node types defined internally now


export default function AdfPipelineAnalyzer() {
    const [inputJson, setInputJson] = useState('')
    const [inputMode, setInputMode] = useState<'pipeline' | 'arm'>('pipeline')
    const [prettifiedJson, setPrettifiedJson] = useState('')
    const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'dependencies' | 'metrics' | 'validation' | 'documentation'>('overview')
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'recommendation'>('all')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [rfInstance, setRfInstance] = useState<any>(null)
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
    const [isExporting, setIsExporting] = useState(false)
    const graphRef = useRef<HTMLDivElement>(null)

    const nodeTypesMemo = useMemo(() => ({ activityNode: ActivityNode }), [])

    const extractNestedReferences = (activities: any[], result: PipelineMetadata) => {
        activities.forEach((act: any) => {
            if (act.linkedServiceName) {
                result.linkedServices.add(act.linkedServiceName.referenceName)
            }
            if (act.typeProperties) {
                const tp = act.typeProperties
                if (tp.source?.dataset) result.datasets.add(tp.source.dataset.referenceName)
                if (tp.sink?.dataset) result.datasets.add(tp.sink.dataset.referenceName)
                if (tp.dataset?.referenceName) result.datasets.add(tp.dataset.referenceName)

                // Check for Child Pipelines
                if (tp.pipeline?.referenceName) {
                    result.childPipelines.add(tp.pipeline.referenceName)
                }
            }
            if (act.inputs) {
                act.inputs.forEach((inp: any) => {
                    if (inp.referenceName) result.datasets.add(inp.referenceName)
                })
            }
            if (act.outputs) {
                act.outputs.forEach((out: any) => {
                    if (out.referenceName) result.datasets.add(out.referenceName)
                })
            }
        })
    }

    const parsePipelineFromARM = (json: any): any => {
        const resources = json.resources || []
        const pipelineResource = resources.find((r: any) => r.type === 'Microsoft.DataFactory/factories/pipelines')
        if (pipelineResource) {
            let name = pipelineResource.name || 'Unnamed'
            const nameMatch = name.match(/'\/?([^']+)'[)\]]?$/)
            if (nameMatch) {
                name = nameMatch[1].replace(/^\//, '')
            }
            return {
                name: name,
                properties: pipelineResource.properties
            }
        }
        return null
    }

    const metadata = useMemo<PipelineMetadata>(() => {
        const result: PipelineMetadata = {
            name: '',
            description: '',
            activities: [],
            parameters: {},
            variables: {},
            linkedServices: new Set(),
            datasets: new Set(),
            childPipelines: new Set(),
            errors: []
        }

        if (!inputJson.trim()) {
            return result
        }

        try {
            let parsed = JSON.parse(inputJson)

            // Auto-detect ARM template
            if (parsed.resources && Array.isArray(parsed.resources)) {
                const extracted = parsePipelineFromARM(parsed)
                if (extracted) {
                    parsed = extracted
                } else {
                    result.errors.push('No pipeline resource found in ARM template')
                    return result
                }
            }

            // Extract pipeline metadata
            if (parsed.name) {
                result.name = parsed.name
            }
            if (parsed.properties) {
                const props = parsed.properties

                // Description
                if (props.description) {
                    result.description = props.description
                }

                // Parameters
                if (props.parameters) {
                    result.parameters = props.parameters
                }

                // Variables
                if (props.variables) {
                    result.variables = props.variables
                }

                // Activities (enhanced extraction)
                if (props.activities && Array.isArray(props.activities)) {
                    result.activities = props.activities.map((act: any) => ({
                        name: act.name || 'Unnamed Activity',
                        type: act.type || 'Unknown',
                        dependsOn: act.dependsOn ? act.dependsOn.map((d: any) => ({
                            activity: d.activity || 'Unknown',
                            conditions: d.dependencyConditions || []
                        })) : [],
                        description: act.description,
                        typeProperties: act.typeProperties,
                        policy: act.policy,
                        linkedServiceName: act.linkedServiceName,
                        userProperties: act.userProperties
                    }))

                    // Extract linked services and datasets from activities
                    props.activities.forEach((act: any) => {
                        // Check for linked services
                        if (act.linkedServiceName) {
                            result.linkedServices.add(act.linkedServiceName.referenceName)
                        } else if (act.typeProperties && act.typeProperties.linkedServiceName) {
                            result.linkedServices.add(act.typeProperties.linkedServiceName.referenceName)
                        }

                        // Check for datasets in various activity types
                        if (act.typeProperties) {
                            const tp = act.typeProperties

                            // Copy activity
                            if (tp.source?.dataset) {
                                result.datasets.add(tp.source.dataset.referenceName)
                            }
                            if (tp.sink?.dataset) {
                                result.datasets.add(tp.sink.dataset.referenceName)
                            }

                            // Lookup/Get Metadata activities
                            if (tp.dataset?.referenceName) {
                                result.datasets.add(tp.dataset.referenceName)
                            }

                            // Check for Child Pipelines
                            if (tp.pipeline?.referenceName) {
                                result.childPipelines.add(tp.pipeline.referenceName)
                            }

                            // ForEach/IfCondition nested activities
                            if (tp.activities && Array.isArray(tp.activities)) {
                                extractNestedReferences(tp.activities, result)
                            }
                        }

                        // Direct inputs/outputs
                        if (act.inputs) {
                            act.inputs.forEach((inp: any) => {
                                if (inp.referenceName) result.datasets.add(inp.referenceName)
                            })
                        }
                        if (act.outputs) {
                            act.outputs.forEach((out: any) => {
                                if (out.referenceName) result.datasets.add(out.referenceName)
                            })
                        }
                    })
                }
            }

            // Prettify for display
            setPrettifiedJson(JSON.stringify(parsed, null, 2))

        } catch (err) {
            result.errors.push(err instanceof Error ? err.message : 'Invalid JSON')
        }

        return result
    }, [inputJson])



    // DEPENDENCY ANALYSIS
    const dependencyAnalysis = useMemo<DependencyAnalysis>(() => {
        const result: DependencyAnalysis = {
            circularDependencies: [],
            criticalPath: [],
            parallelGroups: [],
            maxDepth: 0,
            orphanedActivities: []
        }

        if (metadata.activities.length === 0) {
            return result
        }

        const activityMap = new Map(metadata.activities.map(a => [a.name, a]))

        // 1. Detect circular dependencies using DFS
        const visited = new Set<string>()
        const recStack = new Set<string>()
        const cycles: string[][] = []

        const detectCycle = (activityName: string, path: string[]): boolean => {
            visited.add(activityName)
            recStack.add(activityName)
            path.push(activityName)

            const activity = activityMap.get(activityName)
            if (activity) {
                for (const dep of activity.dependsOn) {
                    if (!visited.has(dep.activity)) {
                        if (detectCycle(dep.activity, [...path])) {
                            return true
                        }
                    } else if (recStack.has(dep.activity)) {
                        // Found cycle
                        const cycleStart = path.indexOf(dep.activity)
                        if (cycleStart >= 0) {
                            cycles.push([...path.slice(cycleStart), dep.activity])
                        }
                        return true
                    }
                }
            }

            recStack.delete(activityName)
            return false
        }

        metadata.activities.forEach(act => {
            if (!visited.has(act.name)) {
                detectCycle(act.name, [])
            }
        })
        result.circularDependencies = cycles

        // 2. Calculate critical path (longest chain)
        const calculateDepth = (activityName: string, memo: Map<string, number>): number => {
            if (memo.has(activityName)) {
                return memo.get(activityName)!
            }

            const activity = activityMap.get(activityName)
            if (!activity || activity.dependsOn.length === 0) {
                memo.set(activityName, 1)
                return 1
            }

            const maxDepth = Math.max(...activity.dependsOn.map(dep => calculateDepth(dep.activity, memo)))
            const depth = maxDepth + 1
            memo.set(activityName, depth)
            return depth
        }

        const depthMemo = new Map<string, number>()
        const allDepths = metadata.activities.map(act => ({
            name: act.name,
            depth: calculateDepth(act.name, depthMemo)
        }))

        result.maxDepth = Math.max(...allDepths.map(d => d.depth))

        // Find activities at max depth (critical path endpoints)
        const criticalEndpoints = allDepths.filter(d => d.depth === result.maxDepth)
        if (criticalEndpoints.length > 0) {
            // Build critical path by backtracking
            const buildPath = (activityName: string, path: string[]): string[] => {
                const activity = activityMap.get(activityName)
                if (!activity || activity.dependsOn.length === 0) {
                    return [activityName, ...path]
                }
                // Find the dependency with maximum depth
                const depths = activity.dependsOn.map(dep => ({
                    name: dep.activity,
                    depth: depthMemo.get(dep.activity) || 0
                }))
                const maxDep = depths.reduce((max, curr) => curr.depth > max.depth ? curr : max)
                return buildPath(maxDep.name, [activityName, ...path])
            }
            result.criticalPath = buildPath(criticalEndpoints[0].name, [])
        }

        // 3. Identify orphaned activities (no dependencies and not depended upon)
        const dependedUpon = new Set(metadata.activities.flatMap(a => a.dependsOn.map(d => d.activity)))
        result.orphanedActivities = metadata.activities
            .filter(a => a.dependsOn.length === 0 && !dependedUpon.has(a.name))
            .map(a => a.name)

        // 4. Identify parallel execution groups
        const groupByDepth = new Map<number, string[]>()
        allDepths.forEach(({ name, depth }) => {
            if (!groupByDepth.has(depth)) {
                groupByDepth.set(depth, [])
            }
            groupByDepth.get(depth)!.push(name)
        })
        result.parallelGroups = Array.from(groupByDepth.values()).filter(group => group.length > 1)

        return result
    }, [metadata.activities])

    // BEST PRACTICES VALIDATION
    const validationIssues = useMemo<ValidationIssue[]>(() => {
        const issues: ValidationIssue[] = []

        if (metadata.activities.length === 0) {
            return issues
        }

        // CRITICAL: Activities without error handling
        metadata.activities.forEach(act => {
            if (act.dependsOn.length > 0) {
                const hasErrorHandling = act.dependsOn.some(dep =>
                    dep.conditions.some(c => c.toLowerCase() === 'failed' || c.toLowerCase() === 'completed')
                )
                if (!hasErrorHandling && act.type !== 'SetVariable' && act.type !== 'AppendVariable') {
                    issues.push({
                        severity: 'critical',
                        category: 'Error Handling',
                        message: 'Activity has dependencies but no error handling (Failed/Completed conditions)',
                        activityName: act.name
                    })
                }
            }
        })

        // CRITICAL: Missing parameter descriptions
        Object.entries(metadata.parameters).forEach(([key, value]: [string, any]) => {
            if (!value.description) {
                issues.push({
                    severity: 'critical',
                    category: 'Documentation',
                    message: `Parameter '${key}' is missing a description`
                })
            }
        })

        // CRITICAL: Excessive pipeline complexity
        if (metadata.activities.length > 15) {
            issues.push({
                severity: 'critical',
                category: 'Complexity',
                message: `Pipeline has ${metadata.activities.length} activities (recommended max: 15). Consider splitting into child pipelines.`
            })
        }

        // WARNING: Activities without descriptions
        metadata.activities.forEach(act => {
            if (!act.description) {
                issues.push({
                    severity: 'warning',
                    category: 'Documentation',
                    message: 'Activity is missing a description',
                    activityName: act.name
                })
            }
        })

        // WARNING: Copy activities without retry policy
        metadata.activities.forEach(act => {
            if (act.type === 'Copy' && !act.policy?.retry) {
                issues.push({
                    severity: 'warning',
                    category: 'Resilience',
                    message: 'Copy activity should have a retry policy configured',
                    activityName: act.name
                })
            }
        })

        // WARNING: Missing timeout
        metadata.activities.forEach(act => {
            if (!act.policy?.timeout && act.type !== 'SetVariable' && act.type !== 'AppendVariable') {
                issues.push({
                    severity: 'warning',
                    category: 'Resilience',
                    message: 'Activity should have a timeout configured',
                    activityName: act.name
                })
            }
        })

        // RECOMMENDATION: Parameterize common patterns
        if (Object.keys(metadata.parameters).length === 0 && metadata.activities.length > 3) {
            issues.push({
                severity: 'recommendation',
                category: 'Best Practice',
                message: 'Consider adding parameters to make the pipeline more reusable'
            })
        }

        // RECOMMENDATION: Add annotations
        if (!metadata.description) {
            issues.push({
                severity: 'recommendation',
                category: 'Documentation',
                message: 'Pipeline should have a description for better maintainability'
            })
        }

        // SMART: Parallelism Opportunity Detector
        // Find sequential chains of lightweight activities that could be parallelized
        const visitedForOptimization = new Set<string>()

        metadata.activities.forEach(act => {
            if (visitedForOptimization.has(act.name)) return

            // Look for chain start: Activity with NO deps or deps outside the chain, followed by SINGLE dependent
            const nextActivities = metadata.activities.filter(a => a.dependsOn.some(d => d.activity === act.name))

            if (nextActivities.length === 1) {
                const chain = [act.name]
                let current = nextActivities[0]

                // Follow the chain
                while (current) {
                    // It must depend ONLY on previous in chain (simple sequence)
                    if (current.dependsOn.length !== 1) break

                    chain.push(current.name)
                    visitedForOptimization.add(current.name)

                    // Get next
                    const subsequent = metadata.activities.filter(a => a.dependsOn.some(d => d.activity === current.name))
                    if (subsequent.length === 1) {
                        current = subsequent[0]
                    } else {
                        break
                    }
                }

                if (chain.length >= 3) {
                    // Check if activities are "parallelizable" (e.g. Lookups, Web, GetMetadata)
                    const parallelizableTypes = ['WebActivity', 'Lookup', 'GetMetadata', 'Warning'] // Warning is just test
                    const allParallelizable = chain.every(name => {
                        const a = metadata.activities.find(act => act.name === name)
                        return a && parallelizableTypes.includes(a.type)
                    })

                    if (allParallelizable) {
                        issues.push({
                            severity: 'recommendation',
                            category: 'Optimization',
                            message: `Found sequential chain of ${chain.length} lightweight activities (${chain[0]}... -> ...${chain[chain.length - 1]}). Consider running them in parallel to reduce runtime.`,
                            activityName: chain[0]
                        })
                    }
                }
            }
        })

        // SMART: Cost Risk Detector (Heavy compute in parallel loops)
        metadata.activities.forEach(act => {
            if (act.type === 'ForEach') {
                const isSequential = act.typeProperties?.isSequential === true
                const innerActivities: any[] = act.typeProperties?.activities || []

                const hasHeavyCompute = innerActivities.some(inner =>
                    ['ExecuteDataFlow', 'DatabricksNotebook', 'SynapseNotebook', 'HDInsight'].some(t => inner.type.startsWith(t))
                )

                if (!isSequential && hasHeavyCompute) {
                    issues.push({
                        severity: 'warning',
                        category: 'Cost Risk',
                        message: 'Parallel ForEach loop contains heavy compute activities. Ensure concurrency limits to avoid unexpected costs.',
                        activityName: act.name
                    })
                }
            }
        })

        // SMART: Infinite Loop Risk (Until activity)
        metadata.activities.forEach(act => {
            if (act.type === 'Until') {
                const expression = act.typeProperties?.expression?.value || ''
                const innerActivities: any[] = act.typeProperties?.activities || []

                // Extract variable names from expression
                const varsInCondition: string[] = []
                const varMatch = expression.match(/variables\('([^']+)'\)/g)
                if (varMatch) {
                    varMatch.forEach((m: string) => {
                        const v = m.match(/variables\('([^']+)'\)/)
                        if (v) varsInCondition.push(v[1])
                    })
                }

                // Check if any of those variables are modified inside
                const isModified = innerActivities.some(inner =>
                    (inner.type === 'SetVariable' || inner.type === 'AppendVariable') &&
                    varsInCondition.includes(inner.typeProperties?.variableName)
                )

                if (varsInCondition.length > 0 && !isModified) {
                    issues.push({
                        severity: 'warning',
                        category: 'Logic Risk',
                        message: 'Until loop condition relies on variables that are NOT modified inside the loop. Potential infinite loop.',
                        activityName: act.name
                    })
                }
            }
        })

        return issues
    }, [metadata])

    // BUILD VISUAL GRAPH
    const buildGraph = useCallback(() => {
        if (metadata.activities.length === 0) {
            setNodes([])
            setEdges([])
            return
        }

        // Create nodes with custom activity node type
        const newNodes: Node[] = metadata.activities.map((act) => {
            return {
                id: act.name,
                data: { label: act.name, type: act.type },
                position: { x: 0, y: 0 },
                type: 'activityNode',
            }
        })

        // Create edges
        const newEdges: Edge[] = []

        const getEdgeColor = (conditions: string[]) => {
            if (conditions.includes('Succeeded')) return '#10b981' // Green
            if (conditions.includes('Failed')) return '#ef4444' // Red
            if (conditions.includes('Completed')) return '#3b82f6' // Blue
            if (conditions.includes('Skipped')) return '#64748b' // Slate
            return '#94a3b8' // Default
        }

        metadata.activities.forEach((act) => {
            act.dependsOn.forEach((dep) => {
                const conditionLabel = dep.conditions.length > 0 ? dep.conditions.join(', ') : 'Succeeded'
                const edgeColor = getEdgeColor(dep.conditions)

                newEdges.push({
                    id: `${dep.activity}-${act.name}`,
                    source: dep.activity,
                    target: act.name,
                    label: conditionLabel,
                    type: 'default',
                    animated: true,
                    style: { stroke: edgeColor, strokeWidth: 2 },
                    labelStyle: { fill: edgeColor, fontWeight: 700, fontSize: 11 },
                    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: edgeColor,
                    },
                })
            })
        })

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges)
        setNodes(layoutedNodes)
        setEdges(layoutedEdges)

        // Auto-fit view
        setTimeout(() => {
            if (rfInstance) {
                rfInstance.fitView({ padding: 0.2 })
            }
        }, 50)
    }, [metadata.activities, setNodes, setEdges, rfInstance])

    // Trigger graph build when switching to graph tab or when metadata changes
    useEffect(() => {
        if (activeTab === 'graph') {
            buildGraph()
        }
    }, [metadata.activities, activeTab, buildGraph])

    const handleCopyMetadata = () => {
        const text = generateMetadataReport()
        navigator.clipboard.writeText(text)
    }

    const handleCopyJson = () => {
        navigator.clipboard.writeText(prettifiedJson)
    }



    const handleDownloadJson = () => {
        const blob = new Blob([prettifiedJson], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${metadata.name || 'pipeline'}_formatted.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const generateMetadataReport = () => {
        let report = `ADF Pipeline Analysis Report\n`
        report += `${'='.repeat(50)}\n\n`

        if (metadata.name) {
            report += `Pipeline Name: ${metadata.name}\n`
        }
        if (metadata.description) {
            report += `Description: ${metadata.description}\n`
        }
        report += `\n`

        if (Object.keys(metadata.parameters).length > 0) {
            report += `Parameters (${Object.keys(metadata.parameters).length}):\n`
            Object.entries(metadata.parameters).forEach(([key, value]: [string, any]) => {
                report += `  - ${key}: ${value.type || 'Unknown'}\n`
            })
            report += `\n`
        }

        if (Object.keys(metadata.variables).length > 0) {
            report += `Variables (${Object.keys(metadata.variables).length}):\n`
            Object.entries(metadata.variables).forEach(([key, value]: [string, any]) => {
                report += `  - ${key}: ${value.type || 'Unknown'}\n`
            })
            report += `\n`
        }

        if (metadata.activities.length > 0) {
            report += `Activities (${metadata.activities.length}):\n`
            metadata.activities.forEach((act, idx) => {
                report += `  ${idx + 1}. ${act.name} [${act.type}]\n`
                if (act.dependsOn.length > 0) {
                    report += `     Depends On: ${act.dependsOn.map(d => `${d.activity} (${d.conditions.join(', ') || 'Succeeded'})`).join(', ')}\n`
                }
            })
            report += `\n`
        }

        if (metadata.linkedServices.size > 0) {
            report += `Linked Services (${metadata.linkedServices.size}):\n`
            Array.from(metadata.linkedServices).forEach((ls) => {
                report += `  - ${ls}\n`
            })
            report += `\n`
        }

        if (metadata.datasets.size > 0) {
            report += `Datasets (${metadata.datasets.size}):\n`
            Array.from(metadata.datasets).forEach((ds) => {
                report += `  - ${ds}\n`
            })
            report += `\n`
        }

        return report
    }

    // File upload handlers
    const handleFileRead = (content: string) => {
        setInputJson(content)
        try {
            const parsed = JSON.parse(content)
            if (parsed.resources && Array.isArray(parsed.resources)) {
                setInputMode('arm')
            } else {
                setInputMode('pipeline')
            }
        } catch {
            // Error handling in useMemo
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const files = e.dataTransfer.files
        if (files.length > 0) {
            const file = files[0]
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                const reader = new FileReader()
                reader.onload = (event) => {
                    const content = event.target?.result as string
                    handleFileRead(content)
                }
                reader.readAsText(file)
            } else {
                alert('Please upload a JSON file')
            }
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const file = files[0]
            const reader = new FileReader()
            reader.onload = (event) => {
                const content = event.target?.result as string
                handleFileRead(content)
            }
            reader.readAsText(file)
        }
    }

    const handleClear = () => {
        setInputJson('')
        setPrettifiedJson('')
        setActiveTab('overview')
    }

    const loadSample = () => {
        setInputJson(JSON.stringify(COMPREHENSIVE_SAMPLE, null, 2))
    }

    // PIPELINE METRICS
    const pipelineMetrics = useMemo(() => {
        if (metadata.activities.length === 0) return null

        // Count by type
        const typeCounts: Record<string, number> = {}
        metadata.activities.forEach(act => {
            typeCounts[act.type] = (typeCounts[act.type] || 0) + 1
        })

        // Error coverage: % of activities with deps that have failure handling
        const activitiesWithDeps = metadata.activities.filter(a => a.dependsOn.length > 0)
        const activitiesWithErrorHandling = new Set<string>()
        metadata.activities.forEach(act => {
            act.dependsOn.forEach(dep => {
                if (dep.conditions.includes('Failed') || dep.conditions.includes('Completed')) {
                    activitiesWithErrorHandling.add(dep.activity)
                }
            })
        })
        const errorCoverage = activitiesWithDeps.length > 0
            ? Math.round((activitiesWithErrorHandling.size / activitiesWithDeps.length) * 100)
            : 100

        // Complexity score: based on activity count and depth
        const complexityScore = Math.min(100,
            (metadata.activities.length * 5) +
            (dependencyAnalysis.maxDepth * 10) +
            (dependencyAnalysis.circularDependencies.length * 20)
        )
        const complexityLevel = complexityScore < 30 ? 'Simple' : complexityScore < 60 ? 'Medium' : 'Complex'

        // Estimated runtime based on CRITICAL PATH only (accounts for parallel execution)
        const activityHeuristics: Record<string, { min: number, max: number }> = {
            'Copy': { min: 2, max: 60 },
            'ExecuteDataFlow': { min: 5, max: 120 },
            'DatabricksNotebook': { min: 5, max: 120 },
            'SynapseNotebook': { min: 5, max: 120 },
            'HDInsightHive': { min: 10, max: 180 },
            'HDInsightPig': { min: 10, max: 180 },
            'HDInsightMapReduce': { min: 10, max: 180 },
            'HDInsightSpark': { min: 10, max: 180 },
            'AzureMLExecutePipeline': { min: 5, max: 60 },
            'WebActivity': { min: 0.1, max: 1 },
            'Lookup': { min: 0.1, max: 5 },
            'GetMetadata': { min: 0.1, max: 1 },
            'SqlServerStoredProcedure': { min: 0.5, max: 30 },
            'Wait': { min: 0, max: 0 } // Handle dynamically
        }

        let minMinutes = 0
        let maxMinutes = 0
        const activityMap = new Map(metadata.activities.map(a => [a.name, a]))

        // Calculate based on Critical Path
        const pathActivities = dependencyAnalysis.criticalPath.length > 0
            ? dependencyAnalysis.criticalPath
            : metadata.activities.map(a => a.name) // Fallback if no deps

        pathActivities.forEach(actName => {
            const act = activityMap.get(actName)
            if (!act) return

            // 1. Check for explicit timeout (Max override)
            let actMax = 10 // Default max
            if (act.policy?.timeout) {
                const match = act.policy.timeout.match(/0\.(\d+):(\d+):(\d+)/)
                if (match) {
                    actMax = parseInt(match[1]) * 60 + parseInt(match[2])
                }
            }

            // 2. Check for explicit Wait time
            if (act.type === 'Wait' && act.typeProperties?.waitTimeInSeconds) {
                const waitMin = act.typeProperties.waitTimeInSeconds / 60
                minMinutes += waitMin
                maxMinutes += waitMin
                return
            }

            // 3. Apply Heuristics
            const heuristics = activityHeuristics[act.type] || { min: 1, max: 10 }
            minMinutes += heuristics.min

            // Use timeout as max if available and reasonable, otherwise use heuristic max
            maxMinutes += Math.min(actMax, heuristics.max)
        })

        if (pathActivities.length === 0 && metadata.activities.length > 0) {
            // Very simple fallback
            minMinutes = metadata.activities.length * 1
            maxMinutes = metadata.activities.length * 10
        }

        // --- NEW STRATEGIC KPIs ---

        // 1. Cost Impact Score
        // Heavy compute = 10, Medium = 5, Light = 1
        let totalCostWeight = 0
        const costWeights: Record<string, number> = {
            'ExecuteDataFlow': 10,
            'DatabricksNotebook': 10,
            'SynapseNotebook': 10,
            'HDInsightHive': 10,
            'HDInsightSpark': 10,
            'Copy': 5,
            'AzureMLExecutePipeline': 8,
            'WebActivity': 1,
            'Lookup': 1,
            'GetMetadata': 1,
            'SetVariable': 0,
            'IfCondition': 0,
            'ForEach': 0,
            'Switch': 0
        }
        metadata.activities.forEach(act => {
            totalCostWeight += costWeights[act.type] || 2 // Default to 2
        })
        // Normalizing: Score / Activities. High compute density > 5 is High.
        const avgCostWeight = metadata.activities.length > 0 ? totalCostWeight / metadata.activities.length : 0
        const costImpactLevel = avgCostWeight > 6 ? 'High' : avgCostWeight > 3 ? 'Medium' : 'Low'

        // 2. Resilience Score
        // Check for Retry policies OR Error Handling paths
        let resilientActivitiesCount = 0
        const criticalActivityTypes = ['Copy', 'ExecuteDataFlow', 'DatabricksNotebook', 'SynapseNotebook', 'HDInsight', 'AzureML', 'WebActivity', 'Lookup', 'SqlServerStoredProcedure']

        const meaningfulActivities = metadata.activities.filter(a =>
            criticalActivityTypes.some(t => a.type.startsWith(t))
        )

        meaningfulActivities.forEach(act => {
            let isResilient = false

            // Check Retry
            if (act.policy && act.policy.retry && typeof act.policy.retry === 'number' && act.policy.retry > 0) {
                isResilient = true
            }

            // Check Error Handling (if any other activity depends on this with 'Failed' or 'Skipped' or 'Completed')
            // This is effectively "isCaught"
            const isCaught = metadata.activities.some(other =>
                other.dependsOn.some(dep =>
                    dep.activity === act.name &&
                    (dep.conditions.includes('Failed') || dep.conditions.includes('Completed') || dep.conditions.includes('Skipped'))
                )
            )

            if (isResilient || isCaught) {
                resilientActivitiesCount++
            }
        })

        const resilienceScore = meaningfulActivities.length > 0
            ? Math.round((resilientActivitiesCount / meaningfulActivities.length) * 100)
            : 100 // Default if no risky activities

        // 4. Dynamic Content Score (Expression usage)
        let totalProps = 0
        let dynamicProps = 0

        const countExpressions = (obj: any) => {
            if (!obj) return
            if (typeof obj === 'string') {
                totalProps++
                // Check for ADF expression patterns: @{...}, @pipeline()..., @variables('...'), etc.
                if (obj.trim().startsWith('@') || obj.includes('@{')) {
                    dynamicProps++
                }
            } else if (Array.isArray(obj)) {
                obj.forEach(item => countExpressions(item))
            } else if (typeof obj === 'object') {
                Object.values(obj).forEach(val => countExpressions(val))
            }
        }

        metadata.activities.forEach(act => {
            // Only scan typeProperties for user inputs
            if (act.typeProperties) {
                countExpressions(act.typeProperties)
            }
        })

        const dynamicScore = totalProps > 0 ? Math.round((dynamicProps / totalProps) * 100) : 0

        // 3. Activity Composition Ratio
        let dataMovementCount = 0
        let orchestrationCount = 0
        let computeCount = 0

        metadata.activities.forEach(act => {
            if (['Copy'].includes(act.type)) dataMovementCount++
            else if (['ExecuteDataFlow', 'DatabricksNotebook', 'SynapseNotebook', 'HDInsight', 'AzureML'].some(t => act.type.startsWith(t))) computeCount++
            else orchestrationCount++
        })

        return {
            totalActivities: metadata.activities.length,
            typeCounts,
            maxDepth: dependencyAnalysis.maxDepth,
            parallelGroups: dependencyAnalysis.parallelGroups.length,
            errorCoverage,
            complexityScore,
            complexityLevel,
            runtimeEstimate: { min: Math.ceil(minMinutes), max: Math.ceil(maxMinutes) },
            parameterCount: Object.keys(metadata.parameters).length,
            variableCount: Object.keys(metadata.variables).length,
            // New KPIs
            costImpactLevel,
            resilienceScore,
            dynamicScore,
            composition: {
                dataMovement: dataMovementCount,
                orchestration: orchestrationCount,
                compute: computeCount
            }
        }
    }, [metadata, dependencyAnalysis])

    // EXPORT GRAPH AS PNG
    const handleExportGraph = useCallback(async () => {
        if (!graphRef.current) return
        setIsExporting(true)
        try {
            const dataUrl = await toPng(graphRef.current, {
                backgroundColor: '#1e1e1e',
                pixelRatio: 2
            })
            const link = document.createElement('a')
            link.download = `${metadata.name || 'pipeline'}_graph_${Date.now()}.png`
            link.href = dataUrl
            link.click()
        } catch (err) {
            console.error('Export failed:', err)
        } finally {
            setIsExporting(false)
        }
    }, [metadata.name])

    // NODE CLICK HANDLER
    const handleNodeClick = useCallback((_: any, node: Node) => {
        const activity = metadata.activities.find(a => a.name === node.id)
        setSelectedActivity(activity || null)
    }, [metadata.activities])

    const criticalCount = validationIssues.filter(i => i.severity === 'critical').length
    const warningCount = validationIssues.filter(i => i.severity === 'warning').length
    const recommendationCount = validationIssues.filter(i => i.severity === 'recommendation').length

    return (
        <div id="adf-analyzer-root" className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>

            {/* INTERACTIVE UI */}
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 no-print">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileJson className="h-6 w-6 text-primary" />
                        ADF Pipeline Analyzer
                    </h1>
                    <div className="flex gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".json,application/json"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="flex bg-muted rounded-md p-0.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 text-xs ${inputMode === 'pipeline' ? 'bg-background shadow-sm' : ''}`}
                                onClick={() => { setInputMode('pipeline'); fileInputRef.current?.click(); }}
                            >
                                <Upload className="mr-1.5 h-3.5 w-3.5" />
                                Upload Pipeline JSON
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 text-xs ${inputMode === 'arm' ? 'bg-background shadow-sm' : ''}`}
                                onClick={() => { setInputMode('arm'); fileInputRef.current?.click(); }}
                            >
                                <FileJson className="mr-1.5 h-3.5 w-3.5" />
                                Upload ARM Template
                            </Button>
                        </div>
                        <Button variant="outline" size="sm" onClick={loadSample}>
                            Load Sample
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleClear} disabled={!inputJson}>
                            Clear
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                        >
                            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center border-b bg-muted/40 rounded-t-lg no-print">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('graph')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'graph' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <Network className="inline h-4 w-4 mr-1" />
                        Visual Graph
                    </button>
                    <button
                        onClick={() => setActiveTab('dependencies')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dependencies' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <GitBranch className="inline h-4 w-4 mr-1" />
                        Dependencies
                    </button>
                    <button
                        onClick={() => setActiveTab('metrics')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'metrics' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <Activity className="inline h-4 w-4 mr-1" />
                        Metrics
                    </button>
                    <button
                        onClick={() => setActiveTab('validation')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'validation' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <TrendingUp className="h-4 w-4" />
                        Best Practices
                        {validationIssues.length > 0 && (
                            <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                                {validationIssues.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('documentation')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'documentation' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <FileJson className="inline h-4 w-4 mr-1" />
                        Documentation
                    </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'overview' && (
                        <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
                            <ResizablePanel defaultSize={33} minSize={25}>
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
                                        <span className="text-xs font-medium text-muted-foreground uppercase">
                                            Pipeline JSON Input
                                        </span>
                                    </div>
                                    <div
                                        className={`flex-1 relative ${isDragging ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        {!inputJson && !isDragging && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-md m-2">
                                                <div className="text-center text-muted-foreground">
                                                    <FileJson className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                                    <p className="text-sm font-medium mb-1">Drop ADF Pipeline JSON here</p>
                                                    <p className="text-xs opacity-70">or paste JSON, or use "Open File" button</p>
                                                </div>
                                            </div>
                                        )}
                                        <CodeEditor
                                            value={inputJson}
                                            onChange={(value) => setInputJson(value || '')}
                                            language="json"
                                            readOnly={false}
                                            hideHeader={true}
                                        />
                                    </div>
                                </div>
                            </ResizablePanel>

                            <ResizableHandle withHandle />

                            <ResizablePanel defaultSize={33} minSize={25}>
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
                                        <span className="text-xs font-medium text-muted-foreground uppercase">
                                            Pipeline Analysis
                                        </span>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            onClick={handleCopyMetadata}
                                            title="Copy Analysis"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                                        {metadata.errors.length > 0 ? (
                                            <div className="bg-destructive/10 border border-destructive/30 rounded p-3 flex items-start gap-2">
                                                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                                                <div>
                                                    <p className="font-semibold text-sm">Error Parsing JSON</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {metadata.errors[0]}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : !inputJson.trim() ? (
                                            <div className="text-center text-muted-foreground py-8">
                                                <FileJson className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                                <p>Paste ADF pipeline JSON to analyze</p>
                                                <p className="text-xs mt-2">Or click "Load Sample" to see an example</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* General Info Card */}
                                                <div className="md:col-span-2 border rounded-lg p-3 bg-card shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                                        <Info className="h-4 w-4 text-primary" />
                                                        <h3 className="font-semibold text-sm">General Information</h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <div className="text-muted-foreground text-xs mb-1">Pipeline Name</div>
                                                            <div className="font-medium text-sm">{metadata.name || 'Unnamed Pipeline'}</div>
                                                        </div>
                                                        {metadata.description && (
                                                            <div>
                                                                <div className="text-muted-foreground text-xs mb-1">Description</div>
                                                                <div className="text-sm">{metadata.description}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Parameters Card */}
                                                {Object.keys(metadata.parameters).length > 0 && (
                                                    <div className="border rounded-lg p-3 bg-card shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                                            <List className="h-4 w-4 text-orange-500" />
                                                            <h3 className="font-semibold text-sm">Parameters ({Object.keys(metadata.parameters).length})</h3>
                                                        </div>
                                                        <div className="space-y-1 overflow-y-auto max-h-[150px]">
                                                            {Object.entries(metadata.parameters).map(([key, value]: [string, any]) => (
                                                                <div key={key} className="text-xs flex justify-between items-center bg-muted/30 p-1.5 rounded">
                                                                    <span className="font-medium">{key}</span>
                                                                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{value.type}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Variables Card */}
                                                {Object.keys(metadata.variables).length > 0 && (
                                                    <div className="border rounded-lg p-3 bg-card shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                                            <Variable className="h-4 w-4 text-purple-500" />
                                                            <h3 className="font-semibold text-sm">Variables ({Object.keys(metadata.variables).length})</h3>
                                                        </div>
                                                        <div className="space-y-1 overflow-y-auto max-h-[150px]">
                                                            {Object.entries(metadata.variables).map(([key, value]: [string, any]) => (
                                                                <div key={key} className="text-xs flex justify-between items-center bg-muted/30 p-1.5 rounded">
                                                                    <span className="font-medium">{key}</span>
                                                                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{value.type}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Linked Services Card */}
                                                {metadata.linkedServices.size > 0 && (
                                                    <div className="border rounded-lg p-3 bg-card shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                                            <Link2 className="h-4 w-4 text-blue-500" />
                                                            <h3 className="font-semibold text-sm">Linked Services ({metadata.linkedServices.size})</h3>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {Array.from(metadata.linkedServices).map((ls) => (
                                                                <span
                                                                    key={ls}
                                                                    className="text-xs border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1"
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                                    {ls}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Datasets Card */}
                                                {metadata.datasets.size > 0 && (
                                                    <div className="border rounded-lg p-3 bg-card shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                                            <Database className="h-4 w-4 text-green-500" />
                                                            <h3 className="font-semibold text-sm">Datasets ({metadata.datasets.size})</h3>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {Array.from(metadata.datasets).map((ds) => (
                                                                <span
                                                                    key={ds}
                                                                    className="text-xs border border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1"
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                                    {ds}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Child Pipelines Card */}
                                                {metadata.childPipelines.size > 0 && (
                                                    <div className="border rounded-lg p-3 bg-card shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                                            <Workflow className="h-4 w-4 text-orange-500" />
                                                            <h3 className="font-semibold text-sm">Child Pipelines ({metadata.childPipelines.size})</h3>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {Array.from(metadata.childPipelines).map((pl) => (
                                                                <span
                                                                    key={pl}
                                                                    className="text-xs border border-orange-200 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300 px-2 py-0.5 rounded-full flex items-center gap-1 max-w-full"
                                                                    title={pl}
                                                                >
                                                                    <Play className="w-3 h-3 shrink-0" />
                                                                    <span className="truncate">{pl}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Activities Card */}
                                                {metadata.activities.length > 0 && (
                                                    <div className="md:col-span-2 border rounded-lg p-3 bg-card shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                                            <Activity className="h-4 w-4 text-slate-500" />
                                                            <h3 className="font-semibold text-sm">Activities ({metadata.activities.length})</h3>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                            {metadata.activities.map((act, idx) => (
                                                                <div key={idx} className="border rounded p-2 text-xs bg-muted/10 hover:bg-muted/30 transition-colors">
                                                                    <div className="font-semibold truncate" title={act.name}>{act.name}</div>
                                                                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">{act.type}</div>
                                                                    {act.dependsOn.length > 0 ? (
                                                                        <div className="text-muted-foreground text-[10px] border-t pt-1 mt-1">
                                                                            <span className="font-medium">Dependencies:</span> {act.dependsOn.length}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-muted-foreground text-[10px] border-t pt-1 mt-1 italic">
                                                                            No dependencies
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ResizablePanel>

                            <ResizableHandle withHandle />

                            <ResizablePanel defaultSize={33} minSize={25}>
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
                                        <span className="text-xs font-medium text-muted-foreground uppercase">
                                            Formatted JSON
                                        </span>
                                        <div className="flex gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={handleCopyJson}
                                                title="Copy JSON"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={handleDownloadJson}
                                                title="Download JSON"
                                            >
                                                <Download className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative">
                                        <CodeEditor
                                            value={prettifiedJson}
                                            language="json"
                                            readOnly={true}
                                            hideHeader={true}
                                        />
                                    </div>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    )}

                    {activeTab === 'graph' && (
                        <ResizablePanelGroup direction="horizontal" className="flex-1 border rounded-lg h-full" style={{ minHeight: '500px' }}>
                            <ResizablePanel defaultSize={70} minSize={30} className="h-full relative">
                                <div className="flex-1 relative flex flex-col h-full w-full">
                                    <div className="flex-1 overflow-hidden bg-slate-900 relative h-full w-full" ref={graphRef}>
                                        <ReactFlow
                                            style={{ width: '100%', height: '100%' }}
                                            nodes={nodes}
                                            edges={edges}
                                            onNodesChange={onNodesChange}
                                            onEdgesChange={onEdgesChange}
                                            nodeTypes={nodeTypesMemo}
                                            fitView
                                            minZoom={0.1}
                                            maxZoom={1.5}
                                            attributionPosition="bottom-right"
                                            nodesDraggable={!isExporting}
                                            nodesConnectable={false}
                                            elementsSelectable={!isExporting}
                                            onNodeClick={handleNodeClick}
                                            onInit={setRfInstance}
                                        >
                                            <Background />
                                            <Controls />
                                            <MiniMap />
                                            {/* Export Button */}
                                            <div className="absolute top-2 right-2 z-10 no-print">
                                                <Button size="sm" variant="secondary" onClick={handleExportGraph} disabled={isExporting}>
                                                    <Camera className="h-4 w-4 mr-1" />
                                                    {isExporting ? 'Exporting...' : 'Export PNG'}
                                                </Button>
                                            </div>
                                        </ReactFlow>
                                    </div>
                                </div>
                            </ResizablePanel>

                            {selectedActivity && <ResizableHandle withHandle />}

                            {selectedActivity && (
                                <ResizablePanel defaultSize={30} minSize={20} className="h-full">
                                    {selectedActivity ? (
                                        <div className="h-full border-l bg-muted/20 p-4 overflow-y-auto w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-semibold">Activity Details</h3>
                                                <Button variant="ghost" size="icon" onClick={() => setSelectedActivity(null)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="space-y-4 text-sm">
                                                <div>
                                                    <div className="text-muted-foreground text-xs mb-1">Name</div>
                                                    <div className="font-medium">{selectedActivity.name}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-xs mb-1">Type</div>
                                                    <div className="font-medium text-primary">{selectedActivity.type}</div>
                                                </div>
                                                {selectedActivity.description && (
                                                    <div>
                                                        <div className="text-muted-foreground text-xs mb-1">Description</div>
                                                        <div>{selectedActivity.description}</div>
                                                    </div>
                                                )}
                                                {selectedActivity.policy && (
                                                    <div>
                                                        <div className="text-muted-foreground text-xs mb-1">Policy</div>
                                                        <div className="bg-muted/50 p-2 rounded text-xs font-mono">
                                                            {selectedActivity.policy.timeout && <div>Timeout: {selectedActivity.policy.timeout}</div>}
                                                            {selectedActivity.policy.retry && <div>Retry: {selectedActivity.policy.retry}</div>}
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedActivity.linkedServiceName && (
                                                    <div>
                                                        <div className="text-muted-foreground text-xs mb-1">Linked Service</div>
                                                        <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2 rounded text-xs font-medium">
                                                            {selectedActivity.linkedServiceName.referenceName}
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedActivity.typeProperties && (
                                                    <div>
                                                        <div className="text-muted-foreground text-xs mb-1">Type Properties</div>
                                                        <div className="h-[200px] border rounded overflow-hidden">
                                                            <CodeEditor
                                                                value={JSON.stringify(selectedActivity.typeProperties, null, 2)}
                                                                language="json"
                                                                readOnly
                                                                minimap={false}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center">
                                            Select an activity to view details
                                        </div>
                                    )}
                                </ResizablePanel>
                            )}
                        </ResizablePanelGroup>
                    )}

                    {activeTab === 'dependencies' && (
                        <div className="h-full border rounded-lg p-6 overflow-y-auto space-y-6">
                            {metadata.activities.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <div className="text-center">
                                        <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                        <p>Paste a pipeline JSON to analyze dependencies</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Circular Dependencies */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                            <AlertCircle className="h-5 w-5 text-destructive" />
                                            Circular Dependencies
                                        </h3>
                                        {dependencyAnalysis.circularDependencies.length > 0 ? (
                                            <div className="space-y-2">
                                                {dependencyAnalysis.circularDependencies.map((cycle, idx) => (
                                                    <div key={idx} className="bg-destructive/10 border border-destructive/30 rounded p-3">
                                                        <p className="text-sm font-mono">{cycle.join(' → ')}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                                                <p className="text-sm text-green-700 dark:text-green-400">✓ No circular dependencies detected</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Critical Path */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                            <TrendingUp className="h-5 w-5 text-blue-500" />
                                            Critical Path (Longest Execution Chain)
                                        </h3>
                                        <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                                            <p className="text-sm mb-2">
                                                <span className="font-semibold">Max Depth:</span> {dependencyAnalysis.maxDepth} level(s)
                                            </p>
                                            {dependencyAnalysis.criticalPath.length > 0 && (
                                                <p className="text-sm font-mono mt-2">
                                                    {dependencyAnalysis.criticalPath.join(' → ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Parallel Groups */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                            <Network className="h-5 w-5 text-purple-500" />
                                            Parallel Execution Opportunities
                                        </h3>
                                        {dependencyAnalysis.parallelGroups.length > 0 ? (
                                            <div className="space-y-2">
                                                {dependencyAnalysis.parallelGroups.map((group, idx) => (
                                                    <div key={idx} className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                                                        <p className="text-sm mb-1">
                                                            <span className="font-semibold">Group {idx + 1}:</span> {group.length} activities can run in parallel
                                                        </p>
                                                        <p className="text-xs font-mono text-muted-foreground">
                                                            {group.join(', ')}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-muted/50 border rounded p-3">
                                                <p className="text-sm text-muted-foreground">No parallel execution groups found</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Orphaned Activities */}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                            Orphaned Activities
                                        </h3>
                                        {dependencyAnalysis.orphanedActivities.length > 0 ? (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                                                <p className="text-sm mb-2">Activities with no dependencies and not depended upon:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {dependencyAnalysis.orphanedActivities.map(act => (
                                                        <span key={act} className="text-xs bg-yellow-500/20 px-2 py-1 rounded font-mono">
                                                            {act}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                                                <p className="text-sm text-green-700 dark:text-green-400">✓ All activities are properly connected</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'metrics' && (
                        <div className="h-full border rounded-lg p-6 overflow-y-auto">
                            {!pipelineMetrics ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <div className="text-center">
                                        <Activity className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                        <p>Paste a pipeline JSON to see metrics</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 max-w-4xl mx-auto">
                                    {/* Main Metrics Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                                            <div className="text-blue-600 dark:text-blue-400 text-sm font-medium mb-1">Total Activities</div>
                                            <div className="text-3xl font-bold">{pipelineMetrics.totalActivities}</div>
                                        </div>
                                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-4">
                                            <div className="text-purple-600 dark:text-purple-400 text-sm font-medium mb-1">Max Depth</div>
                                            <div className="text-3xl font-bold">{pipelineMetrics.maxDepth}</div>
                                        </div>
                                        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-4">
                                            <div className="text-green-600 dark:text-green-400 text-sm font-medium mb-1">Parallel Groups</div>
                                            <div className="text-3xl font-bold">{pipelineMetrics.parallelGroups}</div>
                                        </div>
                                        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg p-4 relative group">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className="text-orange-600 dark:text-orange-400 text-sm font-medium">Est. Runtime</div>
                                                <Info className="h-3 w-3 text-orange-600/70 dark:text-orange-400/70 cursor-help" />
                                                {/* Tooltip */}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border z-50 hidden group-hover:block">
                                                    Based on critical path analysis and activity heuristics. Actual runtime varies by data volume and cluster startup.
                                                </div>
                                            </div>
                                            <div className="text-2xl font-bold truncate" title={`${pipelineMetrics.runtimeEstimate.min} - ${pipelineMetrics.runtimeEstimate.max} min`}>
                                                {pipelineMetrics.runtimeEstimate.min} <span className="text-sm font-normal text-muted-foreground">-</span> {pipelineMetrics.runtimeEstimate.max} <span className="text-lg font-normal text-muted-foreground">min</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Strategic Insights (New KPIs) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-muted/30 border rounded-lg p-4 relative group">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Coins className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                                <h3 className="font-semibold text-sm">Cost Impact</h3>
                                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border z-50 hidden group-hover:block">
                                                    Weighted score based on compute intensity. Data Flows and Notebooks have high impact; Web activities have low impact.
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className={`text-2xl font-bold ${pipelineMetrics.costImpactLevel === 'High' ? 'text-red-500' : pipelineMetrics.costImpactLevel === 'Medium' ? 'text-yellow-500' : 'text-green-500'}`}>
                                                    {pipelineMetrics.costImpactLevel}
                                                </div>
                                                <div className="text-xs text-muted-foreground text-right max-w-[120px]">
                                                    Based on compute activity types
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-muted/30 border rounded-lg p-4 relative group">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Shield className="h-5 w-5 text-blue-500" />
                                                <h3 className="font-semibold text-sm">Resilience Score</h3>
                                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border z-50 hidden group-hover:block">
                                                    Percentage of critical activities equipped with Retry policies or explicit Error Handling (purple/red paths).
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className={`text-2xl font-bold ${pipelineMetrics.resilienceScore >= 80 ? 'text-green-500' : pipelineMetrics.resilienceScore >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                    {pipelineMetrics.resilienceScore}%
                                                </div>
                                                <div className="text-xs text-muted-foreground text-right max-w-[120px]">
                                                    Activities with retry / error handler
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-muted/30 border rounded-lg p-4 relative group">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Variable className="h-5 w-5 text-indigo-500" />
                                                <h3 className="font-semibold text-sm">Dynamic Content</h3>
                                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border z-50 hidden group-hover:block">
                                                    Percentage of properties using dynamic expressions (@{'{...}'}) vs hardcoded values. Higher is generally better for reusability.
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className={`text-2xl font-bold ${pipelineMetrics.dynamicScore >= 70 ? 'text-green-500' : pipelineMetrics.dynamicScore >= 30 ? 'text-blue-500' : 'text-slate-500'}`}>
                                                    {pipelineMetrics.dynamicScore}%
                                                </div>
                                                <div className="text-xs text-muted-foreground text-right max-w-[120px]">
                                                    Use of expressions / parameters
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-muted/30 border rounded-lg p-4 relative group">
                                            <div className="flex items-center gap-2 mb-3">
                                                <PieChart className="h-5 w-5 text-purple-500" />
                                                <h3 className="font-semibold text-sm">Composition</h3>
                                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border z-50 hidden group-hover:block">
                                                    Breakdown of pipeline role: Data Movement (Copy), Compute (Transform), and Orchestration (Control Flow).
                                                </div>
                                            </div>
                                            <div className="flex h-4 rounded-full overflow-hidden mb-2">
                                                {pipelineMetrics.composition.dataMovement > 0 && <div className="bg-blue-500" style={{ width: `${(pipelineMetrics.composition.dataMovement / pipelineMetrics.totalActivities) * 100}%` }} title="Data Movement" />}
                                                {pipelineMetrics.composition.orchestration > 0 && <div className="bg-slate-500" style={{ width: `${(pipelineMetrics.composition.orchestration / pipelineMetrics.totalActivities) * 100}%` }} title="Orchestration" />}
                                                {pipelineMetrics.composition.compute > 0 && <div className="bg-orange-500" style={{ width: `${(pipelineMetrics.composition.compute / pipelineMetrics.totalActivities) * 100}%` }} title="Compute" />}
                                            </div>
                                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />Data</div>
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500" />Orch</div>
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" />Comp</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Complexity & Error Coverage */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-muted/30 border rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Zap className="h-5 w-5 text-primary" />
                                                <h3 className="font-semibold">Complexity Analysis</h3>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Score</span>
                                                <span className="font-bold text-lg">{pipelineMetrics.complexityScore}/100</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-2 mt-2 mb-3">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${pipelineMetrics.complexityLevel === 'Simple' ? 'bg-green-500' :
                                                        pipelineMetrics.complexityLevel === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}
                                                    style={{ width: `${pipelineMetrics.complexityScore}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Level</span>
                                                <span className={`font-semibold px-2 py-0.5 rounded ${pipelineMetrics.complexityLevel === 'Simple' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                                                    pipelineMetrics.complexityLevel === 'Medium' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                                        'bg-red-500/20 text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {pipelineMetrics.complexityLevel}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-muted/30 border rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Shield className="h-5 w-5 text-primary" />
                                                <h3 className="font-semibold">Error Coverage</h3>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Coverage</span>
                                                <span className="font-bold text-lg">{pipelineMetrics.errorCoverage}%</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-2 mt-2 mb-3">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${pipelineMetrics.errorCoverage >= 80 ? 'bg-green-500' :
                                                        pipelineMetrics.errorCoverage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}
                                                    style={{ width: `${pipelineMetrics.errorCoverage}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Percentage of activities with proper failure handling (Failed/Completed conditions)
                                            </p>
                                        </div>
                                    </div>

                                    {/* Activity Type Breakdown */}
                                    <div className="bg-muted/30 border rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Activity className="h-5 w-5 text-primary" />
                                            <h3 className="font-semibold">Activity Type Breakdown</h3>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {Object.entries(pipelineMetrics.typeCounts).map(([type, count]) => {
                                                const colors = getActivityColor(type)
                                                return (
                                                    <div
                                                        key={type}
                                                        className="flex items-center gap-2 bg-background/50 rounded-lg p-3"
                                                    >
                                                        <div
                                                            className="w-3 h-3 rounded-full shrink-0"
                                                            style={{ backgroundColor: colors.bg }}
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="text-xs text-muted-foreground truncate">{type}</div>
                                                            <div className="font-bold">{count}</div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Parameters & Variables */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-muted/30 border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-muted-foreground">Parameters</span>
                                                <span className="font-bold text-lg">{pipelineMetrics.parameterCount}</span>
                                            </div>
                                        </div>
                                        <div className="bg-muted/30 border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-muted-foreground">Variables</span>
                                                <span className="font-bold text-lg">{pipelineMetrics.variableCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'validation' && (
                        <div className="h-full border rounded-lg p-6 overflow-y-auto space-y-6">
                            {metadata.activities.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <div className="text-center">
                                        <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                        <p>Paste a pipeline JSON to validate best practices</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Summary */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div
                                            className={`bg-red-500/10 border rounded p-4 cursor-pointer transition-all hover:bg-red-500/20 ${filterSeverity === 'critical' ? 'ring-2 ring-red-500 border-red-500 bg-red-500/20' : 'border-red-500/30'}`}
                                            onClick={() => setFilterSeverity(prev => prev === 'critical' ? 'all' : 'critical')}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                                <span className="font-semibold text-sm">Critical</span>
                                            </div>
                                            <p className="text-2xl font-bold">{criticalCount}</p>
                                        </div>
                                        <div
                                            className={`bg-yellow-500/10 border rounded p-4 cursor-pointer transition-all hover:bg-yellow-500/20 ${filterSeverity === 'warning' ? 'ring-2 ring-yellow-500 border-yellow-500 bg-yellow-500/20' : 'border-yellow-500/30'}`}
                                            onClick={() => setFilterSeverity(prev => prev === 'warning' ? 'all' : 'warning')}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                                <span className="font-semibold text-sm">Warnings</span>
                                            </div>
                                            <p className="text-2xl font-bold">{warningCount}</p>
                                        </div>
                                        <div
                                            className={`bg-blue-500/10 border rounded p-4 cursor-pointer transition-all hover:bg-blue-500/20 ${filterSeverity === 'recommendation' ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-500/20' : 'border-blue-500/30'}`}
                                            onClick={() => setFilterSeverity(prev => prev === 'recommendation' ? 'all' : 'recommendation')}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                <span className="font-semibold text-sm">Recommendations</span>
                                            </div>
                                            <p className="text-2xl font-bold">{recommendationCount}</p>
                                        </div>
                                    </div>

                                    {validationIssues.length === 0 ? (
                                        <div className="bg-green-500/10 border border-green-500/30 rounded p-6 text-center">
                                            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-600 dark:text-green-400" />
                                            <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                                                Excellent! No issues found.
                                            </p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Your pipeline follows best practices.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {validationIssues
                                                .filter(issue => filterSeverity === 'all' || issue.severity === filterSeverity)
                                                .length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded border border-dashed">
                                                    No issues found for the selected filter.
                                                </div>
                                            ) : (
                                                validationIssues
                                                    .filter(issue => filterSeverity === 'all' || issue.severity === filterSeverity)
                                                    .map((issue, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`border rounded p-4 ${issue.severity === 'critical'
                                                                ? 'bg-red-500/10 border-red-500/30'
                                                                : issue.severity === 'warning'
                                                                    ? 'bg-yellow-500/10 border-yellow-500/30'
                                                                    : 'bg-blue-500/10 border-blue-500/30'
                                                                }`}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                {issue.severity === 'critical' && (
                                                                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                                                                )}
                                                                {issue.severity === 'warning' && (
                                                                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                                                )}
                                                                {issue.severity === 'recommendation' && (
                                                                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                                                )}
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-xs font-semibold uppercase tracking-wider">
                                                                            {issue.category}
                                                                        </span>
                                                                        {issue.activityName && (
                                                                            <span className="text-xs bg-background px-2 py-0.5 rounded font-mono">
                                                                                {issue.activityName}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm">{issue.message}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                            )
                                            }
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'documentation' && (
                        <div className="h-[calc(100vh-280px)] border rounded-lg overflow-y-auto p-6 space-y-6">
                            {/* Header & Download */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">{metadata.name || 'Pipeline'} Documentation</h2>
                                    {metadata.description && <p className="text-sm text-muted-foreground mt-1">{metadata.description}</p>}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const csv = generateCsvDocumentation(metadata);
                                        const blob = new Blob([csv], { type: 'text/csv' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${metadata.name || 'pipeline'}_docs.csv`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    Export to CSV
                                </Button>
                            </div>

                            {/* Parameters Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b">Parameters ({Object.keys(metadata.parameters).length})</div>
                                {Object.keys(metadata.parameters).length > 0 ? (
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/30">
                                            <tr>
                                                <th className="text-left px-4 py-2 border-b">Name</th>
                                                <th className="text-left px-4 py-2 border-b">Type</th>
                                                <th className="text-left px-4 py-2 border-b">Default Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(metadata.parameters).map(([name, details]) => (
                                                <tr key={name} className="border-b last:border-b-0 hover:bg-muted/20">
                                                    <td className="px-4 py-2 font-mono text-xs">{name}</td>
                                                    <td className="px-4 py-2">{details.type}</td>
                                                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{JSON.stringify(details.defaultValue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="px-4 py-3 text-sm text-muted-foreground italic">No parameters defined</div>
                                )}
                            </div>

                            {/* Variables Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b">Variables ({Object.keys(metadata.variables).length})</div>
                                {Object.keys(metadata.variables).length > 0 ? (
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/30">
                                            <tr>
                                                <th className="text-left px-4 py-2 border-b">Name</th>
                                                <th className="text-left px-4 py-2 border-b">Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(metadata.variables).map(([name, details]) => (
                                                <tr key={name} className="border-b last:border-b-0 hover:bg-muted/20">
                                                    <td className="px-4 py-2 font-mono text-xs">{name}</td>
                                                    <td className="px-4 py-2">{details.type}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="px-4 py-3 text-sm text-muted-foreground italic">No variables defined</div>
                                )}
                            </div>

                            {/* Activities Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b">Activities ({metadata.activities.length})</div>
                                {metadata.activities.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/30">
                                                <tr>
                                                    <th className="text-left px-4 py-2 border-b">Name</th>
                                                    <th className="text-left px-4 py-2 border-b">Type</th>
                                                    <th className="text-left px-4 py-2 border-b">Description</th>
                                                    <th className="text-left px-4 py-2 border-b">Linked Service</th>
                                                    <th className="text-left px-4 py-2 border-b">Dependencies</th>
                                                    <th className="text-left px-4 py-2 border-b">Timeout</th>
                                                    <th className="text-left px-4 py-2 border-b">Retry</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {metadata.activities.map((act, idx) => (
                                                    <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                                                        <td className="px-4 py-2 font-medium">{act.name}</td>
                                                        <td className="px-4 py-2"><span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{act.type}</span></td>
                                                        <td className="px-4 py-2 text-muted-foreground max-w-xs truncate" title={act.description}>{act.description || '-'}</td>
                                                        <td className="px-4 py-2 font-mono text-xs">{act.linkedServiceName?.referenceName || '-'}</td>
                                                        <td className="px-4 py-2 text-xs">{act.dependsOn?.map(d => d.activity).join(', ') || '-'}</td>
                                                        <td className="px-4 py-2 text-xs font-mono">{act.policy?.timeout || '-'}</td>
                                                        <td className="px-4 py-2 text-xs">{act.policy?.retry || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="px-4 py-3 text-sm text-muted-foreground italic">No activities defined</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
                    <strong>Tip:</strong> Export your ADF pipeline JSON from Azure Portal → Author → Pipeline → Code (JSON) view.
                    This enhanced tool now includes visual flow diagrams, dependency analysis, and automated best practices validation.
                </div>
            </div >
        </div>


    )
}

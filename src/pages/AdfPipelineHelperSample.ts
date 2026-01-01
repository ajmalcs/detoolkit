// Sample: 4 critical, 5 warnings, 2 recommendations
export const COMPREHENSIVE_SAMPLE = {
    "name": "Customer_Orders_Pipeline",
    "properties": {
        "activities": [
            {
                "name": "Extract_Customers",
                "type": "Copy",
                "description": "Extract customer master data",
                "dependsOn": [],
                "policy": { "timeout": "0.01:00:00", "retry": 3 },
                "typeProperties": {
                    "source": { "type": "SqlServerSource", "dataset": { "referenceName": "SQL_Customers" } },
                    "sink": { "type": "ParquetSink", "dataset": { "referenceName": "Lake_Customers" } }
                }
            },
            {
                "name": "Extract_Orders",
                "type": "Copy",
                "description": "Extract order transactions",
                "dependsOn": [],
                "policy": { "timeout": "0.01:00:00", "retry": 2 },
                "typeProperties": {
                    "source": { "type": "RestSource", "dataset": { "referenceName": "API_Orders" } },
                    "sink": { "type": "JsonSink", "dataset": { "referenceName": "Lake_Orders" } }
                }
            },
            {
                "name": "Transform_Data",
                "type": "ExecuteDataFlow",
                "description": "Apply business rules",
                "dependsOn": [
                    { "activity": "Extract_Customers", "dependencyConditions": ["Succeeded"] },
                    { "activity": "Extract_Orders", "dependencyConditions": ["Succeeded"] }
                ],
                "policy": { "timeout": "0.00:30:00" }
            },
            {
                "name": "Load_Synapse",
                "type": "Copy",
                "dependsOn": [
                    { "activity": "Transform_Data", "dependencyConditions": ["Succeeded"] }
                ],
                "policy": { "timeout": "0.02:00:00" },
                "typeProperties": {
                    "source": { "type": "ParquetSource", "dataset": { "referenceName": "Lake_Validated" } },
                    "sink": { "type": "SqlDWSink", "dataset": { "referenceName": "Synapse_Fact" } }
                }
            },
            {
                "name": "Send_Notification",
                "type": "WebActivity",
                "linkedServiceName": { "referenceName": "LogicApp_Service", "type": "LinkedServiceReference" },
                "dependsOn": [
                    { "activity": "Load_Synapse", "dependencyConditions": ["Succeeded"] }
                ]
            },
            {
                "name": "Log_Extract_Failure",
                "type": "WebActivity",
                "description": "Log extraction errors",
                "dependsOn": [
                    { "activity": "Extract_Customers", "dependencyConditions": ["Failed"] },
                    { "activity": "Extract_Orders", "dependencyConditions": ["Failed"] }
                ],
                "policy": { "timeout": "0.00:05:00" }
            },
            {
                "name": "Log_Transform_Failure",
                "type": "WebActivity",
                "description": "Log transform errors",
                "dependsOn": [
                    { "activity": "Transform_Data", "dependencyConditions": ["Failed"] }
                ],
                "policy": { "timeout": "0.00:05:00" }
            },
            {
                "name": "Log_Load_Failure",
                "type": "WebActivity",
                "description": "Log load errors",
                "dependsOn": [
                    { "activity": "Load_Synapse", "dependencyConditions": ["Failed"] }
                ],
                "policy": { "timeout": "0.00:05:00" }
            },

            // Smart Rec: Parallelism Opportunity (Chain of 3 lightweight activities)
            {
                "name": "Check_Status_1",
                "type": "WebActivity",
                "description": "Check system status",
                "dependsOn": [{ "activity": "Send_Notification", "dependencyConditions": ["Succeeded"] }],
                "policy": { "timeout": "0.00:01:00" },
                "typeProperties": { "url": "https://api.example.com/status", "method": "GET" }
            },
            {
                "name": "Check_Status_2",
                "type": "WebActivity",
                "description": "Check secondary status",
                "dependsOn": [{ "activity": "Check_Status_1", "dependencyConditions": ["Succeeded"] }],
                "policy": { "timeout": "0.00:01:00" },
                "typeProperties": { "url": "https://api.example.com/status2", "method": "GET" }
            },
            {
                "name": "Check_Status_3",
                "type": "WebActivity",
                "description": "Check tertiary status",
                "dependsOn": [{ "activity": "Check_Status_2", "dependencyConditions": ["Succeeded"] }],
                "policy": { "timeout": "0.00:01:00" },
                "typeProperties": { "url": "https://api.example.com/status3", "method": "GET" }
            },

            // Smart Rec: Cost Risk (Heavy compute in parallel loop)
            {
                "name": "Process_Each_Region",
                "type": "ForEach",
                "dependsOn": [
                    { "activity": "Transform_Data", "dependencyConditions": ["Succeeded"] }
                ],
                "typeProperties": {
                    "isSequential": false,
                    "items": { "value": "@pipeline().parameters.Regions", "type": "Expression" },
                    "activities": [
                        {
                            "name": "Heavy_Compute_Job",
                            "type": "DatabricksNotebook",
                            "linkedServiceName": { "referenceName": "Databricks_LS", "type": "LinkedServiceReference" },
                            "typeProperties": { "notebookPath": "/Users/jobs/heavy_calc" }
                        }
                    ]
                }
            },

            // Smart Rec: Logic Risk (Infinite Loop - variable not updated)
            {
                "name": "Wait_For_Status",
                "type": "Until",
                "dependsOn": [
                    { "activity": "Load_Synapse", "dependencyConditions": ["Succeeded"] }
                ],
                "typeProperties": {
                    "expression": { "value": "@equals(variables('BatchId'), 'Ready')", "type": "Expression" },
                    "activities": [
                        {
                            "name": "Check_File",
                            "type": "GetMetadata",
                            "typeProperties": {
                                "dataset": { "referenceName": "Input_File" },
                                "fieldList": ["exists"]
                            }
                        },
                        {
                            "name": "Wait_10s",
                            "type": "Wait",
                            "typeProperties": { "waitTimeInSeconds": 10 }
                        }
                    ],
                    "timeout": "0.00:10:00"
                }
            },

            // Child Pipeline Discovery Test
            {
                "name": "Trigger_Reconciliation",
                "type": "ExecutePipeline",
                "dependsOn": [
                    { "activity": "Wait_For_Status", "dependencyConditions": ["Succeeded"] }
                ],
                "typeProperties": {
                    "pipeline": { "referenceName": "Finance_Reconciliation_V2" },
                    "waitOnCompletion": true
                }
            }
        ],
        "parameters": {
            "SourcePath": {
                "type": "String",
                "defaultValue": "/data/input",
                "description": "Source data lake path"
            },
            "TargetSchema": {
                "type": "String",
                "defaultValue": "dbo",
                "description": "Target Synapse schema"
            },
            "QualityThreshold": {
                "type": "Int",
                "defaultValue": 95
            },
            "ProcessDate": {
                "type": "String"
            }
        },
        "variables": {
            "BatchId": { "type": "String", "defaultValue": "" }
        }
    }
}

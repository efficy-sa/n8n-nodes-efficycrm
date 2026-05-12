import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, ApplicationError } from 'n8n-workflow';

/**
 * efficy Enterprise Action node — "efficy Action"
 *
 * API contexts:
 *   api     — stateless calls  (consultmanyex, delete, addlink, query…)
 *   consult — read a single record  (master, dataContainer, category, detail…)
 *   edit    — create / update / mutate a record  (update, insertDetail…)
 *
 * Reference: https://help.efficy.io/edn/rpcrequests
 */
export class Efficy implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'efficy Enterprise CRM',
    name: 'efficy',
    icon: 'file:efficy.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["resource"]}} — {{$parameter["operation"]}}',
    description: 'Calls the efficy Enterprise JSON API API',
    defaults: { name: 'efficy Enterprise CRM' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'efficyApi', required: true }],
    properties: [

      // ── Resource ──────────────────────────────────────────────────────────
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        // eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
        options: [
          { name: 'Entity',   value: 'entity'   },
          { name: 'Relation', value: 'relation' },
          { name: 'Query',    value: 'query'    },
          { name: 'Search',   value: 'search'   },
          { name: 'Tool',     value: 'tool'     },
        ],
        default: 'entity',
      },

      // ── Operation: Entity ─────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['entity'] } },
        // eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
        options: [
          {
            name: 'Consult',
            value: 'consultEntity',
            description: 'Read a single entity by key (API: consult)',
            action: 'Consult an entity',
          },
          {
            name: 'Create',
            value: 'createEntity',
            description: 'Create a new entity (API: edit key=0 + update)',
            action: 'Create an entity',
          },
          {
            name: 'Delete',
            value: 'deleteEntity',
            description: 'Delete one or more entities (API: delete)',
            action: 'Delete an entity',
          },
          {
            name: 'Update',
            value: 'updateEntity',
            description: 'Update fields on an existing entity (API: edit + update)',
            action: 'Update an entity',
          },
          {
            name: 'Custom API Call',
            value: 'custom',
            description: 'Write a raw JSON RPC request body (API: any)',
            action: 'Execute a custom API call',
          },
        ],
        default: 'consultEntity',
      },

      // ── Operation: Query ──────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['query'] } },
        options: [
          {
            name: 'Run Query',
            value: 'runQuery',
            description: 'Execute a saved query by K_QUERY or K_MASTER + K_DETAIL (API: query)',
            action: 'Run a query',
          },
          {
            name: 'Consult Many Entities',
            value: 'consultManyEntities',
            description: 'Find records matching exact field values (API: consultmanyex)',
            action: 'Consult many entities',
          },
          {
            name: 'Custom API Call',
            value: 'custom',
            description: 'Write a raw JSON RPC request body (API: any)',
            action: 'Execute a custom API call',
          },
        ],
        default: 'consultManyEntities',
      },

      // ── Operation: Search ─────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['search'] } },
        options: [
          {
            name: 'Fast Search',
            value: 'searchFast',
            description: 'Index-based fast search on the entity grid (API: search SEARCHFAST)',
            action: 'Fast search',
          },
          {
            name: 'Full Text Search',
            value: 'searchFull',
            description: 'Full-text search across all fields (API: search SEARCHFULL)',
            action: 'Full text search',
          },
          {
            name: 'Elastic Search',
            value: 'searchElastic',
            description: 'Elasticsearch-powered full-text search (API: search SEARCHELASTIC)',
            action: 'Elastic search',
          },
          {
            name: 'Custom API Call',
            value: 'custom',
            description: 'Write a raw JSON RPC request body (API: any)',
            action: 'Execute a custom API call',
          },
        ],
        default: 'searchFast',
      },

      // ── Search: shared parameters ──────────────────────────────────────────
      {
        displayName: 'Entity',
        name: 'searchEntity',
        type: 'string',
        default: '',
        placeholder: 'Comp',
        description: 'Entity code to search in (e.g. Comp, Cont, Proj)',
        displayOptions: { show: { resource: ['search'], operation: ['searchFast', 'searchFull', 'searchElastic'] } },
        required: true,
      },
      {
        displayName: 'Search Value',
        name: 'searchValue',
        type: 'string',
        default: '',
        placeholder: 'Acme',
        description: 'Text to search for',
        displayOptions: { show: { resource: ['search'], operation: ['searchFast', 'searchFull', 'searchElastic'] } },
        required: true,
      },
      {
        displayName: 'Options',
        name: 'searchOptions',
        type: 'collection',
        placeholder: 'Add option',
        default: {},
        displayOptions: { show: { resource: ['search'], operation: ['searchFast', 'searchFull', 'searchElastic'] } },
        options: [
          {
            displayName: 'Opened Only',
            name: 'opened',
            type: 'boolean',
            default: false,
            description: 'Whether to return only opened records',
          },
          {
            displayName: 'Own Records Only',
            name: 'own',
            type: 'boolean',
            default: false,
            description: 'Whether to return only records owned by the current user',
          },
          {
            displayName: 'Contains (vs. Starts With)',
            name: 'contains',
            type: 'boolean',
            default: true,
            description: 'Whether to match anywhere in the field (contains) rather than only at the start',
          },
          {
            displayName: 'Return Full Response',
            name: 'returnFullResponse',
            type: 'boolean',
            default: false,
            description: 'Whether to return the complete API response array instead of the first context result',
          },
        ],
      },

      // ── Operation: Relation ───────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['relation'] } },
        // eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
        options: [
          {
            name: 'Add Link',
            value: 'addLink',
            description: 'Add a relation between two records (API: addlink)',
            action: 'Add a link',
          },
          {
            name: 'Delete All Relations',
            value: 'clearDetail',
            description: 'Remove all detail relations of a given entity in an edit context (API: edit + clearDetail)',
            action: 'Delete all relations',
          },
          {
            name: 'Delete Detail',
            value: 'deleteDetail',
            description: 'Remove a specific detail relation in an edit context (API: edit + deleteDetail)',
            action: 'Delete a detail',
          },
          {
            name: 'Delete Link',
            value: 'deleteLink',
            description: 'Remove a relation between two records (API: deletelink)',
            action: 'Delete a link',
          },
          {
            name: 'Insert Detail',
            value: 'insertDetail',
            description: 'Add a detail relation in an edit context (API: edit + insertDetail)',
            action: 'Insert a detail',
          },
          {
            name: 'Update Detail',
            value: 'updateDetail',
            description: 'Update fields of a detail relation in an edit context (API: edit + updateDetail)',
            action: 'Update a detail',
          },
          {
            name: 'Custom API Call',
            value: 'custom',
            description: 'Write a raw JSON RPC request body (API: any)',
            action: 'Execute a custom API call',
          },
        ],
        default: 'addLink',
      },

      // ── Operation: Utils ──────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['tool'] } },
        // eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
        options: [
          {
            name: 'Get Current User Code',
            value: 'getCurrentUserCode',
            description: 'Return the user code of the authenticated user (API: currentusername)',
            action: 'Get current user code',
          },
          {
            name: 'Get Current User Full Name',
            value: 'getCurrentUserFullName',
            description: 'Return the full name of the authenticated user (API: currentuserfullname)',
            action: 'Get current user full name',
          },
          {
            name: 'Get Lookup Data',
            value: 'getLookupData',
            description: 'Return the list of lookup values for a field (API: getlookupdata)',
            action: 'Get lookup data',
          },
          {
            name: 'Get Lookup Key From Value',
            value: 'getLookupKeyFromValue2',
            description: 'Resolve a lookup display value to its key integer (API: getlookupkeyfromvalue2)',
            action: 'Get lookup key from value',
          },
          {
            name: 'Get Lookup Value From Key',
            value: 'getLookupValueFromKey2',
            description: 'Resolve a lookup key integer to its display value (API: getlookupvaluefromkey2)',
            action: 'Get lookup value from key',
          },
          {
            name: 'Get Setting',
            value: 'getSetting',
            description: 'Read an efficy server setting by name (API: getsetting)',
            action: 'Get setting',
          },
          {
            name: 'Send Notification',
            value: 'sendNotification',
            description: 'Send a notification to efficy users or groups (API: sendnotification)',
            action: 'Send a notification',
          },
          {
            name: 'Finalize Workflow',
            value: 'finalizeWorkflow',
            description: 'Use this as the last node in workflows that have Server Side Cache enabled',
            action: 'Finalize workflow',
          },
          {
            name: 'Custom API Call',
            value: 'custom',
            description: 'Write a raw JSON RPC request body (API: any)',
            action: 'Execute a custom API call',
          },
        ],
        default: 'getLookupData',
      },

      // ══════════════════════════════════════════════════════════════════════
      // SHARED FIELDS
      // ══════════════════════════════════════════════════════════════════════

      // ── Shared: entity ────────────────────────────────────────────────────
      {
        displayName: 'Entity',
        name: 'entity',
        type: 'string',
        default: '',
        placeholder: 'Comp',
        description: 'Efficy entity code, e.g. Comp, Cont, Oppo, Acti, Docu, Proj',
        displayOptions: {
          show: {
            operation: [
              'consultEntity', 'consultManyEntities', 'createEntity', 'updateEntity', 'deleteEntity',
              'addLink', 'deleteLink',
              'insertDetail', 'updateDetail', 'deleteDetail', 'clearDetail',
            ],
          },
        },
        required: true,
      },

      // ── Shared: entity key ────────────────────────────────────────────────
      {
        displayName: 'Entity Key',
        name: 'entityKey',
        type: 'number',
        default: 0,
        description: 'Primary key of the entity',
        displayOptions: {
          show: {
            operation: [
              'consultEntity', 'updateEntity',
              'addLink', 'deleteLink',
              'insertDetail', 'updateDetail', 'deleteDetail', 'clearDetail',
            ],
          },
        },
        required: true,
      },

      // ══════════════════════════════════════════════════════════════════════
      // OPERATION-SPECIFIC FIELDS
      // ══════════════════════════════════════════════════════════════════════

      // ── Entity: Consult (consult) ─────────────────────────────────────────
      // The consult context always starts with master(tableview:0).
      // Extra functions let you add more sub-requests in the same context.
      {
        displayName: 'Extra Functions',
        name: 'consultFunctions',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        default: {},
        placeholder: 'Add function',
        description: 'Additional API functions inside the consult context',
        displayOptions: { show: { operation: ['consultEntity'] } },
        options: [{
          name: 'items',
          displayName: 'Function',
          values: [
            {
              displayName: 'Function Name',
              name: 'funcName',
              type: 'options',
              options: [
                { name: 'Master — Main Record Fields (Tableview)',      value: 'master'        },
                { name: 'dataContainer — Raw Data Container',           value: 'dataContainer' },
                { name: 'Category — Category Tableview Fields',         value: 'category'      },
                { name: 'Detail — Detail/relation Rows',                value: 'detail'        },
              ],
              default: 'master',
            },
            {
              displayName: 'Parameter',
              name: 'funcParam',
              type: 'string',
              default: '',
              placeholder: 'master → tableview e.g. 0 | category → COMP$ADDRESS | detail → Acti',
            },
          ],
        }],
      },

      // ── Entity: Create / Update (edit + update) ───────────────────────────
      {
        displayName: 'Fields (JSON)',
        name: 'entityFields',
        type: 'json',
        default: '{\n  "NAME": ""\n}',
        description: 'Field name → value pairs sent as @data to the update function. Dates in ISO 8601.',
        displayOptions: { show: { operation: ['createEntity', 'updateEntity'] } },
        required: true,
      },
      {
        displayName: 'Category',
        name: 'category',
        type: 'string',
        default: '',
        placeholder: 'CONT$EMPLOYEE',
        description: 'API update param: write into this category tableview. Leave blank to target the main tableview (tableview:0).',
        displayOptions: { show: { operation: ['createEntity', 'updateEntity'] } },
      },

      // ── Entity: Delete (delete) ───────────────────────────────────────────
      {
        displayName: 'Keys',
        name: 'keys',
        type: 'string',
        default: '',
        placeholder: '123 or 123;456',
        description: 'API delete param: semicolon-separated list of entity keys to delete',
        displayOptions: { show: { operation: ['deleteEntity'] } },
        required: true,
      },

      // ── Query: Consult Many Entities (consultmanyex) ─────────────────────────────
      {
        displayName: 'Find Field(s)',
        name: 'findfield',
        type: 'string',
        default: '',
        placeholder: 'NAME or NAME;COUNTRY',
        description: 'API consultmanyex param: separator-delimited field names to filter on',
        displayOptions: { show: { operation: ['consultManyEntities'] } },
        required: true,
      },
      {
        displayName: 'Value(s)',
        name: 'searchKeys',
        type: 'string',
        default: '',
        placeholder: 'Acme or Acme;Belgium',
        description: 'API consultmanyex param: separator-delimited values matching the order of Find Field(s)',
        displayOptions: { show: { operation: ['consultManyEntities'] } },
        required: true,
      },
      {
        displayName: 'Order By Field',
        name: 'orderbyfield',
        type: 'string',
        default: '',
        placeholder: 'D_CHANGE',
        description: 'API consultmanyex param: field name to sort results by',
        displayOptions: { show: { operation: ['consultManyEntities'] } },
      },
      {
        displayName: 'Separator',
        name: 'separator',
        type: 'string',
        default: ';',
        description: 'API consultmanyex param: separator used in Find Field(s) and Value(s)',
        displayOptions: { show: { operation: ['consultManyEntities'] } },
      },

      // ── Search: Run Query (query) ─────────────────────────────────────────
      {
        displayName: 'Query Key',
        name: 'queryKey',
        type: 'number',
        default: 0,
        description: 'API query param: K_QUERY of the saved query. When set, Master/Detail keys are ignored.',
        displayOptions: { show: { operation: ['runQuery'] } },
      },
      {
        displayName: 'Master Key',
        name: 'queryMaster',
        type: 'number',
        default: 0,
        description: 'API query param: K_MASTER of the query (required when Query Key is 0)',
        displayOptions: { show: { operation: ['runQuery'] } },
      },
      {
        displayName: 'Detail Key',
        name: 'queryDetail',
        type: 'number',
        default: 0,
        description: 'API query param: K_DETAIL of the query (required when Query Key is 0)',
        displayOptions: { show: { operation: ['runQuery'] } },
      },
      {
        displayName: 'Query Parameters',
        name: 'queryParams',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        default: {},
        placeholder: 'Add parameter',
        description: 'API query param: extra named parameters passed to the query',
        displayOptions: { show: { operation: ['runQuery'] } },
        options: [{
          name: 'items',
          displayName: 'Parameter',
          values: [
            { displayName: 'Name',  name: 'name',  type: 'string', default: 'param1' },
            { displayName: 'Value', name: 'value', type: 'string', default: '' },
          ],
        }],
      },

      // ── Utils: Get Lookup Data (getlookupdata) ────────────────────────────
      {
        displayName: 'Entity',
        name: 'lookupEntity',
        type: 'string',
        default: '',
        placeholder: 'Oppo',
        description: 'Entity code whose field lookup values you want (e.g. Oppo, Cont). Use this or Table ID.',
        displayOptions: { show: { operation: ['getLookupData'] } },
      },
      {
        displayName: 'Table ID',
        name: 'lookupTableId',
        type: 'number',
        default: 0,
        description: 'Efficy table ID (e.g. 11000). Use this or Entity. Takes precedence over Entity if both set.',
        displayOptions: { show: { operation: ['getLookupData'] } },
      },
      {
        displayName: 'Field Name',
        name: 'lookupFieldName',
        type: 'string',
        default: '',
        placeholder: 'STATUS',
        description: 'Field name whose lookup values to retrieve',
        displayOptions: { show: { operation: ['getLookupData'] } },
        required: true,
      },

      // ── Utils: Get Lookup Key From Value (getlookupkeyfromvalue2) ─────────
      {
        displayName: 'Lookup Table Name',
        name: 'lookupTableName',
        type: 'string',
        default: '',
        placeholder: 'LK_COUNTRY',
        description: 'Name of the lookup table (e.g. LK_COUNTRY)',
        displayOptions: { show: { operation: ['getLookupKeyFromValue2'] } },
        required: true,
      },
      {
        displayName: 'Field Name',
        name: 'lookupKeyFieldName',
        type: 'string',
        default: '',
        placeholder: 'COUNTRY',
        description: 'Field name in the lookup table',
        displayOptions: { show: { operation: ['getLookupKeyFromValue2'] } },
        required: true,
      },
      {
        displayName: 'Value',
        name: 'lookupValue',
        type: 'string',
        default: '',
        placeholder: 'Belgium',
        description: 'Display value to resolve to its key integer',
        displayOptions: { show: { operation: ['getLookupKeyFromValue2'] } },
        required: true,
      },
      {
        displayName: 'Search In Translations',
        name: 'searchInTranslations',
        type: 'boolean',
        default: false,
        description: 'Whether to also search across translated values',
        displayOptions: { show: { operation: ['getLookupKeyFromValue2'] } },
      },

      // ── Utils: Get Lookup Value From Key (getlookupvaluefromkey2) ────────
      {
        displayName: 'Lookup Table Name',
        name: 'lookupValueTableName',
        type: 'string',
        default: '',
        placeholder: 'LK_COUNTRY',
        displayOptions: { show: { operation: ['getLookupValueFromKey2'] } },
        required: true,
      },
      {
        displayName: 'Field Name',
        name: 'lookupValueFieldName',
        type: 'string',
        default: '',
        placeholder: 'COUNTRY',
        displayOptions: { show: { operation: ['getLookupValueFromKey2'] } },
        required: true,
      },
      {
        displayName: 'Key',
        name: 'lookupKeyValue',
        type: 'number',
        default: 0,
        displayOptions: { show: { operation: ['getLookupValueFromKey2'] } },
        required: true,
      },

      // ── Utils: Get Setting (getsetting) ───────────────────────────────────
      {
        displayName: 'Setting Name',
        name: 'settingName',
        type: 'string',
        default: '',
        placeholder: 'UseLinkedFile',
        description: 'Name of the efficy setting to read',
        displayOptions: { show: { operation: ['getSetting'] } },
        required: true,
      },
      {
        displayName: 'Module',
        name: 'settingModule',
        type: 'string',
        default: '',
        placeholder: 'user',
        description: 'Module (JSON object) that owns the setting. Leave blank for global settings.',
        displayOptions: { show: { operation: ['getSetting'] } },
      },
      {
        displayName: 'Return As String',
        name: 'settingAsString',
        type: 'boolean',
        default: false,
        description: 'Whether to return DateTime values as a formatted string instead of a float',
        displayOptions: { show: { operation: ['getSetting'] } },
      },

      // ── Relation: Add Link / Delete Link (addlink / deletelink) ───────────
      {
        displayName: 'Detail Entity',
        name: 'detail',
        type: 'string',
        default: '',
        placeholder: 'Comp',
        description: 'API addlink/deletelink param: entity of the record to link',
        displayOptions: { show: { operation: ['addLink', 'deleteLink'] } },
        required: true,
      },
      {
        displayName: 'Detail Key',
        name: 'detailkey',
        type: 'string',
        default: '',
        placeholder: '456',
        description: 'API addlink/deletelink param: key of the record to link',
        displayOptions: { show: { operation: ['addLink', 'deleteLink'] } },
        required: true,
      },
      {
        displayName: 'Ignore Existing',
        name: 'ignoreexisting',
        type: 'boolean',
        default: false,
        description: 'Whether to skip the error if the relation already exists',
        displayOptions: { show: { operation: ['addLink'] } },
      },

      // ── Relation: Insert Detail (edit + insertDetail) ─────────────────────
      {
        displayName: 'Detail Entity',
        name: 'insertDetailEntity',
        type: 'string',
        default: '',
        placeholder: 'Cont',
        description: 'API insertDetail param: entity of the detail record to link',
        displayOptions: { show: { operation: ['insertDetail'] } },
        required: true,
      },
      {
        displayName: 'Detail Key',
        name: 'insertDetailKey',
        type: 'string',
        default: '',
        placeholder: '71',
        description: 'API insertDetail param: key of the detail record to link',
        displayOptions: { show: { operation: ['insertDetail'] } },
        required: true,
      },

      // ── Relation: Update Detail (edit + updateDetail) ─────────────────────
      {
        displayName: 'Detail Entity',
        name: 'updateDetailEntity',
        type: 'string',
        default: '',
        placeholder: 'Prod',
        description: 'API updateDetail param: entity of the detail to update',
        displayOptions: { show: { operation: ['updateDetail'] } },
        required: true,
      },
      {
        displayName: 'Detail Key',
        name: 'updateDetailKey',
        type: 'string',
        default: '',
        placeholder: '56_865114542',
        description: 'API updateDetail param: key of the detail. Format: K_xxx or K_xxx_K_RELATION (e.g. 56_865114542).',
        displayOptions: { show: { operation: ['updateDetail'] } },
        required: true,
      },
      {
        displayName: 'Fields (JSON)',
        name: 'updateDetailFields',
        type: 'json',
        default: '{\n  "QUANTITY": 1\n}',
        description: 'API updateDetail param: field name → value pairs sent as @data',
        displayOptions: { show: { operation: ['updateDetail'] } },
        required: true,
      },

      // ── Relation: Delete Detail (edit + deleteDetail) ─────────────────────
      {
        displayName: 'Detail Entity',
        name: 'deleteDetailEntity',
        type: 'string',
        default: '',
        placeholder: 'Comp',
        description: 'API deleteDetail param: entity of the detail to remove',
        displayOptions: { show: { operation: ['deleteDetail'] } },
        required: true,
      },
      {
        displayName: 'Detail Key',
        name: 'deleteDetailKey',
        type: 'string',
        default: '',
        placeholder: '44 or 8541_8',
        description: 'API deleteDetail param: key of the detail to remove',
        displayOptions: { show: { operation: ['deleteDetail'] } },
        required: true,
      },

      // ── Relation: Clear Detail (edit + clearDetail) ───────────────────────
      {
        displayName: 'Detail Entity',
        name: 'clearDetailEntity',
        type: 'string',
        default: '',
        placeholder: 'Proj',
        description: 'API clearDetail param: all relations for this entity will be removed',
        displayOptions: { show: { operation: ['clearDetail'] } },
        required: true,
      },

      // ── Notification: Send (sendnotification) ─────────────────────────────
      {
        displayName: 'Users',
        name: 'users',
        type: 'string',
        default: '',
        placeholder: '7;3',
        description: 'API sendnotification param: semicolon-separated user codes or group codes',
        displayOptions: { show: { operation: ['sendNotification'] } },
        required: true,
      },
      {
        displayName: 'Subject',
        name: 'subject',
        type: 'string',
        default: '',
        description: 'API sendnotification param: notification subject',
        displayOptions: { show: { operation: ['sendNotification'] } },
        required: true,
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        description: 'API sendnotification param: optional notification body text',
        displayOptions: { show: { operation: ['sendNotification'] } },
      },
      {
        displayName: 'Entity',
        name: 'notifEntity',
        type: 'string',
        default: '',
        placeholder: 'Cont',
        description: 'API sendnotification param: optional entity the notification relates to',
        displayOptions: { show: { operation: ['sendNotification'] } },
      },
      {
        displayName: 'Key',
        name: 'notifKey',
        type: 'number',
        default: 0,
        description: 'API sendnotification param: optional key of the record the notification relates to',
        displayOptions: { show: { operation: ['sendNotification'] } },
      },
      {
        displayName: 'Custom Params (JSON)',
        name: 'customparams',
        type: 'string',
        default: '',
        placeholder: '{"foo":"bar"}',
        description: 'API sendnotification param: optional JSON object passed as customparams',
        displayOptions: { show: { operation: ['sendNotification'] } },
      },

      // ── Custom: Raw API (per resource) ────────────────────────────────────
      {
        displayName: 'API Request Body',
        name: 'rpcBody',
        type: 'json',
        default: JSON.stringify(
          [{ '@name': 'consult', entity: 'Comp', key: 1, '@func': [{ '@name': 'master' }] }],
          null, 2,
        ),
        description: 'Full efficy JSON API request body. Must be a JSON array of context objects.',
        displayOptions: { show: { resource: ['entity'], operation: ['custom'] } },
        required: true,
      },
      {
        displayName: 'API Request Body',
        name: 'rpcBody',
        type: 'json',
        default: JSON.stringify(
          [{ '@name': 'api', '@func': [{ '@name': 'addlink', entity1: 'Comp', key1: 1, entity2: 'Cont', key2: 2 }] }],
          null, 2,
        ),
        description: 'Full efficy JSON API request body. Must be a JSON array of context objects.',
        displayOptions: { show: { resource: ['relation'], operation: ['custom'] } },
        required: true,
      },
      {
        displayName: 'API Request Body',
        name: 'rpcBody',
        type: 'json',
        default: JSON.stringify(
          [{ '@name': 'api', '@func': [{ '@name': 'consultmanyex', entity: 'Comp', findfield: 'NAME', keys: 'Acme', separator: ';' }] }],
          null, 2,
        ),
        description: 'Full efficy JSON API request body. Must be a JSON array of context objects.',
        displayOptions: { show: { resource: ['query'], operation: ['custom'] } },
        required: true,
      },
      {
        displayName: 'API Request Body',
        name: 'rpcBody',
        type: 'json',
        default: JSON.stringify(
          [{ '@name': 'search', entity: 'Comp', value: 'Acme', method: 'SEARCHFAST', '@func': [{ '@name': 'master' }] }],
          null, 2,
        ),
        description: 'Full efficy JSON API request body. Must be a JSON array of context objects.',
        displayOptions: { show: { resource: ['search'], operation: ['custom'] } },
        required: true,
      },
      {
        displayName: 'API Request Body',
        name: 'rpcBody',
        type: 'json',
        default: JSON.stringify(
          [{ '@name': 'api', '@func': [{ '@name': 'currentuserfullname' }] }],
          null, 2,
        ),
        description: 'Full efficy JSON API request body. Must be a JSON array of context objects.',
        displayOptions: { show: { resource: ['tool'], operation: ['custom'] } },
        required: true,
      },

      // ── Options ───────────────────────────────────────────────────────────
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        default: {},
        displayOptions: { hide: { resource: ['search'] } },
        options: [
          {
            displayName: 'Return Full Response',
            name: 'returnFullResponse',
            type: 'boolean',
            default: false,
            description: 'Whether to return the complete API response array instead of the first context result',
          },
        ],
      },
    ],
    usableAsTool: true,
  };

  // ── Execute ───────────────────────────────────────────────────────────────

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('efficyApi');
    const rawUrl      = (credentials.serverUrl as string).replace(/\/$/, '');
    const serverUrl   = rawUrl.endsWith('/crm') ? rawUrl : `${rawUrl}/crm`;
    const serverSideCache = credentials.serverSideCache as boolean;
    const customer    = (credentials.customer as string) || '';
    const customerHeader = customer ? { 'X-Efficy-Customer': customer } : {};

    // ── Cache reuse ───────────────────────────────────────────────────────────
    // When cache reuse is on, one cache token is obtained per execution
    // and shared across all efficy nodes via workflow static data.
    // The server returns X-Efficy-Cachetoken
    // which we send back on subsequent requests to reuse the server-side cache.
    // Tokens are keyed by execution ID and purged after 2 hours.

    type TokenEntry = { token: string; createdAt: number };
    type TokenStore = { cacheTokens?: Record<string, TokenEntry> };

    let cacheToken = '';

    if (serverSideCache) {
      const staticData = this.getWorkflowStaticData('global') as TokenStore;
      if (!staticData.cacheTokens) staticData.cacheTokens = {};

      // Purge tokens older than 2 hours
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      const now = Date.now();
      for (const id of Object.keys(staticData.cacheTokens)) {
        if (now - staticData.cacheTokens[id].createdAt > TWO_HOURS_MS) {
          delete staticData.cacheTokens[id];
        }
      }

      // Reuse or obtain a cache token for this execution
      const executionId = this.getExecutionId() ?? `exec-${now}`;
      const existing    = staticData.cacheTokens[executionId];

      if (existing) {
        cacheToken = existing.token;
      } else {
        // Lightweight call to obtain the cache token
        const initRes = await this.helpers.httpRequestWithAuthentication.call(this, 'efficyApi', {
          method: 'POST',
          url:    `${serverUrl}/json`,
          headers: { 'Content-Type': 'application/json', ...customerHeader },
          body: [{ '@name': 'api', '@func': [{ '@name': 'currentuserfullname' }] }],
          json: true,
          returnFullResponse: true,
        }) as { body: unknown; headers: Record<string, string | string[]> };

        cacheToken = extractCacheToken(initRes.headers);
        staticData.cacheTokens[executionId] = { token: cacheToken, createdAt: now };
      }
    }

    // ── Item loop ────────────────────────────────────────────────────────────

    for (let i = 0; i < items.length; i++) {
      const operation   = this.getNodeParameter('operation', i) as string;
      const resource    = this.getNodeParameter('resource', i) as string;
      const optionsParam = resource === 'search' ? 'searchOptions' : 'options';
      const options     = this.getNodeParameter(optionsParam, i, {}) as {
        returnFullResponse?: boolean;
      };

      // ── Finalize workflow  ─────────────────
      if (operation === 'finalizeWorkflow') {
        const sessionClosed = serverSideCache && !!cacheToken;
        if (sessionClosed) {
          await this.helpers.httpRequestWithAuthentication.call(this, 'efficyApi', {
            method:  'POST',
            url:     `${serverUrl}/json`,
            headers: {
              'Content-Type':        'application/json',
              'X-Efficy-Logoff':     'true',
              'X-Efficy-Cachetoken': cacheToken,
              ...customerHeader,
            },
            body: [{ '@name': 'api', '@func': [{ '@name': 'currentuserfullname' }] }],
            json: true,
          });
          const staticData  = this.getWorkflowStaticData('global') as TokenStore;
          const executionId = this.getExecutionId() ?? '';
          delete staticData.cacheTokens?.[executionId];
          cacheToken = '';
        }
        continue;
      }

      let rpcBody: IDataObject[];
      try {
        rpcBody = buildRpcBody(this, i, operation);
      } catch (error) {
        throw new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex: i });
      }

      const requestOptions: IHttpRequestOptions = {
        method: 'POST',
        url:    `${serverUrl}/json`,
        headers: {
          'Content-Type': 'application/json',
          ...((!serverSideCache || !cacheToken) ? { 'X-Efficy-Logoff': 'true' } : {}),
          ...(cacheToken ? { 'X-Efficy-Cachetoken': cacheToken } : {}),
          ...customerHeader,
        },
        body: rpcBody,
        json: true,
        ...(serverSideCache ? { returnFullResponse: true } : {}),
      };

      let rawResponse: unknown;
      try {
        rawResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'efficyApi', requestOptions);
      } catch (error) {
        // Network/HTTP errors (not efficy API errors which are always HTTP 200)
        const efficyMsg = (error as Error).message;
        if (this.continueOnFail()) {
          returnData.push({ json: { error: efficyMsg }, pairedItem: { item: i } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), efficyMsg, { itemIndex: i });
      }

      // Extract body; update stored token if rotated.
      let response: unknown;
      if (serverSideCache) {
        const full = rawResponse as {
          body:       unknown;
          headers:    Record<string, string | string[]>;
          statusCode: number;
        };
        response = full.body;
        const freshToken = cacheToken ? extractCacheToken(full.headers) : '';
        if (freshToken && freshToken !== cacheToken) {
          cacheToken = freshToken;
          // Persist rotated token for subsequent nodes
          const staticData = this.getWorkflowStaticData('global') as TokenStore;
          const executionId = this.getExecutionId() ?? '';
          if (staticData.cacheTokens?.[executionId]) {
            staticData.cacheTokens[executionId].token = freshToken;
          }
        }
      } else {
        response = rawResponse;
      }

      const efficyError = extractEfficyError(response);
      if (efficyError) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: efficyError }, pairedItem: { item: i } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), efficyError, { itemIndex: i });
      }

      let outputJson: IDataObject;
      if (options.returnFullResponse) {
        outputJson = Array.isArray(response) ? { response } : (response as IDataObject);
      } else {
        const arr  = Array.isArray(response) ? response : [response];
        outputJson = (arr[0] as IDataObject) ?? {};
      }

      returnData.push({ json: outputJson, pairedItem: { item: i } });
    }

    return [returnData];
  }
}

// ── API body builders ─────────────────────────────────────────────────────────

function buildRpcBody(ctx: IExecuteFunctions, i: number, op: string): IDataObject[] {

  // Wrap in api context (stateless)
  const api = (...funcs: IDataObject[]) => [{ '@name': 'api', '@func': funcs }];

  // Wrap in edit context — commits and closes (write operations)
  const edit = (entity: string, key: number, ...funcs: IDataObject[]) => [{
    '@name': 'edit', entity, key, commit: true, closecontext: true, '@func': funcs,
  }];

  switch (op) {

    // ── Entity ────────────────────────────────────────────────────────────────

    // API: consult context + master function
    case 'consultEntity': {
      const entity = ctx.getNodeParameter('entity', i) as string;
      const key    = ctx.getNodeParameter('entityKey', i) as number;
      const extra  = ((ctx.getNodeParameter('consultFunctions', i, {}) as { items?: Array<{ funcName: string; funcParam: string }> }).items) ?? [];
      const funcs: IDataObject[] = [{ '@name': 'master', tableview: 0 }];
      for (const fn of extra) {
        const f: IDataObject = { '@name': fn.funcName };
        if (fn.funcName === 'master')   f['tableview'] = fn.funcParam ? Number(fn.funcParam) : 0;
        if (fn.funcName === 'category') { if (fn.funcParam) f['category'] = fn.funcParam; }
        if (fn.funcName === 'detail')   { if (fn.funcParam) f['detail']   = fn.funcParam; }
        funcs.push(f);
      }
      return [{ '@name': 'consult', entity, key, closecontext: true, '@func': funcs }];
    }

    // API: edit context (key=0) + update function
    case 'createEntity': {
      const entity   = ctx.getNodeParameter('entity', i) as string;
      const fields   = parseJson(ctx.getNodeParameter('entityFields', i) as string | IDataObject);
      const category = ctx.getNodeParameter('category', i, '') as string;
      const upd: IDataObject = { '@name': 'update', '@data': fields };
      if (category) { upd['category'] = category; } else { upd['tableview'] = 0; }
      return edit(entity, 0, upd);
    }

    // API: edit context + update function
    case 'updateEntity': {
      const entity   = ctx.getNodeParameter('entity', i) as string;
      const key      = ctx.getNodeParameter('entityKey', i) as number;
      const fields   = parseJson(ctx.getNodeParameter('entityFields', i) as string | IDataObject);
      const category = ctx.getNodeParameter('category', i, '') as string;
      const upd: IDataObject = { '@name': 'update', '@data': fields };
      if (category) { upd['category'] = category; } else { upd['tableview'] = 0; }
      return edit(entity, key, upd);
    }

    // API: delete function
    case 'deleteEntity': {
      const entity = ctx.getNodeParameter('entity', i) as string;
      const keys   = ctx.getNodeParameter('keys', i) as string;
      return api({ '@name': 'delete', entity, keys });
    }

    // ── Utils ─────────────────────────────────────────────────────────────────

    case 'getLookupData': {
      const fieldname  = ctx.getNodeParameter('lookupFieldName', i) as string;
      const tableId    = ctx.getNodeParameter('lookupTableId', i, 0) as number;
      const entity     = ctx.getNodeParameter('lookupEntity', i, '') as string;
      const func: IDataObject = { '@name': 'getlookupdata', fieldname };
      if (tableId) { func['tableid'] = tableId; } else { func['entity'] = entity; }
      return api(func);
    }

    case 'getLookupKeyFromValue2': {
      const tablename           = ctx.getNodeParameter('lookupTableName', i) as string;
      const fieldname           = ctx.getNodeParameter('lookupKeyFieldName', i) as string;
      const value               = ctx.getNodeParameter('lookupValue', i) as string;
      const searchintranslations = ctx.getNodeParameter('searchInTranslations', i, false) as boolean;
      return api({ '@name': 'getlookupkeyfromvalue2', tablename, fieldname, value, searchintranslations });
    }

    case 'getLookupValueFromKey2': {
      const tablename = ctx.getNodeParameter('lookupValueTableName', i) as string;
      const fieldname = ctx.getNodeParameter('lookupValueFieldName', i) as string;
      const key       = ctx.getNodeParameter('lookupKeyValue', i) as number;
      return api({ '@name': 'getlookupvaluefromkey2', tablename, fieldname, key });
    }

    case 'getCurrentUserCode':
      return api({ '@name': 'currentusername' });

    case 'getCurrentUserFullName':
      return api({ '@name': 'currentuserfullname' });

    case 'getSetting': {
      const name     = ctx.getNodeParameter('settingName', i) as string;
      const module_  = ctx.getNodeParameter('settingModule', i, '') as string;
      const asstring = ctx.getNodeParameter('settingAsString', i, false) as boolean;
      const func: IDataObject = { '@name': 'getsetting', name };
      if (module_)  func['module']   = module_;
      if (asstring) func['asstring'] = asstring;
      return api(func);
    }

    // ── Query ─────────────────────────────────────────────────────────────────

    // API: consultmanyex function
    case 'consultManyEntities': {
      const entity       = ctx.getNodeParameter('entity', i) as string;
      const findfield    = ctx.getNodeParameter('findfield', i) as string;
      const keys         = ctx.getNodeParameter('searchKeys', i) as string;
      const orderbyfield = ctx.getNodeParameter('orderbyfield', i, '') as string;
      const separator    = ctx.getNodeParameter('separator', i, ';') as string;
      const func: IDataObject = { '@name': 'consultmanyex', entity, findfield, keys, separator };
      if (orderbyfield) func['orderbyfield'] = orderbyfield;
      return api(func);
    }

    // API: query function
    case 'runQuery': {
      const queryKey = ctx.getNodeParameter('queryKey', i) as number;
      const master   = ctx.getNodeParameter('queryMaster', i) as number;
      const detail   = ctx.getNodeParameter('queryDetail', i) as number;
      const params   = ((ctx.getNodeParameter('queryParams', i, {}) as { items?: Array<{ name: string; value: string }> }).items) ?? [];
      if (!queryKey && (!master || !detail)) throw new NodeOperationError(ctx.getNode(), 'Provide a Query Key or both Master Key and Detail Key');
      const func: IDataObject = { '@name': 'query' };
      if (queryKey) { func['key'] = queryKey; } else { func['master'] = master; func['detail'] = detail; }
      for (const p of params) func[p.name] = p.value;
      return api(func);
    }

    // ── Search ────────────────────────────────────────────────────────────────

    case 'searchFast':
    case 'searchFull':
    case 'searchElastic': {
      const methodMap: Record<string, string> = {
        searchFast:    'SEARCHFAST',
        searchFull:    'SEARCHFULL',
        searchElastic: 'SEARCHELASTIC',
      };
      const entity = ctx.getNodeParameter('searchEntity', i) as string;
      const value  = ctx.getNodeParameter('searchValue', i) as string;
      const opts   = ctx.getNodeParameter('searchOptions', i, {}) as {
        opened?: boolean;
        own?: boolean;
        contains?: boolean;
      };
      const req: IDataObject = {
        '@name': 'search',
        entity,
        value,
        method: methodMap[op],
        '@func': [{ '@name': 'master' }],
      };
      if (opts.opened   !== undefined) req['opened']   = opts.opened;
      if (opts.own      !== undefined) req['own']      = opts.own;
      if (opts.contains !== undefined) req['contains'] = opts.contains;
      return [req];
    }

    // ── Relation ──────────────────────────────────────────────────────────────

    // API: addlink function
    case 'addLink': {
      const entity         = ctx.getNodeParameter('entity', i) as string;
      const key            = ctx.getNodeParameter('entityKey', i) as number;
      const detail         = ctx.getNodeParameter('detail', i) as string;
      const detailkey      = ctx.getNodeParameter('detailkey', i) as string;
      const ignoreexisting = ctx.getNodeParameter('ignoreexisting', i, false) as boolean;
      return api({ '@name': 'addlink', entity, key, detail, detailkey, ignoreexisting });
    }

    // API: deletelink function
    case 'deleteLink': {
      const entity    = ctx.getNodeParameter('entity', i) as string;
      const key       = ctx.getNodeParameter('entityKey', i) as number;
      const detail    = ctx.getNodeParameter('detail', i) as string;
      const detailkey = ctx.getNodeParameter('detailkey', i) as string;
      return api({ '@name': 'deletelink', entity, key, detail, detailkey });
    }

    // API: edit context + insertDetail function
    case 'insertDetail': {
      const entity    = ctx.getNodeParameter('entity', i) as string;
      const key       = ctx.getNodeParameter('entityKey', i) as number;
      const detail    = ctx.getNodeParameter('insertDetailEntity', i) as string;
      const detailkey = ctx.getNodeParameter('insertDetailKey', i) as string;
      return edit(entity, key, { '@name': 'insertDetail', detail, detailkey });
    }

    // API: edit context + updateDetail function
    case 'updateDetail': {
      const entity    = ctx.getNodeParameter('entity', i) as string;
      const key       = ctx.getNodeParameter('entityKey', i) as number;
      const detail    = ctx.getNodeParameter('updateDetailEntity', i) as string;
      const detailkey = ctx.getNodeParameter('updateDetailKey', i) as string;
      const fields    = parseJson(ctx.getNodeParameter('updateDetailFields', i) as string | IDataObject);
      return edit(entity, key, { '@name': 'updateDetail', detail, detailkey, '@data': fields });
    }

    // API: edit context + deleteDetail function
    case 'deleteDetail': {
      const entity    = ctx.getNodeParameter('entity', i) as string;
      const key       = ctx.getNodeParameter('entityKey', i) as number;
      const detail    = ctx.getNodeParameter('deleteDetailEntity', i) as string;
      const detailkey = ctx.getNodeParameter('deleteDetailKey', i) as string;
      return edit(entity, key, { '@name': 'deleteDetail', detail, detailkey });
    }

    // API: edit context + clearDetail function
    case 'clearDetail': {
      const entity = ctx.getNodeParameter('entity', i) as string;
      const key    = ctx.getNodeParameter('entityKey', i) as number;
      const detail = ctx.getNodeParameter('clearDetailEntity', i) as string;
      return edit(entity, key, { '@name': 'clearDetail', detail });
    }

    // ── Notification ─────────────────────────────────────────────────────────

    // API: sendnotification function
    case 'sendNotification': {
      const users        = ctx.getNodeParameter('users', i) as string;
      const subject      = ctx.getNodeParameter('subject', i) as string;
      const body         = ctx.getNodeParameter('body', i, '') as string;
      const entity       = ctx.getNodeParameter('notifEntity', i, '') as string;
      const key          = ctx.getNodeParameter('notifKey', i, 0) as number;
      const customparams = ctx.getNodeParameter('customparams', i, '') as string;
      const func: IDataObject = { '@name': 'sendnotification', users, subject };
      if (body)         func['body']         = body;
      if (entity)       func['entity']       = entity;
      if (key)          func['key']          = key;
      if (customparams) func['customparams'] = customparams;
      return api(func);
    }

    // ── Custom ────────────────────────────────────────────────────────────────

    case 'custom': {
      const raw  = ctx.getNodeParameter('rpcBody', i) as string | IDataObject[];
      const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(body)) throw new NodeOperationError(ctx.getNode(), 'API Request Body must be a JSON array');
      return body as IDataObject[];
    }

    default:
      throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${op}`);
  }
}

// Inspect an Efficy JSON API response for embedded errors.
// Efficy always returns HTTP 200; errors are reported as "#error" fields
// either at the context level or inside individual "@func" entries.
// "#error" can be a descriptive string or the boolean true (flag only);
// in the latter case the actual message is in "#message" if present,
// otherwise the whole object is serialised so the caller can see it.
function extractEfficyError(response: unknown): string | null {
  if (!Array.isArray(response)) return null;
  for (const ctx of response as IDataObject[]) {
    const msg = readEfficyErrorField(ctx);
    if (msg) return msg;
    const funcs = ctx['@func'];
    if (Array.isArray(funcs)) {
      for (const fn of funcs as IDataObject[]) {
        const fnMsg = readEfficyErrorField(fn);
        if (fnMsg) return fnMsg;
      }
    }
  }
  return null;
}

function readEfficyErrorField(obj: IDataObject): string | null {
  const err = obj['#error'];
  if (!err) return null;
  if (typeof err === 'string') return err;
  // boolean true at context level: just a flag, real error is in @func — skip
  if (err === true) return null;
  // object: { errorcode, errorstring, detail }
  if (typeof err === 'object') {
    const e = err as IDataObject;
    const header: string[] = [];
    if (e['detail'])    header.push(String(e['detail']));
    if (e['errorcode']) header.push(String(e['errorcode']));
    const lines: string[] = [];
    if (header.length)      lines.push(header.join(' '));
    if (e['errorstring'])   lines.push(String(e['errorstring']));
    return lines.length ? lines.join('\n') : JSON.stringify(err);
  }
  return null;
}

// Extracts the X-Efficy-Cachetoken from response headers.
function extractCacheToken(headers: Record<string, string | string[]>): string {
  const raw = headers?.['x-efficy-cachetoken'];
  if (!raw) return '';
  return Array.isArray(raw) ? raw[0] : raw;
}

function parseJson(value: string | IDataObject): IDataObject {
  if (typeof value === 'string') {
    try { return JSON.parse(value) as IDataObject; }
    catch { throw new ApplicationError('Fields (JSON) is not valid JSON'); }
  }
  return value;
}

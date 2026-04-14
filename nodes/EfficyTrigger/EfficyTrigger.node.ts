import type {
  IHookFunctions,
  IWebhookFunctions,
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

/**
 * efficy Enterprise Trigger node — "On efficy Enterprise event"
 *
 * This node exposes an n8n webhook URL that you register in efficy Designer
 * (SYS_WEBHOOKS table). When efficy fires a webhook, this node receives the
 * payload and starts the workflow.
 *
 * Setup:
 *   1. Activate the workflow — n8n generates a unique webhook URL.
 *   2. In efficy Designer → Content Management → WebHooks, click + (top right):
 *        URL        : <the URL shown in this node>
 *        Operations : Create / Update / Delete as needed
 *
 * efficy webhook payload structure:
 *   {
 *     database : string
 *     version  : string
 *     records  : [{
 *       table     : number   — efficy table ID (e.g. 11000 = Cont)
 *       key       : number   — record primary key
 *       operation : string   — "Create" | "Update" | "Delete"
 *       user      : string   — efficy user code
 *       subject   : string   — record subject/name
 *       fields    : object   — changed field values (on update)
 *       date      : string   — ISO 8601 timestamp
 *     }]
 *   }
 *
 * One n8n item is emitted per record in the payload.
 */
// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool -- trigger nodes are passive receivers; usableAsTool causes a Maximum call stack size exceeded at runtime
export class EfficyTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'efficy Enterprise CRM Trigger',
    name: 'efficyTrigger',
    icon: 'file:efficy.svg',
    group: ['trigger'],
    version: 1,
    description:
      'Starts the workflow when efficy Enterprise fires a webhook event (record created, updated or deleted)',
    defaults: { name: 'efficy Enterprise CRM' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'efficy-event',
      },
    ],
    properties: [
      // ── Setup notice ─────────────────────────────────────────────────────────
      {
        displayName:
          'Setup: Activate this workflow to generate the webhook URL (shown at the top of this panel under "Webhook URLs"). Then in efficy Designer → Content Management → WebHooks, click the + button (top right) and paste that URL as Target URL.',
        name: 'setupNotice',
        type: 'notice',
        default: '',
      },
      // ── Operation ─────────────────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'filterOperation',
        type: 'options',
        options: [
          { name: 'Any', value: '' },
          { name: 'Create', value: 'Create' },
          { name: 'Update', value: 'Update' },
          { name: 'Delete', value: 'Delete' },
        ],
        default: '',
        description: 'Only emit items for this operation. Select "Any" to receive all operations.',
      },
      // ── Options collection ────────────────────────────────────────────────────
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        default: {},
        options: [
          {
            displayName: 'Include Raw Headers',
            name: 'includeHeaders',
            type: 'boolean',
            default: false,
            description: 'Whether to include the raw HTTP request headers in the output',
          },
        ],
      },
    ],
  };

  /**
   * Lifecycle hooks called by n8n when the workflow is activated / deactivated.
   *
   * This node is a PASSIVE receiver — the webhook must be registered manually
   * in efficy Designer (SYS_WEBHOOKS). The hooks here are intentionally no-ops.
   */
  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        return true;
      },
    },
  };

  /**
   * Called by n8n for every incoming POST request to the webhook URL.
   * Emits one n8n item per record in the efficy payload.
   */
  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData() as IDataObject;
    const headerData = this.getHeaderData() as Record<string, string>;

    // ── Parse efficy payload ──────────────────────────────────────────────────
    // n8n may wrap the request as { body, headers, query } or deliver the parsed
    // JSON body directly — depending on Content-Type and n8n version.
    // We resolve the actual body with the following priority:
    //   1. bodyData.body  (n8n wraps the request object)
    //   2. bodyData itself if it has a "records" key  (direct JSON parse)
    //   3. rawBody string fallback (Content-Type not application/json)
    let parsedBody: IDataObject = bodyData;

    if (bodyData.body && typeof bodyData.body === 'object') {
      parsedBody = bodyData.body as IDataObject;
    } else if (!Array.isArray(bodyData.records) && Object.keys(bodyData).length === 0) {
      try {
        const req = this.getRequestObject();
        const raw = (req as unknown as { rawBody?: string | Buffer }).rawBody;
        if (raw) {
          parsedBody = JSON.parse(raw.toString()) as IDataObject;
        }
      } catch {
        // rawBody unavailable or not JSON — fall through with empty body
      }
    }

    const records = Array.isArray(parsedBody.records)
      ? (parsedBody.records as IDataObject[])
      : [parsedBody];

    // ── Filter ────────────────────────────────────────────────────────────────
    const filterOperation = this.getNodeParameter('filterOperation', '') as string;

    // ── Options ───────────────────────────────────────────────────────────────
    const options = this.getNodeParameter('options', {}) as {
      includeHeaders?: boolean;
    };

    // ── Build output items — one per record ───────────────────────────────────
    const outputItems: INodeExecutionData[] = [];

    for (const record of records) {
      if (filterOperation && record.operation !== filterOperation) {
        continue;
      }

      const item: IDataObject = {
        database: parsedBody.database,
        version: parsedBody.version,
        table: record.table,
        key: record.key,
        operation: record.operation,
        user: record.user,
        subject: record.subject,
        fields: record.fields ?? {},
        date: record.date,
      };

      if (options.includeHeaders) {
        item.headers = headerData as unknown as IDataObject;
      }

      outputItems.push({ json: item });
    }

    if (outputItems.length === 0) {
      return { workflowData: [[]] };
    }

    return { workflowData: [outputItems] };
  }
}

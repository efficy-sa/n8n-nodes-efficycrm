# n8n-nodes-efficycrm

This package provides two [n8n](https://n8n.io/) community nodes for [efficy Enterprise CRM](https://www.efficy.com):

- **efficy Enterprise CRM Trigger** — trigger node that starts a workflow when efficy fires a webhook
- **efficy Enterprise CRM** — action node that calls the efficy JSON API

## Requirements

- n8n version **1.0.0** or later
- efficy Enterprise CRM (any version supporting the JSON API)

## Nodes

### efficy Enterprise CRM Trigger

Starts a workflow when efficy fires a webhook event (entity created, updated, or deleted).

**Setup:**
1. Activate the workflow in n8n — a unique webhook URL is generated.
2. In efficy Designer → Content Management → WebHooks, click **+** (top right) and paste the URL as Target URL.

**Output fields:** `database`, `version`, `table`, `key`, `operation`, `user`, `subject`, `fields`, `date`

**Filter:** optionally restrict to Create, Update or Delete events only.

### efficy Enterprise CRM

Calls the efficy Enterprise JSON API (`POST /json`).

Each resource includes a **Custom API Call** operation to write a raw JSON request body when none of the built-in operations cover your use case.

**Operations:**

*Entity*
- **Consult** — read a single entity by key
- **Create** — create a new entity
- **Update** — update fields on an existing entity
- **Delete** — delete one or more entities

*Relation*
- **Add Link** — add a relation between two entities
- **Delete Link** — remove a relation between two entities
- **Insert Detail** — add a detail relation in an edit context
- **Update Detail** — update fields of a detail relation
- **Delete Detail** — remove a specific detail relation
- **Delete All Relations** — remove all detail relations of a given entity

*Query*
- **Run Query** — execute a saved query by key
- **Consult Many Entities** — find entities matching exact field values (`consultmanyex`)

*Search*
- **Fast Search** — index-based fast search on the entity grid
- **Full Text Search** — full-text search across all fields
- **Elastic Search** — Elasticsearch-powered full-text search

*Utils*
- **Get Lookup Data** — return all values for a lookup list field
- **Get Lookup Key From Value** — resolve a lookup label to its numeric key
- **Get Lookup Value From Key** — resolve a lookup key to its label
- **Get Setting** — read an efficy server setting by name
- **Get Current User Code** — return the authenticated user's user code
- **Get Current User Full Name** — return the authenticated user's full name
- **Send Notification** — send a notification to efficy users or groups

## Credentials

### efficy Enterprise API

| Field | Description |
|---|---|
| Server URL | Base URL of your efficy server (e.g. `https://mycompany.efficy.com`) |
| API Key | efficy API key with access to the `/json` endpoint |
| Language | Language code sent as `X-Efficy-Lang` header (affects translated field values) |
| Server Side Cache | Reuse the same server-side cache across all nodes in a workflow execution |

**How to create an API key in efficy:**
1. Go to Designer → Security → API Keys → New
2. Set "Whitelist API" to include `json`
3. Copy the generated key into the n8n credential

Authentication is performed via the `X-Efficy-Apikey` HTTP header.

## License

MIT

## Resources

- [efficy JSON API function reference](https://help.efficy.io/edn/rpcrequests)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

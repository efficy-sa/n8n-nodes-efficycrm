import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
  Icon,
} from 'n8n-workflow';

/**
 * efficy Enterprise API credential.
 *
 * Authentication: API key sent as the `X-Efficy-Apikey` header.
 * The API key must be created in efficy Conficy with access to the /json endpoint.
 *
 * How to create an API key in efficy:
 *   Conficy → Security → API Keys → New
 *   Set "Whitelist API" to include "json"
 *
 * Cache reuse: when "Reuse Cache" is enabled, a single server-side cache is
 * established once per workflow execution and shared across all efficy nodes
 * in that execution. Cache entries are tracked in workflow static data (keyed
 * by execution ID) and automatically cleaned up after 2 hours of inactivity.
 */
export class EfficyApi implements ICredentialType {
  name = 'efficyApi';
  displayName = 'Efficy Enterprise API';
  documentationUrl = 'https://help.efficy.io/edn/rpcrequests';
  icon: Icon = 'file:efficy.svg';

  properties: INodeProperties[] = [
    {
      displayName: 'Server URL',
      name: 'serverUrl',
      type: 'string',
      default: '',
      placeholder: 'https://mycompany.efficy.com/crm',
      description: 'Base URL of your efficy server. If it does not end with /crm, it will be appended automatically.',
      required: true,
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'efficy API key. Create one in Conficy → Security → API Keys with /json access.',
      required: true,
    },
    {
      displayName: 'Language',
      name: 'language',
      type: 'options',
      options: [
        { name: 'English',                value: 'EN' },
        { name: 'Français (French)',       value: 'FR' },
        { name: 'Nederlands (Dutch)',      value: 'NL' },
        { name: 'Deutsch (German)',        value: 'DE' },
        { name: 'Español (Spanish)',       value: 'ES' },
        { name: '简体中文 (Chinese)',       value: 'ZH' },
        { name: 'Hrvatski (Croatian)',     value: 'HR' },
        { name: 'Čeština (Czech)',         value: 'CS' },
        { name: 'Dansk (Danish)',          value: 'DA' },
        { name: 'Ελληνικά (Greek)',        value: 'EL' },
        { name: 'Magyar (Hungarian)',      value: 'HU' },
        { name: 'Italiano (Italian)',      value: 'IT' },
        { name: '日本語 (Japanese)',        value: 'JA' },
        { name: 'Norsk (Norwegian)',       value: 'NO' },
        { name: 'Polski (Polish)',         value: 'PL' },
        { name: 'Português (Portuguese)', value: 'PT' },
        { name: 'Română (Romanian)',       value: 'RO' },
        { name: 'Русский (Russian)',       value: 'RU' },
        { name: 'Slovak (Slovakian)',      value: 'SK' },
        { name: 'Suomi (Finnish)',         value: 'FI' },
        { name: 'Svenska (Swedish)',       value: 'SV' },
        { name: 'Türkçe (Turkish)',        value: 'TR' },
      ],
      default: 'EN',
      description: 'Language sent as X-Efficy-Lang header. Affects translated field values returned by efficy.',
    },
    {
      displayName: 'Customer',
      name: 'customer',
      type: 'string',
      default: '',
      placeholder: 'mycompany',
      description: 'Customer alias sent as X-Efficy-Customer header. Required only when multiple customers share the same efficy URL.',
    },
    {
      displayName: 'Server Side Cache',
      name: 'serverSideCache',
      type: 'boolean',
      default: false,
      description: 'Whether to reuse the same server-side cache across all efficy nodes in a workflow execution. Reduces server load by avoiding repeated cache initialisation. When enabled, finish your workflow with the Tool → Finalize Workflow operation.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'X-Efficy-Apikey': '={{$credentials.apiKey}}',
        'X-Efficy-Lang': '={{$credentials.language}}',
      },
    },
  };

  // Credential test: calls currentuserfullname via the JSON RPC API.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{ $credentials.serverUrl.replace(/\\/+$/, "").endsWith("/crm") ? $credentials.serverUrl.replace(/\\/+$/, "") : $credentials.serverUrl.replace(/\\/+$/, "") + "/crm" }}',
      url: '/json',
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Efficy-Apikey':    '={{ $credentials.apiKey }}',
        'X-Efficy-Lang':      '={{ $credentials.language }}',
        'X-Efficy-Customer':  '={{ $credentials.customer }}',
        'X-Efficy-Logoff':    'true',
      },
      body: JSON.stringify([
        {
          '@name': 'api',
          '@func': [{ '@name': 'currentuserfullname' }],
        },
      ]),
    },
  };
}


import { randomUUID } from 'crypto';
import { InspectorSession } from './InspectorSession';

export interface Page {
  pageId: number;
  title: string;
  url: string;
  type: string;
}

export interface Application {
  id: string;
  name: string;
  bundleId: string;
  pages: Page[];
}

/**
 * WebKit Automation session — wraps InspectorSession with WIR protocol commands.
 */
export class AutomationSession {
  private connectionId = randomUUID();
  private senderId = randomUUID();
  private sessionId: string | null = null;

  constructor(private session: InspectorSession) {}

  async setup(): Promise<void> {
    await this.session.send('_rpc_reportIdentifier:', {
      WIRConnectionIdentifierKey: this.connectionId,
      WIRSenderKey: this.senderId,
    });
  }

  async getConnectedApplications(): Promise<Application[]> {
    const r = await this.session.sendRecv('_rpc_getConnectedApplications:', {
      WIRConnectionIdentifierKey: this.connectionId,
    });
    const apps = r.__argument?.WIRApplicationDictionaryKey ?? {};
    return Object.entries(apps).map(([id, info]: [string, any]) => ({
      id,
      name: info.WIRApplicationNameKey ?? '',
      bundleId: info.WIRApplicationBundleIdentifierKey ?? '',
      pages: [],
    }));
  }

  async getPages(appId: string): Promise<Page[]> {
    const r = await this.session.sendRecv('_rpc_forwardGetListing:', {
      WIRConnectionIdentifierKey: this.connectionId,
      WIRApplicationIdentifierKey: appId,
    });
    const listing = r.__argument?.WIRListingKey ?? {};
    return Object.entries(listing).map(([pid, info]: [string, any]) => ({
      pageId: parseInt(pid, 10),
      title: info.WIRTitleKey ?? '',
      url: info.WIRURLKey ?? '',
      type: info.WIRTypeKey ?? '',
    }));
  }

  async createAutomationSession(appId: string): Promise<string> {
    this.sessionId = randomUUID();
    await this.session.send('_rpc_forwardAutomationSessionRequest:', {
      WIRConnectionIdentifierKey: this.connectionId,
      WIRApplicationIdentifierKey: appId,
      WIRAutomationSessionIdentifierKey: this.sessionId,
    });
    return this.sessionId;
  }

  async navigate(pageId: number, appId: string, url: string): Promise<Record<string, any>> {
    return this._forwardCommand(pageId, appId, 'Page.navigate', { url });
  }

  async evaluate(pageId: number, appId: string, expression: string): Promise<any> {
    const r = await this._forwardCommand(pageId, appId, 'Runtime.evaluate', { expression });
    return r?.result;
  }

  async screenshot(pageId: number, appId: string): Promise<string> {
    const r = await this._forwardCommand(pageId, appId, 'Page.captureScreenshot', {});
    return r?.data ?? '';
  }

  private async _forwardCommand(
    pageId: number,
    appId: string,
    method: string,
    params: Record<string, any>,
  ): Promise<any> {
    const msgId = Math.floor(Math.random() * 100000);
    await this.session.send('_rpc_forwardSocketData:', {
      WIRConnectionIdentifierKey: this.connectionId,
      WIRApplicationIdentifierKey: appId,
      WIRPageIdentifierKey: pageId,
      WIRSessionIdentifierKey: this.sessionId,
      WIRSocketDataKey: Buffer.from(JSON.stringify({ id: msgId, method, params })),
    });
    // Wait for reply
    for await (const msg of this.session.messages()) {
      const data = msg.__argument?.WIRSocketDataKey;
      if (data) {
        try {
          const parsed = JSON.parse(Buffer.isBuffer(data) ? data.toString() : data);
          if (parsed.id === msgId) return parsed.result;
        } catch { /* ignore */ }
      }
    }
    return null;
  }

  async close(): Promise<void> {
    await this.session.close();
  }
}
